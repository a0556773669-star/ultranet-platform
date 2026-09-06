import Link from "next/link";
import { Building2, AlertTriangle } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { loadCoworkingData, currentMonth } from "@/lib/coworking";
import { CoworkingTabs } from "./coworking-tabs";
import { ClientRow } from "./client-row";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * לקוחות המשרד השיתופי — מנוי חודשי, ולכן השאלה היחידה היא מי לא שילם.
 *
 * ההתראה בראש המסך היא כל הפואנטה: לקוח שהתחיל ב-10 בחודש אמור לשלם ב-10 בכל חודש,
 * והמערכת בודקת מול רשימת התשלומים אילו חודשים חסרים. חודש נוכחי שהתאריך שלו עדיין
 * לא הגיע אינו נחשב חוב - אחרת כל הלקוחות היו נראים בפיגור ב-1 לחודש.
 */
export default async function CoworkingPage() {
  const session = await requireModuleAccess("coworking");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const data = await loadCoworkingData(role === "owner" ? undefined : { branchId: myBranchId });
  const month = currentMonth();

  const active = data.statuses.filter((s) => s.active);
  const ended = data.statuses.filter((s) => !s.active);
  const overdue = active.filter((s) => s.unpaidMonths.length > 0);
  const monthlyTotal = active.reduce((sum, s) => sum + s.cost, 0);

  return (
    <div>
      <CoworkingTabs active="/dashboard/coworking" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Building2 className="h-5 w-5" />
            משרד שיתופי
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {active.length} לקוחות פעילים · {money(monthlyTotal)} לחודש
          </p>
        </div>
        <Link
          href="/dashboard/coworking/new"
          className="rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          + לקוח משרד שיתופי
        </Link>
      </div>

      {overdue.length > 0 && (
        <div className="mb-4 rounded-card border border-amber-300 bg-amber-50 p-3.5">
          <p className="flex items-center gap-1.5 text-sm font-extrabold text-amber-900">
            <AlertTriangle className="h-4 w-4" />
            ממתינים לתשלום ({overdue.length})
          </p>
          <ul className="mt-1 space-y-0.5 text-[12px] text-amber-900">
            {overdue.map((s) => (
              <li key={s.client.id}>
                <b>{s.client.name}</b> — {s.unpaidMonths.length} חודשים לא שולמו ({s.unpaidMonths.join(", ")}) ·{" "}
                {money(s.cost)} לחודש · יום תשלום {s.payDay} בחודש
              </li>
            ))}
          </ul>
        </div>
      )}

      {active.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          אין לקוחות משרד שיתופי פעילים
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {active.map((s) => (
            <ClientRow key={s.client.id} status={s} month={month} showBranch={role === "owner"} />
          ))}
        </div>
      )}

      {ended.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-bold text-muted">לקוחות שהפסיקו ({ended.length})</summary>
          <div className="mt-2 flex flex-col gap-2.5">
            {ended.map((s) => (
              <ClientRow key={s.client.id} status={s} month={month} showBranch={role === "owner"} />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
