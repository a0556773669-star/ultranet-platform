import { BarChart3 } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, CoworkingClient, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { buildCoworkingLedger } from "@/lib/coworking";
import { CoworkingTabs } from "../coworking-tabs";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * הנה"ח משרד שיתופי — שני מספרים.
 *
 * הבעלים ביקש לראות כאן בדיוק שני דברים: כמה שילמתי עד היום וכמה קיבלתי. לכן אין כאן
 * טפסים, אין חודשים ואין פילוח לפי לקוח — כל אלה קיימים במסכים שלידם. הפירוט של
 * ההוצאות לשלושת הסוגים מוצג רק כדי שהמספר הגדול יהיה ניתן לפענוח, לא כדי לעבוד איתו.
 */
export default async function CoworkingAccountingPage() {
  const session = await requireModuleAccess("coworking");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;

  const db = getAdminFirestore();
  const [branchesSnap, clientsSnap, fixedSnap, variableSnap] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "coworking").get(),
    db.collection("n_cw_clients").get(),
    db.collection("n_fixed_expenses").get(),
    db.collection("n_var_expenses").get(),
  ]);

  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .filter((b) => isOwner || b.id === myBranchId);
  const branchIds = new Set(branches.map((b) => b.id));

  const clients = clientsSnap.docs
    .map((d) => ({ ...(d.data() as Omit<CoworkingClient, "id">), id: d.id }) as CoworkingClient)
    .filter((c) => branchIds.has(c.branchId));
  const fixed = fixedSnap.docs
    .map((d) => ({ ...(d.data() as Omit<FixedExpense, "id">), id: d.id }) as FixedExpense)
    .filter((e) => branchIds.has(e.branchId));
  const variable = variableSnap.docs
    .map((d) => ({ ...(d.data() as Omit<VariableExpense, "id">), id: d.id }) as VariableExpense)
    .filter((e) => branchIds.has(e.branchId));

  const ledger = buildCoworkingLedger({ fixed, variable, clients });

  return (
    <div>
      <CoworkingTabs active="/dashboard/coworking/accounting" />

      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <BarChart3 className="h-5 w-5" />
        {'הנה"ח משרד שיתופי'}
      </h1>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        <article className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">שילמתי עד היום</p>
          <p className="mt-1 text-[26px] font-black text-red-600">{money(ledger.paidToDate)}</p>
        </article>
        <article className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">קיבלתי עד היום</p>
          <p className="mt-1 text-[26px] font-black text-emerald-600">{money(ledger.receivedToDate)}</p>
        </article>
        <article className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted">מאזן</p>
          <p className={`mt-1 text-[26px] font-black ${ledger.balance >= 0 ? "text-teal-dark" : "text-red-600"}`}>
            {money(ledger.balance)}
          </p>
        </article>
      </div>

      <div className="mt-3 rounded-card border border-card-border bg-white p-4 text-[12.5px] shadow-card">
        <p className="mb-1.5 font-bold text-ink">ממה מורכבות ההוצאות</p>
        <ul className="space-y-0.5 text-muted">
          <li>
            הקמה: <b className="text-ink">{money(ledger.setupToDate)}</b>
          </li>
          <li>
            קבועות (נצבר מתחילת כל הוצאה עד היום): <b className="text-ink">{money(ledger.fixedToDate)}</b>
          </li>
          <li>
            שוטפות: <b className="text-ink">{money(ledger.variableToDate)}</b>
          </li>
        </ul>
        <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
          המספרים כאן הם של המשרד השיתופי בלבד. מה מתוכם נכנס גם לשורה התחתונה של העסק נקבע פר-שורה
          לפי הסימון &quot;לחשבן בהנה&quot;ח הראשית&quot;.
        </p>
      </div>
    </div>
  );
}
