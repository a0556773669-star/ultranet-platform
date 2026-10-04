import { redirect } from "next/navigation";
import { Banknote } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";
import { sharedExpenseScopeLabel } from "@/lib/expense-shared-scope";
import { countsToMain } from "@/lib/counts-to-main";
import { getOwnerName, resolveSharedPartnerName, branchPartnerName } from "@/lib/owner-name";
import { loadRecurringVariableExpenses } from "@/lib/recurring-expenses";
import { loadRecurringPurchaseIndex } from "@/lib/recurring-purchases";
import { AddExpenseModal } from "./add-expense-modal";
import { ExpensesDetailPanel, type ExpenseDetailRow } from "./expenses-detail-panel";
import { PendingRecurringRows } from "./pending-recurring-rows";

/** "שילם: X · חוב: Y" — נכתב רק בסניף שותפות, ששם לשאלה הזו יש בכלל תשובה. */
function paymentNote(paidBy: string | undefined, owedBy: string | undefined, ownerName: string, partnerName: string) {
  const paidLabels: Record<string, string> = { owner: ownerName, partner: partnerName };
  const owedLabels: Record<string, string> = {
    owner: `על ${ownerName} (הכל)`,
    partner: `על ${partnerName} (הכל)`,
    shared: "משותף (חצי-חצי)",
  };
  const p = paidBy === "partner" ? "partner" : "owner";
  const o = owedBy === "partner" ? "partner" : owedBy === "shared" ? "shared" : "owner";
  return `שילם: ${paidLabels[p]} · חוב: ${owedLabels[o]}`;
}

/**
 * מסך ההוצאות של חדרי מחשבים — פעולה אחת למעלה, היסטוריה מאחורי כפתור, מטלות למטה.
 *
 * הרשימה שהייתה כאן (שורה לכל סניף, ועוד כפתור נפרד ל"הוצאות על כל הסניפים יחד") הכריחה
 * לבחור סניף לפני שבכלל אפשר היה לרשום הוצאה, ופיצלה את אותה פעולה עצמה לשני מסלולים לפי
 * מה שעוד לא ידעת בתחילת הדרך — אם ההוצאה שייכת לסניף אחד או לכמה. כאן יש כפתור אחד
 * ("הוספת הוצאה"), והשאלה על מי ההוצאה חלה היא הצעד הראשון בתוכו ולא תנאי כניסה.
 *
 * מתחת: `ExpensesDetailPanel` — כל ההוצאות של כל הסניפים בטבלה אחת, סגורה כברירת מחדל —
 * ואז `PendingRecurringRows`, השורות שבאמת ממתינות להקלדה היום.
 */
export default async function ComputerRoomExpensesHomePage() {
  // מנהלים בלבד: עובד חדר מחשבים מתפעל מלאי ומשימות, ואת הוצאות הסניף רואה מי שמנהל אותו.
  const session = await requireModuleAccess("computers", { managerOnly: true });
  const isOwner = session.user?.role === "owner";
  if (!isOwner) {
    const myBranchId = session.user?.branchId;
    if (!myBranchId) redirect("/dashboard");
    const myDoc = await getAdminFirestore().collection("n_branches").doc(myBranchId).get();
    const myBranch = myDoc.exists ? ({ id: myDoc.id, ...(myDoc.data() as Omit<Branch, "id">) } as Branch) : null;
    if (!myBranch || myBranch.branchType !== "computers") redirect("/dashboard");
    redirect(`/dashboard/expenses/${myBranchId}`);
  }

  const db = getAdminFirestore();
  const [branchesSnap, fixedSnap, variableSnap, recurring, purchaseIndex, ownerName, sharedPartner] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "computers").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
    loadRecurringVariableExpenses({ scope: "computers" }),
    loadRecurringPurchaseIndex(),
    getOwnerName(session.user?.name),
    resolveSharedPartnerName("computers"),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
  const branchById = new Map(branches.map((b) => [b.id, b]));
  const branchNameById = new Map(branches.map((b) => [b.id, b.name]));

  /**
   * ההוצאות של כל המודולים חיות באותן קולקשנים ונבדלות ב-`branchId` בלבד, ולכן הסינון כאן
   * הוא מול סניפי חדרי המחשבים והספר המשותף שלהם — אחרת הוצאה של השכרות הייתה מופיעה כאן
   * בלי סניף.
   */
  const belongsHere = (branchId: string) => branchId === SHARED_EXPENSE_BRANCH_ID || branchById.has(branchId);

  const allFixed = fixedSnap.docs
    .map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense)
    .filter((e) => belongsHere(e.branchId));
  const allVariable = variableSnap.docs
    .map((d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense)
    .filter((e) => belongsHere(e.branchId));

  function bookOf(branchId: string) {
    if (branchId === SHARED_EXPENSE_BRANCH_ID) {
      return {
        label: "כל הסניפים (ספר משותף)",
        isShared: true,
        isPartner: sharedPartner.hasPartner,
        partnerName: sharedPartner.partnerName,
      };
    }
    const branch = branchById.get(branchId);
    return {
      label: branch?.name ?? "סניף שנמחק",
      isShared: false,
      isPartner: branch?.isMine === false,
      partnerName: branchPartnerName(branch ?? null),
    };
  }

  const detailRows: ExpenseDetailRow[] = [
    ...allFixed.map((e) => {
      const book = bookOf(e.branchId);
      return {
        branchId: e.branchId,
        branchLabel: book.label,
        isShared: book.isShared,
        isPartner: book.isPartner,
        ownerName,
        partnerName: book.partnerName,
        scopeNote: book.isShared ? `חל על: ${sharedExpenseScopeLabel(e, branchNameById)}` : undefined,
        payerNote: book.isPartner ? paymentNote(e.paidBy, e.owedBy, ownerName, book.partnerName) : undefined,
        countsToMain: countsToMain(e),
        date: e.startDate,
        fixed: e,
      } satisfies ExpenseDetailRow;
    }),
    ...allVariable.map((e) => {
      const book = bookOf(e.branchId);
      return {
        branchId: e.branchId,
        branchLabel: book.label,
        isShared: book.isShared,
        isPartner: book.isPartner,
        ownerName,
        partnerName: book.partnerName,
        scopeNote: book.isShared ? `חל על: ${sharedExpenseScopeLabel(e, branchNameById)}` : undefined,
        payerNote: book.isPartner ? paymentNote(e.paidBy, e.owedBy, ownerName, book.partnerName) : undefined,
        countsToMain: countsToMain(e),
        date: e.date,
        variable: e,
      } satisfies ExpenseDetailRow;
    }),
  ];

  const branchOptions = branches.map((b) => ({ id: b.id, name: b.name }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Banknote className="h-5 w-5" />
          הוצאות — חדרי מחשבים
        </h1>
        <AddExpenseModal
          branches={branches.map((b) => ({
            id: b.id,
            name: b.name,
            isMine: b.isMine !== false,
            partnerName: branchPartnerName(b),
          }))}
          ownerName={ownerName}
          sharedHasPartner={sharedPartner.hasPartner}
          sharedPartnerName={sharedPartner.partnerName}
          expenseTypes={purchaseIndex.types}
        />
      </div>

      <p className="px-1 text-[11.5px] leading-relaxed text-muted">
        הוצאה נרשמת על סניף אחד, על כל הסניפים או על סניפים נבחרים. הוצאה שחלה על יותר מסניף
        אחד נשמרת בספר המשותף ומתחלקת בהנה&quot;ח בין הסניפים שנבחרו — סניף חדש לא יירש
        אוטומטית הוצאה שלא קשורה אליו. הסימון <b>&quot;נספר בהנה&quot;ח הראשית&quot;</b> הוא
        מה שמכניס את השורה לשורה התחתונה של העסק; בלעדיו ההוצאה נשארת בספר של הסניף בלבד.
      </p>

      <ExpensesDetailPanel rows={detailRows} branches={branchOptions} />

      <PendingRecurringRows expenses={recurring} branchNameById={branchNameById} canManage />
    </div>
  );
}
