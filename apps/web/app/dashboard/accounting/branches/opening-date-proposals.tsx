"use client";

import { useMemo, useState, useTransition } from "react";
import { applyOpeningDatesAction, type BranchActionResult } from "./actions";

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH =
  "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted whitespace-nowrap border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] align-middle";
const DATE_FIELD =
  "w-[150px] rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-[12px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";

export interface OpeningRow {
  id: string;
  name: string;
  branchType: string;
  /** the date already saved on the branch, null when it has none */
  currentDate: string | null;
  /** what the system suggests, null when the branch holds nothing to base a date on */
  proposedDate: string | null;
  /** Hebrew: what the suggestion is based on */
  note: string;
  /** the suggestion rests on a cost only, so it may predate the real opening */
  weak: boolean;
  notStarted: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  rentals: "ניידים",
  computers: "חדר מחשבים",
  coworking: "משרד שיתופי",
};

/**
 * The proposal table: for every branch, the opening date the system derives from what is
 * actually recorded in it - and nothing more until the owner says so.
 *
 * Deliberately a preview and not a one-click "fix everything": a wrong opening date silently
 * rewrites what every branch owes for every past month, so each row is shown with the evidence
 * behind it, is editable, and is written only if it is ticked. Branches that already have a date
 * come in unticked - they are here to be looked at, not to be overwritten by default.
 */
export function OpeningDateProposals({ rows }: { rows: OpeningRow[] }) {
  const [picked, setPicked] = useState<Set<string>>(
    () => new Set(rows.filter((r) => !r.currentDate && r.proposedDate).map((r) => r.id)),
  );
  const [dates, setDates] = useState<Record<string, string>>(() =>
    Object.fromEntries(rows.map((r) => [r.id, r.currentDate ?? r.proposedDate ?? ""])),
  );
  const [result, setResult] = useState<BranchActionResult | null>(null);
  const [pending, startTransition] = useTransition();

  const missing = useMemo(() => rows.filter((r) => !r.currentDate).length, [rows]);
  const pickedRows = rows.filter((r) => picked.has(r.id));
  const blocked = pickedRows.filter((r) => !dates[r.id]);

  function toggle(id: string) {
    setResult(null);
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function pickAllMissing() {
    setResult(null);
    setPicked(new Set(rows.filter((r) => !r.currentDate && dates[r.id]).map((r) => r.id)));
  }

  function save() {
    const fd = new FormData();
    for (const r of pickedRows) {
      fd.append("branchId", r.id);
      fd.set(`date_${r.id}`, dates[r.id] ?? "");
      fd.set(`name_${r.id}`, r.name);
    }
    setResult(null);
    startTransition(async () => {
      const res = await applyOpeningDatesAction(fd);
      setResult(res);
      if (res.ok) setPicked(new Set());
    });
  }

  if (rows.length === 0) return null;

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">שיוך תאריך פתיחה לכל הסניפים — הצעה לאישור</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            {missing > 0
              ? `ל-${missing} סניפים אין תאריך פתיחה. לכל אחד מוצע כאן תאריך לפי מה שבאמת רשום בו — אפשר לתקן כל שורה, וכלום לא נשמר עד לחיצה על הכפתור למטה.`
              : "לכל הסניפים כבר יש תאריך פתיחה. אפשר לשנות כאן תאריך קיים — רק שורות שסומנו יישמרו."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={pickAllMissing}
            className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-[12.5px] font-bold text-ink transition hover:border-teal hover:text-teal"
          >
            סימון כל הסניפים ללא תאריך
          </button>
          <button
            type="button"
            onClick={() => {
              setPicked(new Set());
              setResult(null);
            }}
            className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-[12.5px] font-bold text-muted transition hover:text-ink"
          >
            ניקוי הסימונים
          </button>
        </div>
      </div>

      {result && (
        <p
          className={`px-4 pt-3 text-[13px] font-bold ${result.ok ? "text-emerald-600" : "text-red-600"}`}
          role="status"
        >
          {result.ok ? "✓ " : "✕ "}
          {result.message}
        </p>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className={`${TH} w-10`} />
              <th className={`${TH} min-w-[170px] whitespace-normal`}>סניף</th>
              <th className={TH}>תאריך פתיחה היום</th>
              <th className={`${TH} min-w-[260px] whitespace-normal`}>על מה מבוססת ההצעה</th>
              <th className={TH}>התאריך שיישמר</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const checked = picked.has(r.id);
              return (
                <tr
                  key={r.id}
                  className={checked ? "bg-teal-bg" : i % 2 ? "bg-[#fafbfd]" : ""}
                >
                  <td className={TD}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(r.id)}
                      className="h-4 w-4 accent-teal"
                      aria-label={`סימון ${r.name}`}
                    />
                  </td>
                  <td className={TD}>
                    <b className="text-ink">{r.name}</b>
                    <div className="mt-0.5 text-[10.5px] text-muted">
                      {TYPE_LABEL[r.branchType] ?? r.branchType}
                    </div>
                    {r.notStarted && (
                      <span className="mt-1 inline-block rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[10.5px] font-extrabold text-[#7a4a12]">
                        מסומן &quot;עדיין לא התחיל לפעול&quot; — השמירה תסיר את הסימון
                      </span>
                    )}
                  </td>
                  <td className={TD}>
                    {r.currentDate ? (
                      <span className="font-bold text-ink">{r.currentDate}</span>
                    ) : (
                      <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[10.5px] font-extrabold text-[#b45309]">
                        אין תאריך
                      </span>
                    )}
                  </td>
                  <td className={`${TD} whitespace-normal text-[11.5px] text-muted`}>
                    {r.proposedDate ? (
                      <>
                        <b className={r.weak ? "text-[#a15c1b]" : "text-teal-dark"}>{r.proposedDate}</b> — {r.note}
                      </>
                    ) : (
                      r.note
                    )}
                  </td>
                  <td className={TD}>
                    <input
                      type="date"
                      value={dates[r.id] ?? ""}
                      onChange={(e) => {
                        setResult(null);
                        setDates((prev) => ({ ...prev, [r.id]: e.target.value }));
                      }}
                      className={DATE_FIELD}
                      aria-label={`תאריך פתיחה ל${r.name}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-card-border px-4 py-3">
        <button
          type="button"
          onClick={save}
          disabled={pending || pickedRows.length === 0 || blocked.length > 0}
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2.5 text-[13.5px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-45"
        >
          {pending ? "שומר..." : `שמירת התאריכים שסומנו (${pickedRows.length})`}
        </button>
        <span className="text-[11.5px] leading-relaxed text-muted">
          {blocked.length > 0
            ? `${blocked.length} שורות מסומנות בלי תאריך — נא למלא תאריך או להסיר את הסימון.`
            : 'רק השורות המסומנות נשמרות. שמירה של תאריך פתיחה מעבירה את הסניף לספר שלו מאותו חודש ומסירה את הסימון "עדיין לא התחיל לפעול".'}
        </span>
      </div>
    </section>
  );
}
