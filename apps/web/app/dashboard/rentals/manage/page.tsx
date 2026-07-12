import Link from "next/link";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Rental, RentalClient, Laptop, Branch } from "@ultranet/shared-types";
import { markReturnedAction } from "../actions";
import { ReturnButton } from "../return-button";

async function loadData() {
  const db = getAdminFirestore();
  const [rentalsSnap, clientsSnap, laptopsSnap, branchesSnap] = await Promise.all([
    db.collection("n_rentals").get(),
    db.collection("n_rental_clients").get(),
    db.collection("n_laptops").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);
  const rentals = rentalsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Rental, "id">) }) as Rental);
  const clients = new Map(clientsSnap.docs.map((d) => [d.id, d.data() as RentalClient]));
  const laptops = new Map(laptopsSnap.docs.map((d) => [d.id, d.data() as Laptop]));
  const branches = new Map(branchesSnap.docs.map((d) => [d.id, d.data() as Branch]));
  return { rentals, clients, laptops, branches };
}

export default async function RentalsPage() {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const { rentals, clients, laptops, branches } = await loadData();

  const visible = rentals.filter((r) => role === "owner" || r.branchId === myBranchId);
  const active = visible.filter((r) => r.status === "active");
  const history = visible.filter((r) => r.status !== "active").slice(0, 20);

  function rowInfo(r: Rental) {
    return {
      clientName: clients.get(r.clientId)?.name ?? "-",
      laptopName: laptops.get(r.itemId)?.name ?? "-",
      branchName: branches.get(r.branchId)?.name ?? "-",
    };
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[21px] font-extrabold text-ink">📋 ניהול השכרות</h1>
        <p className="text-sm text-muted">השכרות פעילות והיסטוריה</p>
      </div>
      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span>📋 השכרות פעילות</span>
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{active.length}</span>
      </div>
      {active.length === 0 ? (
        <div className="mb-8 rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
          אין השכרות פעילות כרגע
        </div>
      ) : (
        <div className="mb-8 overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f6f9] text-muted">
              <tr>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">לקוח</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחשב</th>
                {role === "owner" && (
                  <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
                )}
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">התחלה</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סיום</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחיר</th>
                <th className="px-[11px] py-[9px]"></th>
              </tr>
            </thead>
            <tbody>
              {active.map((r) => {
                const info = rowInfo(r);
                const bound = markReturnedAction.bind(null, r.id);
                return (
                  <tr key={r.id} className="border-t border-card-border transition hover:bg-[#f8fafc]">
                    <td className="px-[11px] py-2 font-semibold text-ink">{info.clientName}</td>
                    <td className="px-[11px] py-2 text-muted">{info.laptopName}</td>
                    {role === "owner" && <td className="px-[11px] py-2 text-muted">{info.branchName}</td>}
                    <td className="px-[11px] py-2 text-muted">{r.startDate}</td>
                    <td className="px-[11px] py-2 text-muted">{r.endDate}</td>
                    <td className="px-[11px] py-2 font-semibold text-ink">{r.calcPrice} ₪</td>
                    <td className="px-[11px] py-2">
                      <form action={bound}>
                        <ReturnButton />
                      </form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
        <span>🗄️ היסטוריה אחרונה</span>
        <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{history.length}</span>
      </div>
      {history.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-sm text-muted">
          אין היסטוריית השכרות
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <table className="w-full text-[13px]">
            <thead className="bg-[#f4f6f9] text-muted">
              <tr>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">לקוח</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחשב</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">התחלה</th>
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סיום בפועל</th>
              </tr>
            </thead>
            <tbody>
              {history.map((r) => {
                const info = rowInfo(r);
                return (
                  <tr key={r.id} className="border-t border-card-border transition hover:bg-[#f8fafc]">
                    <td className="px-[11px] py-2 text-muted">{info.clientName}</td>
                    <td className="px-[11px] py-2 text-muted">{info.laptopName}</td>
                    <td className="px-[11px] py-2 text-muted">{r.startDate}</td>
                    <td className="px-[11px] py-2 text-muted">{r.returnDate ?? r.endDate}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
