import { redirect } from "next/navigation";
import Link from "next/link";
import { Banknote, Building2, Layers, ArrowRight } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { SHARED_EXPENSE_BRANCH_ID } from "@/lib/computer-room-accounting";

export default async function ComputerRoomExpensesHomePage() {
  const session = await requireModuleAccess("computers");
  const isOwner = session.user?.role === "owner";
  if (!isOwner) {
    const myBranchId = session.user?.branchId;
    if (!myBranchId) redirect("/dashboard");
    const myDoc = await getAdminFirestore().collection("n_branches").doc(myBranchId).get();
    const myBranch = myDoc.exists ? ({ id: myDoc.id, ...(myDoc.data() as Omit<Branch, "id">) } as Branch) : null;
    if (!myBranch || myBranch.branchType !== "computers") redirect("/dashboard");
    redirect(`/dashboard/expenses/${myBranchId}`);
  }

  const db = getAdminFirestore();
  const snap = await db.collection("n_branches").where("branchType", "==", "computers").get();
  const branches = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Banknote className="h-5 w-5" />
        הוצאות — בחר סניף
      </h1>
      <div className="flex flex-col gap-2">
        <Link
          href={`/dashboard/expenses/${SHARED_EXPENSE_BRANCH_ID}`}
          className="flex items-center justify-between rounded-card border border-dashed border-card-border bg-[#f8fafc] p-4 shadow-card transition hover:bg-[#f1f5f9]"
        >
          <span className="flex items-center gap-1.5 font-bold text-ink">
            <Layers className="h-4 w-4" />
            הוצאות משותפות (כל הסניפים)
          </span>
          <ArrowRight className="h-4 w-4 text-muted" />
        </Link>
        {branches.length === 0 && (
          <div className="rounded-card border border-card-border bg-white p-5 text-center text-sm text-muted shadow-card">
            אין עדיין סניפי חדרי מחשבים
          </div>
        )}
        {branches.map((b) => (
          <Link
            key={b.id}
            href={`/dashboard/expenses/${b.id}`}
            className="flex items-center justify-between rounded-card border border-card-border bg-white p-4 shadow-card transition hover:bg-[#f8fafc]"
          >
            <span className="flex items-center gap-1.5 font-bold text-ink">
              <Building2 className="h-4 w-4" />
              {b.name}
            </span>
            <span className="flex items-center gap-1.5 text-xs text-muted">
              {b.isMine === false ? "שותפות" : "קלאסי"}
              <ArrowRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
