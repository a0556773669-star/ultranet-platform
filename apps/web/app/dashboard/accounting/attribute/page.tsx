import { Split } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { AccountingExpense, Branch } from "@ultranet/shared-types";
import { AccountingTabs } from "../accounting-tabs";
import { AttributeClient, type PendingExpense } from "./attribute-client";

export default async function AttributeExpensesPage() {
  await requireOwner();

  const db = getAdminFirestore();
  const [expensesSnap, branchesSnap] = await Promise.all([
    db.collection("n_ah_expenses").get(),
    db.collection("n_branches").get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const expenses: PendingExpense[] = expensesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<AccountingExpense, "id">), id: d.id }) as AccountingExpense)
    .map((e) => ({
      id: e.id,
      desc: e.desc ?? "",
      category: e.category,
      date: e.date ?? "",
      amount: e.amount ?? 0,
    }))
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Split className="h-5 w-5" />
            שיוך הוצאות לסניפים
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            הוצאות שנרשמו בהנה&quot;ח האישית והסניף שלהן כתוב רק בטקסט — כאן משייכים אותן לסניף אמיתי.
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/attribute" />
      </div>

      <div className="mb-3.5 rounded-card border border-card-border bg-white px-4 py-3.5 text-[12.5px] leading-relaxed text-muted shadow-card">
        <p className="mb-2">
          <b className="text-ink">למה זה צריך לקרות:</b> הוצאה כמו &quot;8 מחשבים — נתיבות - פריד&quot; נרשמה
          כשורה בהנה&quot;ח האישית, והסניף מופיע רק בתוך הטקסט. המערכת לא יכולה לקרוא טקסט חופשי, ולכן
          ההוצאה הזו לא נספרת אצל הסניף ולא מופיעה בפירוט שלו.
        </p>
        <p className="mb-2">
          <b className="text-ink">מה קורה בשיוך:</b> ההוצאה <b className="text-ink">עוברת</b> לספר של הסניף
          (ולא מועתקת) — כך היא נספרת פעם אחת בלבד. הוצאה שמכסה כמה סניפים (&quot;כל סניפי חדרי
          המחשבים&quot;) מתפצלת שווה בשווה ביניהם, והסכומים תמיד מסתכמים בחזרה לסכום המקורי.
        </p>
        <p>
          <b className="text-ink">אחרי השיוך</b> ההוצאה מופיעה בעמוד הסניף עם הפירוט המלא, נכנסת לטבלת
          הסניפים ולסיכומים למעלה, וניתנת לעריכה או מחיקה בעמוד ההוצאות של הסניף.
        </p>
      </div>

      <AttributeClient expenses={expenses} branches={branches} />
    </div>
  );
}
