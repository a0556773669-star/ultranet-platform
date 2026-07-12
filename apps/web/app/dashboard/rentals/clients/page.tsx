import Link from "next/link";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { RentalClient, Branch } from "@ultranet/shared-types";
import { createClientAction } from "../actions";
import { ClientForm } from "./client-form";

export default async function RentalClientsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;
  const isOwner = role === "owner";

  const db = getAdminFirestore();
  const [clientsSnap, branchesSnap] = await Promise.all([
    db.collection("n_rental_clients").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);
  const branches = branchesSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch
  );
  const allClients = clientsSnap.docs.map(
    (d) => ({ id: d.id, ...(d.data() as Omit<RentalClient, "id">) }) as RentalClient
  );
  const clients = isOwner ? allClients : allClients.filter((c) => c.branchId === myBranchId);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";

  return (
    <div>
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">לקוחות 👥</h1>

      {searchParams?.error === "missing" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          חובה לבחור סניף ולמלא שם לקוח לפני השמירה.
        </div>
      )}
      {searchParams?.error === "forbidden" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          פעולה זו מותרת רק לבעלים.
        </div>
      )}

      <ClientForm action={createClientAction} branches={branches} isOwner={isOwner} myBranchId={myBranchId} />

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">שם</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">טלפון</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">פיקדון</th>
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">תקנון</th>
              {isOwner && (
                <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide">סניף</th>
              )}
              <th className="px-[11px] py-[9px] text-right text-[11px] font-bold uppercase tracking-wide"></th>
            </tr>
          </thead>
          <tbody>
            {clients.map((c) => (
              <tr key={c.id} className="border-t border-card-border transition hover:bg-[#f8fafc]">
                <td className="px-[11px] py-2 font-semibold text-ink">{c.name}</td>
                <td className="px-[11px] py-2 text-muted" dir="ltr">
                  {c.phone ?? "-"}
                </td>
                <td className="px-[11px] py-2">
                  {(!c.depositType || c.depositType === "none") && (
                    <span className="rounded-full bg-[#fdecea] px-2 py-0.5 text-[11px] font-bold text-red-600">
                      ללא פיקדון
                    </span>
                  )}
                  {c.depositType === "check" && (
                    <span className="rounded-full bg-[#eaf3ff] px-2 py-0.5 text-[11px] font-bold text-blue-600">
                      צ׳ק
                    </span>
                  )}
                  {c.depositType === "credit" && (
                    <span
                      className="rounded-full bg-[#eafaf0] px-2 py-0.5 text-[11px] font-bold text-teal"
                      dir="ltr"
                    >
                      אשראי •••• {c.cardLast4 ?? "----"}
                    </span>
                  )}
                </td>
                <td className="px-[11px] py-2">
                  {c.signedTerms ? (
                    <span className="font-bold text-teal">✓</span>
                  ) : (
                    <span className="font-bold text-red-500">✗</span>
                  )}
                </td>
                {isOwner && <td className="px-[11px] py-2 text-muted">{branchName(c.branchId)}</td>}
                <td className="px-[11px] py-2 text-left">
                  <Link
                    href={`/dashboard/rentals/clients/${c.id}`}
                    className="text-xs font-bold text-teal hover:underline"
                  >
                    עריכה
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
