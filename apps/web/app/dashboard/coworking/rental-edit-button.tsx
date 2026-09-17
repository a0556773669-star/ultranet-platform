"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import type { CoworkingClient } from "@ultranet/shared-types";
import { useToast } from "@/lib/toast";
import { Modal } from "@/components/modal";
import { updateStationRentalAction } from "./station-actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

/**
 * "עריכת פרטים" — תיקון של שם, טלפון, תאריך התחלה או מחיר, בלי לגעת בתשלומים.
 *
 * שורת העמדה הפכה לשורת טבלה, ולכן אין בה מקום לטופס פרוש: הפרטים נקראים בשורה
 * ונערכים בחלון. תאריך הסיום נשאר בחוץ, ב"סיום השכרה", כי הוא לא תיקון של פרט אלא
 * אירוע — הוא מוריד את ההשכרה להיסטוריה.
 */
export function RentalEditButton({ client }: { client: CoworkingClient }) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateStationRentalAction(client.id, formData);
        router.refresh();
        setOpen(false);
        showSuccess("הפרטים עודכנו");
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
        className="flex items-center gap-1 rounded-lg border border-card-border bg-white px-2 py-1 text-[11px] font-bold text-teal transition hover:border-teal"
      >
        <Pencil className="h-3 w-3" />
        עריכת פרטים
      </button>

      {open && (
        <Modal title={`עריכת פרטי ההשכרה — ${client.name}`} icon={Pencil} onClose={() => setOpen(false)}>
          <form action={handleSubmit} className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className={LABEL}>שם השוכר</label>
              <input name="name" defaultValue={client.name} required className={FIELD} autoFocus />
            </div>
            <div>
              <label className={LABEL}>טלפון</label>
              <input name="phone" type="tel" defaultValue={client.phone ?? ""} className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>תאריך התחלה</label>
              <input name="startDate" type="date" defaultValue={client.startDate?.slice(0, 10)} required className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>מחיר חודשי</label>
              <input
                name="price"
                type="number"
                min={0}
                step="0.01"
                defaultValue={client.customPrice ?? ""}
                className={FIELD}
              />
            </div>
            <p className="text-[11px] leading-snug text-muted sm:col-span-2">
              יום התשלום החודשי נקבע מחדש לפי יום תאריך ההתחלה. התשלומים שכבר נרשמו לא משתנים,
              ותאריך הסיום נשאר ב&quot;סיום השכרה&quot; שבשורת העמדה.
            </p>
            <div className="flex items-center gap-2 sm:col-span-2">
              <button
                type="submit"
                disabled={isPending}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "שומר..." : "שמירת הפרטים"}
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
