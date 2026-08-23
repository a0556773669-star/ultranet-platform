import { Tag } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { loadCostRates, DEFAULT_COST_RATES } from "@/lib/cost-rates";
import { AccountingTabs } from "../accounting-tabs";
import { saveRateAction, seedDefaultRatesAction } from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-[13px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-[11px] font-bold text-muted";

const QTY_SOURCE_LABELS: Record<string, string> = {
  laptops: "מספר המחשבים בסניף",
  sticks: "מספר הסטיקים בסניף",
  sims: "מספר הסימים (מחשבים + סטיקים)",
  one: "קבוע — פעם אחת לחודש",
  manual: "כמות ידנית לכל סניף",
};

export default async function CostRatesPage() {
  await requireOwner();
  const { rates, usingDefaults } = await loadCostRates();
  const have = new Set(rates.map((r) => r.key));
  const missing = usingDefaults ? [] : DEFAULT_COST_RATES.filter((r) => !have.has(r.key));

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <Tag className="h-5 w-5" />
            תעריפון
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            כמה עולה כל דבר, ועל מי הוא נופל כברירת מחדל. מכאן מחושב פירוט העלויות בכל סניף.
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/rates" />
      </div>

      {usingDefaults && (
        <form
          action={seedDefaultRatesAction}
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-[#f0dcb8] bg-[#fdf3e3] px-4 py-3"
        >
          <p className="text-[12.5px] font-bold text-[#7a4a12]">
            התעריפון עדיין לא נשמר במערכת — מוצגות ערכי ברירת המחדל. שמירה תיצור אותם ב-Firestore ואז אפשר לערוך
            כל שורה.
          </p>
          <button
            type="submit"
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90"
          >
            שמירת התעריפון
          </button>
        </form>
      )}

      {missing.length > 0 && (
        <form
          action={seedDefaultRatesAction}
          className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-[#f0dcb8] bg-[#fdf3e3] px-4 py-3"
        >
          <p className="text-[12.5px] font-bold text-[#7a4a12]">
            נוספו קטגוריות חדשות שעדיין לא קיימות בתעריפון שלך: {missing.map((r) => r.label).join(" · ")}. הוספה
            לא תשנה אף קטגוריה קיימת.
          </p>
          <button
            type="submit"
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90"
          >
            הוספת הקטגוריות החסרות
          </button>
        </form>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {rates.map((rate) => {
          const save = saveRateAction.bind(null, rate.id);
          return (
            <form
              key={rate.id}
              action={save}
              className="rounded-card border border-card-border bg-white p-4 shadow-card"
            >
              <div className="mb-2.5 flex items-center justify-between gap-2">
                <h2 className="text-[15px] font-extrabold text-ink">{rate.label}</h2>
                {rate.unitCost === 0 ? (
                  <span className="rounded-full bg-[#fdf3e3] px-2 py-0.5 text-[10.5px] font-extrabold text-[#7a4a12]">
                    לא הוגדרה עלות — לא נספר
                  </span>
                ) : (
                  <span className="rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10.5px] font-extrabold text-muted">
                    {rate.key}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="col-span-2">
                  <label className={LABEL}>שם הקטגוריה</label>
                  <input name="label" defaultValue={rate.label} required className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>עלות ליחידה (₪)</label>
                  <input
                    name="unitCost"
                    type="number"
                    min={0}
                    step="1"
                    defaultValue={rate.unitCost}
                    required
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>סוג החיוב</label>
                  <select name="kind" defaultValue={rate.kind} className={FIELD}>
                    <option value="monthly">חודשי — חוזר כל חודש</option>
                    <option value="once">חד-פעמי — רכישה</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>על מי ההוצאה</label>
                  <select name="owedBy" defaultValue={rate.owedBy} className={FIELD}>
                    <option value="owner">על הבעלים (100%)</option>
                    <option value="shared">משותף (50% / 50%)</option>
                    <option value="partner">על השותף (100%)</option>
                  </select>
                </div>
                <div>
                  <label className={LABEL}>מאיפה נלקחת הכמות</label>
                  <select name="qtySource" defaultValue={rate.qtySource} className={FIELD}>
                    {Object.entries(QTY_SOURCE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <button
                    type="submit"
                    disabled={usingDefaults}
                    className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    שמירה
                  </button>
                  {usingDefaults && (
                    <span className="mr-2 text-[11.5px] text-muted">שמרי קודם את התעריפון למעלה</span>
                  )}
                </div>
              </div>
            </form>
          );
        })}
      </div>

      <p className="mt-3 rounded-card border border-card-border bg-white px-4 py-3 text-[12.5px] leading-relaxed text-muted shadow-card">
        <b className="text-ink">איך זה מתחבר לסניפים:</b> לכל סניף מחושבת הכמות אוטומטית לפי מה שרשום בו (מחשבים,
        סטיקים, סימים), מוכפלת בעלות כאן, ומתחלקת בין הבעלים לשותף לפי &quot;על מי ההוצאה&quot;.{" "}
        <b className="text-ink">אם כבר קיימת בסניף הוצאה שהוזנה ידנית על אותו נושא</b> (למשל הוצאה קבועה בשם
        &quot;פרסום&quot;) — ההוצאה הידנית היא שנספרת, ושורת התעריפון מושמטת לאותו חודש כדי שלא ייספר פעמיים. מה
        שהושמט מוצג במפורש בעמוד הסניף.
      </p>
    </div>
  );
}
