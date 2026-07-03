import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CoworkingStation, Branch } from "@ultranet/shared-types";
import { createStationAction } from "../actions";

export default async function StationsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const myBranchId = session?.user?.branchId;

  const db = getAdminFirestore();
  const [stationsSnap, branchesSnap] = await Promise.all([
    db.collection("n_cw_stations").get(),
    db.collection("n_branches").get(),
  ]);
  const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch);
  const allStations = stationsSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<CoworkingStation, "id">) }) as CoworkingStation,
  );
  const stations = role === "owner" ? allStations : allStations.filter((s) => s.branchId === myBranchId);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">עמדות קוורקינג</h1>

      <form
        action={createStationAction}
        className="mb-8 grid grid-cols-1 gap-4 rounded-xl border border-gray-200 bg-white p-6 sm:grid-cols-3"
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
          <label className="mb-1 block text-sm font-medium text-gray-700">שם עמדה</label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">מחיר חודשי</label>
          <input
            name="price"
            type="number"
            min={0}
            defaultValue={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="self-start rounded-lg bg-teal px-6 py-2 font-medium text-white transition hover:bg-teal-dark sm:col-span-3"
        >
          הוספת עמדה
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">שם</th>
              <th className="px-4 py-3 font-medium">מחיר חודשי</th>
              {role === "owner" && <th className="px-4 py-3 font-medium">סניף</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {stations.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-gray-800">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">{s.price} ₪</td>
                {role === "owner" && <td className="px-4 py-3 text-gray-600">{branchName(s.branchId)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
