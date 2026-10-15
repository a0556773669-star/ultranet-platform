import Link from "next/link";
import { Users } from "lucide-react";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";
import type { AppUser, UserAssignment } from "@ultranet/shared-types";
import { unionPerms, type PermKey } from "@/lib/perms";
import { deleteUserAction } from "./actions";
import { UsersList, type UserRow } from "./users-list";

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  partner: "שותף",
  employee: "עובד",
};

const PERM_LABELS: Record<string, string> = {
  branches: "סניפים",
  computers: "חדרי מחשבים",
  tasks: "משימות",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
  accounting: "הנה\"ח",
  charging: "סליקה וקבלות",
  shop: "חנות AI",
  duxus: "משימות ונהלים",
};

/** אותה נפילה לאחור כמו ב-`getAssignments`, כאן על מסמך מ-Firestore ולא על session. */
function userHats(u: AppUser): UserAssignment[] {
  if (u.assignments?.length) return u.assignments;
  return [{ role: u.role, branchId: u.branchId, perms: u.perms }];
}

export default async function UsersPage() {
  await requireOwner();
  const db = getAdminFirestore();
  const [usersSnap, branchesSnap] = await Promise.all([
    db.collection("n_users").get(),
    db.collection("n_branches").get(),
  ]);
  const branchNames = new Map(
    branchesSnap.docs.map((d) => [d.id, (d.data().name as string | undefined) ?? d.id])
  );
  const users = usersSnap.docs
    .map((d) => ({ ...(d.data() as Omit<AppUser, "id">), id: d.id }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const rows: UserRow[] = users.map((u) => {
    const hats = userHats(u);
    const granted = unionPerms(hats);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      roles: hats.map((hat) => ROLE_LABELS[hat.role] ?? hat.role),
      roleKeys: hats.map((hat) => hat.role),
      branches: hats
        .map((hat) => (hat.role === "owner" ? "כל הסניפים" : (branchNames.get(hat.branchId) ?? hat.branchId ?? "-")))
        .join(" · "),
      perms: Object.entries(PERM_LABELS).map(([key, label]) => ({ label, on: Boolean(granted[key as PermKey]) })),
      allOwner: hats.every((hat) => hat.role === "owner"),
    };
  });
  const deleteActions: Record<string, () => void> = {};
  for (const u of users) deleteActions[u.id] = deleteUserAction.bind(null, u.id);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Users className="h-5 w-5" />משתמשים והרשאות</h1>
        <Link
          href="/dashboard/users/new"
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          + משתמש חדש
        </Link>
      </div>

      <UsersList rows={rows} deleteActions={deleteActions} />
    </div>
  );
}
