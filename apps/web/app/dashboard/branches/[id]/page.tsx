import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { BranchForm } from "../branch-form";
import { DeleteButton } from "../delete-button";
import { updateBranchAction, deleteBranchAction } from "../actions";

const TYPE_LABELS: Record<string, string> = {
  computers: "🖥️ מחשבים",
  rentals: "💻 השכרות",
  coworking: "🏢 קוורקינג",
};

export default async function BranchDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const role = session?.user?.role;
  const myBranchId = session?.user?.branchId;

  const doc = await getAdminFirestore().collection("n_branches").doc(params.id).get();
  if (!doc.exists) {
    notFound();
  }
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;

  const canView = role === "owner" || branch.id === myBranchId || branch.parentBranchId === myBranchId;
  if (!canView) {
    redirect("/dashboard/branches");
  }

  if (role !== "owner") {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-4 text-[21px] font-extrabold text-ink">🏢 {branch.name}</h1>
        <div className="grid grid-cols-3 gap-2.5">
          <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">סוג</p>
            <p className="mt-1 font-bold text-ink">{TYPE_LABELS[branch.branchType] ?? branch.branchType}</p>
          </div>
          <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">מיקום</p>
            <p className="mt-1 font-bold text-ink">{branch.location ?? "-"}</p>
          </div>
          <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">האחוז שלי</p>
            <p className="mt-1 font-bold text-teal-dark">{branch.isMine ? "100%" : `${branch.myPct}%`}</p>
          </div>
        </div>
      </div>
    );
  }

  const boundUpdate = updateBranchAction.bind(null, branch.id);
  const boundDelete = deleteBranchAction.bind(null, branch.id);

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[21px] font-extrabold text-ink">🏢 {branch.name}</h1>
        <form action={boundDelete}>
          <DeleteButton />
        </form>
      </div>
      <BranchForm action={boundUpdate} initial={branch} />
    </div>
  );
}
