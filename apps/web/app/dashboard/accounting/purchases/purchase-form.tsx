"use client";

/**
 * "רכישה חדשה" — one screen, once, for a whole supplier invoice.
 *
 * The live total is the point of the screen: the owner types the lines and immediately sees
 * whether they add up to the invoice, because that equality is what makes every downstream
 * number true (Σ qty × unitCost = total = the transaction). A purchase that doesn't balance
 * can't be saved, so a branch's investment can never disagree with what left the account.
 */
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Branch, ItemKind } from "@ultranet/shared-types";
import {
  ITEM_KINDS,
  ITEM_KIND_LABEL,
  WAREHOUSE_LABEL,
  WAREHOUSE_LOCATION,
  lineTotal,
  purchaseLinesTotal,
  purchaseUnitCount,
  validatePurchase,
} from "@/lib/assets";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const LABEL = "mb-1 block text-[11px] font-extrabold tracking-wide text-muted";
const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-2 text-[13px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";

interface DraftLine {
  key: number;
  kind: ItemKind;
  label: string;
  qty: string;
  unitCost: string;
}

let nextKey = 1;
const emptyLine = (kind: ItemKind = "laptop"): DraftLine => ({
  key: nextKey++,
  kind,
  label: "",
  qty: "",
  unitCost: "",
});

export function PurchaseForm({
  branches,
  action,
}: {
  branches: Branch[];
  action: (formData: FormData) => Promise<void>;
}) {
  const [lines, setLines] = useState<DraftLine[]>([emptyLine("laptop"), emptyLine("stick"), emptyLine("bag")]);
  const [total, setTotal] = useState("");

  const parsed = lines.map((l) => ({ qty: Number(l.qty) || 0, unitCost: Number(l.unitCost) || 0 }));
  const linesTotal = purchaseLinesTotal(parsed);
  const unitCount = purchaseUnitCount(parsed);
  const totalNum = Number(total) || 0;
  const check = validatePurchase(totalNum, parsed);
  const balanced = totalNum > 0 && Math.abs(linesTotal - totalNum) <= 0.5;

  function patch(key: number, next: Partial<DraftLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...next } : l)));
  }

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={LABEL} htmlFor="date">
            תאריך החשבונית
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="supplier">
            ספק
          </label>
          <input id="supplier" name="supplier" required placeholder="יבואן מחשבים" className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="invoiceNo">
            מספר חשבונית
          </label>
          <input id="invoiceNo" name="invoiceNo" placeholder="4471" className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="business">
            יחידה עסקית
          </label>
          <select id="business" name="business" defaultValue="rentals" className={FIELD}>
            <option value="rentals">השכרות ניידים</option>
            <option value="computers">חדרי מחשבים</option>
            <option value="coworking">משרד שיתופי</option>
            <option value="hq">מטה</option>
          </select>
        </div>
      </div>

      {/* --- the invoice lines ------------------------------------------- */}
      <div className="overflow-hidden rounded-card border border-card-border">
        <table className="w-full border-collapse text-[12.5px]">
          <thead>
            <tr>
              <th className="bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted">סוג</th>
              <th className="bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted">
                תיאור (רשות)
              </th>
              <th className="bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted">כמות</th>
              <th className="bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted">
                עלות ליחידה
              </th>
              <th className="bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted">סה&quot;כ</th>
              <th className="bg-[#f4f6f9] px-2.5 py-2" />
            </tr>
          </thead>
          <tbody>
            {lines.map((line, i) => (
              <tr key={line.key} className="border-t border-[#eef1f6]">
                <td className="px-2 py-1.5">
                  <select
                    name="lineKind"
                    value={line.kind}
                    onChange={(e) => patch(line.key, { kind: e.target.value as ItemKind })}
                    className={FIELD}
                  >
                    {ITEM_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {ITEM_KIND_LABEL[k]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-2 py-1.5">
                  <input
                    name="lineLabel"
                    value={line.label}
                    onChange={(e) => patch(line.key, { label: e.target.value })}
                    placeholder={ITEM_KIND_LABEL[line.kind]}
                    className={FIELD}
                  />
                </td>
                <td className="w-24 px-2 py-1.5">
                  <input
                    name="lineQty"
                    type="number"
                    min={0}
                    step="1"
                    value={line.qty}
                    onChange={(e) => patch(line.key, { qty: e.target.value })}
                    className={FIELD}
                  />
                </td>
                <td className="w-32 px-2 py-1.5">
                  <input
                    name="lineUnitCost"
                    type="number"
                    min={0}
                    step="1"
                    value={line.unitCost}
                    onChange={(e) => patch(line.key, { unitCost: e.target.value })}
                    className={FIELD}
                  />
                </td>
                <td className="w-28 px-2.5 py-1.5 text-right font-bold tabular-nums text-ink">
                  {money(lineTotal(parsed[i]!))}
                </td>
                <td className="w-10 px-2 py-1.5">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                      className="text-muted transition hover:text-red-600"
                      aria-label="מחיקת שורה"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-card-border bg-[#fafbfc] px-2.5 py-2">
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, emptyLine()])}
            className="flex items-center gap-1 text-[12px] font-bold text-teal hover:underline"
          >
            <Plus className="h-3.5 w-3.5" />
            הוספת שורה
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className={LABEL} htmlFor="total">
            סכום החשבונית
          </label>
          <input
            id="total"
            name="total"
            type="number"
            min={1}
            step="1"
            required
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            placeholder="15000"
            className={FIELD}
          />
        </div>
        <div>
          <label className={LABEL} htmlFor="location">
            הפריטים נכנסים ל־
          </label>
          <select id="location" name="location" defaultValue={WAREHOUSE_LOCATION} className={FIELD}>
            <option value={WAREHOUSE_LOCATION}>{WAREHOUSE_LABEL}</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL} htmlFor="doc">
            קישור לחשבונית (רשות)
          </label>
          <input id="doc" name="doc" placeholder="https://..." className={FIELD} />
        </div>
        <div>
          <label className={LABEL} htmlFor="note">
            הערה (רשות)
          </label>
          <input id="note" name="note" className={FIELD} />
        </div>
      </div>

      {/* --- the balance check, live -------------------------------------- */}
      <div
        className={`rounded-card border px-3.5 py-2.5 text-[12.5px] font-bold ${
          balanced
            ? "border-[#bfe3d4] bg-[#eefaf4] text-[#0f6e56]"
            : "border-[#f0dcb8] bg-[#fdf3e3] text-[#7a4a12]"
        }`}
      >
        {balanced ? (
          <>
            מאוזן — {unitCount} פריטים, סכום השורות {money(linesTotal)} שווה לסכום החשבונית. תיווצר תנועה הונית
            אחת ו-{unitCount} פריטים, כל אחד עם עלות היחידה שלו. שום הוצאה לא נרשמת לאף סניף.
          </>
        ) : (
          <>
            {check.error ?? "נא להשלים את החשבונית"}
            {linesTotal > 0 && ` · סכום השורות כרגע: ${money(linesTotal)} (${unitCount} פריטים)`}
          </>
        )}
      </div>

      <div>
        <button
          type="submit"
          disabled={!balanced}
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2.5 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          שמירת הרכישה
        </button>
      </div>
    </form>
  );
}
