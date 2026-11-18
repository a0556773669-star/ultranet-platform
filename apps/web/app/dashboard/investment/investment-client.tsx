"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Trash2, PiggyBank } from "lucide-react";
import type { InvestmentEntry, InvestmentEntryKind } from "@ultranet/shared-types";
import { Modal } from "@/components/modal";
import { useToast } from "@/lib/toast";
import {
  EXPENSE_CATEGORIES,
  INVESTMENT_TERMS,
  KIND_LABELS,
  type InvestmentSummary,
} from "@/lib/investment";
import { deleteInvestmentEntryAction, saveInvestmentEntryAction } from "./actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function dmy(date: string) {
  const [y, m, d] = date.split("-");
  return `${d}.${m}.${y}`;
}

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";
const TH = "px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-3 py-2 text-[13px]";

const KIND_TONE: Record<InvestmentEntryKind, string> = {
  deposit: "bg-teal-bg text-teal-dark",
  expense: "bg-red-50 text-red-700",
  income: "bg-green-50 text-green-700",
  profit_payout: "bg-amber-50 text-amber-800",
  principal_return: "bg-slate-100 text-slate-700",
};

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "bad" | "good" }) {
  return (
    <div className="rounded-card border border-card-border bg-white p-3 shadow-card">
      <div className="text-[11px] font-bold text-muted">{label}</div>
      <div
        className={`mt-0.5 text-xl font-black tabular-nums ${tone === "bad" ? "text-red-600" : tone === "good" ? "text-green-700" : "text-ink"}`}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-muted">{hint}</div>}
    </div>
  );
}

type Draft = {
  id?: string;
  kind: InvestmentEntryKind;
  date: string;
  amount: string;
  description: string;
  category: string;
  expenseType: "capital" | "operating";
  note: string;
};

function blank(kind: InvestmentEntryKind, today: string): Draft {
  return { kind, date: today, amount: "", description: "", category: EXPENSE_CATEGORIES[0], expenseType: "capital", note: "" };
}

export function InvestmentClient({
  entries,
  summary: s,
  isOwner,
  today,
}: {
  entries: InvestmentEntry[];
  summary: InvestmentSummary;
  isOwner: boolean;
  today: string;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [filter, setFilter] = useState<InvestmentEntryKind | "all">("all");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  const shown = filter === "all" ? entries : entries.filter((e) => e.kind === filter);

  function save() {
    if (!draft) return;
    startTransition(async () => {
      const r = await saveInvestmentEntryAction({
        id: draft.id,
        kind: draft.kind,
        date: draft.date,
        amount: Number(draft.amount),
        description: draft.description,
        category: draft.category,
        expenseType: draft.expenseType,
        note: draft.note,
      });
      if (r.ok) {
        showSuccess(r.message);
        setDraft(null);
        router.refresh();
      } else showError(r.message);
    });
  }

  function remove(e: InvestmentEntry) {
    if (!window.confirm(`למחוק את "${e.description}" (${money(e.amount)}, ${dmy(e.date)})?`)) return;
    startTransition(async () => {
      const r = await deleteInvestmentEntryAction(e.id);
      if (r.ok) {
        showSuccess(r.message);
        router.refresh();
      } else showError(r.message);
    });
  }

  const balanceNegative = s.fundBalance < 0;

  return (
    <>
      {toastNode}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="הושקע עד היום" value={money(s.deposited)} hint={`מתוך תקרה ${money(INVESTMENT_TERMS.cap)} · נשאר ${money(s.capRemaining)}`} />
        <Stat label="הוצאות הפרויקט" value={money(s.expensesTotal)} hint={`הקמה ופיתוח ${money(s.capitalExpenses)} · שוטפות ${money(s.operatingExpenses)}`} />
        <Stat
          label={balanceNegative ? "ממתין להעברה מהמשקיע" : "יתרה בקרן"}
          value={money(Math.abs(s.fundBalance))}
          tone={balanceNegative ? "bad" : "good"}
          hint={balanceNegative ? "הוצאות שמומנו ועוד לא כוסו בהעברה" : "הפקדות פחות הוצאות"}
        />
        <Stat label="הכנסות הפרויקט" value={money(s.incomeTotal)} hint={`רווח נקי מצטבר ${money(s.netProfit)}`} tone={s.netProfit < 0 ? "bad" : undefined} />
        <Stat label="חלק המשקיע ברווחים (25%)" value={money(s.investorShareAccrued)} hint={`שולם ${money(s.investorPaid)}`} />
        <Stat label="ממתין לתשלום למשקיע" value={money(s.investorOwed)} tone={s.investorOwed > 0 ? "bad" : undefined} hint="חלק שנצבר פחות מה ששולם" />
        <Stat label="תשואה שנתית (מחושב)" value={`${s.annualizedReturnPct.toLocaleString("he-IL")}%`} hint={`יעד קבוע ${INVESTMENT_TERMS.floorRate * 100}%–${INVESTMENT_TERMS.ceilingRate * 100}% בפירעון`} />
        <Stat label="חסר ליעד 9% / 13%" value={`${money(s.shortfallToFloor)} / ${money(s.shortfallToCeiling)}`} hint="השלמה בפירעון לפי סעיף 5 (מחושב, לא התחייבות)" />
      </div>

      <div className="rounded-card border border-card-border bg-white p-3 shadow-card">
        <div className="flex items-center justify-between text-[12px] font-bold text-muted">
          <span>ניצול התקרה</span>
          <span>{money(s.deposited)} / {money(INVESTMENT_TERMS.cap)}</span>
        </div>
        <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#eef1f5]">
          <div className="h-full rounded-full bg-teal" style={{ width: `${s.capUsedPct}%` }} />
        </div>
      </div>

      {isOwner && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDraft(blank("deposit", today))} className="flex items-center gap-1.5 rounded-lg bg-teal px-3 py-2 text-sm font-bold text-white hover:opacity-90">
            <Plus className="h-4 w-4" /> העברה מהמשקיע
          </button>
          <button type="button" onClick={() => setDraft(blank("expense", today))} className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-[#f4f6f9]">
            <Plus className="h-4 w-4" /> הוצאה
          </button>
          <button type="button" onClick={() => setDraft(blank("income", today))} className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-[#f4f6f9]">
            <Plus className="h-4 w-4" /> הכנסה
          </button>
          <button type="button" onClick={() => setDraft(blank("profit_payout", today))} className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-[#f4f6f9]">
            <Plus className="h-4 w-4" /> תשלום רווחים למשקיע
          </button>
          <button type="button" onClick={() => setDraft(blank("principal_return", today))} className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-2 text-sm font-bold text-ink hover:bg-[#f4f6f9]">
            <Plus className="h-4 w-4" /> החזר קרן
          </button>
        </div>
      )}

      <section className="rounded-card border border-card-border bg-white shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
            <PiggyBank className="h-4 w-4" /> ספר תנועות ({shown.length})
          </h2>
          <select value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)} className="rounded-lg border border-card-border bg-white px-2 py-1 text-xs">
            <option value="all">כל התנועות</option>
            {(Object.keys(KIND_LABELS) as InvestmentEntryKind[]).map((k) => (
              <option key={k} value={k}>{KIND_LABELS[k]}</option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className={TH}>תאריך</th>
                <th className={TH}>סוג</th>
                <th className={TH}>תיאור</th>
                <th className={TH}>קטגוריה</th>
                <th className={TH}>סכום</th>
                {isOwner && <th className={TH} />}
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted">עוד אין תנועות. {isOwner ? "הוסף העברה או הוצאה ראשונה." : ""}</td>
                </tr>
              )}
              {shown.map((e) => (
                <tr key={e.id} className="border-b border-card-border/60 last:border-0">
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>{dmy(e.date)}</td>
                  <td className={TD}>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${KIND_TONE[e.kind]}`}>{KIND_LABELS[e.kind]}</span>
                  </td>
                  <td className={TD}>
                    {e.description}
                    {e.note && <div className="text-[11px] text-muted">{e.note}</div>}
                  </td>
                  <td className={`${TD} text-muted`}>
                    {e.kind === "expense" ? `${e.category ?? "אחר"} · ${e.expenseType === "operating" ? "שוטפת" : "הקמה/פיתוח"}` : ""}
                  </td>
                  <td className={`${TD} whitespace-nowrap font-bold tabular-nums`}>{money(e.amount)}</td>
                  {isOwner && (
                    <td className={`${TD} whitespace-nowrap`}>
                      <button
                        type="button"
                        aria-label="עריכה"
                        className="ml-2 text-muted hover:text-ink"
                        onClick={() =>
                          setDraft({
                            id: e.id,
                            kind: e.kind,
                            date: e.date,
                            amount: String(e.amount),
                            description: e.description,
                            category: e.category ?? EXPENSE_CATEGORIES[0],
                            expenseType: e.expenseType ?? "capital",
                            note: e.note ?? "",
                          })
                        }
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button type="button" aria-label="מחיקה" className="text-muted hover:text-red-600" onClick={() => remove(e)}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-card border border-card-border bg-white shadow-card">
        <h2 className="border-b border-card-border px-4 py-3 text-sm font-extrabold text-ink">התחשבנות חודשית</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-card-border">
                <th className={TH}>חודש</th>
                <th className={TH}>הכנסות</th>
                <th className={TH}>הוצאות שוטפות</th>
                <th className={TH}>רווח נקי</th>
                <th className={TH}>למשקיע 25%</th>
                <th className={TH}>ליזם 75%</th>
                <th className={TH}>שולם למשקיע</th>
                <th className={TH}>הוצאות הקמה</th>
              </tr>
            </thead>
            <tbody>
              {s.months.map((m) => (
                <tr key={m.month} className="border-b border-card-border/60 last:border-0">
                  <td className={`${TD} tabular-nums`}>{m.month.split("-").reverse().join(".")}</td>
                  <td className={`${TD} tabular-nums`}>{money(m.income)}</td>
                  <td className={`${TD} tabular-nums`}>{money(m.operatingExpenses)}</td>
                  <td className={`${TD} font-bold tabular-nums ${m.net < 0 ? "text-red-600" : ""}`}>{money(m.net)}</td>
                  <td className={`${TD} tabular-nums`}>{money(m.investorShare)}</td>
                  <td className={`${TD} tabular-nums`}>{money(m.founderShare)}</td>
                  <td className={`${TD} tabular-nums`}>{money(m.payouts)}</td>
                  <td className={`${TD} tabular-nums text-muted`}>{money(m.capitalExpenses)}</td>
                </tr>
              ))}
              {s.months.length === 0 && (
                <tr><td colSpan={8} className="px-3 py-6 text-center text-sm text-muted">אין עדיין חודשים.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {s.expensesByCategory.length > 0 && (
        <section className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <h2 className="mb-2 text-sm font-extrabold text-ink">הוצאות לפי קטגוריה</h2>
          <ul className="flex flex-col gap-1 text-[13px]">
            {s.expensesByCategory.map((c) => (
              <li key={c.category} className="flex justify-between">
                <span className="text-muted">{c.category}</span>
                <span className="font-bold tabular-nums">{money(c.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="rounded-card border border-card-border bg-[#f9fafb] p-4 text-[12.5px] leading-relaxed text-muted">
        <h2 className="mb-1 text-sm font-extrabold text-ink">עיקרי ההסכם</h2>
        <ul className="list-disc pr-5">
          <li>תקרת השקעה {money(INVESTMENT_TERMS.cap)}: {money(INVESTMENT_TERMS.initial)} בחתימה, היתרה לפי צורכי הפיתוח.</li>
          <li>רווח נקי חודשי (הכנסות פחות הוצאות תפעוליות): 75% ליזם, 25% למשקיע.</li>
          <li>בפירעון: ריבית קבועה 9% לשנה על הקרן, עם השלמה עד 13% ללא כפל; החזר קרן מלא בכל מקרה.</li>
          <li>תקופת התקשרות ראשונה 24 חודשים; יציאה בהודעה של 90 יום. היזם מוסר דוח עד ה-5 בחודש והמשקיע מעביר עד ה-9.</li>
          <li>מספרי הריבית והחלוקה כאן הם חישוב מידע לפי הנחות מפורטות ב-SPEC, ולא תחליף לקריאת ההסכם.</li>
        </ul>
      </section>

      {draft && (
        <Modal title={`${draft.id ? "עריכת" : "הוספת"} ${KIND_LABELS[draft.kind]}`} onClose={() => setDraft(null)}>
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={LABEL}>תאריך</span>
                <input type="date" className={FIELD} value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
              </label>
              <label>
                <span className={LABEL}>סכום ב-₪</span>
                <input type="number" min={0} step="0.01" className={FIELD} value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value })} />
              </label>
            </div>
            <label>
              <span className={LABEL}>סוג</span>
              <select className={FIELD} value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as InvestmentEntryKind })}>
                {(Object.keys(KIND_LABELS) as InvestmentEntryKind[]).map((k) => (
                  <option key={k} value={k}>{KIND_LABELS[k]}</option>
                ))}
              </select>
            </label>
            <label>
              <span className={LABEL}>תיאור</span>
              <input className={FIELD} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder="למשל: העברה ראשונה בחתימה / משכורת מפתחת נובמבר" />
            </label>
            {draft.kind === "expense" && (
              <div className="grid grid-cols-2 gap-3">
                <label>
                  <span className={LABEL}>קטגוריה</span>
                  <select className={FIELD} value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className={LABEL}>סוג הוצאה</span>
                  <select className={FIELD} value={draft.expenseType} onChange={(e) => setDraft({ ...draft, expenseType: e.target.value as Draft["expenseType"] })}>
                    <option value="capital">הקמה / פיתוח (מקרן ההשקעה)</option>
                    <option value="operating">שוטפת (מנוכה מהרווח)</option>
                  </select>
                </label>
              </div>
            )}
            <label>
              <span className={LABEL}>הערה (רשות)</span>
              <input className={FIELD} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
            </label>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="rounded-lg border border-card-border px-3 py-2 text-sm font-bold text-muted">ביטול</button>
              <button type="button" disabled={isPending} onClick={save} className="rounded-lg bg-teal px-4 py-2 text-sm font-bold text-white disabled:opacity-60">
                {isPending ? "שומר..." : "שמירה"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
