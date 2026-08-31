"use client";

/**
 * "ההוצאות של הסניף שלי" — עובדות בלבד.
 *
 * Every field here is something only the branch manager knows. There is deliberately no "who
 * paid" control, no owner/partner split, and no branch picker: those are terms, they follow from
 * the agreement, and the form explains the consequence in a sentence instead of asking him to
 * decide it. He cannot get the split wrong because he is never asked for it.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Receipt } from "lucide-react";
import type { Branch } from "@ultranet/shared-types";
import { BRANCH_EXPENSE_CATEGORIES, policyExplanation } from "@/lib/expense-policy";
import { RECEIPT_REQUIRED_ABOVE } from "@/lib/expense-review";
import { addBranchExpenseAction, type SaveResult } from "./actions";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const LABEL = "mb-1 block text-[11px] font-extrabold tracking-wide text-muted";
const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-2 text-[13px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";

export function BranchExpenseForm({
  branch,
  ownerName,
  partnerLabel,
}: {
  branch: Pick<Branch, "expensePolicy" | "name">;
  ownerName: string;
  partnerLabel: string;
}) {
  const router = useRouter();
  const [category, setCategory] = useState(BRANCH_EXPENSE_CATEGORIES[0]!.label);
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [result, setResult] = useState<SaveResult | null>(null);
  const [busy, setBusy] = useState(false);

  const amountNum = Number(amount) || 0;
  const receiptWanted = amountNum > RECEIPT_REQUIRED_ABOVE && !receipt.trim();

  async function submit(formData: FormData) {
    setBusy(true);
    setResult(null);
    const res = await addBranchExpenseAction(formData);
    setBusy(false);
    setResult(res);
    if (res.ok) {
      setAmount("");
      setReceipt("");
      router.refresh();
    }
  }

  return (
    <form action={submit} className="flex flex-col gap-3 rounded-card border border-card-border bg-white p-4 shadow-card">
      <div>
        <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-ink">
          <Receipt className="h-4 w-4" />
          הוצאה חדשה בסניף
        </h2>
        <p className="mt-0.5 text-[12px] text-muted">
          מזינים מה שקרה בפועל. מי נושא בעלות נגזר מההסכם של הסניף — אין מה להחליט כאן.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        <div>
          <label className={LABEL} htmlFor="category">
            על מה ההוצאה
          </label>
          <select
            id="category"
            name="category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={FIELD}
          >
            {BRANCH_EXPENSE_CATEGORIES.map((c) => (
              <option key={c.label} value={c.label}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="amount">
            סכום
          </label>
          <input
            id="amount"
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
          <label className={LABEL} htmlFor="date">
            תאריך
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="desc">
            תיאור (רשות)
          </label>
          <input id="desc" name="desc" placeholder="חשבון מרץ" className={FIELD} />
        </div>
      </div>

      <div>
        <label className={LABEL} htmlFor="receipt">
          קבלה — קישור או מספר
        </label>
        <input
          id="receipt"
          name="receipt"
          value={receipt}
          onChange={(e) => setReceipt(e.target.value)}
          placeholder="קישור לצילום הקבלה, או מספר החשבונית"
          className={FIELD}
        />
        {receiptWanted && (
          <p className="mt-1 text-[11.5px] font-bold text-[#7a4a12]">
            מעל {money(RECEIPT_REQUIRED_ABOVE)} כדאי לצרף קבלה — אחרת השורה תסומן לסקירה אצל {ownerName}.
          </p>
        )}
      </div>

      <details
        className="rounded-card border border-card-border bg-[#f9fafb] px-3 py-2.5"
        onToggle={(e) => setRecurring((e.currentTarget as HTMLDetailsElement).open)}
      >
        <summary className="cursor-pointer text-[12.5px] font-extrabold text-ink">
          ההוצאה הזו חוזרת כל חודש {recurring && "(פעיל)"}
        </summary>
        <div className="mt-2">
          <label className={LABEL} htmlFor="recurringFrom">
            מאיזה חודש היא מתחילה
          </label>
          <input id="recurringFrom" name="recurringFrom" type="month" className={`${FIELD} max-w-[200px]`} />
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-muted">
            מזינים <b className="text-ink">פעם אחת</b>, ביום שהקו הותקן. מכאן והלאה השורה מופיעה לבד בכל
            חודש, נכנסת להתחשבנות ומופיעה בדוח החודשי שלך. עלה המחיר? עורכים את הסכום והוא חל מהחודש
            הזה והלאה — לא רטרואקטיבית. הפסקת לשלם? מסמנים חודש סיום והשורה נעצרת.
          </p>
        </div>
      </details>

      <div className="rounded-card border border-card-border bg-[#f9fafb] px-3 py-2.5 text-[12px] leading-relaxed text-muted">
        {policyExplanation(branch, category, ownerName, partnerLabel)}
        {amountNum > 0 && (
          <>
            {" "}
            ההוצאה תיכנס להתחשבנות של החודש הזה מיד, ותופיע בדוח החודשי שלך ב-1 לחודש.
          </>
        )}
      </div>

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
          {busy ? "שומר…" : "רישום ההוצאה"}
        </button>
      </div>
    </form>
  );
}
