/**
 * The monthly partner statement (דו"ח חודשי) for a single rentals branch: the same numbers the
 * owner sees in the unified table on /dashboard/rentals/accounting, itemised and rendered as a
 * standalone HTML document that can be previewed in the browser or emailed to the branch's
 * partner.
 *
 * Sign convention is the one used everywhere in this module (see lib/branch-accounting.ts):
 * positive = the branch/partner owes the owner, negative = the owner owes the branch/partner.
 *
 * The HTML is deliberately old-school - tables, inline styles, no external CSS - because email
 * clients (Gmail, Outlook) strip <style> blocks and ignore flex/grid.
 */
import type { Branch } from "@ultranet/shared-types";
import { getAdminFirestore } from "./firebase-admin";
import {
  computeBranchFinancials,
  settlementExpenseLinesForMonth,
  type BranchAccountingRawData,
  type SettlementExpenseLine,
} from "./branch-accounting-data";
import { buildBranchLedger } from "./branch-ledger";

export interface BranchMonthReport {
  branch: Branch;
  month: string;
  /** Number of paid+returned rentals (and manual income rows) counted this month. */
  rentalCount: number;
  /** Gross collected income for the month, before any owner/partner split. */
  income: number;
  expenseLines: SettlementExpenseLine[];
  /** Total spent on the settlement-relevant expense lines above. */
  expenseTotal: number;
  /** Balance carried in from previous months. */
  openingBalance: number;
  /** This month's settlement on its own. */
  netToOwner: number;
  /** openingBalance + netToOwner - the bottom line. */
  totalDue: number;
  /** Already recorded as transferred for this month. */
  transferredAmount: number;
  /** totalDue - transferredAmount. */
  outstanding: number;
}

export function buildBranchMonthReport(
  branch: Branch,
  raw: BranchAccountingRawData,
  month: string
): BranchMonthReport {
  const f = computeBranchFinancials(branch, raw, month);
  const ledgerRow = buildBranchLedger(branch, raw).rows.find((r) => r.month === month);
  const openingBalance = ledgerRow?.openingBalance ?? 0;
  const totalDue = ledgerRow?.totalDue ?? f.settlementNetToOwner;
  const transferredAmount = ledgerRow?.transferredAmount ?? 0;

  return {
    branch,
    month,
    rentalCount: f.rentalCountThisMonth,
    income: f.grossIncomeThisMonth,
    expenseLines: settlementExpenseLinesForMonth(branch, raw, month),
    expenseTotal: f.settlementExpenseThisMonth,
    openingBalance,
    netToOwner: f.settlementNetToOwner,
    totalDue,
    transferredAmount,
    outstanding: totalDue - transferredAmount,
  };
}

/** Reads the business logo once (same source the dashboard header uses) so it can be embedded at
 *  the top of the report. Returns "" when unset or unreachable - the report falls back to text. */
export async function loadReportLogoUrl(): Promise<string> {
  try {
    const doc = await getAdminFirestore().collection("n_label_settings").doc("default").get();
    return String((doc.data() as { logoUrl?: string } | undefined)?.logoUrl ?? "");
  } catch {
    return "";
  }
}

const HE_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
];

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  if (!y || !m || m < 1 || m > 12) return month;
  return `${HE_MONTHS[m - 1]} ${y}`;
}

function money(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString("he-IL")} ₪`;
}

function signed(n: number): string {
  if (Math.abs(n) < 1) return "0 ₪";
  return `${n > 0 ? "+" : "-"}${money(n)}`;
}

/** Escapes text coming from Firestore (branch/expense names) before it goes into the HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function whoPaid(line: SettlementExpenseLine, partnerName: string, ownerName: string): string {
  return line.paidBy === "partner" ? partnerName : ownerName;
}

function whoOwes(line: SettlementExpenseLine, partnerName: string, ownerName: string): string {
  // A multi-branch expense splits by a free percentage, which owner/partner/50-50 can't express -
  // so state the actual split instead of forcing it into one of those buckets.
  if (line.ownerPct != null) return `${100 - line.ownerPct}% ${partnerName} · ${line.ownerPct}% ${ownerName}`;
  if (line.owedBy === "partner") return partnerName;
  if (line.owedBy === "shared") return "שנינו (50/50)";
  return ownerName;
}

const INK = "#1f2933";
const MUTED = "#6b7785";
const BORDER = "#e3e8ef";
const TEAL = "#0f766e";
const GREEN = "#047857";
const RED = "#b91c1c";

export interface ReportRenderOptions {
  logoUrl?: string;
  ownerName: string;
  /** Rendered as a banner at the top, e.g. for the "this is a test" preview send. */
  testNotice?: string;
}

/**
 * Full standalone HTML document for one branch's monthly statement.
 * Table-based and inline-styled on purpose - see the module comment.
 */
export function renderBranchMonthReportHtml(report: BranchMonthReport, opts: ReportRenderOptions): string {
  const partnerName = report.branch.partnerName?.trim() || "הסניף";
  const ownerName = opts.ownerName;
  const label = monthLabel(report.month);

  // The bottom line, phrased from the partner's point of view - they're the one reading it.
  const due = report.outstanding;
  const balanced = Math.abs(due) < 1;
  const conclusionColor = balanced ? TEAL : due > 0 ? GREEN : RED;
  const conclusionTitle = balanced
    ? "מאוזן - אין מה להעביר"
    : due > 0
      ? `עליך להעביר ${money(due)}`
      : `מגיע לך ${money(due)}`;
  const conclusionBody = balanced
    ? `החשבון בין ${esc(ownerName)} לבין ${esc(partnerName)} מאוזן לחודש ${label}. אין צורך בהעברה.`
    : due > 0
      ? `סך הכל לחודש ${label}, כולל יתרות קודמות, יש להעביר ${money(due)} אל ${esc(ownerName)}.`
      : `סך הכל לחודש ${label}, כולל יתרות קודמות, ${esc(ownerName)} יעביר אליך ${money(due)}.`;

  const expenseRows =
    report.expenseLines.length === 0
      ? `<tr><td colspan="4" style="padding:14px;text-align:center;color:${MUTED};font-size:13px;border-top:1px solid ${BORDER}">אין הוצאות משותפות החודש</td></tr>`
      : report.expenseLines
          .map(
            (line, i) => `
            <tr style="background:${i % 2 === 1 ? "#fafbfc" : "#ffffff"}">
              <td style="padding:8px 10px;border-top:1px solid ${BORDER};font-size:13px;color:${INK}">${esc(line.desc)}${
                line.recurring ? `<span style="color:${MUTED};font-size:11px"> (קבועה)</span>` : ""
              }</td>
              <td style="padding:8px 10px;border-top:1px solid ${BORDER};font-size:13px;color:${MUTED}">${esc(
                whoPaid(line, partnerName, ownerName)
              )}</td>
              <td style="padding:8px 10px;border-top:1px solid ${BORDER};font-size:13px;color:${MUTED}">${esc(
                whoOwes(line, partnerName, ownerName)
              )}</td>
              <td style="padding:8px 10px;border-top:1px solid ${BORDER};font-size:13px;color:${INK};font-weight:700;white-space:nowrap">${money(
                line.amount
              )}</td>
            </tr>${
              line.ownerPct != null
                ? `<tr style="background:${i % 2 === 1 ? "#fafbfc" : "#ffffff"}"><td colspan="4" style="padding:0 10px 8px;font-size:11px;color:${MUTED}">חלקך בהוצאה משותפת שהתחלקה בין כמה סניפים</td></tr>`
                : ""
            }`
          )
          .join("");

  const summaryRow = (labelText: string, value: string, color: string, bold = false) => `
    <tr>
      <td style="padding:9px 12px;border-top:1px solid ${BORDER};font-size:13px;color:${MUTED}">${labelText}</td>
      <td style="padding:9px 12px;border-top:1px solid ${BORDER};font-size:${bold ? "16px" : "13px"};font-weight:${
        bold ? "800" : "700"
      };color:${color};text-align:left;white-space:nowrap">${value}</td>
    </tr>`;

  const header = opts.logoUrl
    ? `<img src="${esc(opts.logoUrl)}" alt="אולטרנט" style="height:52px;width:auto;display:block;margin:0 auto" />`
    : `<div style="font-size:26px;font-weight:800;color:${TEAL};text-align:center">אולטרנט</div>`;

  const testBanner = opts.testNotice
    ? `<div style="background:#fef3c7;border:1px solid #fcd34d;color:#92400e;border-radius:8px;padding:10px 14px;margin-bottom:16px;font-size:13px;font-weight:700;text-align:center">${esc(
        opts.testNotice
      )}</div>`
    : "";

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>דו"ח חודשי - ${esc(report.branch.name)} - ${label}</title>
</head>
<body style="margin:0;padding:24px 12px;background:#f4f6f9;font-family:Arial,'Segoe UI',Helvetica,sans-serif;color:${INK}" dir="rtl">
<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;max-width:640px;margin:0 auto;border-collapse:collapse">
<tr><td>
  ${testBanner}
  <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;overflow:hidden">
    <tr>
      <td style="padding:22px 20px 16px;border-bottom:1px solid ${BORDER}">
        ${header}
        <div style="margin-top:14px;text-align:center">
          <div style="font-size:19px;font-weight:800;color:${INK}">דו"ח התחשבנות חודשי</div>
          <div style="margin-top:4px;font-size:14px;color:${MUTED}">${esc(report.branch.name)} · ${label}</div>
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:18px 20px 4px">
        <div style="font-size:13px;font-weight:800;color:${MUTED};letter-spacing:.02em">הכנסות החודש</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:6px">
          ${summaryRow("מספר השכרות שנגבו", String(report.rentalCount), INK)}
          ${summaryRow('סה"כ הכנסות', money(report.income), GREEN, true)}
        </table>
      </td>
    </tr>

    <tr>
      <td style="padding:18px 20px 4px">
        <div style="font-size:13px;font-weight:800;color:${MUTED};letter-spacing:.02em">הוצאות משותפות החודש</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:6px">
          <tr style="background:#f4f6f9">
            <td style="padding:7px 10px;font-size:11px;font-weight:800;color:${MUTED}">תיאור</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:800;color:${MUTED}">מי שילם</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:800;color:${MUTED}">על חשבון מי</td>
            <td style="padding:7px 10px;font-size:11px;font-weight:800;color:${MUTED}">סכום</td>
          </tr>
          ${expenseRows}
          <tr style="background:#f4f6f9">
            <td colspan="3" style="padding:9px 10px;border-top:2px solid ${BORDER};font-size:13px;font-weight:800;color:${INK}">סה"כ הוצאות</td>
            <td style="padding:9px 10px;border-top:2px solid ${BORDER};font-size:14px;font-weight:800;color:${INK};white-space:nowrap">${money(
              report.expenseTotal
            )}</td>
          </tr>
        </table>
        <div style="margin-top:8px;font-size:11px;color:${MUTED};line-height:1.6">
          מופיעות כאן רק הוצאות שיש עליהן התחשבנות בינינו - הוצאות משותפות, או הוצאות שצד אחד שילם
          עבור הצד השני. הוצאה שהיא כולה על חשבון מי ששילם אותה אינה חלק מהחשבון הזה.
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:18px 20px 4px">
        <div style="font-size:13px;font-weight:800;color:${MUTED};letter-spacing:.02em">חישוב ההתחשבנות</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;margin-top:6px">
          ${summaryRow("יתרה מחודש קודם", signed(report.openingBalance), report.openingBalance >= 0 ? GREEN : RED)}
          ${summaryRow("התחשבנות החודש", signed(report.netToOwner), report.netToOwner >= 0 ? GREEN : RED)}
          ${summaryRow('סה"כ כולל חודש קודם', signed(report.totalDue), report.totalDue >= 0 ? GREEN : RED)}
          ${
            Math.abs(report.transferredAmount) > 0.5
              ? summaryRow("כבר הועבר", signed(report.transferredAmount), MUTED)
              : ""
          }
        </table>
        <div style="margin-top:8px;font-size:11px;color:${MUTED};line-height:1.6">
          סכום חיובי = מגיע ל${esc(ownerName)}. סכום שלילי = ${esc(ownerName)} חייב לך.
        </div>
      </td>
    </tr>

    <tr>
      <td style="padding:18px 20px 22px">
        <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse;background:#f8fafb;border:2px solid ${conclusionColor};border-radius:10px">
          <tr>
            <td style="padding:16px 18px;text-align:center">
              <div style="font-size:12px;font-weight:800;color:${MUTED};letter-spacing:.04em">שורה תחתונה</div>
              <div style="margin-top:6px;font-size:24px;font-weight:800;color:${conclusionColor}">${conclusionTitle}</div>
              <div style="margin-top:8px;font-size:13px;color:${INK};line-height:1.7">${conclusionBody}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="margin-top:14px;text-align:center;font-size:11px;color:${MUTED};line-height:1.7">
    הדו"ח הופק אוטומטית ממערכת אולטרנט. לשאלות או אי-התאמה - השב למייל הזה.
  </div>
</td></tr>
</table>
</body>
</html>`;
}

/** Subject line for the emailed version of the report above. */
export function branchMonthReportSubject(report: BranchMonthReport): string {
  return `דו"ח התחשבנות ${monthLabel(report.month)} - ${report.branch.name}`;
}
