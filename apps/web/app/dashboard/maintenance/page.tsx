import Link from "next/link";
import { ArrowLeft, CheckCircle2, Stethoscope } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadLeftovers } from "@/lib/leftovers";
import { deleteLeftoverAction } from "./actions";
import { DeleteLeftoverButton } from "./delete-leftover-button";

export const dynamic = "force-dynamic";

/**
 * בדיקת נתונים — "מה יש כאן מהעבר".
 *
 * המערכת יושבת על ה-DB של `app.html` בלי מיגרציה, וכל מסך במודולים מסנן לפי סניף. רשומה
 * שהסניף שלה נמחק או לא קיים נופלת מכל המסכים אבל ממשיכה להיספר בהתראות של דף הבית
 * ובהנה"ח הראשית — כלומר מייצרת התראה על כסף בלי שום מקום לראות או לתקן בו את המקור.
 * המסך הזה הוא המקום הזה: הוא סורק את הקולקשנים, מסביר לכל שורה **למה** היא לא מופיעה
 * בשום מקום, כמה כסף מעורב בה, ומאפשר לשייך אותה בחזרה או למחוק אותה.
 *
 * לבעלים בלבד, ואין כאן שום מחיקה אוטומטית: הדוח מציג, ההחלטה אנושית.
 */
export default async function MaintenancePage() {
  await requireOwner();
  const report = await loadLeftovers();

  return (
    <div>
      <h1 className="mb-1 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Stethoscope className="h-5 w-5" />
        בדיקת נתונים — שאריות מהעבר
      </h1>
      <p className="mb-4 max-w-3xl text-[12.5px] leading-relaxed text-muted">
        המערכת עובדת על מסד הנתונים הקיים מ-app.html, וכל מסך במודולים מציג רק את הסניף שנבחר בו.
        רשומה שהסניף שלה נמחק, הוחלף או לא קיים נופלת מכל המסכים — אבל ממשיכה להופיע בהתראות של דף
        הבית ובהנה&quot;ח הראשית. כאן מרוכזות בדיוק הרשומות האלה. נסרקו {report.scanned.toLocaleString("he-IL")} מסמכים.
      </p>

      {report.total === 0 ? (
        <div className="rounded-card border border-emerald-200 bg-emerald-50 p-6 text-center">
          <p className="flex items-center justify-center gap-1.5 text-sm font-extrabold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" />
            לא נמצאו שאריות
          </p>
          <p className="mt-1 text-[12.5px] text-emerald-700">
            כל הרשומות במערכת משויכות לסניף קיים, וכל התראה בדף הבית מובילה למסך שאפשר לטפל בה בו.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {report.groups
            .filter((g) => g.items.length > 0)
            .map((group) => (
              <section key={group.key} className="rounded-card border border-amber-300 bg-amber-50 p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-extrabold text-ink">{group.title}</h2>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-extrabold text-amber-900">
                    {group.items.length}
                  </span>
                </div>
                <p className="mb-3 text-[11.5px] leading-relaxed text-amber-900">{group.explain}</p>

                <div className="flex flex-col gap-2">
                  {group.items.map((item) => (
                    <div
                      key={`${item.collection}/${item.id}`}
                      className="rounded-lg border border-amber-200 bg-white p-3"
                    >
                      <p className="text-[13px] font-extrabold text-ink">{item.title}</p>
                      <p className="mt-0.5 text-[11.5px] text-muted">{item.detail}</p>
                      <p className="mt-1 text-[11.5px] font-bold text-amber-900">למה לא רואים אותה: {item.reason}</p>
                      {item.moneyNote && <p className="mt-0.5 text-[11.5px] text-muted">{item.moneyNote}</p>}

                      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-card-border pt-2">
                        {item.fixHref && (
                          <Link
                            href={item.fixHref}
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-teal hover:underline"
                          >
                            {item.fixLabel ?? "למסך הטיפול"}
                            <ArrowLeft className="h-3 w-3" />
                          </Link>
                        )}
                        <form
                          action={deleteLeftoverAction.bind(null, item.collection, item.id)}
                          className="mr-auto"
                        >
                          <DeleteLeftoverButton title={item.title} moneyNote={item.moneyNote} />
                        </form>
                        <span className="text-[10.5px] text-muted">
                          {item.collection}/{item.id}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
