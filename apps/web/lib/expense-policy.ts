/**
 * מדיניות התשלום של הסניף (פרק יד׳).
 *
 * THE RULE THIS MODULE EXISTS FOR:
 *   מנהל הסניף מזין עובדות. לעולם לא תנאים.
 *
 * How much, on what, when, and a photo of the receipt are FACTS - he is the only one who knows
 * them. Who owes what and who bore the cost are TERMS: they follow from the agreement, and they
 * should never be a field he sees at all.
 *
 * Today that decision is made afresh on every single expense row, which is why it comes out
 * inconsistent and why branches cannot be compared with each other. Moving it up to the branch
 * buys three things at once:
 *
 *  1. one screen that shows who pays what across all 30 branches - every agreement in front of you
 *  2. branches that are actually comparable, because the split no longer depends on who typed it
 *  3. changing an agreement is one field, not a retroactive edit of dozens of rows
 *
 * Pure module on purpose (no firebase-admin import): the branch manager's entry form is a client
 * component and derives its preview from here.
 */
import type { Branch, ExpensePolicyKey } from "@ultranet/shared-types";

export const EXPENSE_POLICY_KEYS: ExpensePolicyKey[] = [
  "internet",
  "filtering",
  "ads",
  "rent",
  "electricity",
  "print",
];

export const EXPENSE_POLICY_LABEL: Record<ExpensePolicyKey, string> = {
  internet: "אינטרנט",
  filtering: "סינון וגלישה",
  ads: "פרסום ושיווק",
  rent: "שכירות",
  electricity: "חשמל",
  print: "הדפסות ותקנונים",
};

/**
 * The closed category list a branch manager picks from, mapped to the policy key that decides who
 * fronts the cash. Closed on purpose: a free-text category would make the policy unmatchable and
 * put the manager straight back in the business of deciding terms.
 *
 * `null` = a category with no standing agreement. Those default to the manager having paid, which
 * is the honest assumption for a row he typed, and they show up on the review list as a category
 * this branch has not had before.
 */
export const BRANCH_EXPENSE_CATEGORIES: { label: string; policy: ExpensePolicyKey | null }[] = [
  { label: "אינטרנט", policy: "internet" },
  { label: "סינון וגלישה", policy: "filtering" },
  { label: "פרסום ושיווק", policy: "ads" },
  { label: "שכירות", policy: "rent" },
  { label: "חשמל", policy: "electricity" },
  { label: "הדפסות ותקנונים", policy: "print" },
  { label: "ציוד ותחזוקה", policy: null },
  { label: "נסיעות ודלק", policy: null },
  { label: "הוצאה אחרת", policy: null },
];

export function policyKeyForCategory(category: string): ExpensePolicyKey | null {
  return BRANCH_EXPENSE_CATEGORIES.find((c) => c.label === category)?.policy ?? null;
}

/**
 * Who fronts the cash for this category at this branch — derived, never typed.
 *
 * Falls back to `"partner"` for a category the branch has a manager entering rows for: he is the
 * one who just paid it. The owner can override the standing agreement per category on the policy
 * screen; nothing about that reaches the manager's form.
 */
export function paidByForCategory(
  branch: Pick<Branch, "expensePolicy">,
  category: string,
): "owner" | "partner" {
  const key = policyKeyForCategory(category);
  if (!key) return "partner";
  return branch.expensePolicy?.[key] ?? "partner";
}

/** How the branch's own screen explains the derived split, in words rather than a form field. */
export function policyExplanation(
  branch: Pick<Branch, "expensePolicy">,
  category: string,
  ownerName: string,
  partnerLabel: string,
): string {
  const key = policyKeyForCategory(category);
  if (!key) {
    return `הקטגוריה הזו לא מוגדרת בהסכם של הסניף — היא תיכנס כהוצאה ש${partnerLabel} שילם, ותסומן לסקירה אצל ${ownerName}.`;
  }
  const payer = branch.expensePolicy?.[key] ?? "partner";
  return payer === "partner"
    ? `לפי ההסכם של הסניף, ${EXPENSE_POLICY_LABEL[key]} משולם על ידי הסניף. החלוקה נגזרת מההסכם — אין מה להזין.`
    : `לפי ההסכם של הסניף, ${EXPENSE_POLICY_LABEL[key]} משולם על ידי ${ownerName}. אם שילמת מכיסך — כדאי לציין בהערה.`;
}

/** The policy row for one branch, with every key resolved, for the cross-branch table. */
export function resolvedPolicy(branch: Pick<Branch, "expensePolicy">): Record<ExpensePolicyKey, "owner" | "partner"> {
  const out = {} as Record<ExpensePolicyKey, "owner" | "partner">;
  for (const key of EXPENSE_POLICY_KEYS) out[key] = branch.expensePolicy?.[key] ?? "partner";
  return out;
}
