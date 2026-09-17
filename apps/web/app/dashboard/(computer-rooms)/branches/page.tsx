import Link from "next/link";
import { Building2, MapPin, Handshake, Plus, Pause } from "lucide-react";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { requireModuleAccess } from "@/lib/perms";

async function listBranches(): Promise<Branch[]> {
  const snap = await getAdminFirestore().collection("n_branches").where("branchType", "==", "computers").get();
  return snap.docs
    .map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));
}

/**
 * הסניפים כקוביות ולא כשורות.
 *
 * שורה ברוחב המסך המלא נותנת לשם הסניף - המידע היחיד שבאמת מחפשים כאן - שלוש מילים
 * ומטר של רווח לבן, ומכריחה לסרוק למטה גם כשיש חמישה סניפים בלבד. קובייה מחזיקה את אותו
 * מידע בדיוק ברוחב שליש, כך שכל הסניפים נכנסים למסך אחד והבחירה היא מבט אחד ולא גלילה.
 */
export default async function BranchesPage() {
  const session = await requireModuleAccess("branches");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const all = await listBranches();
  const branches =
    role === "owner" ? all : all.filter((b) => b.id === myBranchId || b.parentBranchId === myBranchId);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Building2 className="h-5 w-5" />ניהול סניפים</h1>
          <p className="mt-1 text-[13px] text-muted">סניפים, שותפים, הוצאות ומטלות</p>
        </div>
        {role === "owner" && (
          <Link
            href="/dashboard/branches/new"
            className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
          >
            <Plus className="h-4 w-4" />
            סניף חדש
          </Link>
        )}
      </div>

      {branches.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          <Building2 className="mx-auto mb-3 h-9 w-9" />
          אין סניפים עדיין
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {branches.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/branches/${b.id}`}
              className="flex min-h-[132px] flex-col justify-between rounded-card border border-card-border bg-white p-4 shadow-card transition hover:-translate-y-0.5 hover:border-teal hover:shadow-primary"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-[15px] font-extrabold leading-snug text-ink">
                    <Building2 className="h-4 w-4 shrink-0 text-teal" />
                    {b.name}
                  </span>
                  {b.notStarted && (
                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10.5px] font-bold text-muted">
                      <Pause className="h-3 w-3" />
                      טרם פעיל
                    </span>
                  )}
                </div>
                <p className="mt-2 flex items-center gap-1 text-xs text-muted">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {b.location ?? "—"}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {b.isMine ? (
                  <span className="rounded-full bg-teal-bg px-2.5 py-1 text-[11px] font-bold text-teal-dark">שלי בלבד</span>
                ) : (
                  <>
                    <span className="rounded-full bg-[#f3e8fd] px-2.5 py-1 text-[11px] font-bold text-purple">
                      {b.partnerName ?? "שותף"}
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-muted">
                      <Handshake className="h-3.5 w-3.5" />
                      {b.myPct}% / {b.partnerPct}%
                    </span>
                  </>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
