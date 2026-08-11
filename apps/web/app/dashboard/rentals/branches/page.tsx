import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Handshake, Leaf, Plus, Laptop as LaptopIcon, type LucideIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, Laptop } from "@ultranet/shared-types";
import { AuditPermsButton } from "./audit-perms-button";

const MODEL_LABELS: Record<string, string> = {
  classic: "קלאסי",
  partnership: "שותפות",
  sub_partnership: "תת שותפות",
};

const MODEL_ICONS: Record<string, LucideIcon> = {
  classic: Building2,
  partnership: Handshake,
  sub_partnership: Leaf,
};

function modelOf(b: Branch): keyof typeof MODEL_LABELS {
  if (b.parentBranchId) return "sub_partnership";
  if (b.isMine === false) return "partnership";
  return "classic";
}

const TH = "px-3 py-2 text-right text-[11px] font-bold uppercase tracking-wide text-muted whitespace-nowrap";
const TD = "px-3 py-2 whitespace-nowrap text-[13px]";

export default async function RentalBranchesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const db = getAdminFirestore();
  const [branchesSnap, laptopsSnap] = await Promise.all([
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
    db.collection("n_laptops").get(),
  ]);
  const branches = branchesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .filter((b) => !b.deleted)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  // Live count - every computer actually registered under this branch right now (n_laptops),
  // not a trend/estimate - so it always matches what's really on /dashboard/rentals/laptops.
  const laptopCountByBranch = new Map<string, number>();
  for (const d of laptopsSnap.docs) {
    const l = d.data() as Omit<Laptop, "id">;
    laptopCountByBranch.set(l.branchId, (laptopCountByBranch.get(l.branchId) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
            <Building2 className="h-5 w-5" />
            {"סניפי ההשכרות"}
          </h2>
          <p className="text-[13px] text-muted">{"ניהול סניפים, שותפויות ותת-שותפויות"}</p>
        </div>
        <div className="flex items-center gap-2">
          <AuditPermsButton />
          <Link
            href="/dashboard/rentals/branches/new"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            {"הוספת סניף"}
          </Link>
        </div>
      </div>

      {branches.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          {"עדיין אין סניפים"}
        </div>
      ) : (
        <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse">
              <thead>
                <tr className="border-b border-card-border bg-[#f4f6f9]">
                  <th className={TH}>סניף</th>
                  <th className={TH}>סוג</th>
                  <th className={TH}>מיקום</th>
                  <th className={TH}>טלפון</th>
                  <th className={TH}>שותף</th>
                  <th className={TH}>מספר מחשבים</th>
                  <th className={TH}></th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {branches.map((b, idx) => {
                  const ModelIcon = MODEL_ICONS[modelOf(b)] ?? Building2;
                  const laptopCount = laptopCountByBranch.get(b.id) ?? 0;
                  return (
                    <tr key={b.id} className={idx % 2 === 1 ? "bg-[#fafbfc]" : "bg-white"}>
                      <td className={`${TD} font-bold text-ink`}>
                        <Link href={`/dashboard/rentals/branches/${b.id}`} className="hover:underline">
                          {b.name}
                        </Link>
                      </td>
                      <td className={TD}>
                        <span className="flex items-center gap-1.5 rounded-full bg-[#e8f4fd] px-2.5 py-1 text-[11px] font-bold text-[#2980b9] w-fit">
                          <ModelIcon className="h-3.5 w-3.5" />
                          {MODEL_LABELS[modelOf(b)]}
                        </span>
                      </td>
                      <td className={`${TD} text-muted`}>{b.location || "-"}</td>
                      <td className={`${TD} text-muted`}>{b.phone || "-"}</td>
                      <td className={`${TD} text-muted`}>
                        {modelOf(b) !== "classic" ? `${b.partnerName ?? "ללא שם"} · ${b.myPct}% / ${b.partnerPct}%` : "-"}
                      </td>
                      <td className={TD}>
                        <span className="flex items-center gap-1.5 font-bold text-ink">
                          <LaptopIcon className="h-3.5 w-3.5 text-muted" />
                          {laptopCount}
                        </span>
                      </td>
                      <td className={TD}>
                        <Link
                          href={`/dashboard/rentals/branches/${b.id}`}
                          className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
                        >
                          עריכה
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
