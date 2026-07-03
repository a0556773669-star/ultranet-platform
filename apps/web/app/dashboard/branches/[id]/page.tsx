import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { BranchForm } from "../branch-form";
import { DeleteButton } from "../delete-button";
import { updateBranchAction, deleteBranchAction } from "../actions";

const TYPE_LABELS: Record<string, string> = {
  computers: "מחשבים",
  rentals: "השכרות",
  coworking: "קוורקינג",
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
        <h1 className="mb-6 text-2xl font-bold text-gray-800">{branch.name}</h1>
        <dl className="grid grid-cols-2 gap-4 rounded-xl border border-gray-200 bg-white p-6 text-sm">
          <div>
            <dt className="text-gray-500">סוג</dt>
            <dd className="font-medium text-gray-800">{TYPE_LABELS[branch.branchType] ?? branch.branchType}</dd>
          </div>
          <div>
            <dt className="text-gray-500">מיקום</dt>
            <dd className="font-medium text-gray-800">{branch.location ?? "-"}</dd>
          </div>
          <div>
            <dt className="text-gray-500">האחוז שלי</dt>
            <dd className="font-medium text-gray-800">{branch.isMine ? "100%" : `${branch.myPct}%`}</dd>
          </div>
        </dl>
      </div>
    );
  }

  const boundUpdate = updateBranchAction.bind(null, branch.id);
  const boundDelete = deleteBranchAction.bind(null, branch.id);

  return (
    <div className="max-w-2xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-800">{branch.name}</h1>
        <form action={boundDelete}>
          <DeleteButton />
        </form>
      </div>
      <BranchForm action={boundUpdate} initial={branch} />
    </div>
  );
}
