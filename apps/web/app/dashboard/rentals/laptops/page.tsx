import Link from "next/link";
import { Laptop as LaptopIcon, Wifi } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Laptop, Branch } from "@ultranet/shared-types";
import { deleteLaptopAction } from "./actions";
import { DeleteLaptopButton } from "./delete-button";

export default async function LaptopsPage() {
  const session = await requireModuleAccess("rentals");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const db = getAdminFirestore();
  const [laptopsSnap, branchesSnap] = await Promise.all([
    db.collection("n_laptops").get(),
    db.collection("n_branches").where("branchType", "==", "rentals").get(),
  ]);
  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const allLaptops = laptopsSnap.docs.map((d) => ({ ...(d.data() as Omit<Laptop, "id">), id: d.id }) as Laptop);
  const laptops = role === "owner" ? allLaptops : allLaptops.filter((l) => l.branchId === myBranchId);
  const branchName = (id: string) => branches.find((b) => b.id === id)?.name ?? "-";

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <LaptopIcon className="h-4 w-4" />
          {"מלאי מחשבים"}
        </h1>
        <Link
          href="/dashboard/rentals/laptops/new"
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          + הוסף מחשב
        </Link>
      </div>

      <div className="flex flex-col gap-2">
        {laptops.length === 0 && (
          <div className="rounded-card border border-card-border bg-white p-5 text-center text-sm text-muted shadow-card">
            אין מחשבים עדיין
          </div>
        )}
        {laptops.map((l) => (
          <div
            key={l.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-card-border bg-white p-4 shadow-card"
          >
            <Link href={`/dashboard/rentals/laptops/${l.id}`} className="flex-1 min-w-[220px]">
              <p className="font-bold text-ink">
                {l.name}
              </p>
              <p className="flex flex-wrap items-center gap-x-1 text-xs text-muted">
                <span>
                  ₪{l.dayPrice ?? 0}/יום · ₪{l.weekPrice ?? 0}/שבוע · ₪{l.monthPrice ?? 0}/חודש
                </span>
                {l.hasStick && (
                  <span className="flex items-center gap-1">
                    {"·"}
                    <Wifi className="h-3 w-3" />
                    {`סטיק${l.simNumber ? ` (${l.simNumber})` : ""}`}
                  </span>
                )}
                {role === "owner" && <span>{`· ${branchName(l.branchId)}`}</span>}
              </p>
            </Link>
            <div className="flex items-center gap-2">
              <Link
                href={`/dashboard/rentals/laptops/${l.id}`}
                className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
              >
                עריכה
              </Link>
              {role === "owner" && <DeleteLaptopButton action={deleteLaptopAction.bind(null, l.id)} />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
