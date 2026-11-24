import { Tag } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadPriceGuide } from "@/lib/store-price-guide";
import { advisorConfigured } from "@/lib/store-advisor";
import { StoreTabs } from "../store-tabs";
import { PricesForm } from "./prices-form";

export const dynamic = "force-dynamic";
/** המילוי האוטומטי (חיפוש ברשת) יכול לקחת עד כדקה - ללא זה Vercel חותך אחרי 10 שניות. */
export const maxDuration = 60;

export default async function PricesPage() {
  await requireOwner();
  const guide = await loadPriceGuide();
  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Tag className="h-5 w-5" />
        מחירון שוק יומי
      </h1>
      <StoreTabs isOwner />
      <div className="card mb-4 text-sm text-muted">
        זה המחירון שממנו הצ׳אט מחשב <b>מיד</b> את טווחי המחיר לסניפים: מחיר שוק <b>נמוך</b> (ממוצע בלי מחירים חריגים, מחשב
        מינימלי בלי מערכת הפעלה) <b>ועוד 300-500 ₪</b> למחשב. הוא מתרענן <b>אוטומטית כל לילה</b> (חיפוש ברשת עם Haiku),
        ומחיר שמשתנה ביותר מ-40% או נראה לא הגיוני נדחה ונשמר הקודם. אפשר גם לערוך ידנית, או ללחוץ על העדכון האוטומטי
        ושומר מיד. <b>בפעם הראשונה</b> חובה ללחוץ על ״עדכון המחירון עכשיו״, כדי שיהיו מחירים כבר מהיום.
      </div>
      <PricesForm key={guide.updatedAt ?? "empty"} guide={guide} aiEnabled={advisorConfigured()} />
    </div>
  );
}
