import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { createClientAction } from "../actions";

export default async function RentalClientsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const myBranchId = session?.user?.branchId;

  const db = getAdminFirestore();
  const [clientsSnap, branchesSnap] = await Promise.all([
    db.collection("n_rental_clients").get(),
    db.collection("n_branches").get(),
  ]);
  const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch);
  const allClients = clientsSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<RentalClient, "id">) }) as RentalClient,
  );
  const clients = role === "owner" ? allClients : allClients.filter((c) => c.branchId === myBranchId);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">לקוחות השכרה</h1>

      <form
        action={createClientAction}
        className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-2"
      >
        {role === "owner" ? (
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">סניף</label>
            <select
              name="branchId"
              required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
            >
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        ) : (
          <input type="hidden" name="branchId" value={myBranchId ?? ""} />
        )}
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">שם לקוח</label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">טלפון</label>
          <input
            name="phone"
            dir="ltr"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">ת.ז.</label>
          <input
            name="idNum"
            dir="ltr"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-sm font-medium text-gray-700">כתובת</label>
          <input
            name="address"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="self-start rounded-lg bg-teal px-6 py-2 font-medium text-white transition hover:bg-teal-dark sm:col-span-2"
        >
          הוספת לקוח
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">שם</th>
              <th className="px-4 py-3 font-medium">טלפון</th>
              {role === "owner" && <th className="px-4 py-3 font-medium">סניף</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {clients.map((c) => (
              <tr key={c.id}>
                <td className="px-4 py-3 font-medium text-gray-800">{c.name}</td>
                <td className="px-4 py-3 text-gray-600" dir="ltr">
                  {c.phone ?? "-"}
                </td>
                {role === "owner" && <td className="px-4 py-3 text-gray-600">{branchName(c.branchId)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
