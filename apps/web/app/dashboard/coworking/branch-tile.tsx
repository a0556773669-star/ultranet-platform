import Link from "next/link";
import { Building2, Pencil, Plus } from "lucide-react";
import type { Branch } from "@ultranet/shared-types";
import { setupCostCountsToMain } from "@/lib/counts-to-main";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import { SetupCostCard } from "@/components/accounting/setup-cost-card";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * הסניף כקובייה אחת בפינה, ולא כשורה על כל רוחב המסך.
 *
 * במשרד שיתופי הסניף כמעט אף פעם לא משתנה: השם, תאריך ההקמה ועלות ההקמה הם שלוש עובדות
 * שקוראים פעם בשנה, ואין סיבה שיגזלו את השורה העליונה מארבע העמדות — שהן מה שבאמת מסתכלים
 * עליו. עלות ההקמה נשארת לחיצה אחת מהפירוט המלא, באותו חלון שמשרת את חדרי המחשבים.
 */
export function BranchTile({
  branch,
  others,
  isOwner,
}: {
  branch: Branch;
  others: Branch[];
  isOwner: boolean;
}) {
  const founded = (branch.openedAt || branch.founded)?.slice(0, 10) || "טרם נקבע";
  const setupCost = branch.setupCost ?? 0;

  return (
    <section className="w-full rounded-card border border-card-border bg-white p-3 shadow-card sm:w-[15.5rem]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13.5px] font-extrabold text-ink">
          <Building2 className="h-4 w-4" />
          {branch.name}
        </h2>
        {isOwner && (
          <div className="flex items-center gap-1">
            <Link
              href={`/dashboard/coworking/branches/${branch.id}`}
              title="עריכת הסניף ועלויות ההקמה"
              className="rounded-lg border border-card-border p-1 text-muted transition hover:border-teal hover:text-teal"
            >
              <Pencil className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/dashboard/coworking/branches/new"
              title="סניף משרד שיתופי נוסף"
              className="rounded-lg border border-card-border p-1 text-muted transition hover:border-teal hover:text-teal"
            >
              <Plus className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </div>

      <div className="mb-1.5 rounded-lg bg-[#f9fafb] px-2.5 py-1.5">
        <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">תאריך הקמה</p>
        <p className="mt-0.5 text-[13px] font-bold text-ink">{founded}</p>
      </div>

      <SetupCostCard
        amount={setupCost}
        items={branch.setupItems ?? []}
        fromAssets={false}
        label="עלות הקמה"
        triggerClassName="w-full rounded-lg bg-[#f9fafb] px-2.5 py-1.5 text-center transition hover:bg-teal-bg"
      />
      {setupCost > 0 && (
        <p className="mt-1 flex justify-center">
          <CountsToMainBadge on={setupCostCountsToMain(branch)} />
        </p>
      )}
      <p className="mt-1 text-center text-[10.5px] text-muted">
        {(branch.setupItems ?? []).length > 0 ? "לחיצה — ממה מורכבת העלות" : `סכום כולל ${money(setupCost)}, ללא פירוט`}
      </p>

      {others.length > 1 && (
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-card-border pt-2">
          {others.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/coworking?branchId=${b.id}`}
              className={b.id === branch.id ? "pill-active" : "pill-inactive"}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}
