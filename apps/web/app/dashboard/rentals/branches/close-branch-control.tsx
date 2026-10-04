"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DoorClosed, DoorOpen } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/lib/toast";
import { closeRentalBranchAction, reopenRentalBranchAction } from "./actions";

/**
 * "סגירת סניף" (בעלים בלבד) — לא מחיקה. הסניף נרשם כסגור מהתאריך שנבחר: ההוצאות הקבועות
 * שלו נעצרות, והוא יוצא מהמעקב ומהרשימות הפעילות. כל ההיסטוריה נשארת.
 */
export function CloseBranchControl({
  branchId,
  branchName,
  closedAt,
}: {
  branchId: string;
  branchName: string;
  closedAt?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function run(action: () => Promise<{ ok: boolean; message: string }>) {
    startTransition(async () => {
      try {
        const r = await action();
        if (r.ok) {
          showSuccess(r.message);
          setOpen(false);
          router.refresh();
        } else showError(r.message);
      } catch (e) {
        showError(e instanceof Error ? e.message : "אירעה שגיאה");
      }
    });
  }

  if (closedAt) {
    return (
      <>
        <button
          type="button"
          disabled={isPending}
          onClick={() => {
            if (confirm(`לפתוח מחדש את ${branchName}? ההוצאות שנעצרו לא יחזרו לבד.`)) {
              run(() => reopenRentalBranchAction(branchId));
            }
          }}
          className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9] disabled:opacity-50"
        >
          <DoorOpen className="h-4 w-4" />
          פתיחה מחדש
        </button>
        {toastNode}
      </>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-800 hover:bg-amber-50"
      >
        <DoorClosed className="h-4 w-4" />
        סגירת סניף
      </button>
      {open && (
        <Modal title={`סגירת סניף — ${branchName}`} icon={DoorClosed} onClose={() => setOpen(false)}>
          <div className="flex flex-col gap-3 text-[13px] leading-relaxed text-ink">
            <p>מה קורה בסגירה:</p>
            <ul className="list-inside list-disc text-[12.5px] text-muted">
              <li>כל ההוצאות הקבועות של הסניף נעצרות בתאריך הסגירה (החודש הזה הוא האחרון שנספר).</li>
              <li>המעקב אחרי הסניף נעצר, והוא יוצא מהרשימות הפעילות.</li>
              <li>שום דבר לא נמחק — הסניף נשאר רשום כ&quot;סניף סגור&quot; עם כל ההיסטוריה שלו.</li>
              <li>יתרה פתוחה מול השותף נשארת פתוחה עד שמסמנים שהועברה.</li>
            </ul>
            <label className="flex flex-col gap-1">
              <span className="text-xs font-semibold text-muted">תאריך הסגירה</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm"
              />
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => run(() => closeRentalBranchAction(branchId, date))}
                className="rounded-[10px] bg-amber-600 px-5 py-2 text-sm font-bold text-white transition hover:bg-amber-700 disabled:opacity-60"
              >
                {isPending ? "סוגר..." : "סגירת הסניף"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-[#f4f6f9]"
              >
                ביטול
              </button>
            </div>
          </div>
        </Modal>
      )}
      {toastNode}
    </>
  );
}
