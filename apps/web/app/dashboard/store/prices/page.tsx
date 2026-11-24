import { Tag } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadPriceGuide } from "@/lib/store-price-guide";
import { advisorConfigured } from "@/lib/store-advisor";
import { StoreTabs } from "../store-tabs";
import { PricesForm } from "./prices-form";

export const dynamic = "force-dynamic";

export default async function PricesPage() {
  await requireOwner();
  const guide = await loadPriceGuide();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Tag className="h-5 w-5" />
        מחירון גיבוי
      </h1>
      <StoreTabs isOwner />
      <div className="card mb-4 text-sm text-muted">
        המחיר בצ׳אט נבדק <b>חי בשוק</b> (חיפוש ברשת, ממוצע נמוך בלי מחירים חריגים, ועוד המרווח), ונשמר <b>למשך אותו יום</b> לכל
        הסניפים, כך שמפרט שכבר נבדק היום לא נבדק שוב. המחירון כאן הוא <b>גיבוי בלבד</b>, למקרה שהחיפוש נכשל.
      </div>
      <PricesForm guide={guide} aiEnabled={advisorConfigured()} />
    </div>
  );
}
