import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Handshake, Leaf, MapPin, Plus, type LucideIcon } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
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

export default async function RentalBranchesPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const snap = await getAdminFirestore().collection("n_branches").where("branchType", "==", "rentals").get();
  const branches = snap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

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
        <div className="space-y-2.5">
          {branches.map((b) => {
            const ModelIcon = MODEL_ICONS[modelOf(b)] ?? Building2;
            return (
              <Link
                key={b.id}
                href={`/dashboard/rentals/branches/${b.id}`}
                className="block rounded-card border border-card-border bg-white p-4 shadow-card transition hover:border-teal"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
                    <Building2 className="h-4 w-4" />
                    {b.name}
                  </div>
                  <span className="flex items-center gap-1.5 rounded-full bg-[#e8f4fd] px-2.5 py-1 text-[11px] font-bold text-[#2980b9]">
                    <ModelIcon className="h-3.5 w-3.5" />
                    {MODEL_LABELS[modelOf(b)]}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2.5 text-xs text-muted">
                  {b.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />
                      {b.location}
                    </span>
                  )}
                  {modelOf(b) !== "classic" && (
                    <span className="flex items-center gap-1.5">
                      <Handshake className="h-3.5 w-3.5" />
                      {`${b.partnerName ?? "ללא שם"} · ${b.myPct}% / ${b.partnerPct}%`}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
