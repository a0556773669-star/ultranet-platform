import { redirect } from "next/navigation";
import Link from "next/link";
import { Banknote, Building2, Layers, ArrowRight } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { SHARED_RENTALS_BRANCH_ID } from "@/lib/expense-shared-scope";

export default async function ExpensesHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  const isOwner = session.user?.role === "owner";
  if (!isOwner) {
    const myBranchId = session.user?.branchId;
    if (!myBranchId) redirect("/dashboard/rentals");
    const myDoc = await getAdminFirestore().collection("n_branches").doc(myBranchId).get();
    const myBranch = myDoc.exists ? ({ id: myDoc.id, ...(myDoc.data() as Omit<Branch, "id">) } as Branch) : null;
    if (!myBranch || myBranch.parentBranchId) redirect("/dashboard/rentals");
    redirect(`/dashboard/rentals/expenses/${myBranchId}`);
  }

  const db = getAdminFirestore();
  const snap = await db.collection("n_branches").where("branchType", "==", "rentals").get();
  const branches = snap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Banknote className="h-5 w-5" />
        הוצאות — בחר סניף
      </h1>
      <div className="flex flex-col gap-2">
        <Link
          href={`/dashboard/rentals/expenses/${SHARED_RENTALS_BRANCH_ID}`}
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
            אין עדיין סניפים
          </div>
        )}
        {branches.map((b) => (
          <Link
            key={b.id}
            href={`/dashboard/rentals/expenses/${b.id}`}
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
