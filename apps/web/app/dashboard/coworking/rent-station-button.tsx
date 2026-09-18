"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Armchair, Plus } from "lucide-react";
import { useToast } from "@/lib/toast";
import { Modal } from "@/components/modal";
import { rentStationAction } from "./station-actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

/**
 * השכרת עמדה פנויה — אותם שדות שהיו בטופס הפרוש, בחלון.
 *
 * הטופס ירד מהשורה מאותה סיבה שהפרטים ירדו ממנה: עמדה היא שורה במסך שמסתכלים בו, והשכרה
 * היא פעולה שעושים פעם אחת. חמישה שדות פרושים בכל עמדה פנויה מתחו שורה אחת לגובה של
 * ארבע, ודחפו את שאר העמדות ואת ההיסטוריה מתחת לקפל.
 */
export function RentStationButton({ branchId, stationNumber }: { branchId: string; stationNumber: number }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await rentStationAction(branchId, stationNumber, formData);
        router.refresh();
        setOpen(false);
        showSuccess(`עמדה ${stationNumber} הושכרה`);
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-3 py-1.5 text-[11.5px] font-bold text-white shadow-primary transition hover:opacity-90"
      >
        <Plus className="h-3.5 w-3.5" />
        השכרת העמדה
      </button>

      {open && (
        <Modal title={`השכרת עמדה ${stationNumber}`} icon={Armchair} onClose={() => setOpen(false)}>
          <form action={handleSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className={LABEL}>שם השוכר</label>
              <input name="name" required className={FIELD} autoFocus />
            </div>
            <div>
              <label className={LABEL}>טלפון</label>
              <input name="phone" type="tel" className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>תאריך התחלה</label>
              <input name="startDate" type="date" required className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>מחיר חודשי</label>
              <input name="price" type="number" min={0} step="0.01" className={FIELD} />
            </div>
            <p className="text-[11px] leading-snug text-muted sm:col-span-2">
              יום התשלום החודשי נקבע לפי היום שבו מתחילה השכירות. תאריך סיום נרשם מאוחר יותר,
              בכפתור &quot;סיום השכרה&quot; שבשורת העמדה.
            </p>
            <div className="flex items-center gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "שומר..." : "השכרת העמדה"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-muted transition hover:bg-[#f4f6f9]"
              >
                ביטול
              </button>
            </div>
          </form>
        </Modal>
      )}
      {toastNode}
    </>
  );
}
