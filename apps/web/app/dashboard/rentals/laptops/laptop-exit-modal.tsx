"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, PackageMinus } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/lib/toast";
import type { LaptopSaleItems } from "@ultranet/shared-types";
import { removeLaptopAction, sellLaptopAction, type ExpenseChange } from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

/** הוצאה קבועה פעילה של הסניף, כפי שהיא מוצגת בשאלה "האם להוריד הוצאה חודשית קבועה". */
export interface BranchFixedExpenseOption {
  id: string;
  name: string;
  amount: number;
  category?: string;
}

const SALE_ITEMS: { key: keyof LaptopSaleItems; label: string }[] = [
  { key: "laptop", label: "מחשב" },
  { key: "charger", label: "מטען" },
  { key: "stick", label: "סטיק" },
  { key: "sim", label: "סים" },
  { key: "bag", label: "תיק" },
];

type RowChoice = { selected: boolean; mode: "stop" | "reduce"; reduceBy: string };

/**
 * החלון של מכירה (`sell`) והוצאה (`remove`) של מחשב.
 *
 * שני המקרים שואלים בסוף את אותה שאלה — **האם להוריד הוצאה חודשית קבועה** — כי מחשב שיוצא
 * לוקח איתו לעתים סים וסינון שמשלמים עליהם כל חודש. "כן" פותח את ההוצאות הקבועות של הסניף,
 * ולכל אחת אפשר לבחור לעצור אותה, או להוריד ממנה סכום (650 ₪ על עשרה סימים → 585 ₪).
 */
export function LaptopExitModal({
  mode,
  laptopId,
  laptopName,
  hasStick,
  expenses,
  onClose,
  onDone,
}: {
  mode: "sell" | "remove";
  laptopId: string;
  laptopName: string;
  hasStick: boolean;
  expenses: BranchFixedExpenseOption[];
  onClose: () => void;
  /** אחרי שמירה מוצלחת — ההודעה מוצגת אצל מי שפתח את החלון, כי החלון עצמו נסגר */
  onDone: (message: string) => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [items, setItems] = useState<LaptopSaleItems>({
    laptop: true,
    charger: true,
    stick: false,
    sim: false,
    bag: false,
  });
  const [simTransferred, setSimTransferred] = useState(false);
  const [netfreeTransferred, setNetfreeTransferred] = useState(false);
  const [price, setPrice] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [notes, setNotes] = useState("");
  const [lowerExpenses, setLowerExpenses] = useState<boolean | null>(null);
  const [choices, setChoices] = useState<Record<string, RowChoice>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showError, toastNode } = useToast();

  const choiceOf = (id: string): RowChoice => choices[id] ?? { selected: false, mode: "stop", reduceBy: "" };
  const setChoice = (id: string, patch: Partial<RowChoice>) =>
    setChoices((prev) => ({ ...prev, [id]: { ...choiceOf(id), ...patch } }));

  const month = date.slice(0, 7);

  function submit() {
    const expenseChanges: ExpenseChange[] = lowerExpenses
      ? expenses
          .filter((e) => choiceOf(e.id).selected)
          .map((e) => {
            const c = choiceOf(e.id);
            return c.mode === "stop"
              ? { id: e.id, mode: "stop" as const }
              : { id: e.id, mode: "reduce" as const, reduceBy: Number(c.reduceBy) || 0 };
          })
      : [];
    if (expenseChanges.some((c) => c.mode === "reduce" && !(c.reduceBy! > 0))) {
      showError("יש להזין בכמה להוריד בכל הוצאה שסומנה להפחתה");
      return;
    }
    startTransition(async () => {
      const result =
        mode === "sell"
          ? await sellLaptopAction(laptopId, {
              date,
              price: Number(price) || 0,
              items,
              simTransferred,
              netfreeTransferred,
              buyerName,
              notes,
              expenseChanges,
            })
          : await removeLaptopAction(laptopId, { date, note: notes, expenseChanges });
      if (result.ok) {
        router.refresh();
        onDone(result.message);
      } else {
        showError(result.message);
      }
    });
  }

  return (
    <Modal
      title={mode === "sell" ? `מכירה — ${laptopName}` : `הוצאת מחשב מהסניף — ${laptopName}`}
      icon={mode === "sell" ? HandCoins : PackageMinus}
      onClose={onClose}
      wide
    >
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>{mode === "sell" ? "תאריך המכירה" : "תאריך ההוצאה"}</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={FIELD} />
          </div>
          {mode === "sell" && (
            <div>
              <label className={LABEL}>מחיר המכירה (₪) — על כל מה שנמכר</label>
              <input
                type="number"
                min={0}
                step={1}
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className={FIELD}
                required
              />
            </div>
          )}
        </div>

        {mode === "sell" && (
          <>
            <div>
              <p className={LABEL}>מה מכרנו</p>
              <div className="flex flex-wrap gap-2">
                {SALE_ITEMS.map((it) => {
                  const disabled = it.key === "stick" && !hasStick;
                  const on = items[it.key];
                  return (
                    <label
                      key={it.key}
                      className={`flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-semibold transition ${
                        on ? "border-teal bg-teal-bg text-teal-dark" : "border-card-border bg-white text-ink"
                      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
                      title={disabled ? "אין סטיק משוייך למחשב הזה" : undefined}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        disabled={disabled}
                        onChange={(e) => setItems((prev) => ({ ...prev, [it.key]: e.target.checked }))}
                      />
                      {it.label}
                    </label>
                  );
                })}
              </div>
              {!items.laptop && (
                <p className="mt-1.5 text-[11px] text-amber-700">
                  המחשב עצמו לא סומן — הוא יישאר פעיל בסניף, ונרשמת רק מכירה של הציוד הנלווה.
                </p>
              )}
            </div>

            {items.sim && (
              <div className="rounded-lg border border-card-border bg-[#f9fafb] p-3">
                <p className="mb-2 text-xs font-bold text-ink">הסים נמכר</p>
                <div className="flex flex-col gap-1.5">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input type="checkbox" checked={simTransferred} onChange={(e) => setSimTransferred(e.target.checked)} />
                    העברנו את הסים על שמו
                  </label>
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={netfreeTransferred}
                      onChange={(e) => setNetfreeTransferred(e.target.checked)}
                    />
                    העברנו את נטפרי על שמו
                  </label>
                </div>
              </div>
            )}

            <div>
              <label className={LABEL}>שם הקונה (רשות)</label>
              <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} className={FIELD} />
            </div>
          </>
        )}

        <div>
          <label className={LABEL}>{mode === "sell" ? "הערות (רשות)" : "לאן / למה (רשות)"}</label>
          <input value={notes} onChange={(e) => setNotes(e.target.value)} className={FIELD} />
        </div>

        <div className="rounded-lg border border-card-border bg-[#f9fafb] p-3">
          <p className="text-sm font-bold text-ink">האם להוריד הוצאה חודשית קבועה?</p>
          <p className="mb-2 text-[11px] text-muted">
            למשל סים וסינון שמשלמים עליהם כל חודש. מה שהיה עד עכשיו לא משתנה.
          </p>
          <div className="flex gap-2">
            {[
              [true, "כן"],
              [false, "לא"],
            ].map(([value, label]) => (
              <button
                key={String(value)}
                type="button"
                onClick={() => setLowerExpenses(value as boolean)}
                className={`rounded-lg px-4 py-1.5 text-xs font-bold transition ${
                  lowerExpenses === value
                    ? "bg-gradient-to-br from-teal to-teal-light text-white shadow-primary"
                    : "border border-card-border bg-white text-ink hover:bg-[#f4f6f9]"
                }`}
              >
                {label as string}
              </button>
            ))}
          </div>

          {lowerExpenses && (
            <div className="mt-3 flex flex-col gap-2">
              {expenses.length === 0 && (
                <p className="text-xs text-muted">אין לסניף הזה הוצאות קבועות פעילות.</p>
              )}
              {expenses.map((e) => {
                const c = choiceOf(e.id);
                const reduceBy = Number(c.reduceBy) || 0;
                return (
                  <div
                    key={e.id}
                    className={`rounded-lg border p-2.5 ${c.selected ? "border-teal bg-white" : "border-card-border bg-white"}`}
                  >
                    <label className="flex items-center gap-2 text-sm font-semibold text-ink">
                      <input type="checkbox" checked={c.selected} onChange={(ev) => setChoice(e.id, { selected: ev.target.checked })} />
                      {e.name}
                      <span className="text-xs font-normal text-muted">
                        · {Math.round(e.amount).toLocaleString("he-IL")} ₪ לחודש
                        {e.category ? ` · ${e.category}` : ""}
                      </span>
                    </label>
                    {c.selected && (
                      <div className="mr-6 mt-2 flex flex-wrap items-center gap-3 text-xs">
                        <label className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            checked={c.mode === "stop"}
                            onChange={() => setChoice(e.id, { mode: "stop" })}
                          />
                          להפסיק את ההוצאה
                        </label>
                        <label className="flex items-center gap-1.5">
                          <input
                            type="radio"
                            checked={c.mode === "reduce"}
                            onChange={() => setChoice(e.id, { mode: "reduce" })}
                          />
                          להוריד ממנה
                        </label>
                        {c.mode === "reduce" && (
                          <span className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min={0}
                              step={1}
                              value={c.reduceBy}
                              onChange={(ev) => setChoice(e.id, { reduceBy: ev.target.value })}
                              className="w-24 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1 text-xs"
                              placeholder="סכום"
                            />
                            ₪
                            {reduceBy > 0 && (
                              <b className="text-ink">
                                → {Math.max(0, Math.round(e.amount - reduceBy)).toLocaleString("he-IL")} ₪ לחודש
                              </b>
                            )}
                          </span>
                        )}
                        <span className="w-full text-[11px] text-muted">
                          {c.mode === "stop"
                            ? `${month} הוא החודש האחרון שנספר.`
                            : `${month} נספר עדיין בסכום המלא; הסכום החדש חל מהחודש שאחריו.`}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {mode === "sell" && (
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] leading-relaxed text-sky-900">
            מחיר המכירה נרשם כהכנסה של הסניף ומתווסף במלואו להעברה החודשית לבעלים.
          </p>
        )}
        {mode === "remove" && (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
            המחשב לא נמחק. הוא יוצא מרשימות הסניף מהתאריך הזה, ומהחודש שאחריו הוא לא נספר במספר המחשבים.
            העלות שנזקפה עליו נשארת בהשקעה בסניף.
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={submit}
            disabled={isPending}
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
          >
            {isPending ? "שומר..." : mode === "sell" ? "רישום המכירה" : "הוצאת המחשב"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-[#f4f6f9]"
          >
            ביטול
          </button>
        </div>
      </div>
      {toastNode}
    </Modal>
  );
}
