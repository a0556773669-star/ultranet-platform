import Link from "next/link";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";
import type { AppUser } from "@ultranet/shared-types";
import { deleteUserAction } from "./actions";
import { DeleteButton } from "./delete-button";

const ROLE_LABELS: Record<string, string> = {
  owner: "בעלים",
  partner: "שותף",
  employee: "עובד",
};

const PERM_LABELS: Record<string, string> = {
  branches: "סניפים",
  computers: "מלאי",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
  accounting: "הנה\"ח",
  tasks: "משימות",
};

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
    .map((d) => ({ id: d.id, ...(d.data() as Omit<AppUser, "id">) }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[21px] font-extrabold text-ink">👥 משתמשים והרשאות</h1>
        <Link
          href="/dashboard/users/new"
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          + משתמש חדש
        </Link>
      </div>

      <div className="flex flex-col gap-3">
        {users.map((u) => {
          const boundDelete = deleteUserAction.bind(null, u.id);
          return (
            <div key={u.id} className="rounded-card border border-card-border bg-white p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-ink">{u.name}</span>
                    <span className="rounded-full border border-teal bg-teal-bg px-2.5 py-0.5 text-[11px] font-bold text-teal-dark">
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-muted">{u.email}</div>
                  <div className="mt-1 text-xs text-muted">
                    {u.role === "owner" ? "כל הסניפים" : branchNames.get(u.branchId) ?? u.branchId ?? "-"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href={`/dashboard/users/${u.id}`}
                    className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
                  >
                    עריכה
                  </Link>
                  <form action={boundDelete}>
                    <DeleteButton />
                  </form>
                </div>
              </div>

              {u.role !== "owner" && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {Object.entries(PERM_LABELS).map(([key, label]) => {
                    const active = Boolean(u.perms?.[key as keyof NonNullable<typeof u.perms>]);
                    return (
                      <span
                        key={key}
                        className={
                          active
                            ? "rounded-full border border-teal bg-teal-bg px-2.5 py-1 text-[11px] font-bold text-teal-dark"
                            : "rounded-full border border-card-border bg-[#f4f6f9] px-2.5 py-1 text-[11px] font-bold text-muted"
                        }
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="rounded-card border border-card-border bg-white p-6 text-center text-sm text-muted shadow-card">
            אין משתמשים עדיין
          </div>
        )}
      </div>
    </div>
  );
}
