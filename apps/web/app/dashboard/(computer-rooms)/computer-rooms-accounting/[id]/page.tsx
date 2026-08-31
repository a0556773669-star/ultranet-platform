import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { BarChart3, ArrowLeft, Plus } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { loadComputerRoomAccounting } from "@/lib/computer-room-accounting";
import { addBranchIncomeAction, deleteBranchIncomeAction } from "../actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const FIELD = "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export default async function ComputerRoomBranchAccountingPage({ params }: { params: { id: string } }) {
  const session = await requireModuleAccess("computers");
  const isOwner = session.user?.role === "owner";
  const myBranchId = session.user?.branchId;
  if (!isOwner && params.id !== myBranchId) redirect("/dashboard/computer-rooms-accounting");

  const data = await loadComputerRoomAccounting();
  const stats = data.statsByBranch.get(params.id);
  if (!stats) notFound();

  const canAdd = isOwner || (stats.branch.isMine === false && params.id === myBranchId);
  const incomes = (data.incomesByBranch.get(params.id) ?? []).sort((a, b) => b.date.localeCompare(a.date));
  const addIncome = addBranchIncomeAction.bind(null, params.id);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
          <BarChart3 className="h-5 w-5" />
          הנה&quot;ח — {stats.branch.name}
        </h1>
        {isOwner && (
          <Link href="/dashboard/computer-rooms-accounting" className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline">
            <ArrowLeft className="h-4 w-4" />
            בחירת סניף אחר
          </Link>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <div className="rounded-card border border-card-border bg-white p-4 text-center shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">עלות הקמה</p>
          <p className="mt-1 text-xl font-black text-ink">{money(stats.setupCost)}</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 text-center shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">הוצאות עד היום (כולל הקמה)</p>
          <p className="mt-1 text-xl font-black text-red-600">{money(stats.spentToDate)}</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 text-center shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">הכנסות עד היום</p>
          <p className="mt-1 text-xl font-black text-emerald-600">{money(stats.incomeToDate)}</p>
        </div>
        <div className="rounded-card border border-card-border bg-white p-4 text-center shadow-card">
          <p className="text-[11px] font-bold uppercase tracking-wide text-muted">רווח מוחזק</p>
          <p className={`mt-1 text-xl font-black ${stats.profitHeld >= 0 ? "text-teal-dark" : "text-red-600"}`}>{money(stats.profitHeld)}</p>
        </div>
      </div>

      {stats.sharedExpenseShare > 0 && (
        <p className="text-xs text-muted">
          מתוכן {money(stats.sharedExpenseShare)} חלק הסניף בהוצאות המשותפות לכל סניפי חדרי המחשבים.
        </p>
      )}

      {canAdd && (
        <form action={addIncome} className="flex flex-wrap items-end gap-2.5 rounded-card border border-card-border bg-white p-4 shadow-card">
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">תאריך</label>
            <input type="date" name="date" defaultValue={todayStr} required className={FIELD} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">תיאור (לא חובה)</label>
            <input name="desc" placeholder="הכנסת חודש" className={FIELD} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-muted">סכום</label>
            <input type="number" name="amount" min={0} required className={FIELD} />
          </div>
          <button type="submit" className="flex items-center gap-1.5 self-end rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
            <Plus className="h-4 w-4" />
            הוספת הכנסת חודש
          </button>
        </form>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
          <span>שורות הכנסה שנוספו</span>
          <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{incomes.length}</span>
        </div>
        <div className="rounded-card border border-card-border bg-white px-4 shadow-card">
          {incomes.length === 0 && <p className="py-6 text-center text-sm text-muted">אין עדיין שורות הכנסה</p>}
          {incomes.map((i) => {
            const bound = isOwner ? deleteBranchIncomeAction.bind(null, i.id, params.id) : null;
            return (
              <div key={i.id} className="flex items-center gap-2.5 border-b border-card-border py-2.5 text-[13px] last:border-b-0">
                <div className="flex-1">
                  <div className="font-bold text-ink">{i.desc}</div>
                  <div className="mt-0.5 text-[11px] text-muted">{i.date}</div>
                </div>
                <div className="min-w-[75px] text-left font-extrabold text-emerald-600">{i.amount.toLocaleString()} ₪</div>
                {bound && (
                  <form action={bound}>
                    <button type="submit" className="rounded-lg border border-red-200 px-2 py-1 text-[11px] font-medium text-red-600 transition hover:bg-red-50">
                      מחיקה
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
