import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Laptop, Branch } from "@ultranet/shared-types";
import { createLaptopAction } from "../actions";

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

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
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">💻 מלאי מחשבים</h1>

      <form
        action={createLaptopAction}
        className="mb-6 grid grid-cols-1 gap-4 rounded-card border border-card-border bg-white p-5 shadow-card sm:grid-cols-2"
      >
        {role === "owner" ? (
          <div>
            <label className={LABEL}>סניף</label>
            <select name="branchId" required className={FIELD}>
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
          <label className={LABEL}>שם מחשב</label>
          <input name="name" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>מספר סידורי</label>
          <input name="serial" dir="ltr" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>מחיר ליום</label>
          <input name="dayPrice" type="number" min={0} defaultValue={0} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>מחיר לשבוע</label>
          <input name="weekPrice" type="number" min={0} defaultValue={0} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>מחיר לחודש</label>
          <input name="monthPrice" type="number" min={0} defaultValue={0} className={FIELD} />
        </div>
        <button
          type="submit"
          className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 sm:col-span-2"
        >
          הוספת מחשב
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">שם</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחיר ליום</th>
              {role === "owner" && (
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
              )}
            </tr>
          </thead>
          <tbody>
            {laptops.map((l) => (
              <tr key={l.id} className="border-t border-card-border transition hover:bg-[#f8fafc]">
                <td className="px-[11px] py-2 font-semibold text-ink">{l.name}</td>
                <td className="px-[11px] py-2 text-muted">{l.dayPrice} ₪</td>
                {role === "owner" && <td className="px-[11px] py-2 text-muted">{branchName(l.branchId)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
