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
        <div className="card border-r-4 border-r-amber-400">
          <h2 className="mb-2 text-base font-extrabold text-ink">כלי הייבוא כבוי</h2>
          <p className="mb-3 text-sm text-muted">
            משתנה הסביבה <code className="rounded bg-[#f4f6f9] px-1">QUARTER1_IMPORT</code> מוגדר ל-<code className="rounded bg-[#f4f6f9] px-1">off</code>,
            ולכן המסך אינו מציג את כפתורי הייבוא והפעולות מסרבות לפעול גם בשרת. זו הגנה מכוונת שמופעלת{" "}
            <b>אחרי</b> שהייבוא הסתיים - אם עוד לא ייבאת, צריך לכבות אותה.
          </p>
          <div className="rounded-[11px] border border-card-border bg-[#f9fafb] p-3 text-sm text-ink">
            <div className="mb-1 font-bold">כדי להפעיל מחדש:</div>
            <ol className="list-decimal space-y-1 pr-5">
              <li>
                ב-Vercel: פרויקט <code>ultranet-platform</code> ← <b>Settings</b> ← <b>Environment Variables</b>
              </li>
              <li>
                למחוק את <code>QUARTER1_IMPORT</code>, או לשנות את הערך ל-<code>on</code>
              </li>
              <li>
                ← <b>Deployments</b> ← בפריסה העליונה <code>···</code> ← <b>Redeploy</b>
              </li>
            </ol>
            <p className="mt-2 text-xs text-muted">
              חובה לפרוס מחדש: משתני סביבה נקראים בזמן הפריסה, ושינוי הערך בלבד אינו משפיע על הגרסה שכבר באוויר.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
