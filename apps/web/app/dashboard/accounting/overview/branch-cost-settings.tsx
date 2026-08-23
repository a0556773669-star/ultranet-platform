/**
 * Per-branch overrides of the price list (n_branch_cost_settings). Owner-only.
 * Every field is optional: leaving it empty means "use the price list", which is why each input
 * shows the value it would fall back to as its placeholder.
 */
import type { Branch, BranchCostSetting, CostRate } from "@ultranet/shared-types";
import { branchHasPartner, branchPartnerLabel } from "@/lib/accounting-overview";
import { branchCostSettingId } from "@/lib/cost-rates";
import { saveBranchCostSettingAction } from "./branch-settings-actions";

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-[12px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted whitespace-nowrap border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] align-middle";

const QTY_SOURCE_HINT: Record<string, string> = {
  laptops: "אוטומטי לפי המחשבים בסניף",
  sticks: "אוטומטי לפי הסטיקים בסניף",
  sims: "אוטומטי לפי הסימים בסניף",
  one: "קבוע — 1 לחודש",
  manual: "ידני — חובה למלא כאן",
};

export function BranchCostSettings({
  branch,
  rates,
  settings,
  autoQty,
}: {
  branch: Branch;
  rates: CostRate[];
  settings: Map<string, BranchCostSetting>;
  /** the quantity the system derives on its own, per rate key - shown as the placeholder */
  autoQty: Map<string, number>;
}) {
  const hasPartner = branchHasPartner(branch);
  const partnerName = branchPartnerLabel(branch);

  return (
    <section className={CARD}>
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">התאמת התעריפון לסניף</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            שדה ריק = כמו בתעריפון הכללי. מלאי רק את מה ששונה בסניף הזה.
          </p>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className={`${TH} min-w-[140px]`}>קטגוריה</th>
              <th className={TH}>כמות בסניף</th>
              <th className={TH}>עלות ליחידה</th>
              <th className={TH}>על מי ההוצאה</th>
              <th className={TH}>מי משלם בפועל</th>
              <th className={TH}>נספר</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {rates.map((rate, i) => {
              const setting = settings.get(branchCostSettingId(branch.id, rate.key));
              const auto = autoQty.get(rate.key) ?? 0;
              const save = saveBranchCostSettingAction.bind(null, branch.id, rate.key);
              return (
                <tr key={rate.key} className={i % 2 ? "bg-[#fafbfd]" : ""}>
                  <td className={TD}>
                    <b className="text-ink">{rate.label}</b>
                    <br />
                    <span className="text-[10.5px] text-muted">
                      {QTY_SOURCE_HINT[rate.qtySource] ?? ""}
                      {rate.unitCost === 0 && " · עדיין לא הוגדרה עלות"}
                    </span>
                  </td>
                  <td className={TD}>
                    <input
                      form={`bcs-${rate.key}`}
                      name="qty"
                      type="number"
                      min={0}
                      step="1"
                      defaultValue={setting?.qty ?? ""}
                      placeholder={rate.qtySource === "manual" ? "0" : String(auto)}
                      className={FIELD}
                    />
                  </td>
                  <td className={TD}>
                    <input
                      form={`bcs-${rate.key}`}
                      name="unitCost"
                      type="number"
                      min={0}
                      step="1"
                      defaultValue={setting?.unitCost ?? ""}
                      placeholder={String(rate.unitCost)}
                      className={FIELD}
                    />
                  </td>
                  <td className={TD}>
                    <select
                      form={`bcs-${rate.key}`}
                      name="owedBy"
                      defaultValue={setting?.owedBy ?? ""}
                      disabled={!hasPartner}
                      className={FIELD}
                    >
                      <option value="">כמו בתעריפון</option>
                      <option value="owner">עליי (100%)</option>
                      <option value="shared">חצי-חצי</option>
                      <option value="partner">על השותף (100%)</option>
                    </select>
                  </td>
                  <td className={TD}>
                    <select
                      form={`bcs-${rate.key}`}
                      name="paidBy"
                      defaultValue={setting?.paidBy ?? ""}
                      disabled={!hasPartner}
                      className={FIELD}
                    >
                      <option value="">אני</option>
                      <option value="owner">אני</option>
                      <option value="partner">{partnerName}</option>
                    </select>
                  </td>
                  <td className={TD}>
                    <input
                      form={`bcs-${rate.key}`}
                      name="enabled"
                      type="checkbox"
                      defaultChecked={setting?.enabled !== false}
                      className="h-4 w-4 accent-[#1a8a76]"
                    />
                  </td>
                  <td className={TD}>
                    <form id={`bcs-${rate.key}`} action={save}>
                      <button
                        type="submit"
                        className="whitespace-nowrap rounded-lg bg-teal px-2.5 py-1.5 text-[11.5px] font-extrabold text-white transition hover:bg-teal-dark"
                      >
                        שמירה
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="px-4 pb-3.5 pt-2.5 text-[11.5px] leading-relaxed text-muted">
        <b className="text-ink">מחשבי גרפיקה:</b> אין במערכת סימון שמבדיל מחשב גרפיקה ממחשב רגיל, ולכן את מזינה
        כאן כמה מחשבי גרפיקה יש בסניף. שורת &quot;מחשב רגיל&quot; מחשבת אוטומטית את שאר המחשבים — סך
        המחשבים בסניף פחות מספר מחשבי הגרפיקה — כך אף מחשב לא נספר פעמיים. התיקים ממשיכים להיספר לפי
        כל המחשבים, כי גם למחשב גרפיקה יש תיק.
      </p>
    </section>
  );
}
