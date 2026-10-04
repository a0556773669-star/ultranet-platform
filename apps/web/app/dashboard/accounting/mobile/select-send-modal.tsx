"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ListChecks, X } from "lucide-react";
import type { BranchSendOutcome } from "@/lib/branch-report-send";
import { sendSelectedReportsAction } from "./report-actions";

/** שורה אחת בטבלת הבחירה: סניף, לאן יישלח, כמה הוא צריך להעביר החודש, והאם כבר נשלח. */
export interface SendChoiceRow {
  branchId: string;
  branchName: string;
  email: string | null;
  /** "צריך להעביר" של החודש, כולל יתרה קודמת: חיובי = הסניף מעביר לי */
  totalDue: number;
  sent: boolean;
}

function money(n: number) {
  return `${Math.round(Math.abs(n)).toLocaleString("he-IL")} ₪`;
}

/**
 * "שליחה לסניפים נבחרים" — טבלה עם תיבת סימון בכל שורה ומה שכל סניף צריך להעביר החודש,
 * כדי לשלוח רק למי שבאמת צריך (למשל רק מי שחייב סכום משמעותי). סניף שכבר קיבל את הדו"ח
 * של החודש לא מסומן מראש, אבל אפשר לסמן אותו ולשלוח שוב.
 */
export function SelectSendModal({
  month,
  monthLabel,
  rows,
  blocker,
  onClose,
}: {
  month: string;
  monthLabel: string;
  rows: SendChoiceRow[];
  /** הודעה כשהשליחה לא מוגדרת או במצב בדיקה — מוצגת מעל הטבלה */
  blocker: string | null;
  onClose: () => void;
}) {
  const sorted = useMemo(() => [...rows].sort((a, b) => b.totalDue - a.totalDue), [rows]);
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(sorted.filter((r) => r.email && !r.sent && r.totalDue >= 1).map((r) => r.branchId)),
  );
  const [minAmount, setMinAmount] = useState("");
  const [outcomes, setOutcomes] = useState<BranchSendOutcome[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const sendable = sorted.filter((r) => r.email);
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  function selectAbove() {
    const min = Number(minAmount) || 0;
    setSelected(new Set(sendable.filter((r) => r.totalDue >= min && r.totalDue > 0).map((r) => r.branchId)));
  }

  const selectedTotal = sorted.filter((r) => selected.has(r.branchId)).reduce((s, r) => s + r.totalDue, 0);

  function send() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await sendSelectedReportsAction(month, [...selected]);
        setOutcomes(result);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "אירעה שגיאה בשליחה");
      }
    });
  }

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/40 p-4" dir="rtl" onClick={onClose}>
      <div
        className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-card border border-card-border bg-white p-5 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
            <ListChecks className="h-4 w-4" />
            שליחה לסניפים נבחרים — {monthLabel}
          </h2>
          <button type="button" onClick={onClose} className="text-muted hover:text-ink" aria-label="סגירה">
            <X className="h-5 w-5" />
          </button>
        </div>

        {outcomes ? (
          <div className="flex flex-col gap-2">
            {outcomes.map((o) => (
              <div
                key={o.branchId || o.message}
                className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-[12px] ${
                  o.ok ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
                }`}
              >
                {o.ok ? (
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
                )}
                <div>
                  <div className="font-bold text-ink">{o.branchName || "—"}</div>
                  <div className={o.ok ? "text-emerald-800" : "text-red-700"}>{o.message}</div>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={onClose}
              className="mt-1 self-start rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-[#f1f5f9]"
            >
              סגירה
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {blocker && (
              <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] leading-relaxed text-amber-900">
                {blocker}
              </p>
            )}

            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="font-bold text-muted">סמן את כל מי שצריך להעביר לפחות</span>
              <input
                type="number"
                min={0}
                step={50}
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-24 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1 text-xs"
                placeholder="₪"
              />
              <button
                type="button"
                onClick={selectAbove}
                className="rounded-lg border border-card-border bg-white px-2.5 py-1 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
              >
                סמן
              </button>
              <span className="mx-1 text-card-border">|</span>
              <button
                type="button"
                onClick={() => setSelected(new Set(sendable.map((r) => r.branchId)))}
                className="text-xs font-bold text-teal-dark"
              >
                סמן הכל
              </button>
              <button type="button" onClick={() => setSelected(new Set())} className="text-xs font-bold text-muted">
                נקה
              </button>
            </div>

            <div className="overflow-hidden rounded-lg border border-card-border">
              <table className="w-full text-right text-[13px]">
                <thead className="bg-[#f4f6f9] text-[11px] font-bold text-muted">
                  <tr>
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2">סניף</th>
                    <th className="px-2 py-2">צריך להעביר</th>
                    <th className="px-2 py-2">מייל</th>
                    <th className="px-2 py-2">החודש</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {sorted.map((r) => {
                    const on = selected.has(r.branchId);
                    return (
                      <tr
                        key={r.branchId}
                        onClick={() => r.email && toggle(r.branchId)}
                        className={`border-t border-card-border ${r.email ? "cursor-pointer hover:bg-[#f9fafb]" : "opacity-50"} ${
                          on ? "bg-teal-bg/40" : ""
                        }`}
                      >
                        <td className="px-2 py-1.5 text-center">
                          <input
                            type="checkbox"
                            checked={on}
                            disabled={!r.email}
                            onChange={() => toggle(r.branchId)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </td>
                        <td className="px-2 py-1.5 font-bold text-ink">{r.branchName}</td>
                        <td className="px-2 py-1.5">
                          {Math.abs(r.totalDue) < 1 ? (
                            <span className="text-muted">מאוזן</span>
                          ) : (
                            <span className={`font-extrabold ${r.totalDue > 0 ? "text-emerald-700" : "text-red-600"}`}>
                              {r.totalDue > 0 ? "+" : "−"}
                              {money(r.totalDue)}
                            </span>
                          )}
                        </td>
                        <td className="px-2 py-1.5 text-[11.5px] text-muted" dir="ltr">
                          {r.email ?? <span dir="rtl" className="text-red-600">אין כתובת</span>}
                        </td>
                        <td className="px-2 py-1.5 text-[11px]">
                          {r.sent ? (
                            <span className="rounded-full bg-emerald-50 px-2 py-0.5 font-bold text-emerald-700">נשלח</span>
                          ) : (
                            <span className="text-muted">עוד לא</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[11px] leading-relaxed text-muted">
              <span className="font-bold text-emerald-700">+ ירוק</span> = הסניף מעביר אליך;{" "}
              <span className="font-bold text-red-600">− אדום</span> = אתה מעביר אליו. סניף שכבר קיבל את הדו&quot;ח
              החודש לא מסומן מראש — סימון שלו שולח אותו שוב.
            </p>

            {error && <p className="text-[12px] font-bold text-red-600">{error}</p>}

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={send}
                disabled={isPending || selected.size === 0}
                className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
              >
                {isPending ? "שולח..." : `שלח ל-${selected.size} סניפים`}
              </button>
              {selected.size > 0 && (
                <span className="text-[12px] text-muted">
                  {'סה"כ'} אצל הנבחרים: <b className="text-ink">{money(selectedTotal)}</b>
                </span>
              )}
              <button
                type="button"
                onClick={onClose}
                className="mr-auto rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-[#f1f5f9]"
              >
                ביטול
              </button>
            </div>
            <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] font-bold text-amber-900">
              שים לב: זה שולח מייל אמיתי לשותפים. אי אפשר לבטל מייל שנשלח.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
