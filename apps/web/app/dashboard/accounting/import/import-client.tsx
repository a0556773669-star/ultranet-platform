"use client";

import { useMemo, useState, useTransition } from "react";
import type { Branch } from "@ultranet/shared-types";
import { importExpensesAction, type ImportResult, type ImportRow } from "./actions";

/** an amount this big is almost certainly a roll-up line, not one expense */
const LUMP_THRESHOLD = 50000;

const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-[12px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted whitespace-nowrap border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] whitespace-nowrap align-middle";
const money = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

type Sheet = "fixed" | "variable";

interface Row {
  id: number;
  name: string;
  branchId: string;
  /** as typed in the file */
  when: string;
  amount: number;
  category: string;
  include: boolean;
  autoMatched: boolean;
  lump: boolean;
}

/** "2026-07" / "2026-07-16" / "16/07/2026" -> normalised, plus whether it carries a day */
function normaliseWhen(raw: string): { when: string; ok: boolean } {
  const t = raw.trim();
  if (/^\d{4}-\d{2}$/.test(t)) return { when: t, ok: true };
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return { when: t, ok: true };
  const dmy = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})$/);
  if (dmy) {
    const [, d, m, y] = dmy;
    const year = y!.length === 2 ? `20${y}` : y!;
    return { when: `${year}-${m!.padStart(2, "0")}-${d!.padStart(2, "0")}`, ok: true };
  }
  const my = t.match(/^(\d{1,2})[./](\d{4})$/);
  if (my) return { when: `${my[2]}-${my[1]!.padStart(2, "0")}`, ok: true };
  return { when: t, ok: false };
}

function parseAmount(raw: string): number {
  const n = Number(String(raw).replace(/[₪,\s]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

export function ImportClient({ branches }: { branches: Branch[] }) {
  const [sheet, setSheet] = useState<Sheet>("fixed");
  const [rentMode, setRentMode] = useState<"recurring" | "dated">("recurring");
  const [writeToOwnerLedger, setWriteToOwnerLedger] = useState(false);
  const [text, setText] = useState("");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pending, startTransition] = useTransition();

  /** finds the branch whose name appears in a free-text cell ("חשמל הנשיא" -> הנשיא) */
  const detectBranch = useMemo(() => {
    const sorted = [...branches].sort((a, b) => b.name.length - a.name.length);
    return (...texts: string[]) => {
      const hay = texts.join(" ").replace(/["'׳״]/g, "");
      for (const b of sorted) {
        const needle = b.name.replace(/["'׳״]/g, "").trim();
        if (needle && hay.includes(needle)) return b.id;
      }
      return "";
    };
  }, [branches]);

  function parse() {
    setResult(null);
    const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    const out: Row[] = [];
    let id = 0;
    for (const line of lines) {
      const cells = (line.includes("\t") ? line.split("\t") : line.split(",")).map((c) => c.trim());
      if (cells.length < 3) continue;
      const first = cells[0] ?? "";
      if (/^שם$/.test(first) || first === "name") continue; // header row

      const name = first;
      const branchCell = cells[1] ?? "";
      const whenRaw = cells[2] ?? "";
      const amount = parseAmount(cells[3] ?? "");
      const category = (cells[4] ?? "").trim();
      const { when, ok } = normaliseWhen(whenRaw);
      if (!ok || amount <= 0) continue;

      const explicit = branches.find((b) => b.name.trim() === branchCell.trim())?.id ?? "";
      const detected = explicit || detectBranch(branchCell, name);
      out.push({
        id: id++,
        name,
        branchId: detected,
        when,
        amount,
        category: category || (sheet === "fixed" ? "שכירות" : ""),
        include: amount < LUMP_THRESHOLD,
        autoMatched: !explicit && !!detected,
        lump: amount >= LUMP_THRESHOLD,
      });
    }
    setRows(out);
  }

  const included = (rows ?? []).filter((r) => r.include);
  const missingBranch = included.filter((r) => !r.branchId).length;
  const total = included.reduce((s, r) => s + r.amount, 0);
  const mode: "recurring" | "dated" = sheet === "fixed" && rentMode === "recurring" ? "recurring" : "dated";
  const willCreate =
    mode === "recurring" ? new Set(included.filter((r) => r.branchId).map((r) => r.branchId)).size : included.length;

  function submit() {
    const payload: { mode: typeof mode; rows: ImportRow[]; writeToOwnerLedger: boolean } = {
      mode,
      writeToOwnerLedger,
      rows: included.map((r) => ({
        name: r.name,
        branchId: r.branchId,
        when: r.when,
        amount: r.amount,
        category: r.category || undefined,
      })),
    };
    startTransition(async () => {
      const res = await importExpensesAction(JSON.stringify(payload));
      setResult(res);
      if (res.created > 0) setRows(null);
    });
  }

  const patch = (id: number, change: Partial<Row>) =>
    setRows((prev) => (prev ? prev.map((r) => (r.id === id ? { ...r, ...change } : r)) : prev));

  return (
    <div className="flex flex-col gap-3.5">
      {/* ---------- step 1: paste ---------- */}
      <section className="rounded-card border border-card-border bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-ink">1 · הדבקת הטבלה מ-Excel</h2>
          <div className="flex gap-1 rounded-xl border border-card-border p-1">
            <button
              type="button"
              onClick={() => { setSheet("fixed"); setRows(null); setResult(null); }}
              className={sheet === "fixed" ? "rounded-lg bg-teal-bg px-3 py-1.5 text-[13px] font-bold text-teal-dark" : "rounded-lg px-3 py-1.5 text-[13px] font-bold text-muted"}
            >
              הוצאות קבועות
            </button>
            <button
              type="button"
              onClick={() => { setSheet("variable"); setRows(null); setResult(null); }}
              className={sheet === "variable" ? "rounded-lg bg-teal-bg px-3 py-1.5 text-[13px] font-bold text-teal-dark" : "rounded-lg px-3 py-1.5 text-[13px] font-bold text-muted"}
            >
              הוצאות משתנות
            </button>
          </div>
        </div>
        <div className="px-4 py-3.5">
          <p className="mb-2 text-[12.5px] text-muted">
            סמני את הטבלה ב-Excel, העתיקי (Ctrl+C) והדביקי כאן. סדר העמודות:{" "}
            <b className="text-ink">
              {sheet === "fixed" ? "שם · סניף · חודש · סכום" : "שם · סניף · תאריך · סכום · קטגוריה"}
            </b>
            . שורת כותרת מזוהה ומדולגת לבד, ועמודת הסניף יכולה להישאר ריקה.
          </p>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            dir="rtl"
            placeholder={sheet === "fixed" ? "שכירות\tהנשיא\t2026-07\t2400" : "חשמל הנשיא\t\t2026-07-05\t1275\tחשמל"}
            className="w-full rounded-lg border border-card-border bg-[#f4f6f9] p-3 font-mono text-[12px] focus:border-teal focus:bg-white focus:outline-none"
          />
          <button
            type="button"
            onClick={parse}
            disabled={!text.trim()}
            className="mt-2.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-40"
          >
            ניתוח השורות
          </button>
        </div>
      </section>

      {/* ---------- result ---------- */}
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
                ✓ נוספו {result.created} רשומות · דולגו {result.skipped} (כבר היו קיימות)
              </p>
              {result.notes.length > 0 && (
                <ul className="mt-2 flex flex-col gap-1">
                  {result.notes.map((n) => (
                    <li key={n} className="text-[12px] text-muted">
                      · {n}
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-2 text-[12px] text-muted">
                לתיקון או מחיקה של רשומה — בעמוד ההוצאות של הסניף.
              </p>
            </>
          )}
        </section>
      )}

      {/* ---------- step 2: review ---------- */}
      {rows && (
        <section className="rounded-card border border-card-border bg-white shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-ink">2 · בדיקה ותיקון ({rows.length} שורות)</h2>
          </div>

          {sheet === "fixed" && (
            <div className="flex flex-wrap items-center gap-2.5 border-b border-card-border bg-[#f4f6f9] px-4 py-2.5">
              <span className="text-xs font-extrabold text-muted">איך לרשום את השכירות</span>
              <div className="flex gap-0.5 rounded-lg border border-card-border bg-white p-1">
                <button
                  type="button"
                  onClick={() => setRentMode("recurring")}
                  className={rentMode === "recurring" ? "rounded-md bg-teal-bg px-2.5 py-1 text-xs font-bold text-teal-dark" : "rounded-md px-2.5 py-1 text-xs font-bold text-muted"}
                >
                  הוצאה קבועה חוזרת
                </button>
                <button
                  type="button"
                  onClick={() => setRentMode("dated")}
                  className={rentMode === "dated" ? "rounded-md bg-teal-bg px-2.5 py-1 text-xs font-bold text-teal-dark" : "rounded-md px-2.5 py-1 text-xs font-bold text-muted"}
                >
                  שורה לכל חודש
                </button>
              </div>
              <span className="text-[11.5px] text-muted">
                {rentMode === "recurring"
                  ? "שורה אחת לכל סניף שממשיכה לבד כל חודש — כולל חודשים שחסרים בקובץ"
                  : "שורה נפרדת לכל חודש, בדיוק כמו בקובץ — לא תמשיך לבד קדימה"}
              </span>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className={TH}>ייבוא</th>
                  <th className={TH}>שם</th>
                  <th className={`${TH} min-w-[150px]`}>סניף</th>
                  <th className={TH}>{sheet === "fixed" ? "חודש" : "תאריך"}</th>
                  <th className={`${TH} text-left`}>סכום</th>
                  {sheet === "variable" && <th className={TH}>קטגוריה</th>}
                  <th className={TH}>בדיקה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr
                    key={r.id}
                    className={`${i % 2 ? "bg-[#fafbfd]" : ""} ${r.include ? "" : "opacity-45"} ${
                      r.lump ? "bg-red-50" : ""
                    }`}
                  >
                    <td className={TD}>
                      <input
                        type="checkbox"
                        checked={r.include}
                        onChange={(e) => patch(r.id, { include: e.target.checked })}
                        className="h-4 w-4 accent-[#1a8a76]"
                      />
                    </td>
                    <td className={TD}>{r.name || <span className="text-red-600">חסר שם</span>}</td>
                    <td className={TD}>
                      <select
                        value={r.branchId}
                        onChange={(e) => patch(r.id, { branchId: e.target.value, autoMatched: false })}
                        className={`${FIELD} ${r.branchId ? "" : "border-[#e6a23c] bg-[#fff9ef]"}`}
                      >
                        <option value="">— בחרי סניף —</option>
                        {branches.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                      {r.autoMatched && (
                        <span className="mt-0.5 inline-block rounded-full bg-[#eef0fb] px-2 py-px text-[10px] font-extrabold text-[#45499b]">
                          זוהה אוטומטית
                        </span>
                      )}
                    </td>
                    <td className={TD}>{r.when}</td>
                    <td className={`${TD} text-left font-extrabold tabular-nums`}>{money(r.amount)}</td>
                    {sheet === "variable" && (
                      <td className={TD}>
                        <input
                          value={r.category}
                          onChange={(e) => patch(r.id, { category: e.target.value })}
                          className={FIELD}
                        />
                      </td>
                    )}
                    <td className={TD}>
                      {r.lump ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-extrabold text-red-700">
                          סכום חריג — שורת ריכוז?
                        </span>
                      ) : !r.branchId ? (
                        <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[10px] font-extrabold text-[#b45309]">
                          לא זוהה סניף
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-extrabold text-emerald-600">
                          תקין
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sheet === "variable" && (
            <label className="flex cursor-pointer items-start gap-2 border-t border-card-border px-4 py-3 text-[12.5px] text-muted">
              <input
                type="checkbox"
                checked={writeToOwnerLedger}
                onChange={(e) => setWriteToOwnerLedger(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#1a8a76]"
              />
              <span>
                לרשום את ההוצאות האלה גם בספר <b className="text-ink">&quot;שלי&quot;</b> (ההנה&quot;ח האישית).
                כברירת מחדל <b className="text-ink">לא</b> — הן נכנסות לספר של הסניף בלבד. סמני רק אם שילמת
                אותן מהכיס שלך ורוצה שיופיעו גם שם.
              </span>
            </label>
          )}

          <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-3 border-t-2 border-card-border bg-white px-4 py-3">
            <div className="flex flex-wrap items-start gap-5">
              <div className="flex flex-col">
                <span className="text-[10.5px] font-extrabold text-muted">שורות שסומנו</span>
                <span className="text-[17px] font-black tabular-nums">
                  {included.length} / {rows.length}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10.5px] font-extrabold text-muted">ייכתבו למערכת</span>
                <span className="text-[17px] font-black tabular-nums text-teal-dark">{willCreate}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10.5px] font-extrabold text-muted">סכום כולל</span>
                <span className="text-[17px] font-black tabular-nums">{money(total)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10.5px] font-extrabold text-muted">בלי סניף</span>
                <span className={`text-[17px] font-black tabular-nums ${missingBranch ? "text-red-600" : "text-muted"}`}>
                  {missingBranch}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={submit}
              disabled={pending || missingBranch > 0 || willCreate === 0}
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2.5 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {pending
                ? "מייבא..."
                : missingBranch > 0
                  ? `יש ${missingBranch} שורות בלי סניף`
                  : `ייבוא ${willCreate} רשומות למערכת`}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
