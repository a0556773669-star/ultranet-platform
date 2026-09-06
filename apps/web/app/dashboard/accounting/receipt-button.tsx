"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Receipt, X, Check } from "lucide-react";
import { useToast } from "@/lib/toast";
import { issueIncomeReceiptAction } from "./receipt-actions";
import { setIncomeReceiptIssuedAction } from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

/**
 * הפקת קבלה על שורת הכנסת ניידים.
 *
 * שני מסלולים שונים בכוונה: הכפתור הראשי מפיק קבלה אמיתית ב-EZcount ושולח אותה במייל
 * ללקוח, והתיבה שלצידו רק מסמנת "כבר הוצאתי קבלה" - כי לפעמים הקבלה כבר יצאה במקום אחר,
 * ואילוץ להפיק אחת נוספת רק כדי לסמן וי היה יוצר מסמך כפול בספרים.
 */
export function IssueReceiptButton({
  incomeId,
  amount,
  receiptIssued,
  receiptDocNumber,
  defaultClientName,
}: {
  incomeId: string;
  amount: number;
  receiptIssued: boolean;
  receiptDocNumber?: string;
  defaultClientName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function handleIssue(formData: FormData) {
    startTransition(async () => {
      const res = await issueIncomeReceiptAction(incomeId, formData);
      if (res.ok) {
        setOpen(false);
        router.refresh();
        showSuccess(
          res.sentTo.length > 0
            ? `קבלה ${res.docNumber} הופקה ונשלחה ל-${res.sentTo.join(", ")}`
            : `קבלה ${res.docNumber} הופקה (לא נשלח מייל — לא הוזנה כתובת)`,
        );
      } else {
        showError(res.message);
      }
    });
  }

  function toggleManual(next: boolean) {
    startTransition(async () => {
      try {
        await setIncomeReceiptIssuedAction(incomeId, next);
        router.refresh();
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה");
      }
    });
  }

  return (
    <>
      <div className="flex items-center gap-1.5">
        {receiptDocNumber ? (
          <span className="flex items-center gap-1 rounded-full bg-teal-bg px-2 py-0.5 text-[10px] font-extrabold text-teal-dark">
            <Check className="h-3 w-3" />
            קבלה {receiptDocNumber}
          </span>
        ) : (
          <>
            <label className="flex cursor-pointer items-center gap-1 text-[10.5px] font-bold text-muted">
              <input
                type="checkbox"
                checked={receiptIssued}
                disabled={isPending}
                onChange={(e) => toggleManual(e.target.checked)}
                className="h-3.5 w-3.5 accent-teal"
              />
              קבלה
            </label>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-0.5 text-[10.5px] font-bold text-ink transition hover:border-teal hover:text-teal"
            >
              <Receipt className="h-3 w-3" />
              הפק ושלח
            </button>
          </>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-sm rounded-card bg-white p-5 shadow-card" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
                <Receipt className="h-4 w-4" />
                הפקת קבלה על {Math.round(amount).toLocaleString("he-IL")} ₪
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted transition hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form action={handleIssue} className="flex flex-col gap-2.5">
              <div>
                <label className={LABEL}>שם הלקוח (יוקם אוטומטית ב-EZcount)</label>
                <input name="clientName" defaultValue={defaultClientName ?? ""} required className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>מייל לשליחת הקבלה</label>
                <input name="clientEmail" type="email" className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>ח&quot;פ / ת&quot;ז (לא חובה)</label>
                <input name="clientIdNum" className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>אמצעי תשלום</label>
                <select name="paymentType" defaultValue="4" className={FIELD}>
                  <option value="4">העברה בנקאית</option>
                  <option value="1">מזומן</option>
                  <option value="3">אשראי</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "מפיק..." : "הפק ושלח במייל"}
              </button>
            </form>
          </div>
        </div>
      )}
      {toastNode}
    </>
  );
}
