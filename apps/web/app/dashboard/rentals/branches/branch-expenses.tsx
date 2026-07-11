import type { FixedExpense, VariableExpense } from "@ultranet/shared-types";
import {
  createFixedExpenseAction,
  endFixedExpenseAction,
  deleteFixedExpenseAction,
  createVariableExpenseAction,
  deleteVariableExpenseAction,
} from "./expenses-actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

const CATEGORIES = ["שכירות", "חשמל ומים", "משכורות", "ציוד ותחזוקה", "שיווק ופרסום", "ביטוח", "אחר"];

const PAYER_LABELS: Record<string, string> = {
  owner: "🔒 שלי בלבד",
  shared_mine: "🤝 שלי (משותף)",
  shared_theirs: "🤝 שלו (משותף)",
};

function sum(nums: number[]) {
  return nums.reduce((a, b) => a + b, 0);
}

type Props = {
  branchId: string;
  isPartner: boolean;
  fixedExpenses: FixedExpense[];
  variableExpenses: VariableExpense[];
};

export function BranchExpenses({ branchId, isPartner, fixedExpenses, variableExpenses }: Props) {
  const activeFixed = fixedExpenses.filter((e) => !e.endDate);
  const endedFixed = fixedExpenses.filter((e) => e.endDate);

  const payerOptions = (
    <select name="payer" defaultValue="owner" className={FIELD}>
      <option value="owner">{PAYER_LABELS.owner}</option>
      <option value="shared_mine">{PAYER_LABELS.shared_mine}</option>
      <option value="shared_theirs">{PAYER_LABELS.shared_theirs}</option>
    </select>
  );

  let balanceCard = null;
  if (isPartner) {
    const sharedMineTotal =
      sum(activeFixed.filter((e) => e.payer === "shared_mine").map((e) => e.amount ?? 0)) +
      sum(variableExpenses.filter((e) => e.payer === "shared_mine").map((e) => e.amount));
    const sharedTheirsTotal =
      sum(activeFixed.filter((e) => e.payer === "shared_theirs").map((e) => e.amount ?? 0)) +
      sum(variableExpenses.filter((e) => e.payer === "shared_theirs").map((e) => e.amount));
    const partnerOwesMe = sharedMineTotal / 2;
    const iOweThePartner = sharedTheirsTotal / 2;
    const net = partnerOwesMe - iOweThePartner;

    balanceCard = (
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"השותף חייב לי"}</p>
          <p className="mt-1 text-xl font-black text-emerald-600">{partnerOwesMe.toLocaleString()} ₪</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"אני חייב לשותף"}</p>
          <p className="mt-1 text-xl font-black text-red-600">{iOweThePartner.toLocaleString()} ₪</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{"מאזן נקי"}</p>
          <p className={`mt-1 text-xl font-black ${net >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {net.toLocaleString()} ₪
          </p>
        </div>
      </div>
    );
  }

  const createFixedBound = createFixedExpenseAction.bind(null, branchId);
  const createVariableBound = createVariableExpenseAction.bind(null, branchId);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-extrabold text-ink">{"🧾 הוצאות הסניף"}</h2>
        <p className="text-[13px] text-muted">
          {"תמונת מצב ראשונית - לא מחובר להנה\"ח המרכזית עדיין"}
        </p>
      </div>

      {balanceCard}

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
          <span>{"📅 הוצאות קבועות / חודשיות"}</span>
          <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{activeFixed.length}</span>
        </div>

        <form
          action={createFixedBound}
          className="grid grid-cols-1 gap-3 rounded-card border border-card-border bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className={LABEL}>{"שם הוצאה"}</label>
            <input name="name" required className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{"סכום חודשי"}</label>
            <input type="number" name="amount" min={0} required className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{"תאריך התחלה"}</label>
            <input type="date" name="startDate" required className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{"קטגוריה"}</label>
            <select name="category" defaultValue="" className={FIELD}>
              <option value="">{"ללא"}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {isPartner && (
            <div>
              <label className={LABEL}>{"מי משלם"}</label>
              {payerOptions}
            </div>
          )}
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              {"הוספה"}
            </button>
          </div>
        </form>

        <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
          {activeFixed.length === 0 && <p className="py-6 text-center text-sm text-muted">{"אין הוצאות קבועות פעילות"}</p>}
          {activeFixed.map((e) => {
            const endBound = endFixedExpenseAction.bind(null, e.id, branchId);
            const deleteBound = deleteFixedExpenseAction.bind(null, e.id, branchId);
            return (
              <div key={e.id} className="flex flex-wrap items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                <div className="flex-1">
                  <div className="font-bold text-ink">
                    {e.name}
                    {e.category ? ` · ${e.category}` : ""}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {`מ-${e.startDate}`}
                    {isPartner && e.payer ? ` · ${PAYER_LABELS[e.payer] ?? e.payer}` : ""}
                  </div>
                </div>
                <div className="min-w-[75px] text-left font-extrabold text-red-600">{(e.amount ?? 0).toLocaleString()} ₪</div>
                <form action={endBound} className="flex items-center gap-1">
                  <input type="date" name="endDate" className="rounded-lg border border-card-border px-2 py-1 text-[11px]" />
                  <button type="submit" className="rounded-lg border border-card-border px-2.5 py-1 text-[11px] font-medium text-ink transition hover:bg-[#f4f6f9]">
                    {"סיום"}
                  </button>
                </form>
                <form action={deleteBound}>
                  <button type="submit" className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50">
                    {"מחיקה"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>

        {endedFixed.length > 0 && (
          <details className="rounded-card border border-dashed border-card-border bg-white px-4">
            <summary className="cursor-pointer py-2.5 text-xs font-bold text-muted">
              {`הוצאות קבועות שהסתיימו (${endedFixed.length})`}
            </summary>
            {endedFixed.map((e) => (
              <div key={e.id} className="flex items-center gap-2.5 border-t border-card-border py-2.5 text-[13px] text-muted">
                <div className="flex-1">
                  {e.name} · {e.startDate} → {e.endDate}
                </div>
                <div className="min-w-[75px] text-left">{(e.amount ?? 0).toLocaleString()} ₪</div>
              </div>
            ))}
          </details>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
          <span>{"🧾 הוצאות חד פעמיות"}</span>
          <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{variableExpenses.length}</span>
        </div>

        <form
          action={createVariableBound}
          className="grid grid-cols-1 gap-3 rounded-card border border-card-border bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
        >
          <div>
            <label className={LABEL}>{"תיאור"}</label>
            <input name="desc" required className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{"סכום"}</label>
            <input type="number" name="amount" min={0} required className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{"תאריך"}</label>
            <input type="date" name="date" required className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{"קטגוריה"}</label>
            <select name="category" defaultValue="" className={FIELD}>
              <option value="">{"ללא"}</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          {isPartner && (
            <div>
              <label className={LABEL}>{"מי משלם"}</label>
              {payerOptions}
            </div>
          )}
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              {"הוספה"}
            </button>
          </div>
        </form>

        <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
          {variableExpenses.length === 0 && (
            <p className="py-6 text-center text-sm text-muted">{"אין הוצאות חד פעמיות עדיין"}</p>
          )}
          {variableExpenses.map((e) => {
            const deleteBound = deleteVariableExpenseAction.bind(null, e.id, branchId);
            return (
              <div key={e.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                <div className="flex-1">
                  <div className="font-bold text-ink">
                    {e.desc}
                    {e.category ? ` · ${e.category}` : ""}
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">
                    {e.date}
                    {isPartner && e.payer ? ` · ${PAYER_LABELS[e.payer] ?? e.payer}` : ""}
                  </div>
                </div>
                <div className="min-w-[75px] text-left font-extrabold text-red-600">{e.amount.toLocaleString()} ₪</div>
                <form action={deleteBound}>
                  <button type="submit" className="rounded-lg border border-red-200 px-2.5 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50">
                    {"מחיקה"}
                  </button>
                </form>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
