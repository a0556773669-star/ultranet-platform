import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Building2, Banknote, ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, CollectionRoute } from "@ultranet/shared-types";
import { RentalBranchForm } from "../../rental-branch-form";
import { DeleteRentalBranchButton } from "../../delete-button";
import { CloseBranchControl } from "../../close-branch-control";
import { updateRentalBranchAction, deleteRentalBranchAction } from "../../actions";
import { docVersion } from "@/lib/edit-conflict";

/** עריכת פרטי הסניף — מסך נפרד מכרטיס הצפייה (אפיון שדרוג v2, סעיף 6). התוכן ללא שינוי. */
export default async function RentalBranchEditPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const db = getAdminFirestore();
  const doc = await db.collection("n_branches").doc(params.id).get();
  if (!doc.exists) notFound();
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;

  const routesSnap = await db.collection("n_collection_routes").get();

  const routes = routesSnap.docs
    .map((d) => ({ ...(d.data() as Omit<CollectionRoute, "id">), id: d.id }) as CollectionRoute)
    .map((r) => ({ id: r.id, name: r.name }));

  const boundUpdate = updateRentalBranchAction.bind(null, branch.id);
  const boundDelete = deleteRentalBranchAction.bind(null, branch.id);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
          <Building2 className="h-5 w-5" />
          {branch.name}
          {branch.closedAt && (
            <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-[11px] font-extrabold text-muted">
              סניף סגור מ-{branch.closedAt}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/rentals/branches/${branch.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
          >
            חזרה לכרטיס הסניף
          </Link>
          <Link
            href={`/dashboard/rentals/expenses/${branch.id}`}
            className="flex items-center gap-1.5 rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
          >
            <Banknote className="h-4 w-4" />
            ניהול הוצאות
            <ArrowRight className="h-4 w-4" />
          </Link>
          <CloseBranchControl branchId={branch.id} branchName={branch.name} closedAt={branch.closedAt} />
          <form action={boundDelete}>
            <DeleteRentalBranchButton />
          </form>
        </div>
      </div>
      {/* אחרי שמירה שנחסמה (עריכה מקבילה) הטופס נבנה מחדש עם הערכים העדכניים */}
      <RentalBranchForm
        key={searchParams?.error === "conflict" ? `conflict-${docVersion(doc)}` : "edit"}
        action={boundUpdate}
        initial={branch}
        routes={routes}
        editGuard={{ id: branch.id, loadedAt: docVersion(doc), conflict: searchParams?.error === "conflict" }}
      />
    </div>
  );
}
