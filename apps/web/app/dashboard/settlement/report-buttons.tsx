"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Mail, Send, X, Check, AlertTriangle } from "lucide-react";
import { useToast } from "@/lib/toast";
import type { ReportRecipient } from "@/lib/branch-report-recipients";
import type { BranchSendOutcome } from "@/lib/branch-report-send";
import { sendBranchReportAction, sendMonthlyReportsAction } from "./report-actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4" dir="rtl">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-card border border-card-border bg-white p-5 shadow-lg">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-ink">{title}</h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink">
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/**
 * הפקת הדו"ח החודשי: תצוגה מקדימה, שליחת מייל בדיקה, ושליחה לכל הסניפים.
 *
 * The two selects in the test dialog are independent on purpose - "לאיזה מייל לשלוח" and
 * "של איזה סניף הדו"ח" - so any branch's statement can be sent to your own address for checking
 * before a partner ever receives one.
 */
export function ReportButtons({
  month,
  monthLabel,
  recipients,
  ownerEmail,
  mailerError,
  sandboxNotice,
}: {
  month: string;
  monthLabel: string;
  recipients: ReportRecipient[];
  ownerEmail: string | null;
  /** null when sending is configured; otherwise the Hebrew reason it isn't. */
  mailerError: string | null;
  /** set when sending works but only reaches your own inbox (Resend's sandbox sender). */
  sandboxNotice: string | null;
}) {
  const withEmail = recipients.filter((r) => r.email);
  const missingEmail = recipients.filter((r) => !r.email);

  const [testOpen, setTestOpen] = useState(false);
  const [allOpen, setAllOpen] = useState(false);
  const [toEmail, setToEmail] = useState(ownerEmail ?? withEmail[0]?.email ?? "");
  const [branchId, setBranchId] = useState(recipients[0]?.branchId ?? "");
  const [outcomes, setOutcomes] = useState<BranchSendOutcome[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  const previewHref = `/dashboard/settlement/report-preview?month=${month}${
    branchId ? `&branchId=${branchId}` : ""
  }`;

  function sendTest() {
    if (!toEmail || !branchId) {
      showError("צריך לבחור גם כתובת מייל וגם סניף");
      return;
    }
    startTransition(async () => {
      try {
        const result = await sendBranchReportAction(branchId, month, toEmail);
        if (result.ok) {
          showSuccess(result.message);
          setTestOpen(false);
        } else {
          showError(result.message);
        }
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשליחה");
      }
    });
  }

  function sendAll() {
    startTransition(async () => {
      try {
        const results = await sendMonthlyReportsAction(month);
        setOutcomes(results);
        router.refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשליחה");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={previewHref}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-sm font-bold text-ink transition hover:bg-[#f1f5f9]"
      >
        <Eye className="h-4 w-4" />
        תצוגה מקדימה
      </Link>
      <button
        type="button"
        onClick={() => setTestOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] border border-card-border bg-white px-3 py-1.5 text-sm font-bold text-ink transition hover:bg-[#f1f5f9]"
      >
        <Mail className="h-4 w-4" />
        שלח מייל לבדיקה
      </button>
      <button
        type="button"
        onClick={() => {
          setOutcomes(null);
          setAllOpen(true);
        }}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-3 py-1.5 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        <Send className="h-4 w-4" />
        שלח לכל הסניפים
      </button>

      {testOpen && (
        <Modal title='שליחת דו"ח לבדיקה' onClose={() => setTestOpen(false)}>
          {mailerError && (
            <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
              {mailerError}
            </p>
          )}
          {!mailerError && sandboxNotice && (
            <p className="mb-3 rounded-lg border border-sky-300 bg-sky-50 px-3 py-2 text-[12px] leading-relaxed text-sky-900">
              {sandboxNotice}
            </p>
          )}
          <div className="flex flex-col gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted">לאיזה מייל לשלוח</span>
              <select value={toEmail} onChange={(e) => setToEmail(e.target.value)} className={FIELD}>
                {ownerEmail && <option value={ownerEmail}>{`המייל שלי — ${ownerEmail}`}</option>}
                {withEmail.map((r) => (
                  <option key={r.branchId} value={r.email as string}>
                    {`${r.branchName} — ${r.email}`}
                  </option>
                ))}
              </select>
              {withEmail.length === 0 && !ownerEmail && (
                <span className="text-[11px] text-red-600">אין אף כתובת מייל מוגדרת במערכת</span>
              )}
            </label>

            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-bold text-muted">של איזה סניף הדו&quot;ח</span>
              <select value={branchId} onChange={(e) => setBranchId(e.target.value)} className={FIELD}>
                {recipients.map((r) => (
                  <option key={r.branchId} value={r.branchId}>
                    {r.branchName}
                  </option>
                ))}
              </select>
            </label>

            <p className="text-[11px] leading-relaxed text-muted">
              הדו&quot;ח שיישלח הוא של {monthLabel}. מייל בדיקה לא נרשם כ&quot;נשלח&quot; ולא ימנע שליחה אמיתית
              לסניף הזה אחר כך.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={sendTest}
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "שולח..." : "שלח"}
              </button>
              <Link
                href={previewHref}
                className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#f1f5f9]"
              >
                תצוגה מקדימה
              </Link>
            </div>
          </div>
        </Modal>
      )}

      {allOpen && (
        <Modal title={`שליחת הדו"ח לכל הסניפים — ${monthLabel}`} onClose={() => setAllOpen(false)}>
          {outcomes ? (
            <div className="flex flex-col gap-2">
              {outcomes.map((o) => (
                <div
                  key={o.branchId || o.message}
                  className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                    o.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                  }`}
                >
                  {o.ok ? (
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                  ) : (
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                  )}
                  <div>
                    <div className="font-bold text-ink">{o.branchName || "—"}</div>
                    <div className={o.ok ? "text-emerald-800" : "text-red-700"}>{o.message}</div>
                  </div>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setAllOpen(false)}
                className="mt-1 self-start rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#f1f5f9]"
              >
                סגירה
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {mailerError && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                  {mailerError}
                </p>
              )}
              {!mailerError && sandboxNotice && (
                <p className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-[12px] font-bold leading-relaxed text-red-800">
                  {sandboxNotice} כלומר שליחה לסניפים תיכשל כרגע.
                </p>
              )}
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] font-bold leading-relaxed text-amber-900">
                שים לב: פעולה זו שולחת מייל אמיתי לשותפים. אי אפשר לבטל מייל שנשלח.
              </p>
              <div className="text-[12px] leading-relaxed text-ink">
                יישלח דו&quot;ח של <span className="font-bold">{monthLabel}</span> אל{" "}
                <span className="font-bold">{withEmail.length}</span> סניפים:
                <ul className="mt-1 list-inside list-disc text-muted">
                  {withEmail.map((r) => (
                    <li key={r.branchId}>
                      {r.branchName} — {r.email}
                    </li>
                  ))}
                </ul>
                {missingEmail.length > 0 && (
                  <p className="mt-2 text-red-600">
                    ללא כתובת מייל, לא יישלח אליהם: {missingEmail.map((r) => r.branchName).join(", ")}
                  </p>
                )}
              </div>
              <p className="text-[11px] text-muted">
                סניף שכבר קיבל את הדו&quot;ח של החודש הזה ידולג אוטומטית, כך שאפשר להריץ שוב בלי לשלוח פעמיים.
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={sendAll}
                  disabled={isPending || withEmail.length === 0}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
                >
                  {isPending ? "שולח..." : `שלח ל-${withEmail.length} סניפים`}
                </button>
                <button
                  type="button"
                  onClick={() => setAllOpen(false)}
                  className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#f1f5f9]"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
      {toastNode}
    </div>
  );
}
