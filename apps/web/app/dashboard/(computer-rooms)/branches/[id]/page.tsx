import { notFound, redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { BranchForm } from "../branch-form";
import { DeleteButton } from "../delete-button";
import { updateBranchAction, deleteBranchAction } from "../actions";

export default async function BranchDetailPage({ params }: { params: { id: string } }) {
  const session = await requireModuleAccess("branches");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const doc = await getAdminFirestore().collection("n_branches").doc(params.id).get();
  if (!doc.exists) {
    notFound();
  }
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;

  if (branch.branchType !== "computers") {
    notFound();
  }

  const canView = role === "owner" || branch.id === myBranchId || branch.parentBranchId === myBranchId;
  if (!canView) {
    redirect("/dashboard/branches");
  }

  if (role !== "owner") {
    return (
      <div className="max-w-2xl">
        <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Building2 className="h-5 w-5" />{branch.name}</h1>
        <div className="grid grid-cols-2 gap-2.5">
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
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Building2 className="h-5 w-5" />{branch.name}</h1>
        <form action={boundDelete}>
          <DeleteButton />
        </form>
      </div>
      <BranchForm action={boundUpdate} initial={branch} />
    </div>
  );
}
