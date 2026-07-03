import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Laptop, Branch } from "@ultranet/shared-types";
import { createLaptopAction } from "../actions";

export default async function LaptopsPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const myBranchId = session?.user?.branchId;

  const db = getAdminFirestore();
  const [laptopsSnap, branchesSnap] = await Promise.all([
    db.collection("n_laptops").get(),
    db.collection("n_branches").get(),
  ]);
  const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch);
  const allLaptops = laptopsSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Laptop, "id">) }) as Laptop);
  const laptops = role === "owner" ? allLaptops : allLaptops.filter((l) => l.branchId === myBranchId);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-800">מלאי מחשבים</h1>

      <form
        action={createLaptopAction}
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
          <label className="mb-1 block text-sm font-medium text-gray-700">שם מחשב</label>
          <input
            name="name"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">מספר סידורי</label>
          <input
            name="serial"
            dir="ltr"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">מחיר ליום</label>
          <input
            name="dayPrice"
            type="number"
            min={0}
            defaultValue={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">מחיר לשבוע</label>
          <input
            name="weekPrice"
            type="number"
            min={0}
            defaultValue={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">מחיר לחודש</label>
          <input
            name="monthPrice"
            type="number"
            min={0}
            defaultValue={0}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <button
          type="submit"
          className="self-start rounded-lg bg-teal px-6 py-2 font-medium text-white transition hover:bg-teal-dark sm:col-span-2"
        >
          הוספת מחשב
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-right text-sm">
          <thead className="bg-gray-50 text-gray-500">
            <tr>
              <th className="px-4 py-3 font-medium">שם</th>
              <th className="px-4 py-3 font-medium">מחיר ליום</th>
              {role === "owner" && <th className="px-4 py-3 font-medium">סניף</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {laptops.map((l) => (
              <tr key={l.id}>
                <td className="px-4 py-3 font-medium text-gray-800">{l.name}</td>
                <td className="px-4 py-3 text-gray-600">{l.dayPrice} ₪</td>
                {role === "owner" && <td className="px-4 py-3 text-gray-600">{branchName(l.branchId)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
