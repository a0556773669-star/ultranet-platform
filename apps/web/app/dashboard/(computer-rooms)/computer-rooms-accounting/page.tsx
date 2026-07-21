import { redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, Building2, ArrowRight, Layers } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { loadComputerRoomAccounting } from "@/lib/computer-room-accounting";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

export default async function ComputerRoomsAccountingHomePage() {
  const session = await requireModuleAccess("computers");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;

  if (!isOwner) {
    if (!myBranchId) redirect("/dashboard");
    redirect(`/dashboard/computer-rooms-accounting/${myBranchId}`);
  }

  const data = await loadComputerRoomAccounting();
  const totals = data.branches.reduce(
    (acc, b) => {
      const s = data.statsByBranch.get(b.id);
      if (!s) return acc;
      acc.setup += s.setupCost;
      acc.spent += s.spentToDate;
      acc.income += s.incomeToDate;
      acc.profit += s.profitHeld;
      return acc;
    },
    { setup: 0, spent: 0, income: 0, profit: 0 },
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <BarChart3 className="h-5 w-5" />
          הנה&quot;ח חדרי מחשבים — השקעה מול רווח
        </h1>
        <Link
          href={`/dashboard/expenses/shared`}
          className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-2 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
        >
          <Layers className="h-4 w-4" />
          הוצאות משותפות
        </Link>
      </div>
      <p className="text-xs text-muted">
        מעקב סטטוס בלבד: כמה עלתה הקמת כל סניף, כמה הוצאתי עליו עד היום (כולל הקמה), כמה נכנס
        עד היום, וכמה מהרווח עדיין מוחזק. לא מתחשבן בהנה&quot;ח הראשית ובדף הבית.
      </p>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-4">
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ עלות הקמה</p>
          <p className="mt-1 text-xl font-black text-ink">{money(totals.setup)}</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ הוצאות עד היום</p>
          <p className="mt-1 text-xl font-black text-red-600">{money(totals.spent)}</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סה&quot;כ הכנסות עד היום</p>
          <p className="mt-1 text-xl font-black text-emerald-600">{money(totals.income)}</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">רווח מוחזק</p>
          <p className={`mt-1 text-xl font-black ${totals.profit >= 0 ? "text-teal-dark" : "text-red-600"}`}>{money(totals.profit)}</p>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        {data.branches.length === 0 && (
          <div className="rounded-card border border-card-border bg-white p-5 text-center text-sm text-muted shadow-card">
            אין עדיין סניפי חדרי מחשבים
          </div>
        )}
        {data.branches.map((b) => {
          const s = data.statsByBranch.get(b.id);
          if (!s) return null;
          return (
            <Link
              key={b.id}
              href={`/dashboard/computer-rooms-accounting/${b.id}`}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-card-border bg-white p-4 shadow-card transition hover:bg-[#f8fafc]"
            >
              <span className="flex items-center gap-1.5 font-bold text-ink">
                <Building2 className="h-4 w-4" />
                {b.name}
              </span>
              <div className="flex flex-wrap items-center gap-4 text-xs">
                <span className="text-muted">הקמה: <b className="text-ink">{money(s.setupCost)}</b></span>
                <span className="text-muted">הוצאות: <b className="text-red-600">{money(s.spentToDate)}</b></span>
                <span className="text-muted">הכנסות: <b className="text-emerald-600">{money(s.incomeToDate)}</b></span>
                <span className="text-muted">
                  רווח: <b className={s.profitHeld >= 0 ? "text-teal-dark" : "text-red-600"}>{money(s.profitHeld)}</b>
                </span>
                <ArrowRight className="h-4 w-4 text-muted" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
