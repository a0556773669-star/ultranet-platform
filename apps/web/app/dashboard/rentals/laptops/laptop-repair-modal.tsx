"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import type { LaptopRepair } from "@ultranet/shared-types";
import { Modal } from "@/components/modal";
import { useToast } from "@/lib/toast";
import { isRepairOpen, repairDaysText } from "@/lib/laptop-repairs";
import { closeLaptopRepairAction, openLaptopRepairAction } from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

/**
 * חלון "עוד" של מחשב: הוצאה לתיקון / חזר מתיקון, והיסטוריית תקופות התיקון שלו.
 *
 * לא כל תקלה היא תיקון — רק הפעולה המפורשת כאן פותחת תקופה, ומאותו רגע המחשב לא ניתן להשכרה
 * חדשה. מחשב מושכר לא נשלח לתיקון מכאן: ההשכרה לא מסתיימת אוטומטית, אז קודם מחזירים אותה.
 */
export function LaptopRepairModal({
  laptopId,
  laptopName,
  repairs,
  rented,
  canRepair,
  onClose,
  onDone,
}: {
  laptopId: string;
  laptopName: string;
  /** כל תקופות התיקון של המחשב הזה */
  repairs: LaptopRepair[];
  /** יש למחשב השכרה פעילה */
  rented: boolean;
  canRepair: boolean;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const open = repairs.find((r) => isRepairOpen(r));
  const past = repairs.filter((r) => !isRepairOpen(r)).sort((a, b) => b.from.localeCompare(a.from));
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [lab, setLab] = useState("");
  const [labContact, setLabContact] = useState("");
  const [treatment, setTreatment] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showError, toastNode } = useToast();

  function submit() {
    startTransition(async () => {
      const result = open
        ? await closeLaptopRepairAction(open.id, { to: date, returnNote: note, treatment })
        : await openLaptopRepairAction(laptopId, { from: date, note, lab, labContact, treatment });
      if (result.ok) {
        router.refresh();
        onDone(result.message);
      } else {
        showError(result.message);
      }
    });
  }

  return (
    <Modal title={`עוד — ${laptopName}`} icon={Wrench} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {open ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <div className="font-bold">{`בתיקון מ-${open.from} · ${repairDaysText(open, today)}`}</div>
            {open.lab && <div className="text-xs">{`מעבדה: ${open.lab}${open.labContact ? ` · ${open.labContact}` : ""}`}</div>}
            {open.note && <div className="text-xs">{open.note}</div>}
            {open.treatment && <div className="text-xs">{`טיפול: ${open.treatment}`}</div>}
          </div>
        ) : rented ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            המחשב מושכר כרגע. תיקון לא מסיים השכרה ולא משחרר את המחשב — יש להחזיר את ההשכרה (או להחליף לשוכר
            מחשב אחר במסך ההשכרות) ורק אז להוציא לתיקון.
          </div>
        ) : null}

        {canRepair && !(rented && !open) && (
          <div className="rounded-lg border border-card-border p-3">
            <p className="mb-2 text-sm font-extrabold text-ink">{open ? "חזר מתיקון" : "הוצאת מחשב לתיקון"}</p>
            {!open && (
              <p className="mb-3 text-[11px] text-muted">
                מהתאריך הזה המחשב לא יוצע להשכרה חדשה, עד שיסומן &quot;חזר מתיקון&quot;. השכרות קודמות לא משתנות.
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className={LABEL}>{open ? "תאריך החזרה" : "תאריך היציאה לתיקון"}</label>
                <input
                  type="date"
                  value={date}
                  max={today}
                  min={open?.from}
                  onChange={(e) => setDate(e.target.value)}
                  className={FIELD}
                />
              </div>
              {!open && (
                <>
                  <div>
                    <label className={LABEL}>מעבדה (רשות)</label>
                    <input value={lab} onChange={(e) => setLab(e.target.value)} className={FIELD} />
                  </div>
                  <div>
                    <label className={LABEL}>איש קשר במעבדה (רשות)</label>
                    <input value={labContact} onChange={(e) => setLabContact(e.target.value)} className={FIELD} />
                  </div>
                </>
              )}
              <div className={open ? "" : "sm:col-span-2"}>
                <label className={LABEL}>{open ? "הערה (רשות)" : "הערה — מה התקלה"}</label>
                <input value={note} onChange={(e) => setNote(e.target.value)} className={FIELD} />
              </div>
              {!(open && open.treatment) && (
                <div className="sm:col-span-2">
                  <label className={LABEL}>תיאור הטיפול (רשות)</label>
                  <input value={treatment} onChange={(e) => setTreatment(e.target.value)} className={FIELD} />
                </div>
              )}
            </div>
            <button
              type="button"
              disabled={isPending || !date}
              onClick={submit}
              className={`mt-3 rounded-[10px] px-5 py-2 text-sm font-bold transition disabled:opacity-50 ${
                open
                  ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-primary hover:opacity-90"
                  : "border border-amber-200 bg-white text-amber-700 hover:bg-amber-50"
              }`}
            >
              {isPending ? "שומר..." : open ? "חזר מתיקון" : "הוצאה לתיקון"}
            </button>
          </div>
        )}

        <div>
          <p className="mb-1.5 text-xs font-bold text-muted">תקופות תיקון קודמות</p>
          {past.length === 0 ? (
            <p className="text-xs text-muted">אין.</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {past.map((r) => (
                <li key={r.id} className="rounded-lg border border-card-border bg-[#fafbfc] px-3 py-2 text-xs text-ink">
                  <span className="font-bold tabular-nums">{`${r.from} → ${r.to}`}</span>
                  <span className="text-muted">{` · ${repairDaysText(r, today)}`}</span>
                  {r.lab && <span className="text-muted">{` · ${r.lab}`}</span>}
                  {r.note && <div className="text-muted">{r.note}</div>}
                  {r.treatment && <div className="text-muted">{`טיפול: ${r.treatment}`}</div>}
                  {r.returnNote && <div className="text-muted">{`בחזרה: ${r.returnNote}`}</div>}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      {toastNode}
    </Modal>
  );
}
