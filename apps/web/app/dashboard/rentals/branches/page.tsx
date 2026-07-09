import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";

const MODEL_LABELS: Record<string, string> = {
  classic: "🏢 קלאסי",
  partnership: "🤝 שותפות",
  sub_partnership: "🌿 תת שותפות",
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
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-extrabold text-ink">{"🏢 סניפי ההשכרות"}</h2>
          <p className="text-[13px] text-muted">{"ניהול סניפים, שותפויות ותת-שותפויות"}</p>
        </div>
        <Link
          href="/dashboard/rentals/branches/new"
          className="rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          {"+ הוספת סניף"}
        </Link>
      </div>

      {branches.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          {"עדיין אין סניפים"}
        </div>
      ) : (
        <div className="space-y-2.5">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/rentals/branches/${b.id}`}
              className="block rounded-card border border-card-border bg-white p-4 shadow-card transition hover:border-teal"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
                  {"🏢 "}
                  {b.name}
                </div>
                <span className="rounded-full bg-[#e8f4fd] px-2.5 py-1 text-[11px] font-bold text-[#2980b9]">
                  {MODEL_LABELS[modelOf(b)]}
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5 text-xs text-muted">
                {b.location && <span>{`📍 ${b.location}`}</span>}
                {modelOf(b) !== "classic" && (
                  <span>{`🤝 ${b.partnerName ?? "ללא שם"} · ${b.myPct}% / ${b.partnerPct}%`}</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
