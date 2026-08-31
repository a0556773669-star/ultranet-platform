import { redirect } from "next/navigation";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, CoworkingStation } from "@ultranet/shared-types";
import { NewCoworkingClientForm } from "./new-cw-client-form";

export default async function NewCoworkingClientPage() {
  const session = await requireModuleAccess("coworking");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const db = getAdminFirestore();
  const [branchesSnap, stationsSnap] = await Promise.all([
    db.collection("n_branches").get(),
    db.collection("n_cw_stations").get(),
  ]);
  const allBranches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branches = role === "owner" ? allBranches : allBranches.filter((b) => b.id === myBranchId);
  const stations = stationsSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<CoworkingStation, "id">), id: d.id }) as CoworkingStation,
  );

  const defaultBranchId = role === "owner" ? (branches[0]?.id ?? "") : (myBranchId ?? "");

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-[21px] font-extrabold text-ink">לקוח משרד שיתופי חדש</h1>
      <NewCoworkingClientForm
        branches={branches}
        stations={stations}
        defaultBranchId={defaultBranchId}
        lockBranch={role !== "owner"}
      />
    </div>
  );
}
