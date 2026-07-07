import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { createClientAction } from "../actions";

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

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
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">👥 לקוחות השכרה</h1>

      <form
        action={createClientAction}
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
          <label className={LABEL}>שם לקוח</label>
          <input name="name" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>טלפון</label>
          <input name="phone" dir="ltr" className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>ת.ז.</label>
          <input name="idNum" dir="ltr" className={FIELD} />
        </div>
        <div className="sm:col-span-2">
          <label className={LABEL}>כתובת</label>
          <input name="address" className={FIELD} />
        </div>
        <button
          type="submit"
          className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 sm:col-span-2"
        >
          הוספת לקוח
        </button>
      </form>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">שם</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">טלפון</th>
              {role === "owner" && (
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
              )}
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-card-border transition hover:bg-[#f8fafc]">
                <td className="px-[11px] py-2 font-semibold text-ink">{c.name}</td>
                <td className="px-[11px] py-2 text-muted" dir="ltr">
                  {c.phone ?? "-"}
                </td>
                {role === "owner" && <td className="px-[11px] py-2 text-muted">{branchName(c.branchId)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
