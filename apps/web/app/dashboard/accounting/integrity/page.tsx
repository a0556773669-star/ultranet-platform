import Link from "next/link";
import { ShieldCheck, AlertTriangle, CircleAlert, CircleCheck } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { runIntegrityChecks } from "@/lib/integrity";
import { AccountingTabs } from "../accounting-tabs";
import { cleanupMirrorsAction } from "./actions";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";

// The screen re-reads everything on every load on purpose: a check that answers from a cache is
// not a check.
export const dynamic = "force-dynamic";

export default async function IntegrityPage() {
  await requireOwner();
  const report = await runIntegrityChecks();

  const clean = report.errorCount === 0 && report.warningCount === 0;
  const balanced = Math.abs(report.balance.difference) <= 0.5;
  const hasMirrors = report.checks.some((c) => c.key === "mirrors" && c.findings.length > 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <ShieldCheck className="h-5 w-5" />
            בדיקת שלמות
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            הכללים שאפשר לבדוק בקוד — וכל החריגות מהם, ברשימה אחת
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/integrity" />
      </div>

      <div className={`${CARD} mb-3.5 px-4 py-3 text-[12.5px] leading-relaxed text-muted`}>
        המסך הזה לא מתקן כלום מעצמו. מסך שלמות שמתקן את הספרים בשקט הוא רק עוד דרך שבה מספר משתנה
        בלי שתוכל להצביע על הסיבה. הוא מוצא, מסביר, ומראה לאן ללכת.
      </div>

      {/* --- the balance the whole asset layer rests on -------------------- */}
      <section
        className={`${CARD} mb-3.5 overflow-hidden ${balanced ? "" : "border-[#f0b8b8]"}`}
      >
        <div className={`px-4 py-3 ${balanced ? "bg-[#eefaf4]" : "bg-[#fdecec]"}`}>
          <h2
            className={`flex items-center gap-1.5 text-[15px] font-extrabold ${
              balanced ? "text-[#0f6e56]" : "text-[#b91c1c]"
            }`}
          >
            {balanced ? <CircleCheck className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
            {balanced ? "המאזן ההוני סוגר" : "המאזן ההוני לא סוגר"}
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-px bg-card-border sm:grid-cols-5">
          {[
            { label: "נרכש", value: report.balance.purchased },
            { label: "בסניפים", value: report.balance.inBranches },
            { label: "במחסן", value: report.balance.inWarehouse },
            { label: "יצא מהעסק", value: report.balance.exited },
            { label: "הפרש", value: report.balance.difference },
          ].map((c) => (
            <div key={c.label} className="bg-white px-4 py-3">
              <p className="text-[11px] font-extrabold text-muted">{c.label}</p>
              <p
                className={`mt-px text-[19px] font-black tabular-nums ${
                  c.label === "הפרש" && Math.abs(c.value) > 0.5 ? "text-[#b91c1c]" : "text-ink"
                }`}
              >
                {money(c.value)}
              </p>
            </div>
          ))}
        </div>
        <p className="border-t border-card-border px-4 py-2.5 text-[12px] text-muted">
          סניפים + מחסן + מה שיצא מהעסק חייבים להסתכם בדיוק במה שיצא מהחשבון. פריט שנמכר לא נעלם
          מהמאזן — הוא רק עובר לצד השני שלו, ולכן גם אחרי מכירות המאזן חייב להמשיך לסגור. הבדיקה
          הזו מחליפה את כל מנגנוני הבבואה וההשתקה של המודל הישן: היא לא מונעת כפילות בכוח, היא פשוט
          מבחינה בה.
        </p>
      </section>

      {clean ? (
        <p className={`${CARD} px-4 py-8 text-center text-[15px] font-extrabold text-[#0f6e56]`}>
          ✓ כל הבדיקות עברו. אין חריגות.
        </p>
      ) : (
        <p className="mb-3 text-[12.5px] font-bold text-muted">
          {report.errorCount > 0 && <span className="text-[#b91c1c]">{report.errorCount} שגיאות</span>}
          {report.errorCount > 0 && report.warningCount > 0 && " · "}
          {report.warningCount > 0 && <span className="text-[#7a4a12]">{report.warningCount} אזהרות</span>}
        </p>
      )}

      <div className="flex flex-col gap-3.5">
        {report.checks.map((check) => {
          const ok = check.findings.length === 0;
          return (
            <section key={check.key} className={CARD}>
              <div className="border-b border-card-border px-4 py-3">
                <h2 className="flex items-center gap-1.5 text-[14px] font-extrabold text-ink">
                  {ok ? (
                    <CircleCheck className="h-4 w-4 text-[#0f6e56]" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-[#c2410c]" />
                  )}
                  {check.title}
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10.5px] ${
                      ok ? "bg-[#eefaf4] text-[#0f6e56]" : "bg-[#fdf3e3] text-[#7a4a12]"
                    }`}
                  >
                    {ok ? "תקין" : `${check.findings.length} חריגות`}
                  </span>
                </h2>
                <p className="mt-1 text-[12px] leading-relaxed text-muted">{check.rule}</p>
              </div>

              {!ok && (
                <ul className="divide-y divide-[#eef1f6]">
                  {check.findings.map((f, i) => (
                    <li key={i} className="flex flex-wrap items-start justify-between gap-2 px-4 py-2.5">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-[13px] font-bold ${
                            f.severity === "error" ? "text-[#b91c1c]" : "text-[#7a4a12]"
                          }`}
                        >
                          {f.title}
                        </p>
                        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{f.detail}</p>
                      </div>
                      {f.href && (
                        <Link href={f.href} className="whitespace-nowrap text-[12px] font-bold text-teal hover:underline">
                          לטיפול ←
                        </Link>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {check.key === "mirrors" && hasMirrors && (
                <form action={cleanupMirrorsAction} className="border-t border-card-border px-4 py-3">
                  <button
                    type="submit"
                    className="rounded-[10px] border border-card-border px-4 py-2 text-[12.5px] font-bold text-ink transition hover:bg-gray-50"
                  >
                    מחיקת שורות הבבואה
                  </button>
                  <p className="mt-1.5 text-[11.5px] text-muted">
                    לא ישנה אף מספר באף מסך — הן כבר לא נספרות. רק מנקה שורות שנראות כמו כסף ואינן.
                  </p>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
