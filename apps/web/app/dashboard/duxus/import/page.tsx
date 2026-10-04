import Link from "next/link";
import { Target, ArrowRight } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { ImportClient } from "./import-client";

/** הייבוא קורא וכותב מאות מסמכים, ובברירת המחדל של Vercel הוא עלול להיחתך
 *  באמצע בלי הודעה. הארכת החלון מונעת בדיוק את ה"לחצתי ולא קרה כלום". */
export const maxDuration = 300;

/**
 * כלי ייבוא חד-פעמי, בעלים בלבד. הוא לא חלק מלשוניות המודול הרגילות כדי שלא
 * יופיע בעבודה היומיומית - נכנסים אליו ישירות בכתובת.
 *
 * **אין כאן שער של משתנה סביבה.** היה כזה, והוא הסתבר כמכשול ולא כהגנה: הוא חסם
 * את הכלי לפני שהייבוא בכלל רץ, וכדי לפתוח אותו היה צריך למצוא משתנה ב-Vercel
 * ולפרוס מחדש. ההגנות האמיתיות הן ארבע, וכולן כאן: בעלים בלבד (`requireOwner`),
 * המסך אינו מופיע בשום תפריט, הייבוא בפועל נעול עד שרצה הרצה יבשה, והכתיבה
 * אידמפוטנטית ואינה מוחקת דבר. כשהייבוא יסתיים - פשוט מוחקים את התיקייה הזו.
 */
export default async function Quarter1ImportPage() {
  await requireOwner();

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        ייבוא רבעון 1
      </h1>
      <Link href="/dashboard/duxus/rocks/week" className="mb-4 flex w-fit items-center gap-1.5 text-sm font-semibold text-teal hover:underline">
        <ArrowRight className="h-4 w-4" />
        חזרה למשימות
      </Link>

      <ImportClient />
    </div>
  );
}
