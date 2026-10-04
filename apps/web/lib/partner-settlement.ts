/**
 * שורות החוב החודשיות לאנשים שיש להם אחוז מהברוטו של ההשכרות.
 *
 * הקובץ הזה הוא רק שכבת הטעינה: הוא מביא מ-Firestore את מה שצריך, והחישוב עצמו יושב
 * ב-`lib/revenue-shares.ts` — אותן פונקציות בדיוק שמשמשות את `computeBranchFinancials`
 * כשהיא מורידה את הסכומים האלה מהרווח שלי. שני מסלולים לאותה שאלה היו מגיעים במוקדם
 * או במאוחר לשני מספרים שונים, וזה בדיוק המקרה שבו זה הכי מסוכן: מספר אחד אומר לי כמה
 * להעביר, והשני אומר לי כמה נשאר לי.
 */
import { getAdminFirestore } from "./firebase-admin";
import type { Branch, BranchIncome, Laptop, Rental } from "@ultranet/shared-types";
import {
  branchRevenueShareLine,
  computerRevenueShareLines,
  countsAsCollected,
  type DatedAmount,
  type RevenueShareLine,
} from "./revenue-shares";

export type { RevenueShareLine };

/**
 * כל מה שמגיע לכל אחד על חודש מסוים (למשל "2026-08"), מקובץ לפי (סניף, אדם, אחוז).
 *
 * שתי שכבות:
 *  - **פר-מחשב** — כל מחשב שמסומן `hasPartner`, לפי `partnerPct` שלו, על ההשכרות שלו
 *    ושל הסטיק הצמוד לו. אין תאריך התחלה: נספר מהיום הראשון שהמחשב הושכר.
 *  - **פר-סניף** — הסדר מתוך `BRANCH_REVENUE_SHARES`, על כל ההשכרות של הסניף מתאריך
 *    ההתחלה ואילך. חודש ההתחלה מתחלק לפי תאריך ההשכרה ולא נלקח במלואו.
 *
 * ההשכרה נספרת בחודש שבו היא **הוחזרה**, ורק אם שולמה — בדיוק כמו בהתחשבנות מול סניף
 * (`computeBranchFinancials`), כדי ששני הדוחות יסכימו מה נכנס לחודש הזה. השכרה שהוחזרה
 * ולא שולמה לא מייצרת חוב: אין טעם להעביר אחוז מכסף שעוד לא נגבה.
 */
export async function computeRevenueShareLines(month: string): Promise<RevenueShareLine[]> {
  const db = getAdminFirestore();
  // Projected down to the fields this function actually reads. Every returned rental ever is
  // scanned here (the month filter is applied in memory below), so the documents' full contents -
  // notes, client ids, pricing breakdowns - were being shipped for nothing.
  const [branchesSnap, laptopsSnap, sticksSnap, rentalsSnap, branchIncomeSnap] = await Promise.all([
    db.collection("n_branches").select("name", "branchType", "isMine", "deleted").get(),
    db.collection("n_laptops").select("hasPartner", "partnerPct", "partnerName", "branchId", "name").get(),
    db.collection("n_sticks").select("linkedLaptopId").get(),
    db
      .collection("n_rentals")
      .where("status", "==", "returned")
      .select("paid", "returnDate", "kind", "itemId", "branchId", "finalPrice", "calcPrice")
      .get(),
    db.collection("n_branch_income").select("branchId", "amount", "date").get(),
  ]);

  const laptops = laptopsSnap.docs.map((d) => ({ ...(d.data() as Omit<Laptop, "id">), id: d.id }) as Laptop);
  const sticks = sticksSnap.docs.map((d) => ({
    id: d.id,
    linkedLaptopId: (d.data() as { linkedLaptopId?: string }).linkedLaptopId,
  }));
  const rentals = rentalsSnap.docs.map((d) => ({ ...(d.data() as Omit<Rental, "id">), id: d.id }) as Rental);

  const lines = computerRevenueShareLines(laptops, sticks, rentals, (m) => m === month);

  // The per-branch arrangement needs the branch's whole gross, so it reads the same two income
  // sources computeBranchFinancials does: real rentals plus the owner's manual income rows.
  const incomeByBranch = new Map<string, DatedAmount[]>();
  const push = (branchId: string, line: DatedAmount) => {
    const arr = incomeByBranch.get(branchId) ?? [];
    arr.push(line);
    incomeByBranch.set(branchId, arr);
  };
  for (const r of rentals) {
    if (!countsAsCollected(r)) continue;
    push(r.branchId, { date: r.returnDate as string, amount: r.finalPrice ?? r.calcPrice ?? 0 });
  }
  for (const d of branchIncomeSnap.docs) {
    const i = { ...(d.data() as Omit<BranchIncome, "id">), id: d.id } as BranchIncome;
    if (!i.date) continue;
    push(i.branchId, { date: i.date, amount: i.amount || 0 });
  }

  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  for (const branch of branches) {
    const line = branchRevenueShareLine(branch, incomeByBranch.get(branch.id) ?? [], month);
    if (line) lines.push(line);
  }

  return lines.sort((a, b) => b.amount - a.amount);
}
