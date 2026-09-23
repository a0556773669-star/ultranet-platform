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
 * כשהייבוא יסתיים: `QUARTER1_IMPORT=off` והכלי מסרב לפעול גם בשרת.
 */
export default async function Quarter1ImportPage() {
  await requireOwner();
  const enabled = (process.env.QUARTER1_IMPORT ?? "on").toLowerCase() !== "off";

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

      {enabled ? (
        <ImportClient />
      ) : (
        <div className="card text-sm text-muted">
          כלי הייבוא כבוי (<code>QUARTER1_IMPORT=off</code>). כדי להפעיל אותו שוב, יש להסיר את ההגדרה ולפרוס מחדש.
        </div>
      )}
    </div>
  );
}
