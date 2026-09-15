import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { setupCostCountsToMain } from "@/lib/counts-to-main";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import type { Branch } from "@ultranet/shared-types";
import { CoworkingTabs } from "../coworking-tabs";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const TH = "px-2.5 py-1.5 text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-2.5 py-1.5 whitespace-nowrap";

/** סניפי המשרד השיתופי. עד עכשיו אפשר היה רק להשתמש בהם - לא להקים אותם. */
export default async function CoworkingBranchesPage() {
  const session = await requireModuleAccess("coworking");
  if (session.user?.role !== "owner") redirect("/dashboard/coworking");

  const snap = await getAdminFirestore().collection("n_branches").where("branchType", "==", "coworking").get();
  const branches = snap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const setupTotal = branches.reduce((total, b) => total + (b.setupCost ?? 0), 0);

  return (
    <div>
      <CoworkingTabs active="/dashboard/coworking/branches" />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Building2 className="h-5 w-5" />
            סניפי משרד שיתופי
          </h1>
          <p className="mt-1 text-[13px] text-muted">
            {branches.length} סניפים · {money(setupTotal)} סה&quot;כ עלות הקמה
          </p>
        </div>
        <Link
          href="/dashboard/coworking/branches/new"
          className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          <Plus className="h-4 w-4" />
          סניף חדש
        </Link>
      </div>

      {branches.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          אין עדיין סניף משרד שיתופי. יש להקים סניף לפני רישום לקוחות והוצאות.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-card border border-card-border bg-white shadow-card">
          <table className="w-full text-right text-[13px]">
            <thead className="border-b border-card-border bg-[#f9fafb]">
              <tr>
                <th className={TH}>סניף</th>
                <th className={TH}>מיקום</th>
                <th className={TH}>פתיחה</th>
                <th className={TH}>בעלות</th>
                <th className={TH}>עלות הקמה</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {branches.map((b) => (
                <tr key={b.id} className="transition hover:bg-[#f9fafb]">
                  <td className={TD}>
                    <Link href={`/dashboard/coworking/branches/${b.id}`} className="font-bold text-teal hover:underline">
                      {b.name}
                    </Link>
                    {b.notStarted && <span className="mr-1.5 text-[11px] text-muted">(טרם התחיל)</span>}
                  </td>
                  <td className={`${TD} text-muted`}>{b.location || "-"}</td>
                  <td className={`${TD} text-muted`}>{(b.openedAt || b.founded)?.slice(0, 10) || "-"}</td>
                  <td className={`${TD} text-muted`}>
                    {b.isMine === false ? `שותף: ${b.partnerName || "-"} (${b.partnerPct ?? 0}%)` : "מלאה"}
                  </td>
                  <td className={TD}>
                    <span className="font-bold text-ink">{money(b.setupCost ?? 0)}</span>
                    {(b.setupCost ?? 0) > 0 && (
                      <span className="mr-1.5 inline-block align-middle">
                        <CountsToMainBadge on={setupCostCountsToMain(b)} />
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
