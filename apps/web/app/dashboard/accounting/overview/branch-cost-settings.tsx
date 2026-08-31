"use client";

import { useState, useTransition } from "react";
import type { Branch, BranchCostSetting, CostRate } from "@ultranet/shared-types";
import { branchCostSettingId } from "@/lib/cost-rates";
import { saveBranchCostSettingAction } from "./branch-settings-actions";

const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-[12px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted whitespace-nowrap border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] align-middle";
const money = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

const QTY_SOURCE_HINT: Record<string, string> = {
  laptops: "אוטומטי לפי המחשבים בסניף",
  sticks: "אוטומטי לפי הסטיקים בסניף",
  sims: "אוטומטי לפי הסימים בסניף",
  one: "קבוע — 1 לחודש",
  manual: "ידני — צריך למלא כאן",
};

interface RowState {
  qty: string;
  unitCost: string;
  owedBy: string;
  paidBy: string;
  enabled: boolean;
  saved: string | null;
  error: string | null;
}

/**
 * Per-branch overrides of the price list.
 *
 * A client component on purpose: typing a quantity shows what it costs immediately - 2 computers
 * against a 1,200 rate reads 2,400 before anything is saved - which is the whole point of
 * entering quantities rather than amounts.
 */
export function BranchCostSettings({
  branch,
  rates,
  settings,
  autoQty,
  ownerName,
  partnerName,
  hasPartner,
}: {
  branch: Branch;
  rates: CostRate[];
  settings: Map<string, BranchCostSetting>;
  autoQty: Map<string, number>;
  ownerName: string;
  partnerName: string;
  hasPartner: boolean;
}) {
  const [rows, setRows] = useState<Record<string, RowState>>(() => {
    const init: Record<string, RowState> = {};
    for (const rate of rates) {
      const s = settings.get(branchCostSettingId(branch.id, rate.key));
      init[rate.key] = {
        qty: s?.qty != null ? String(s.qty) : "",
        unitCost: s?.unitCost != null ? String(s.unitCost) : "",
        owedBy: s?.owedBy ?? "",
        paidBy: s?.paidBy ?? "",
        enabled: s?.enabled !== false,
        saved: null,
        error: null,
      };
    }
    return init;
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const patch = (key: string, change: Partial<RowState>) =>
    setRows((prev) => ({ ...prev, [key]: { ...prev[key]!, ...change, saved: null, error: null } }));

  /** what this line will actually cost, from the numbers currently on screen */
  function lineTotal(rate: CostRate) {
    const r = rows[rate.key]!;
    const qty = r.qty !== "" ? Number(r.qty) : (autoQty.get(rate.key) ?? 0);
    const unit = r.unitCost !== "" ? Number(r.unitCost) : rate.unitCost;
    if (!Number.isFinite(qty) || !Number.isFinite(unit)) return null;
    return { qty, unit, total: qty * unit };
  }

  function save(rate: CostRate) {
    const r = rows[rate.key]!;
    const fd = new FormData();
    fd.set("qty", r.qty);
    fd.set("unitCost", r.unitCost);
    fd.set("owedBy", r.owedBy);
    fd.set("paidBy", r.paidBy);
    if (r.enabled) fd.set("enabled", "on");
    setBusy(rate.key);
    startTransition(async () => {
      try {
        await saveBranchCostSettingAction(branch.id, rate.key, fd);
        setRows((prev) => ({ ...prev, [rate.key]: { ...prev[rate.key]!, saved: "נשמר", error: null } }));
      } catch (err) {
        setRows((prev) => ({
          ...prev,
          [rate.key]: {
            ...prev[rate.key]!,
            error: err instanceof Error ? err.message : "השמירה נכשלה",
          },
        }));
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <section className="rounded-card border border-card-border bg-white shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-card-border px-4 py-3">
        <div>
          <h2 className="text-[15px] font-extrabold text-ink">כמויות ועלויות בסניף</h2>
          <p className="mt-0.5 text-[12.5px] text-muted">
            מזינים <b className="text-ink">כמה יש</b>, והמערכת מחשבת את הסכום לפי התעריפון. שדה ריק =
            כמו בתעריפון הכללי.
          </p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className={`${TH} min-w-[150px]`}>קטגוריה</th>
              <th className={TH}>כמה יש בסניף</th>
              <th className={TH}>עלות ליחידה</th>
              <th className={`${TH} text-left`}>סה&quot;כ</th>
              <th className={TH}>על מי ההוצאה</th>
              <th className={TH}>מי משלם</th>
              <th className={TH}>נספר</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {rates.map((rate, i) => {
              const r = rows[rate.key]!;
              const auto = autoQty.get(rate.key) ?? 0;
              const calc = lineTotal(rate);
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
                      type="number"
                      min={0}
                      step="1"
                      value={r.qty}
                      onChange={(e) => patch(rate.key, { qty: e.target.value })}
                      placeholder={rate.qtySource === "manual" ? "0" : String(auto)}
                      className={FIELD}
                    />
                  </td>
                  <td className={TD}>
                    <input
                      type="number"
                      min={0}
                      step="1"
                      value={r.unitCost}
                      onChange={(e) => patch(rate.key, { unitCost: e.target.value })}
                      placeholder={String(rate.unitCost)}
                      className={FIELD}
                    />
                  </td>
                  <td className={`${TD} text-left`}>
                    {calc && calc.total > 0 ? (
                      <>
                        <b className="tabular-nums text-ink">{money(calc.total)}</b>
                        <br />
                        <span className="text-[10.5px] text-muted tabular-nums">
                          {calc.qty} × {money(calc.unit)}
                        </span>
                      </>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className={TD}>
                    <select
                      value={r.owedBy}
                      onChange={(e) => patch(rate.key, { owedBy: e.target.value })}
                      disabled={!hasPartner}
                      className={FIELD}
                    >
                      <option value="">כמו בתעריפון</option>
                      <option value="owner">על {ownerName} (100%)</option>
                      <option value="shared">חצי-חצי</option>
                      <option value="partner">על {partnerName} (100%)</option>
                    </select>
                  </td>
                  <td className={TD}>
                    <select
                      value={r.paidBy}
                      onChange={(e) => patch(rate.key, { paidBy: e.target.value })}
                      disabled={!hasPartner}
                      className={FIELD}
                    >
                      <option value="">{ownerName}</option>
                      <option value="owner">{ownerName}</option>
                      <option value="partner">{partnerName}</option>
                    </select>
                  </td>
                  <td className={TD}>
                    <input
                      type="checkbox"
                      checked={r.enabled}
                      onChange={(e) => patch(rate.key, { enabled: e.target.checked })}
                      className="h-4 w-4 accent-[#1a8a76]"
                    />
                  </td>
                  <td className={TD}>
                    <button
                      type="button"
                      onClick={() => save(rate)}
                      disabled={busy === rate.key}
                      className="whitespace-nowrap rounded-lg bg-teal px-2.5 py-1.5 text-[11.5px] font-extrabold text-white transition hover:bg-teal-dark disabled:opacity-50"
                    >
                      {busy === rate.key ? "שומר..." : "שמור"}
                    </button>
                    {r.saved && <div className="mt-0.5 text-[10.5px] font-bold text-emerald-600">✓ {r.saved}</div>}
                    {r.error && <div className="mt-0.5 text-[10.5px] font-bold text-red-600">✕ {r.error}</div>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-4 pb-3.5 pt-2.5 text-[11.5px] leading-relaxed text-muted">
        <b className="text-ink">דוגמה:</b> אם בתעריפון מחשב רגיל עולה 1,200 ₪ ותכתבי כאן שיש 2 מחשבים,
        עמודת סה&quot;כ תראה מיד <b className="text-ink">2,400 ₪</b> — עוד לפני השמירה.{" "}
        <b className="text-ink">מחשבי גרפיקה</b> נספרים בשורה נפרדת, ושורת &quot;מחשב רגיל&quot; מחסרת
        אותם אוטומטית כדי שאף מחשב לא ייספר פעמיים.
      </p>
    </section>
  );
}
