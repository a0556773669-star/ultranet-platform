import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";

const TYPE_LABELS: Record<string, string> = {
  computers: "🖥️ מחשבים",
  rentals: "💻 השכרות",
  coworking: "🏢 קוורקינג",
};

async function listBranches(): Promise<Branch[]> {
  const snap = await getAdminFirestore().collection("n_branches").get();
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export default async function BranchesPage() {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const myBranchId = session?.user?.branchId;

  const all = await listBranches();
  const branches =
    role === "owner" ? all : all.filter((b) => b.id === myBranchId || b.parentBranchId === myBranchId);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-[21px] font-extrabold text-ink">🏢 ניהול סניפים</h1>
          <p className="mt-1 text-[13px] text-muted">סניפים, שותפים, הוצאות ומטלות</p>
        </div>
        {role === "owner" && (
          <Link
            href="/dashboard/branches/new"
            className="rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
          >
            + סניף חדש
          </Link>
        )}
      </div>

      {branches.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          <div className="mb-3 text-4xl">🏢</div>
          אין סניפים עדיין
        </div>
      ) : (
        <div className="space-y-2.5">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/branches/${b.id}`}
              className="block rounded-card border border-card-border bg-white p-4 shadow-card transition hover:border-teal"
            >
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
                  🏢 {b.name}
                  {b.isMine ? (
                    <span className="rounded-full bg-teal-bg px-2.5 py-1 text-[11px] font-bold text-teal-dark">שלי בלבד</span>
                  ) : (
                    <span className="rounded-full bg-[#f3e8fd] px-2.5 py-1 text-[11px] font-bold text-purple">
                      שותפות עם {b.partnerName ?? "שותף"}
                    </span>
                  )}
                </div>
                <span className="rounded-full bg-[#e8f4fd] px-2.5 py-1 text-[11px] font-bold text-[#2980b9]">
                  {TYPE_LABELS[b.branchType] ?? b.branchType}
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5 text-xs text-muted">
                <span>📍 {b.location ?? "—"}</span>
                {!b.isMine && (
                  <span>
                    🤝 חלוקה: {b.myPct}% / {b.partnerPct}%
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
