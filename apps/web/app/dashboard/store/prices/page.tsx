import { Tag } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { classicSpecs, loadPriceGuide, researchTargets, specKey } from "@/lib/store-price-guide";
import { specToText } from "@/lib/store-wizard";
import { advisorConfigured } from "@/lib/store-advisor";
import { StoreTabs } from "../store-tabs";
import { PricesForm } from "./prices-form";

export const dynamic = "force-dynamic";
/** המילוי האוטומטי (חיפוש ברשת) יכול לקחת עד כדקה - ללא זה Vercel חותך אחרי 10 שניות. */
export const maxDuration = 60;

export default async function PricesPage() {
  await requireOwner();
  const guide = await loadPriceGuide();
  const classicKeys = new Set(classicSpecs().map(specKey));
  const targets = await researchTargets();
  const tracked = targets.filter((t) => !classicKeys.has(t.key));
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
      <div className="card mb-4 text-sm">
        <div className="font-bold text-ink">מה נסרק כל לילה: {targets.length - tracked.length} תצורות קלאסיות + {tracked.length} שנוספו בגלל בקשות</div>
        <p className="mt-1 text-xs text-muted">
          תצורה רגילה שמישהו ביקש נכנסת לסריקה הקבועה כבר מהבקשה הראשונה; תצורה חריגה מהבקשה השנייה. תצורה שלא התבקשה 90 יום יוצאת.
          הרשימה גדלה עם הביקוש (עד 30 נוספות).
        </p>
        {tracked.length ? (
          <ul className="mt-2 space-y-0.5 text-xs text-ink">
            {tracked.map((t) => (
              <li key={t.key}>
                {specToText(t.spec)} · התבקשה {t.requested} פעמים · {guide.specPrices?.[t.key] ? `מחיר שוק: ${guide.specPrices[t.key]!.toLocaleString("he-IL")} ₪` : "עוד לא נמצא מחיר"}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-xs text-muted">עוד לא נוספו תצורות - ברגע שסניף יבקש משהו שאינו קלאסי, הוא יופיע כאן.</p>
        )}
      </div>
      <PricesForm guide={guide} aiEnabled={advisorConfigured()} />
    </div>
  );
}
