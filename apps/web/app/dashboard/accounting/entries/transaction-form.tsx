"use client";

/**
 * The one form that creates money.
 *
 * It replaced three income forms and one expense form, and with them the need to decide up front
 * which of seven collections a shekel belongs in. The owner answers three questions instead -
 * how much, which layer, which node - and the split, the recurrence and the free percentage are
 * fields on the same row rather than reasons to invent another collection.
 *
 * The live preview at the bottom exists because the classification has consequences the owner
 * should see before saving: an operating expense reaches the branch's profit and the partner's
 * settlement, a capital one reaches neither.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle } from "lucide-react";
import type { TxBusiness, TxNature } from "@ultranet/shared-types";
import { TX_NATURE_HELP, TX_NATURE_LABEL, evenAllocations } from "@/lib/tx";
import { ACCOUNTING_EXPENSE_CATEGORIES, ACCOUNTING_INCOME_CATEGORIES } from "@/lib/accounting-categories";
import { createTransactionAction, type SaveResult } from "./tx-actions";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const LABEL = "mb-1 block text-[11px] font-extrabold tracking-wide text-muted";
const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-2 text-[13px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";

export interface FormBranch {
  id: string;
  name: string;
  business: TxBusiness;
  hasPartner: boolean;
}

const NATURES: TxNature[] = ["operating", "capital", "transfer"];

export function TransactionForm({ branches, ownerName }: { branches: FormBranch[]; ownerName: string }) {
  const router = useRouter();
  const [direction, setDirection] = useState<"in" | "out">("out");
  const [nature, setNature] = useState<TxNature>("operating");
  const [business, setBusiness] = useState<TxBusiness>("rentals");
  const [branchId, setBranchId] = useState("");
  const [amount, setAmount] = useState("");
  const [ownerPct, setOwnerPct] = useState("100");
  const [splitIds, setSplitIds] = useState<string[]>([]);
  const [recurring, setRecurring] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [busy, setBusy] = useState(false);

  const unitBranches = branches.filter((b) => b.business === business);
  const selected = branches.find((b) => b.id === branchId);
  const amountNum = Number(amount) || 0;

  // Capital is never split with anyone (כלל 7), so the share control is meaningless for it.
  const showOwnerShare = nature === "operating" && (selected?.hasPartner || splitIds.length > 0);
  const effectiveOwnerPct = nature === "capital" ? 100 : Number(ownerPct) || 0;
  const ownerShare = (amountNum * effectiveOwnerPct) / 100;
  const split = splitIds.length > 0 ? evenAllocations(amountNum, splitIds) : [];

  function toggleSplit(id: string) {
    setSplitIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(formData: FormData) {
    setBusy(true);
    setResult(null);
    const res = await createTransactionAction(formData);
    setBusy(false);
    setResult(res);
    if (res.ok) {
      setAmount("");
      setSplitIds([]);
      router.refresh();
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-card border border-card-border bg-white p-4 shadow-card">
      <div>
        <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-ink">
          <PlusCircle className="h-4 w-4" />
          תנועה חדשה
        </h2>
        <p className="mt-0.5 text-[12px] text-muted">
          המסך היחיד במערכת שיוצר כסף. כל מסך אחר מסווג, מפצל ומציג — לא יוצר.
        </p>
      </div>

      {/* --- direction ---------------------------------------------------- */}
      <div className="flex gap-1 rounded-xl border border-card-border bg-[#f4f6f9] p-1">
        {(["out", "in"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={`flex-1 rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition ${
              direction === d ? "bg-white text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            {d === "out" ? "כסף יוצא" : "כסף נכנס"}
          </button>
        ))}
      </div>
      <input type="hidden" name="direction" value={direction} />

      {/* --- nature: the field that picks the layer ------------------------ */}
      <div>
        <span className={LABEL}>סוג התנועה</span>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-3">
          {NATURES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setNature(n)}
              className={`rounded-lg border px-3 py-2 text-right transition ${
                nature === n
                  ? "border-teal bg-teal-bg text-teal-dark"
                  : "border-card-border bg-white text-muted hover:border-teal/50"
              }`}
            >
              <span className="block text-[13px] font-extrabold">{TX_NATURE_LABEL[n]}</span>
              <span className="mt-0.5 block text-[10.5px] leading-tight">{TX_NATURE_HELP[n]}</span>
            </button>
          ))}
        </div>
      </div>
      <input type="hidden" name="nature" value={nature} />

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={LABEL} htmlFor="tx-date">
            תאריך
          </label>
          <input
            id="tx-date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="tx-amount">
            סכום מלא (לפני כל חלוקה)
          </label>
          <input
            id="tx-amount"
            name="amount"
            type="number"
            min={1}
            step="1"
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="tx-business">
            יחידה עסקית
          </label>
          <select
            id="tx-business"
            name="business"
            value={business}
            onChange={(e) => {
              setBusiness(e.target.value as TxBusiness);
              setBranchId("");
              setSplitIds([]);
            }}
            className={FIELD}
          >
            <option value="rentals">השכרות ניידים</option>
            <option value="computers">חדרי מחשבים</option>
            <option value="coworking">משרד שיתופי</option>
            <option value="hq">מטה</option>
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="tx-branch">
            צומת
          </label>
          <select
            id="tx-branch"
            name="branchId"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={FIELD}
          >
            <option value="">{business === "hq" ? "מטה" : "משותף — כל היחידה"}</option>
            {unitBranches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="-mt-1 text-[11.5px] leading-relaxed text-muted">
        תייג בצומת הנמוכה ביותר שאתה באמת יודע. לא יודע לאיזה סניף? &quot;משותף&quot; היא תשובה נכונה
        ותקינה — צומת-אב שמחזיקה סכומים אמיתיים היא סימן לבריאות, לא לרשלנות.
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className={LABEL} htmlFor="tx-desc">
            תיאור
          </label>
          <input id="tx-desc" name="desc" placeholder="אינטרנט · חשבון מרץ" className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="tx-category">
            קטגוריה
          </label>
          <select id="tx-category" name="category" defaultValue="" className={FIELD}>
            <option value="">— ללא —</option>
            {(direction === "in" ? ACCOUNTING_INCOME_CATEGORIES : ACCOUNTING_EXPENSE_CATEGORIES).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="tx-paidBy">
            מי שילם / קיבל בפועל
          </label>
          <select id="tx-paidBy" name="paidBy" defaultValue="owner" className={FIELD}>
            <option value="owner">{ownerName}</option>
            <option value="partner">השותף</option>
          </select>
        </div>
      </div>

      {/* --- the free percentage that used to need its own collection ------ */}
      {showOwnerShare && (
        <div className="rounded-card border border-card-border bg-[#f9fafb] px-3 py-2.5">
          <label className={LABEL} htmlFor="tx-ownerPct">
            כמה מזה על {ownerName} (%)
          </label>
          <input
            id="tx-ownerPct"
            name="ownerPct"
            type="number"
            min={0}
            max={100}
            step="1"
            value={ownerPct}
            onChange={(e) => setOwnerPct(e.target.value)}
            className={`${FIELD} max-w-[140px]`}
          />
          <p className="mt-1.5 text-[11.5px] text-muted">
            אחוז חופשי, לא רק 0/50/100 — לכן הוצאה רב-סניפית ואזור פרסום לא צריכים קולקשן משלהם.
            {amountNum > 0 && (
              <>
                {" "}
                מתוך {money(amountNum)}: על {ownerName} {money(ownerShare)}, על הסניפים{" "}
                {money(amountNum - ownerShare)}.
              </>
            )}
          </p>
        </div>
      )}
      {!showOwnerShare && <input type="hidden" name="ownerPct" value={nature === "capital" ? 100 : ownerPct} />}

      {/* --- split across branches ----------------------------------------- */}
      {nature === "operating" && unitBranches.length > 0 && (
        <details className="rounded-card border border-card-border bg-[#f9fafb] px-3 py-2.5">
          <summary className="cursor-pointer text-[12.5px] font-extrabold text-ink">
            פיצול בין כמה סניפים {splitIds.length > 0 && `(${splitIds.length} נבחרו)`}
          </summary>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {unitBranches.map((b) => (
              <label
                key={b.id}
                className={`cursor-pointer rounded-full border px-2.5 py-1 text-[11.5px] font-bold transition ${
                  splitIds.includes(b.id)
                    ? "border-teal bg-teal-bg text-teal-dark"
                    : "border-card-border bg-white text-muted"
                }`}
              >
                <input
                  type="checkbox"
                  name="splitBranchIds"
                  value={b.id}
                  checked={splitIds.includes(b.id)}
                  onChange={() => toggleSplit(b.id)}
                  className="sr-only"
                />
                {b.name}
              </label>
            ))}
          </div>
          {split.length > 0 && (
            <p className="mt-2 text-[11.5px] text-muted">
              {split.map((a) => `${branches.find((b) => b.id === a.branchId)?.name}: ${money(a.amount)}`).join(" · ")}
              {" — "}
              <b className="text-ink">סכום הפיצולים {money(split.reduce((s, a) => s + a.amount, 0))}</b>, שווה
              בדיוק לסכום התנועה. שארית עיגול הולכת לסניף הראשון.
            </p>
          )}
        </details>
      )}

      {/* --- recurrence: what the fixed-expense collection was ------------- */}
      <details
        className="rounded-card border border-card-border bg-[#f9fafb] px-3 py-2.5"
        onToggle={(e) => setRecurring((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-[12.5px] font-extrabold text-ink">
          תנועה חוזרת כל חודש {recurring && "(פעיל)"}
        </summary>
        <div className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          <div>
            <label className={LABEL} htmlFor="tx-from">
              מחודש
            </label>
            <input id="tx-from" name="recurringFrom" type="month" className={FIELD} />
          </div>
          <div>
            <label className={LABEL} htmlFor="tx-to">
              עד חודש (ריק = ממשיך)
            </label>
            <input id="tx-to" name="recurringTo" type="month" className={FIELD} />
          </div>
        </div>
        <p className="mt-1.5 text-[11.5px] text-muted">
          השורות החודשיות נוצרות בזמן קריאה, לא נכתבות לבסיס הנתונים — זו כל תפקידה של קולקשן
          ההוצאות הקבועות הנפרדת.
        </p>
      </details>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="tx-doc">
            חשבונית / קבלה (רשות)
          </label>
          <input id="tx-doc" name="doc" placeholder="מספר או קישור" className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="tx-note">
            הערה (רשות)
          </label>
          <input id="tx-note" name="note" className={FIELD} />
        </div>
      </div>

      {/* --- what this classification will actually do --------------------- */}
      {amountNum > 0 && (
        <div className="rounded-card border border-card-border bg-[#f9fafb] px-3 py-2.5 text-[12px] leading-relaxed text-muted">
          {nature === "capital" ? (
            <>
              <b className="text-ink">תנועה הונית:</b> {money(amountNum)} יוצאים מהחשבון ונעצרים בשכבת
              הנכסים. <b className="text-ink">לא</b> נכנסים לספר התפעולי של אף סניף, ולא מתחלקים עם אף
              שותף. אם זו רכישת ציוד — עדיף להזין אותה במסך הרכש, שיוצר גם את הפריטים עצמם.
            </>
          ) : nature === "transfer" ? (
            <>
              <b className="text-ink">העברה:</b> {money(amountNum)} זזים, אבל לא נספרים לא כהכנסה ולא
              כהוצאה. ההכנסה שההעברה הזו מסלקת כבר רשומה בספר הסניף — לספור אותה שוב זו בדיוק
              הכפילות שהמודל מונע.
            </>
          ) : (
            <>
              <b className="text-ink">תנועה תפעולית:</b> {money(amountNum)} נכנסים לספר הסניף
              {split.length > 0 ? ` ומתחלקים בין ${split.length} סניפים` : ""}. חלק{" "}
              {ownerName}: <b className="text-ink">{money(ownerShare)}</b>.
            </>
          )}
        </div>
      )}

      {result && (
        <p className={`text-[13px] font-bold ${result.ok ? "text-emerald-600" : "text-red-600"}`} role="status">
          {result.ok ? "✓ " : "✕ "}
          {result.message}
        </p>
      )}

      <div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2.5 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "שומר…" : "רישום התנועה"}
        </button>
      </div>
    </form>
  );
}
