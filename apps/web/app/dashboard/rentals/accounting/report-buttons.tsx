"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Eye, Mail, X } from "lucide-react";
import { useToast } from "@/lib/toast";
import type { ReportRecipient } from "@/lib/branch-report-recipients";
import { sendBranchReportAction } from "./report-actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

/**
 * הפקת הדו"ח החודשי: תצוגה מקדימה, ושליחת מייל בדיקה.
 *
 * The two selects are independent on purpose - "לאיזה מייל לשלוח" and "של איזה סניף הדו"ח" -
 * so any branch's statement can be sent to your own address for checking before a partner ever
 * receives one.
 */
export function ReportButtons({
  month,
  recipients,
  ownerEmail,
  mailerError,
}: {
  month: string;
  recipients: ReportRecipient[];
  ownerEmail: string | null;
  /** null when sending is configured; otherwise the Hebrew reason it isn't. */
  mailerError: string | null;
}) {
  const withEmail = recipients.filter((r) => r.email);
  const [open, setOpen] = useState(false);
  const [toEmail, setToEmail] = useState(ownerEmail ?? withEmail[0]?.email ?? "");
  const [branchId, setBranchId] = useState(recipients[0]?.branchId ?? "");
  const [isPending, startTransition] = useTransition();
  const { showSuccess, showError, toastNode } = useToast();

  const previewHref = `/dashboard/rentals/accounting/report-preview?month=${month}${
    branchId ? `&branchId=${branchId}` : ""
  }`;

  function send() {
    if (!toEmail || !branchId) {
      showError("צריך לבחור גם כתובת מייל וגם סניף");
      return;
    }
    startTransition(async () => {
      try {
        const result = await sendBranchReportAction(branchId, month, toEmail, true);
        if (result.ok) {
          showSuccess(result.message);
          setOpen(false);
        } else {
          showError(result.message);
        }
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
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-3 py-1.5 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        <Mail className="h-4 w-4" />
        שלח מייל לבדיקה
      </button>

      {open && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4" dir="rtl">
          <div className="w-full max-w-md rounded-card border border-card-border bg-white p-5 shadow-lg">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-ink">שליחת דו&quot;ח לבדיקה</h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted hover:text-ink">
                <X className="h-5 w-5" />
              </button>
            </div>

            {mailerError && (
              <p className="mb-3 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-800">
                {mailerError}
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
                הדו&quot;ח שיישלח הוא של החודש שנבחר בטבלה. אפשר לראות אותו קודם ב&quot;תצוגה מקדימה&quot;.
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={send}
                  disabled={isPending}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
                >
                  {isPending ? "שולח..." : "שלח"}
                </button>
                <Link
                  href={`/dashboard/rentals/accounting/report-preview?month=${month}&branchId=${branchId}`}
                  className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#f1f5f9]"
                >
                  תצוגה מקדימה
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
      {toastNode}
    </div>
  );
}
