import { PiggyBank } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { InvestmentEntry } from "@ultranet/shared-types";
import { INVESTMENT_COLLECTION, INVESTMENT_TERMS, summarize } from "@/lib/investment";
import { InvestmentClient } from "./investment-client";

export const dynamic = "force-dynamic";

/**
 * השקעה — הספר של ההשקעה של יצחק ברון במיזם (הסכם 11.11.2026). נראה לבעלים ולמשתמש עם הרשאת
 * `investment` בלבד; עריכה — בעלים בלבד. כל כסף שעובר והוצאה נרשמים כאן בתאריך המדויק, וכל
 * המספרים (הושקע / נשאר / הרוויח / התחשבנות) נגזרים מהשורות. ראו `lib/investment.ts`.
 */
export default async function InvestmentPage() {
  const session = await requireModuleAccess("investment");
  const isOwner = session.user?.role === "owner";

  const snap = await getAdminFirestore().collection(INVESTMENT_COLLECTION).get();
  const entries = snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<InvestmentEntry, "id">) }))
    .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));

  const today = new Date().toISOString().slice(0, 10);
  const summary = summarize(entries, today);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <PiggyBank className="h-5 w-5" />
          השקעה — {INVESTMENT_TERMS.investorName}
        </h1>
        <p className="mt-0.5 text-[12.5px] text-muted">
          הסכם השקעה ושותפות במיזם תוכנה מ-11.11.2026. כל העברה והוצאה נרשמות בתאריך שבו הכסף עבר,
          והמספרים מתעדכנים מיד.
        </p>
      </div>
      <InvestmentClient entries={entries} summary={summary} isOwner={isOwner} today={today} />
    </div>
  );
}
