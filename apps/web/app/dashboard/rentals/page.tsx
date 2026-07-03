import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Rental, RentalClient, Laptop, Branch } from "@ultranet/shared-types";
import { markReturnedAction } from "./actions";
import { ReturnButton } from "./return-button";

async function loadData() {
  const db = getAdminFirestore();
  const [rentalsSnap, clientsSnap, laptopsSnap, branchesSnap] = await Promise.all([
    db.collection("n_rentals").get(),
    db.collection("n_rental_clients").get(),
    db.collection("n_laptops").get(),
    db.collection("n_branches").get(),
  ]);
  const rentals = rentalsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Rental, "id">) }) as Rental);
  const clients = new Map(clientsSnap.docs.map((d) => [d.id, d.data() as RentalClient]));
  const laptops = new Map(laptopsSnap.docs.map((d) => [d.id, d.data() as Laptop]));
  const branches = new Map(branchesSnap.docs.map((d) => [d.id, d.data() as Branch]));
  return { rentals, clients, laptops, branches };
}

export default async function RentalsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const myBranchId = session?.user?.branchId;

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
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-800">השכרות</h1>
        <div className="flex gap-2">
          <Link href="/dashboard/rentals/clients" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            לקוחות
          </Link>
          <Link href="/dashboard/rentals/laptops" className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50">
            מלאי מחשבים
          </Link>
          <Link href="/dashboard/rentals/new" className="rounded-lg bg-teal px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-dark">
            + השכרה חדשה
          </Link>
        </div>
      </div>

      <h2 className="mb-3 text-lg font-semibold text-gray-700">השכרות פעילות</h2>
      {active.length === 0 ? (
        <p className="mb-8 text-sm text-gray-500">אין השכרות פעילות כרגע.</p>
      ) : (
        <div className="mb-8 overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">לקוח</th>
                <th className="px-4 py-3 font-medium">מחשב</th>
                {role === "owner" && <th className="px-4 py-3 font-medium">סניף</th>}
                <th className="px-4 py-3 font-medium">התחלה</th>
                <th className="px-4 py-3 font-medium">סיום</th>
                <th className="px-4 py-3 font-medium">מחיר</th>
                <th className="px-4 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {active.map((r) => {
                const info = rowInfo(r);
                const bound = markReturnedAction.bind(null, r.id);
                return (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-800">{info.clientName}</td>
                    <td className="px-4 py-3 text-gray-600">{info.laptopName}</td>
                    {role === "owner" && <td className="px-4 py-3 text-gray-600">{info.branchName}</td>}
                    <td className="px-4 py-3 text-gray-600">{r.startDate}</td>
                    <td className="px-4 py-3 text-gray-600">{r.endDate}</td>
                    <td className="px-4 py-3 text-gray-600">{r.calcPrice} ₪</td>
                    <td className="px-4 py-3">
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

      <h2 className="mb-3 text-lg font-semibold text-gray-700">היסטוריה אחרונה</h2>
      {history.length === 0 ? (
        <p className="text-sm text-gray-500">אין היסטוריית השכרות.</p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
          <table className="w-full text-right text-sm">
            <thead className="bg-gray-50 text-gray-500">
              <tr>
                <th className="px-4 py-3 font-medium">לקוח</th>
                <th className="px-4 py-3 font-medium">מחשב</th>
                <th className="px-4 py-3 font-medium">התחלה</th>
                <th className="px-4 py-3 font-medium">סיום בפועל</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {history.map((r) => {
                const info = rowInfo(r);
                return (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-gray-600">{info.clientName}</td>
                    <td className="px-4 py-3 text-gray-600">{info.laptopName}</td>
                    <td className="px-4 py-3 text-gray-600">{r.startDate}</td>
                    <td className="px-4 py-3 text-gray-600">{r.returnDate ?? r.endDate}</td>
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
