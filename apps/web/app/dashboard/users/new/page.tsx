import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";
import type { Branch } from "@ultranet/shared-types";
import { createUserAction } from "../actions";
import { UserForm } from "../user-form";

export default async function NewUserPage() {
  await requireOwner();
  const db = getAdminFirestore();
  const branchesSnap = await db.collection("n_branches").get();
  const branches = branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) })) as Branch[];

  return (
    <div>
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">משתמש חדש</h1>
      <UserForm action={createUserAction} branches={branches} submitLabel="יצירת משתמש" />
    </div>
  );
}
