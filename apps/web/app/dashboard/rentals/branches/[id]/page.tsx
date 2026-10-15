import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { ArrowLeft, Building2, Check, Pencil, Zap } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { isLaptopActive } from "@/lib/laptop-names";
import { loadBranchProgressBoard, STAGES } from "@/lib/branch-progress";
import type { Branch, Laptop, Rental, Stick } from "@ultranet/shared-types";

/**
 * כרטיס צפייה בסניף השכרות (אפיון שדרוג v2, סעיף 6): לחיצה על סניף פותחת קודם את הכרטיס —
 * שותף, מצב פעילות, ציוד ושבעת השלבים — עם קישורים ישירים, ו"עריכת פרטי הסניף" בנפרד
 * (`[id]/edit`). **קריאה בלבד.** בעלים בלבד, כמו מסך העריכה.
 */
export default async function RentalBranchViewPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");
  if (session.user?.role !== "owner") redirect("/dashboard/rentals");

  const db = getAdminFirestore();
  const [doc, laptopsSnap, sticksSnap, activeSnap, progress] = await Promise.all([
    db.collection("n_branches").doc(params.id).get(),
    db.collection("n_laptops").where("branchId", "==", params.id).get(),
    db.collection("n_sticks").where("branchId", "==", params.id).get(),
    db.collection("n_rentals").where("branchId", "==", params.id).where("status", "==", "active").get(),
    loadBranchProgressBoard().catch(() => null),
  ]);
  if (!doc.exists) notFound();
  const branch = { id: doc.id, ...(doc.data() as Omit<Branch, "id">) } as Branch;

  const laptops = laptopsSnap.docs.map((d) => ({ ...(d.data() as Laptop), id: d.id })).filter(isLaptopActive);
  const graphics = laptops.filter((l) => l.isGraphics ?? /גרפיקה/.test(l.name)).length;
  const sticks = sticksSnap.docs
    .map((d) => d.data() as Stick)
    .filter((s) => !s.status || s.status === "active");
  const active = activeSnap.docs.map((d) => d.data() as Rental);
  const rentedLaptops = active.filter((r) => r.kind === "laptop").length;
  const row = progress?.rows.find((r) => r.branchId === branch.id);

  const isPartnership = branch.isMine === false;
  const status = branch.closedAt
    ? `סגור מ-${branch.closedAt}`
    : branch.notStarted
      ? "עדיין לא התחיל לפעול"
      : "פעיל";

  const links = [
    { href: `/dashboard/rentals/manage#branch-${branch.id}`, label: "השכרות וציוד בסניף" },
    { href: `/dashboard/rentals/laptops?branch=${branch.id}`, label: "רשימת המחשבים" },
    { href: `/dashboard/rentals/expenses/${branch.id}`, label: "הוצאות והכנסות" },
    { href: "/dashboard/accounting/mobile", label: "רווחיות והתחשבנות" },
  ];

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
          <Building2 className="h-5 w-5" />
          {branch.name}
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
              branch.closedAt || branch.notStarted ? "bg-[#f4f6f9] text-muted" : "bg-teal-bg text-teal-dark"
            }`}
          >
            {status}
          </span>
        </h2>
        <Link href={`/dashboard/rentals/branches/${branch.id}/edit`} className="btn-outline flex items-center gap-1.5">
          <Pencil className="h-4 w-4" />
          עריכת פרטי הסניף
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="card">
          <div className="mb-2 text-xs font-bold text-muted">שותפות</div>
          {isPartnership ? (
            <>
              <div className="text-[15px] font-extrabold text-ink">{branch.partnerName || "שותף ללא שם"}</div>
              <div className="text-[12px] text-muted">{`שלי ${branch.myPct ?? 0}% · השותף ${branch.partnerPct ?? 0}%`}</div>
            </>
          ) : (
            <div className="text-[15px] font-extrabold text-ink">סניף שלי (ללא שותף)</div>
          )}
          <div className="mt-2 text-[12px] text-muted">
            {[branch.location, branch.phone, (branch.openedAt || branch.founded)?.slice(0, 10) && `נפתח ${(branch.openedAt || branch.founded)!.slice(0, 10)}`]
              .filter(Boolean)
              .join(" · ") || "אין פרטי קשר"}
          </div>
        </div>

        <div className="card">
          <div className="mb-2 text-xs font-bold text-muted">ציוד</div>
          <div className="flex items-baseline gap-2">
            <span className="text-[24px] font-black tabular-nums text-ink">{laptops.length}</span>
            <span className="text-[13px] text-muted">מחשבים פעילים</span>
          </div>
          <div className="text-[12px] text-muted">
            {`${laptops.length - graphics} רגילים · ${graphics} גרפיקה · ${sticks.length} סטיקים`}
          </div>
          <div className="mt-1 text-[12px] font-bold text-teal-dark">{`${rentedLaptops} מחשבים מושכרים כעת`}</div>
        </div>

        <div className="card">
          <div className="mb-2 text-xs font-bold text-muted">קישורים ישירים</div>
          <div className="flex flex-col">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="flex items-center justify-between border-b border-card-border py-1.5 text-[13px] font-medium text-ink last:border-b-0 hover:text-teal-dark"
              >
                {l.label}
                <ArrowLeft className="h-3.5 w-3.5" />
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted">
          <span>שבעת השלבים</span>
          <Link href="/dashboard/rentals/progress" className="font-bold text-teal hover:underline">
            למדד הסניפים
          </Link>
        </div>
        {!row ? (
          <div className="text-sm text-muted">אין נתוני מדד לסניף הזה (סניף סגור או שעדיין לא נכלל במדד).</div>
        ) : (
          <ol className="flex flex-col">
            {STAGES.map((st) => {
              const state = row.stages.find((s) => s.no === st.no);
              const done = Boolean(state?.done);
              const isNext = !done && row.currentStage === st.no;
              return (
                <li key={st.no} className="flex items-center gap-2 border-b border-card-border py-1.5 text-[13px] last:border-b-0">
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      done ? "bg-teal text-white" : isNext ? "border-2 border-teal text-teal-dark" : "border border-card-border text-muted"
                    }`}
                  >
                    {done ? <Check className="h-3 w-3" /> : st.no}
                  </span>
                  <span className={`flex-1 ${done ? "text-ink" : "text-muted"}`}>{st.title}</span>
                  {st.auto && <Zap className="h-3.5 w-3.5 text-muted" aria-label="מתעדכן אוטומטית" />}
                  {isNext && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700">הצעד הבא</span>}
                  {state?.hint && <span className="hidden text-[11px] text-muted sm:inline">{state.hint}</span>}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
