import { notFound, redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { CoworkingTabs } from "../../coworking-tabs";
import { CoworkingBranchForm } from "../coworking-branch-form";
import { DeleteCoworkingBranchButton } from "../delete-button";
import { updateCoworkingBranchAction, deleteCoworkingBranchAction } from "../actions";

export default async function CoworkingBranchDetailPage({ params }: { params: { id: string } }) {
  const session = await requireModuleAccess("coworking");
  if (session.user?.role !== "owner") redirect("/dashboard/coworking");

  const doc = await getAdminFirestore().collection("n_branches").doc(params.id).get();
  if (!doc.exists) notFound();
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;
  if (branch.branchType !== "coworking") notFound();

  const boundUpdate = updateCoworkingBranchAction.bind(null, branch.id);
  const boundDelete = deleteCoworkingBranchAction.bind(null, branch.id);

  return (
    <div className="max-w-2xl">
      <CoworkingTabs active="/dashboard/coworking" />
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Building2 className="h-5 w-5" />
          {branch.name}
        </h1>
        <form action={boundDelete}>
          <DeleteCoworkingBranchButton />
        </form>
      </div>
      <CoworkingBranchForm action={boundUpdate} initial={branch} />
    </div>
  );
}
