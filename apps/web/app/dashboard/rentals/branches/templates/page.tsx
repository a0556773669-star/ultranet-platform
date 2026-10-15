import Link from "next/link";
import { ArrowRight, ListChecks } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { loadBranchTemplates } from "@/lib/branch-templates";
import { TemplatesClient } from "./templates-client";

export const dynamic = "force-dynamic";

/**
 * תבניות פתיחת סניף (מסמך המשך סעיף 50) — בעלים בלבד. כאן רק יוצרים/עורכים תבניות;
 * ההחלה נעשית מכרטיס הסניף (`branches/[id]`), ורק על סניף חדש.
 */
export default async function BranchTemplatesPage() {
  await requireOwner();
  const templates = await loadBranchTemplates(getAdminFirestore());

  return (
    <div className="flex max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-lg font-extrabold text-ink">
            <ListChecks className="h-5 w-5" />
            {"תבניות פתיחת סניף"}
          </h2>
          <p className="max-w-2xl text-[13px] text-muted">
            {
              "רשימת צעדים קבועה לפתיחת סניף השכרות. השמירה שלך היא האישור. ההחלה נעשית מכרטיס של סניף חדש (בלי השכרות) ויוצרת לו משימות משלו ב\"משימות ליוני\" — עריכת התבנית אחר כך לא משנה משימות שכבר נוצרו."
            }
          </p>
        </div>
        <Link href="/dashboard/rentals/branches" className="btn-outline flex items-center gap-1.5">
          <ArrowRight className="h-4 w-4" />
          {"לסניפים"}
        </Link>
      </div>

      <TemplatesClient templates={templates} />
    </div>
  );
}
