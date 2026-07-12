import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { LaptopForm } from "../laptop-form";
import { createLaptopAction } from "../actions";

export default async function NewLaptopPage() {
  const session = await requireModuleAccess("rentals");
  const isOwner = session.user?.role === "owner";
  const db = getAdminFirestore();
  const branchesSnap = isOwner
    ? await db.collection("n_branches").where("branchType", "==", "rentals").get()
    : null;
  const branches = branchesSnap ? branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch) : [];

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">💻 מחשב חדש</h1>
      <LaptopForm action={createLaptopAction} branches={branches} isOwner={isOwner} />
    </div>
  );
}
