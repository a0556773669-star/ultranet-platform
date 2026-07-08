import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { CoworkingStation, Branch } from "@ultranet/shared-types";
import { createStationAction } from "../actions";

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export default async function StationsPage() {
  const session = await requireModuleAccess("coworking");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

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
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">🪑 עמדות משרד שיתופי</h1>

      <form
        action={createStationAction}
        className="mb-6 grid grid-cols-1 gap-4 rounded-card border border-card-border bg-white p-5 shadow-card sm:grid-cols-3"
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
          <label className={LABEL}>שם עמדה</label>
          <input name="name" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>מחיר חודשי</label>
          <input name="price" type="number" min={0} defaultValue={0} className={FIELD} />
        </div>
        <button
          type="submit"
          className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 sm:col-span-3"
        >
          הוספת עמדה
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">שם</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">מחיר חודשי</th>
              {role === "owner" && (
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
              )}
            </tr>
          </thead>
          <tbody>
            {stations.map((s) => (
              <tr key={s.id} className="border-t border-card-border transition hover:bg-[#f8fafc]">
                <td className="px-[11px] py-2 font-semibold text-ink">{s.name}</td>
                <td className="px-[11px] py-2 text-muted">{s.price} ₪</td>
                {role === "owner" && <td className="px-[11px] py-2 text-muted">{branchName(s.branchId)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
