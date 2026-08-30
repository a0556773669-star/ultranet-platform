import { Split } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { isPendingAttribution } from "@/lib/accounting-entries";
import { loadMovements } from "@/lib/accounting-entries-data";
import { AccountingTabs } from "../accounting-tabs";
import { AttributeClient } from "./attribute-client";

export default async function AttributeExpensesPage() {
  await requireOwner();

  const { entries, liveBranches } = await loadMovements();
  const pending = entries.filter(isPendingAttribution);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Split className="h-5 w-5" />
            שיוך תנועות לסניפים
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            כל הכנסה וכל הוצאה שנרשמה בהנה&quot;ח האישית ועדיין לא נכנסה לספר של סניף — כאן משייכים
            אותה.
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/attribute" />
      </div>

      <div className="mb-3.5 rounded-card border border-card-border bg-white px-4 py-3.5 text-[12.5px] leading-relaxed text-muted shadow-card">
        <p className="mb-2">
          <b className="text-ink">מה מגיע לכאן:</b> כל תנועה שנרשמת במסך &quot;רישום ותנועות&quot; ולא
          נשלחה ישירות לסניף — הכנסות והוצאות כאחד. גם הכנסה שנרשמה עם שם סניף (מזומן מקופה, ניידים)
          מגיעה לכאן, כי עד לשיוך היא רשומה רק בספר האישי ולא בספר של הסניף.
        </p>
        <p className="mb-2">
          <b className="text-ink">מה קורה בשיוך:</b> השורה <b className="text-ink">עוברת</b> לספר של
          הסניף (ולא מועתקת) — כך היא נספרת פעם אחת בלבד. הוצאה נכנסת לספר ההוצאות של הסניף והכנסה
          לספר ההכנסות שלו. שורה שמכסה כמה סניפים (&quot;כל סניפי חדרי המחשבים&quot;) מתפצלת שווה
          בשווה ביניהם, והסכומים תמיד מסתכמים בחזרה לסכום המקורי.
        </p>
        <p className="mb-2">
          <b className="text-ink">שים לב להכנסות:</b> הכנסה ששויכה לסניף יוצאת מהספר האישי, ולכן
          מפסיקה להיספר בכרטיסי הסיכום של ההנה&quot;ח האישית ובדף הבית — היא נספרת מעכשיו בספר של
          הסניף. זו בדיוק המשמעות של &quot;שני ספרים שלא נסכמים&quot;. אפשר תמיד להחזיר שורה
          בעריכה → &quot;כללי&quot;.
        </p>
        <p>
          <b className="text-ink">אחרי השיוך</b> השורה יוצאת מהרשימה הזו וממסך רישום התנועות, מופיעה
          בעמוד הסניף עם הפירוט המלא, ונכנסת לטבלת הסניפים ולסיכומים. תמיד אפשר לערוך אותה או למחוק
          אותה — גם כאן וגם בעמוד הסניף.
        </p>
      </div>

      <AttributeClient entries={pending} branches={liveBranches} />
    </div>
  );
}
