import Link from "next/link";
import { Upload } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { AccountingTabs } from "../accounting-tabs";
import { ImportClient } from "./import-client";

export default async function ImportExpensesPage() {
  await requireOwner();

  const snap = await getAdminFirestore().collection("n_branches").get();
  const branches = snap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted && (b.branchType === "rentals" || b.branchType === "computers"))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Upload className="h-5 w-5" />
            ייבוא הוצאות מאקסל
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            שום דבר לא נכתב עד שתאשרי, ואפשר לתקן כל שורה לפני כן.
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/import" />
      </div>

      {branches.length === 0 ? (
        <p className="rounded-card border border-card-border bg-white px-4 py-6 text-center text-sm text-muted shadow-card">
          אין עדיין סניפים במערכת — צריך לפתוח סניפים לפני ייבוא הוצאות.
        </p>
      ) : (
        <ImportClient branches={branches} />
      )}

      <div className="mt-3.5 rounded-card border border-card-border bg-white px-4 py-3.5 text-[12.5px] leading-relaxed text-muted shadow-card">
        <p className="mb-2">
          <b className="text-ink">אין כפילויות:</b> לפני הכתיבה נבדק אם כבר קיימת הוצאה תואמת — הוצאה קבועה לפי
          סניף, שם וסכום; הוצאה מתוארכת לפי סניף, חודש, סכום ותיאור. שורה שכבר קיימת מדולגת ומדווחת בשמה,
          כך שאפשר להריץ את הייבוא פעמיים בלי לשכפל כלום.
        </p>
        <p className="mb-2">
          <b className="text-ink">לתקן אחרי הייבוא:</b> כל רשומה ניתנת לעריכה או מחיקה בעמוד ההוצאות של הסניף —{" "}
          <Link href="/dashboard/expenses" className="font-bold text-teal hover:underline">
            הוצאות חדרי מחשבים
          </Link>{" "}
          או{" "}
          <Link href="/dashboard/rentals/expenses" className="font-bold text-teal hover:underline">
            הוצאות ניידים
          </Link>
          . שם גם מגדירים &quot;מי שילם בפועל&quot; ו&quot;על מי החוב&quot;; הייבוא מניח שאת שילמת.
        </p>
        <p>
          <b className="text-ink">שים לב לסכומים חריגים:</b> שורה מעל 50,000 ₪ מסומנת באדום ומבוטלת מראש, כי
          בדרך כלל זו שורת סיכום ולא הוצאה בודדת. אם היא באמת הוצאה — סמני אותה חזרה.
        </p>
      </div>
    </div>
  );
}
