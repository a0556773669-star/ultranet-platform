import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";

export default async function ExpensesHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const db = getAdminFirestore();
  const snap = await db.collection("n_branches").where("branchType", "==", "rentals").get();
  const branches = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch);

  return (
    <div>
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">💸 הוצאות — בחר סניף</h1>
      <div className="flex flex-col gap-2">
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
            <span className="font-bold text-ink">🏢 {b.name}</span>
            <span className="text-xs text-muted">{b.isMine === false ? "שותפות" : "קלאסי"} →</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
