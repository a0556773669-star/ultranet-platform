import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { BranchForm } from "../../branch-form";
import { DeleteButton } from "../../delete-button";
import { updateBranchAction, deleteBranchAction } from "../../actions";

/**
 * טופס עריכת הסניף. נפרד מהכרטיס (`[id]/page.tsx`) בכוונה: הכרטיס הוא מה שפותחים כל יום,
 * והעריכה היא פעולה נדירה שצריכה לחיצה מפורשת ולא להיות מצב ברירת המחדל של המסך.
 */
export default async function BranchEditPage({ params }: { params: { id: string } }) {
  const session = await requireModuleAccess("branches");
  if (session.user?.role !== "owner") {
    redirect(`/dashboard/branches/${params.id}`);
  }

  const doc = await getAdminFirestore().collection("n_branches").doc(params.id).get();
  if (!doc.exists) {
    notFound();
  }
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;
  if (branch.branchType !== "computers") {
    notFound();
  }

  const boundUpdate = updateBranchAction.bind(null, branch.id);
  const boundDelete = deleteBranchAction.bind(null, branch.id);

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Pencil className="h-5 w-5" />
          עריכת {branch.name}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/branches/${branch.id}`}
            className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            חזרה לכרטיס
          </Link>
          <form action={boundDelete}>
            <DeleteButton />
          </form>
        </div>
      </div>
      <BranchForm action={boundUpdate} initial={branch} />
    </div>
  );
}
