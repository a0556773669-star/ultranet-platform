/**
 * A proposed opening date for every branch, derived from what is actually recorded in it.
 *
 * The opening date is the single fact the whole branch book hangs on, and typing it by hand for
 * every branch is exactly the kind of work that gets half-done. So the system proposes one - and
 * proposes nothing else: this file only reads, and the proposal reaches Firestore only through
 * `applyOpeningDatesAction`, after the owner saw it on screen and approved it.
 *
 * The evidence is ranked, because not every date in a branch means the same thing:
 *  - a rental or an income row is proof the branch was OPERATING on that date;
 *  - a computer added, or an expense typed against the branch, may well predate the opening
 *    (equipment bought and rent paid while the place was still being set up).
 * Cost-only evidence is therefore marked `weak`, so the screen can say out loud that the date
 * needs a human look rather than presenting a guess as a fact.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { BranchIncome, Laptop, Rental, VariableExpense } from "@ultranet/shared-types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** Normalizes anything date-shaped to YYYY-MM-DD; anything else is not a date we can propose. */
const isoDate = (value?: string | null): string | null =>
  value && DATE_RE.test(value) ? value.slice(0, 10) : null;

export type ProposalSource = "rental" | "income" | "equipment" | "expense" | "none";

export interface OpeningProposal {
  branchId: string;
  /** null when the branch holds nothing at all to base a date on */
  proposedDate: string | null;
  source: ProposalSource;
  /** ready-made Hebrew line for the screen: what this proposal is based on */
  note: string;
  /** the only evidence is a cost, which may predate the opening - needs a human look */
  weak: boolean;
}

const NOTES: Record<ProposalSource, string> = {
  rental: "ההשכרה הראשונה שנרשמה בסניף",
  income: "ההכנסה הראשונה שנרשמה בסניף",
  equipment: "המחשב הראשון שנוסף לסניף — ייתכן שנרכש עוד לפני הפתיחה",
  expense: "ההוצאה הראשונה שנרשמה בסניף — ייתכן שזו עלות הקמה שקדמה לפתיחה",
  none: "אין בסניף שום נתון להסתמך עליו — נא להזין תאריך ידנית",
};

/** branchId -> the earliest date found for each kind of evidence. */
type Evidence = Partial<Record<Exclude<ProposalSource, "none">, string>>;

export async function loadOpeningProposals(): Promise<Map<string, OpeningProposal>> {
  const db = getAdminFirestore();
  const [rentalsSnap, incomeSnap, expensesSnap, laptopsSnap] = await Promise.all([
    db.collection("n_rentals").get(),
    db.collection("n_branch_income").get(),
    db.collection("n_var_expenses").get(),
    db.collection("n_laptops").get(),
  ]);

  const byBranch = new Map<string, Evidence>();
  const record = (branchId: string | undefined, source: keyof Evidence, date: string | null) => {
    if (!branchId || !date) return;
    const found = byBranch.get(branchId) ?? {};
    const current = found[source];
    if (!current || date < current) {
      found[source] = date;
      byBranch.set(branchId, found);
    }
  };

  for (const d of rentalsSnap.docs) {
    const r = d.data() as Rental;
    // the day the branch started renting out, not the day it was returned
    record(r.branchId, "rental", isoDate(r.startDate));
  }
  for (const d of incomeSnap.docs) {
    const i = d.data() as BranchIncome;
    record(i.branchId, "income", isoDate(i.date) ?? isoDate(i.month ? `${i.month}-01` : null));
  }
  for (const d of expensesSnap.docs) {
    const e = d.data() as VariableExpense;
    record(e.branchId, "expense", isoDate(e.date) ?? isoDate(e.month ? `${e.month}-01` : null));
  }
  for (const d of laptopsSnap.docs) {
    const l = d.data() as Laptop;
    record(l.branchId, "equipment", isoDate(l.addedDate));
  }

  const proposals = new Map<string, OpeningProposal>();
  for (const [branchId, found] of byBranch) {
    // Operating evidence first, and between a rental and an income row simply the earlier one.
    const operating: Array<[ProposalSource, string]> = [];
    if (found.rental) operating.push(["rental", found.rental]);
    if (found.income) operating.push(["income", found.income]);
    operating.sort((a, b) => a[1].localeCompare(b[1]));

    const picked: [ProposalSource, string] | undefined =
      operating[0] ??
      (found.equipment ? ["equipment", found.equipment] : undefined) ??
      (found.expense ? ["expense", found.expense] : undefined);

    const source = picked?.[0] ?? "none";
    proposals.set(branchId, {
      branchId,
      proposedDate: picked?.[1] ?? null,
      source,
      note: NOTES[source],
      weak: source === "equipment" || source === "expense",
    });
  }

  return proposals;
}

/** Branches with nothing in them at all never reach the map above. */
export function proposalFor(proposals: Map<string, OpeningProposal>, branchId: string): OpeningProposal {
  return (
    proposals.get(branchId) ?? {
      branchId,
      proposedDate: null,
      source: "none",
      note: NOTES.none,
      weak: false,
    }
  );
}
