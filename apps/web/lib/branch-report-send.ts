/**
 * הפקה ושליחה של הדו"ח החודשי לסניפים.
 *
 * One place builds the message, so the browser preview, the test send and the automatic monthly
 * run can never drift apart: they all call buildBranchReportEmail() and differ only in what they
 * do with the result.
 *
 * The `reportSentAt` stamp lives on the branch's n_branch_transfers doc for that month (the
 * record that already represents "this branch, this month's settlement"), so a month can't be
 * mailed out twice by accident - the automatic run skips anything already sent.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { currentMonth, loadBranchAccountingRawData, type BranchAccountingRawData } from "./branch-accounting-data";
import { previousMonth } from "./fixed-expense-revision";
import {
  buildBranchMonthReport,
  branchMonthReportSubject,
  loadReportLogoUrl,
  renderBranchMonthReportHtml,
} from "./branch-month-report";
import { logoForEmail } from "./email-logo";
import { loadReportRecipients } from "./branch-report-recipients";
import { sendHtmlEmail, type SendResult } from "./mailer";
import { getOwnerName } from "./owner-name";

export interface BuiltReportEmail {
  subject: string;
  html: string;
  inlineImages: NonNullable<Parameters<typeof sendHtmlEmail>[0]["inlineImages"]>;
}

export function buildBranchReportEmail(params: {
  branch: Branch;
  raw: BranchAccountingRawData;
  month: string;
  logoUrl: string;
  ownerName: string;
  testNotice?: string;
}): BuiltReportEmail {
  const report = buildBranchMonthReport(params.branch, params.raw, params.month);
  const logo = logoForEmail(params.logoUrl);
  const html = renderBranchMonthReportHtml(report, {
    logoUrl: logo.src ?? "",
    ownerName: params.ownerName,
    testNotice: params.testNotice,
  });
  return {
    subject: branchMonthReportSubject(report),
    html,
    inlineImages: logo.attachment ? [logo.attachment] : [],
  };
}

/**
 * החודש שהדו"ח החודשי עוסק בו כברירת מחדל: **החודש הקודם**, זה שכבר נסגר.
 *
 * דו"ח על החודש הנוכחי הוא דו"ח על חודש שעוד לא נגמר - הוא כולל כבר את ההוצאות הקבועות של
 * החודש החדש (שכירות וכו' נזקפות מה-1 לחודש) בלי ההכנסות שלו, ושותף שמקבל אותו רואה חוב
 * שלא קיים. לכן הוא לעולם לא נשלח.
 */
export function reportMonthFor(now: string = currentMonth()): string {
  return previousMonth(now);
}

/** null כשמותר לשלוח דו"ח על החודש הזה; אחרת הסיבה בעברית. מותר רק חודש שכבר נסגר. */
export function reportMonthError(month: string): string | null {
  if (!/^\d{4}-\d{2}$/.test(month)) return "חודש לא תקין";
  if (month >= currentMonth()) return 'אי אפשר לשלוח דו"ח על חודש שעוד לא נגמר - רק על חודש שנסגר';
  return null;
}

export interface BranchSendOutcome {
  branchId: string;
  branchName: string;
  email: string | null;
  ok: boolean;
  message: string;
}

/** Stamps "the statement for this month was mailed" onto the branch/month settlement record. */
async function markReportSent(branchId: string, month: string): Promise<void> {
  await getAdminFirestore()
    .collection("n_branch_transfers")
    .doc(`${branchId}_${month}`)
    .set({ branchId, month, reportSentAt: new Date().toISOString() }, { merge: true });
}

/**
 * Sends the month's statement to every rentals branch that has an address on file.
 * `skipAlreadySent` is what makes the automatic monthly run safe to re-trigger: a branch whose
 * report already went out for that month is reported as skipped rather than mailed again.
 */
export async function sendMonthlyReports(params: {
  month: string;
  ownerDisplayName?: string | null;
  skipAlreadySent: boolean;
  /** רק לסניפים האלה ("שליחה לסניפים נבחרים"). חסר = כל הסניפים. */
  branchIds?: string[];
}): Promise<BranchSendOutcome[]> {
  // השומר האחרון: גם אם מסך כלשהו יעביר את החודש הנוכחי, לשותפים לא ייצא דו"ח על חודש פתוח.
  const monthError = reportMonthError(params.month);
  if (monthError) return [{ branchId: "", branchName: "", email: null, ok: false, message: monthError }];

  const raw = await loadBranchAccountingRawData();
  const only = params.branchIds ? new Set(params.branchIds) : null;
  // A branch of mine gets no statement and no transfer instructions: there is nobody on the other
  // side to instruct. Sending one would tell me to transfer money to myself.
  const branches = raw.branches.filter(
    (b) =>
      b.branchType === "rentals" &&
      !b.deleted &&
      !b.notStarted &&
      b.isMine === false &&
      (!only || only.has(b.id)),
  );

  const [logoUrl, ownerName, recipients] = await Promise.all([
    loadReportLogoUrl(),
    getOwnerName(params.ownerDisplayName),
    loadReportRecipients(branches),
  ]);
  const recipientByBranch = new Map(recipients.map((r) => [r.branchId, r]));

  const outcomes: BranchSendOutcome[] = [];
  for (const branch of branches) {
    const recipient = recipientByBranch.get(branch.id);
    const email = recipient?.email ?? null;
    const base = { branchId: branch.id, branchName: branch.name, email };

    if (!email) {
      outcomes.push({ ...base, ok: false, message: "אין כתובת מייל מוגדרת לסניף" });
      continue;
    }

    const alreadySent = !!raw.transfersByBranchMonth.get(`${branch.id}|${params.month}`)?.reportSentAt;
    if (params.skipAlreadySent && alreadySent) {
      outcomes.push({ ...base, ok: true, message: "כבר נשלח לחודש הזה - דולג" });
      continue;
    }

    const { subject, html, inlineImages } = buildBranchReportEmail({
      branch,
      raw,
      month: params.month,
      logoUrl,
      ownerName,
    });
    const result: SendResult = await sendHtmlEmail({ to: email, subject, html, inlineImages });
    if (result.ok) await markReportSent(branch.id, params.month);
    outcomes.push({ ...base, ok: result.ok, message: result.message });
  }

  return outcomes;
}

/**
 * התזכורת שבדף הבית: "עליך לשלוח את הדו"ח החודשי".
 *
 * השליחה ידנית בלבד (ה-cron הושבת), ולכן משהו צריך להזכיר לשלוח. מחזיר את החודש הקודם ואת
 * הסניפים שיש להם כתובת מייל ועוד לא קיבלו את הדו"ח שלו; null כשאין למי לשלוח. התזכורת
 * נשארת מה-1 לחודש ועד שהדו"ח נשלח לכולם - לא נעלמת ב-2 לחודש אם לא שלחו.
 */
export async function loadPendingReportReminder(): Promise<{ month: string; branchNames: string[] } | null> {
  const month = reportMonthFor();
  const db = getAdminFirestore();
  const [branchesSnap, transfersSnap] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_branch_transfers").where("month", "==", month).get(),
  ]);
  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    // אותו סינון בדיוק כמו ב-sendMonthlyReports - מי שלא יקבל מייל לא צריך תזכורת.
    .filter((b) => b.branchType === "rentals" && !b.deleted && !b.notStarted && b.isMine === false);
  const sent = new Set(
    transfersSnap.docs
      .map((d) => d.data() as { branchId?: string; reportSentAt?: string })
      .filter((t) => t.reportSentAt && t.branchId)
      .map((t) => t.branchId as string),
  );
  const unsent = branches.filter((b) => !sent.has(b.id));
  if (unsent.length === 0) return null;
  const recipients = await loadReportRecipients(unsent);
  const branchNames = recipients.filter((r) => r.email).map((r) => r.branchName);
  return branchNames.length > 0 ? { month, branchNames } : null;
}
