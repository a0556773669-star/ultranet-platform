import { notFound } from "next/navigation";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";
import type { AppUser, Branch } from "@ultranet/shared-types";
import { updateUserAction } from "../actions";
import { UserForm } from "../user-form";

export default async function EditUserPage({ params }: { params: { id: string } }) {
  await requireOwner();
  const db = getAdminFirestore();
  const [doc, branchesSnap] = await Promise.all([
    db.collection("n_users").doc(params.id).get(),
    db.collection("n_branches").get(),
  ]);
  if (!doc.exists) {
    notFound();
  }
  const user = { id: doc.id, ...(doc.data() as Omit<AppUser, "id">) };
  const branches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id })) as Branch[];
  const boundUpdate = updateUserAction.bind(null, params.id);

  return (
    <div>
      <h1 className="mb-4 text-[21px] font-extrabold text-ink">עריכת משתמש</h1>
      <UserForm action={boundUpdate} branches={branches} initial={user} submitLabel="שמירת שינויים" />
    </div>
  );
}
