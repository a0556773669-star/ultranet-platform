import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Building2, Pencil } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { getOwnerName } from "@/lib/owner-name";
import type { Branch } from "@ultranet/shared-types";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function Fact({ label, value, hint, wide }: { label: string; value: React.ReactNode; hint?: string; wide?: boolean }) {
  return (
    <div className={`rounded-card border border-card-border bg-white p-4 shadow-card ${wide ? "col-span-2" : ""}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <div className="mt-1 font-bold text-ink">{value}</div>
      {hint && <p className="mt-1 text-[11.5px] leading-relaxed text-muted">{hint}</p>}
    </div>
  );
}

/**
 * כרטיס הסניף — קריאה בלבד, עם כפתור עריכה למעלה.
 *
 * עורכים סניף פעם בשנה ומסתכלים עליו פעם בשבוע, ולכן הטופס הפתוח היה ברירת המחדל
 * הלא-נכונה: כל כניסה לכרטיס הייתה סיכון לשינוי בשוגג של אחוז שותפות או תאריך פתיחה —
 * שני שדות שמזיזים את כל החישוב של הסניף. כאן רואים, ורק לחיצה מפורשת על "עריכה" פותחת
 * את הטופס (`[id]/edit`).
 */
export default async function BranchDetailPage({ params }: { params: { id: string } }) {
  const session = await requireModuleAccess("branches", { managerOnly: true });
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const doc = await getAdminFirestore().collection("n_branches").doc(params.id).get();
  if (!doc.exists) {
    notFound();
  }
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;

  if (branch.branchType !== "computers") {
    notFound();
  }

  const isOwner = role === "owner";
  const canView = isOwner || branch.id === myBranchId || branch.parentBranchId === myBranchId;
  if (!canView) {
    redirect("/dashboard/branches");
  }

  const ownerName = await getOwnerName();
  const openedAt = (branch.openedAt || branch.founded)?.slice(0, 10) || "טרם נקבע";
  const setupItems = branch.setupItems ?? [];
  const setupTotal = setupItems.length > 0 ? setupItems.reduce((t, i) => t + i.amount, 0) : branch.setupCost ?? 0;

  return (
    <div className="max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Building2 className="h-5 w-5" />
          {branch.name}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/branches"
            className="flex items-center gap-1.5 text-xs font-bold text-teal hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            כל הסניפים
          </Link>
          {isOwner && (
            <Link
              href={`/dashboard/branches/${branch.id}/edit`}
              className="flex items-center gap-1.5 rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              <Pencil className="h-4 w-4" />
              עריכה
            </Link>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <Fact label="מיקום" value={branch.location ?? "-"} />
        <Fact
          label="בעלות"
          value={
            branch.isMine ? (
              <span className="text-teal-dark">שלי בלבד (100%)</span>
            ) : (
              <span className="text-purple">שותפות עם {branch.partnerName ?? "שותף"}</span>
            )
          }
        />

        {!branch.isMine && (
          <>
            <Fact label="האחוז שלי" value={<span className="text-teal-dark">{branch.myPct}%</span>} />
            <Fact label="האחוז של השותף" value={`${branch.partnerPct}%`} />
            {branch.partnerEmail && (
              <Fact label="מייל השותף" value={<span dir="ltr" className="block text-left">{branch.partnerEmail}</span>} wide />
            )}
          </>
        )}

        {/* Read-only on purpose: the opening date decides from which month this branch is
            charged and settled, so it is the owner's call alone - a partner sees it but
            cannot move it. */}
        <Fact
          label="תאריך פתיחה"
          value={openedAt}
          hint={
            isOwner
              ? "מהתאריך הזה מתחיל החישוב של הסניף. חודשים שלפניו לא מחושבים כלל."
              : `מהתאריך הזה מתחיל החישוב של הסניף. רק ${ownerName} יכול לשנות אותו.`
          }
          wide
        />

        {branch.notStarted && (
          <Fact
            label="סטטוס"
            value={<span className="text-amber-700">הסניף עדיין לא התחיל לפעול</span>}
            hint="כל עוד זה מסומן הסניף לא נכנס לשום חישוב: אין לו הוצאות תעריפון, אין הכנסות ואין העברה לבעלים."
            wide
          />
        )}

        {isOwner && (
          <div className="col-span-2 rounded-card border border-card-border bg-white p-4 shadow-card">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted">עלות הקמה</p>
            <p className="mt-1 font-bold text-ink">{money(setupTotal)}</p>
            {setupItems.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1 text-[12.5px] text-muted">
                {setupItems.map((item, i) => (
                  <li key={`${item.label}-${i}`} className="flex items-center justify-between gap-2 tabular-nums">
                    <span>{item.label || "ללא שם"}</span>
                    <span className="font-semibold text-ink">{money(item.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-[11.5px] text-muted">
              {branch.setupCountsToMain === false
                ? 'עלות ההקמה לא נספרת בהנה"ח הראשית.'
                : 'עלות ההקמה נספרת בהנה"ח הראשית.'}
            </p>
          </div>
        )}

        {branch.notes && (
          <Fact label="הערות" value={<span className="whitespace-pre-line font-normal">{branch.notes}</span>} wide />
        )}
      </div>
    </div>
  );
}
