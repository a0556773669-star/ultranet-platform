"use client";

import { useState } from "react";
import { ListPlus, Plus, Trash2, X } from "lucide-react";
import type { SetupCostItem } from "@ultranet/shared-types";
import { COUNTS_TO_MAIN_HINT, COUNTS_TO_MAIN_LABEL } from "@/lib/counts-to-main";

/**
 * עלות ההקמה של סניף היא כמעט אף פעם לא מספר אחד: מחשבים, ריהוט, חשמל, שילוט.
 * השדה שנשמר ב-Firestore נשאר `setupCost` (מספר) כדי שכל מי שקורא אותו היום ימשיך לעבוד,
 * והפירוט נשמר לצידו ב-`setupItems`. הסכום לעולם לא מוקלד - הוא תמיד סכום השורות.
 *
 * משותף לחדרי מחשבים ולמשרד השיתופי: אותה שאלה בדיוק בשני המודולים, ולכן אותו רכיב.
 */

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

type Row = SetupCostItem & { key: number };

let nextKey = 1;
const toRows = (items: SetupCostItem[]): Row[] => items.map((i) => ({ ...i, key: nextKey++ }));

function money(n: number): string {
  return `₪${Math.round(n).toLocaleString("he-IL")}`;
}

const sum = (rows: { amount: number }[]): number => rows.reduce((t, r) => t + (Number(r.amount) || 0), 0);

/** שורה אחת לעריכה: תיאור + סכום + מחיקה */
function EditableRow({
  row,
  onChange,
  onRemove,
}: {
  row: Row;
  onChange: (patch: Partial<SetupCostItem>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <input
          value={row.label}
          onChange={(e) => onChange({ label: e.target.value })}
          placeholder="על מה ההוצאה"
          className={`${FIELD} bg-white`}
        />
      </div>
      <div className="w-28">
        <input
          type="number"
          min={0}
          value={Number.isFinite(row.amount) ? row.amount : 0}
          onChange={(e) => onChange({ amount: e.target.value === "" ? 0 : Number(e.target.value) })}
          placeholder="סכום"
          className={`${FIELD} bg-white`}
        />
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label="מחיקת שורה"
        className="mb-[6px] text-muted transition hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

export function SetupCostField({
  initialItems,
  initialTotal,
  initialCountsToMain,
}: {
  initialItems?: SetupCostItem[];
  initialTotal?: number;
  /** `undefined` נחשב מסומן - ראה `setupCostCountsToMain` ב-`lib/counts-to-main.ts` */
  initialCountsToMain?: boolean;
}) {
  // חדר ותיק שיש בו רק מספר בלי פירוט: המספר הופך לשורה ראשונה, כדי שלא ייעלם ברגע
  // שמתחילים לפרט.
  const seed: SetupCostItem[] =
    initialItems && initialItems.length > 0
      ? initialItems
      : initialTotal
        ? [{ label: "עלות הקמה", amount: initialTotal }]
        : [];

  const [items, setItems] = useState<SetupCostItem[]>(seed);
  const [countsToMain, setCountsToMain] = useState(initialCountsToMain !== false);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Row[]>([]);

  const total = sum(items);

  function openPanel() {
    setDraft(toRows(items.length > 0 ? items : [{ label: "", amount: 0 }]));
    setOpen(true);
  }

  function save() {
    // שורה בלי תיאור ובלי סכום היא שורה ריקה שנשארה פתוחה - לא נשמרת.
    setItems(
      draft
        .map((r) => ({ label: r.label.trim(), amount: Number(r.amount) || 0 }))
        .filter((r) => r.label !== "" || r.amount !== 0),
    );
    setOpen(false);
  }

  return (
    <div>
      <label className={LABEL}>עלות הקמה</label>

      {/* מה שנשלח בפועל עם הטופס */}
      <input type="hidden" name="setupCost" value={total} />
      <input type="hidden" name="setupItems" value={JSON.stringify(items)} />
      {/* נשלח תמיד (גם "false"), אחרת ביטול הסימון לא היה מגיע לשרת - checkbox שלא סומן
          פשוט לא נשלח, ו-stripUndefined היה משאיר את הערך הישן */}
      <input type="hidden" name="setupCountsToMain" value={countsToMain ? "true" : "false"} />

      <div className="flex items-center justify-between gap-3 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2">
        <div>
          <p className="text-lg font-black text-ink">{money(total)}</p>
          <p className="text-[11.5px] text-muted">
            {items.length > 0 ? `${items.length} שורות בפירוט` : "טרם הוזן פירוט"}
            {" · "}
            {countsToMain ? 'נכנס להנה"ח הראשית' : 'בספר הסניף בלבד'}
          </p>
        </div>
        <button
          type="button"
          onClick={openPanel}
          className="flex items-center gap-1.5 rounded-[10px] border border-teal bg-white px-3 py-2 text-xs font-bold text-teal transition hover:bg-teal hover:text-white"
        >
          <ListPlus className="h-4 w-4" />
          פירוט ההוצאות
        </button>
      </div>

      {items.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {items.map((it, idx) => (
            <li key={idx} className="flex items-center justify-between text-[12.5px]">
              <span className="text-muted">{it.label || "ללא תיאור"}</span>
              <span className="font-bold text-ink">{money(it.amount)}</span>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setOpen(false)} />
          {/* חלון צד שמאלי: נפתח לצד הטופס ולא מעליו, כך שרואים את שאר פרטי הסניף בזמן הפירוט */}
          <aside className="fixed inset-y-0 left-0 z-50 flex w-full max-w-md flex-col bg-white shadow-card">
            <div className="flex items-center justify-between border-b border-card-border px-5 py-4">
              <h2 className="text-base font-extrabold text-ink">פירוט עלות הקמה</h2>
              <button type="button" onClick={() => setOpen(false)} aria-label="סגירה" className="text-muted transition hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              <div className="flex flex-col gap-2.5">
                {draft.map((row, idx) => (
                  <EditableRow
                    key={row.key}
                    row={row}
                    onChange={(patch) =>
                      setDraft((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
                    }
                    onRemove={() => setDraft((prev) => prev.filter((_, i) => i !== idx))}
                  />
                ))}
              </div>

              <button
                type="button"
                onClick={() => setDraft((prev) => [...prev, { label: "", amount: 0, key: nextKey++ }])}
                className="mt-3 flex items-center gap-1.5 rounded-[10px] border border-dashed border-teal px-3 py-2 text-xs font-bold text-teal transition hover:bg-[#f4f6f9]"
              >
                <Plus className="h-4 w-4" />
                הוספת שורה
              </button>
            </div>

            <div className="border-t border-card-border px-5 py-4">
              <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-lg border border-card-border bg-[#f8fafc] px-3 py-2">
                <input
                  type="checkbox"
                  checked={countsToMain}
                  onChange={(e) => setCountsToMain(e.target.checked)}
                  className="mt-0.5 h-4 w-4 shrink-0 accent-teal"
                />
                <span>
                  <span className="block text-xs font-bold text-ink">{COUNTS_TO_MAIN_LABEL}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-muted">{COUNTS_TO_MAIN_HINT}</span>
                </span>
              </label>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">סה&quot;כ עלות הקמה</span>
                <span className="text-lg font-black text-ink">{money(sum(draft))}</span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
                >
                  שמירה
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-[10px] border border-card-border px-4 py-2 text-sm font-bold text-muted transition hover:text-ink"
                >
                  ביטול
                </button>
              </div>
              <p className="mt-2 text-[11.5px] text-muted">
                הסכום נשמר יחד עם שאר פרטי הסניף בלחיצה על &quot;שמירה&quot; בתחתית הטופס.
              </p>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
