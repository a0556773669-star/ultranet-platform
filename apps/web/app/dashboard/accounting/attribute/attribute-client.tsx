"use client";

import { useMemo, useState, useTransition } from "react";
import type { Branch } from "@ultranet/shared-types";
import { attributeExpensesAction, type AttributeResult } from "./actions";
import { deleteExpenseRowAction } from "../expense-actions";

export interface PendingExpense {
  id: string;
  desc: string;
  category?: string;
  date: string;
  amount: number;
}

const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-[12px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted whitespace-nowrap border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] align-middle";
const money = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

/** the two "all branches of a type" choices, resolved to a real branch list on submit */
const ALL_ROOMS = "__all_rooms__";
const ALL_RENTALS = "__all_rentals__";

export function AttributeClient({
  expenses,
  branches,
}: {
  expenses: PendingExpense[];
  branches: Branch[];
}) {
  const rooms = useMemo(() => branches.filter((b) => b.branchType === "computers"), [branches]);
  const rentals = useMemo(() => branches.filter((b) => b.branchType === "rentals"), [branches]);
  const coworking = useMemo(() => branches.filter((b) => b.branchType === "coworking"), [branches]);

  /** reads the branch out of the description text, the way the rows were written by hand */
  const suggest = useMemo(() => {
    const sorted = [...branches].sort((a, b) => b.name.length - a.name.length);
    return (text: string) => {
      const hay = (text || "").replace(/["'׳״]/g, "");
      if (/כל סניפי חדרי המחשבים|כל חדרי המחשבים/.test(hay)) return ALL_ROOMS;
      if (/כל סניפי ההשכרות|כל ההשכרות|כל סניפי הניידים/.test(hay)) return ALL_RENTALS;
      for (const b of sorted) {
        const needle = b.name.replace(/["'׳״]/g, "").trim();
        if (needle && hay.includes(needle)) return b.id;
      }
      return "";
    };
  }, [branches]);

  const [choice, setChoice] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const e of expenses) init[e.id] = suggest(`${e.desc} ${e.category ?? ""}`);
    return init;
  });
  const [result, setResult] = useState<AttributeResult | null>(null);
  const [pending, startTransition] = useTransition();
  /** rows removed from the screen after a confirmed delete, so the list reflects reality at once */
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);

  function removeRow(e: PendingExpense) {
    const label = `${e.desc || "הוצאה"} — ${money(e.amount)}`;
    if (!window.confirm(`למחוק לגמרי את "${label}"?\nהשורה תימחק מהמערכת ולא ניתן לשחזר אותה.`)) return;
    setBusyId(e.id);
    setResult(null);
    startTransition(async () => {
      const res = await deleteExpenseRowAction("ledger", e.id);
      setBusyId(null);
      if (res.ok) {
        setRemoved((prev) => new Set(prev).add(e.id));
        setResult({ moved: 0, created: 0, notes: [`נמחק: ${label}`] });
      } else {
        setResult({ moved: 0, created: 0, notes: [], error: res.message });
      }
    });
  }

  const resolve = (value: string): string[] => {
    if (value === ALL_ROOMS) return rooms.map((b) => b.id);
    if (value === ALL_RENTALS) return rentals.map((b) => b.id);
    return value ? [value] : [];
  };

  const live = expenses.filter((e) => !removed.has(e.id));
  const decided = live.filter((e) => resolve(choice[e.id] ?? "").length > 0);
  const total = decided.reduce((s, e) => s + e.amount, 0);
  const newRows = decided.reduce((s, e) => s + resolve(choice[e.id] ?? "").length, 0);

  function submit() {
    const payload = decided.map((e) => ({ id: e.id, branchIds: resolve(choice[e.id] ?? "") }));
    startTransition(async () => {
      const res = await attributeExpensesAction(JSON.stringify(payload));
      setResult(res);
    });
  }

  if (live.length === 0) {
    return (
      <section className="rounded-card border border-card-border bg-white px-4 py-6 text-center text-sm text-muted shadow-card">
        אין הוצאות שממתינות לשיוך — כל ההוצאות כבר משויכות לסניף או מסומנות ככלליות.
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {result && (
        <section
          className={`rounded-card border p-4 shadow-card ${
            result.error ? "border-red-200 bg-red-50" : "border-[#b7e2d0] bg-[#e7f6f0]"
          }`}
        >
          {result.error ? (
            <p className="text-[13px] font-extrabold text-red-700">{result.error}</p>
          ) : (
            <>
              <p className="text-[13px] font-extrabold text-teal-dark">
                ✓ שויכו {result.moved} הוצאות · נוצרו {result.created} שורות בספרי הסניפים
              </p>
              {result.notes.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {result.notes.map((n, i) => (
                    <li key={i} className="text-[12px] text-muted">
                      · {n}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[12px] text-muted">רענני את הדף כדי לראות את הרשימה המעודכנת.</p>
            </>
          )}
        </section>
      )}

      <section className="rounded-card border border-card-border bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">הוצאות שממתינות לשיוך ({live.length})</h2>
            <p className="mt-0.5 text-[12.5px] text-muted">
              הסניף נוחש מתוך הטקסט ומסומן &quot;זוהה אוטומטית&quot;. אפשר לשנות כל שורה.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className={`${TH} min-w-[220px]`}>ההוצאה</th>
                <th className={TH}>תאריך</th>
                <th className={`${TH} text-left`}>סכום</th>
                <th className={`${TH} min-w-[190px]`}>לשייך לסניף</th>
                <th className={TH}>תוצאה</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {live.map((e, i) => {
                const value = choice[e.id] ?? "";
                const targets = resolve(value);
                const auto = suggest(`${e.desc} ${e.category ?? ""}`);
                const isAuto = value !== "" && value === auto;
                return (
                  <tr key={e.id} className={`${i % 2 ? "bg-[#fafbfd]" : ""} ${value ? "" : "bg-[#fffaf0]"}`}>
                    <td className={TD}>
                      <b className="text-ink">{e.desc || "הוצאה"}</b>
                      {e.category && <span className="mr-1 text-[10.5px] text-muted">· {e.category}</span>}
                    </td>
                    <td className={`${TD} whitespace-nowrap text-muted`}>{e.date}</td>
                    <td className={`${TD} text-left font-extrabold tabular-nums`}>{money(e.amount)}</td>
                    <td className={TD}>
                      <select
                        value={value}
                        onChange={(ev) => setChoice((p) => ({ ...p, [e.id]: ev.target.value }))}
                        className={`${FIELD} ${value ? "" : "border-[#e6a23c] bg-[#fff9ef]"}`}
                      >
                        <option value="">— לא לשייך, להשאיר ככללי —</option>
                        {rooms.length > 0 && <option value={ALL_ROOMS}>כל סניפי חדרי המחשבים (פיצול שווה)</option>}
                        {rentals.length > 0 && <option value={ALL_RENTALS}>כל סניפי ההשכרות (פיצול שווה)</option>}
                        {rooms.length > 0 && (
                          <optgroup label="חדרי מחשבים">
                            {rooms.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {rentals.length > 0 && (
                          <optgroup label="ניידים / השכרות">
                            {rentals.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {coworking.length > 0 && (
                          <optgroup label="משרד שיתופי">
                            {coworking.map((b) => (
                              <option key={b.id} value={b.id}>
                                {b.name}
                              </option>
                            ))}
                          </optgroup>
                        )}
                      </select>
                      {isAuto && (
                        <span className="mt-0.5 inline-block rounded-full bg-[#eef0fb] px-2 py-px text-[10px] font-extrabold text-[#45499b]">
                          זוהה אוטומטית
                        </span>
                      )}
                    </td>
                    <td className={`${TD} text-[11.5px]`}>
                      {targets.length === 0 ? (
                        <span className="text-muted">יישאר בהנה&quot;ח האישית</span>
                      ) : targets.length === 1 ? (
                        <span className="font-bold text-teal-dark">
                          {money(e.amount)} לספר של הסניף
                        </span>
                      ) : (
                        <span className="font-bold text-teal-dark">
                          {money(e.amount / targets.length)} × {targets.length} סניפים
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      <button
                        type="button"
                        onClick={() => removeRow(e)}
                        disabled={busyId === e.id}
                        className="whitespace-nowrap rounded-lg border border-red-200 bg-white px-2.5 py-1 text-[11.5px] font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                      >
                        {busyId === e.id ? "מוחק..." : "מחיקה"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t-2 border-card-border bg-white px-4 py-3">
          <div className="flex flex-wrap items-start gap-5">
            <div className="flex flex-col">
              <span className="text-[10.5px] font-extrabold text-muted">הוצאות שיישויכו</span>
              <span className="text-[17px] font-black tabular-nums">
                {decided.length} / {live.length}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10.5px] font-extrabold text-muted">שורות שייווצרו</span>
              <span className="text-[17px] font-black tabular-nums text-teal-dark">{newRows}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10.5px] font-extrabold text-muted">סכום כולל</span>
              <span className="text-[17px] font-black tabular-nums">{money(total)}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={submit}
            disabled={pending || decided.length === 0}
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2.5 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {pending ? "משייך..." : `שיוך ${decided.length} הוצאות לסניפים`}
          </button>
        </div>
      </section>
    </div>
  );
}
