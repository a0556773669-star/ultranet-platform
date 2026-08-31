"use client";

/**
 * "יציאת ציוד" — the purchase screen, run backwards.
 *
 * The live panel shows the capital result before saving, because that is the number the owner is
 * actually deciding on: 1,800 ₪ received against 3,000 ₪ of cost is a 1,200 ₪ capital loss, and
 * it is far better to see that while choosing the price than to discover it in a report later.
 */
import { useMemo, useState } from "react";
import { PackageMinus } from "lucide-react";
import type { Item, ItemStatus } from "@ultranet/shared-types";
import {
  EXIT_REASON_LABEL,
  ITEM_KIND_LABEL,
  ITEM_STATUS_LABEL,
  WAREHOUSE_LABEL,
  WAREHOUSE_LOCATION,
  itemLabel,
  splitSaleProceeds,
} from "@/lib/assets";
import { recordExitAction, type SaveResult } from "./actions";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const LABEL = "mb-1 block text-[11px] font-extrabold tracking-wide text-muted";
const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-2 text-[13px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] text-[12.5px]";

export function SaleClient({
  items,
  branchNames,
}: {
  items: Item[];
  branchNames: Record<string, string>;
}) {
  const [status, setStatus] = useState<Extract<ItemStatus, "sold" | "writeoff" | "lost">>("sold");
  const [selected, setSelected] = useState<string[]>([]);
  const [proceeds, setProceeds] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [result, setResult] = useState<SaveResult | null>(null);
  const [busy, setBusy] = useState(false);

  const nameOf = (id: string) => (id === WAREHOUSE_LOCATION ? WAREHOUSE_LABEL : branchNames[id] ?? id);

  const visible = useMemo(
    () => (locationFilter ? items.filter((i) => i.location === locationFilter) : items),
    [items, locationFilter],
  );
  const selectedItems = useMemo(() => items.filter((i) => selected.includes(i.id)), [items, selected]);

  const cost = selectedItems.reduce((s, i) => s + (i.unitCost || 0), 0);
  const proceedsNum = status === "sold" ? Number(proceeds) || 0 : 0;
  const gain = proceedsNum - cost;
  const shares = splitSaleProceeds(selectedItems, proceedsNum);

  const locations = useMemo(() => [...new Set(items.map((i) => i.location))].sort(), [items]);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function submit(formData: FormData) {
    setBusy(true);
    setResult(null);
    const res = await recordExitAction(formData);
    setBusy(false);
    setResult(res);
    if (res.ok) {
      setSelected([]);
      setProceeds("");
    }
  }

  return (
    <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-2.5 border-b border-card-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">בחירת פריטים שיוצאים</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {visible.length} פריטים פעילים · אפשר לבחור מכל מיקום, מחסן או סניף
            </p>
          </div>
          <div className="w-56">
            <label className={LABEL} htmlFor="loc">
              סינון לפי מיקום
            </label>
            <select
              id="loc"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className={FIELD}
            >
              <option value="">כל המיקומים</option>
              {locations.map((l) => (
                <option key={l} value={l}>
                  {nameOf(l)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">אין פריטים פעילים להצגה.</p>
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0">
                <tr>
                  <th className={TH} />
                  <th className={TH}>פריט</th>
                  <th className={TH}>מספר סידורי</th>
                  <th className={TH}>מיקום</th>
                  <th className={TH}>עלות</th>
                  <th className={TH}>מצב</th>
                  {status === "sold" && <th className={TH}>חלקו בתמורה</th>}
                </tr>
              </thead>
              <tbody>
                {visible.map((item) => (
                  <tr
                    key={item.id}
                    className={selected.includes(item.id) ? "bg-teal-bg/40" : "transition hover:bg-[#fafbfc]"}
                  >
                    <td className={TD}>
                      <input
                        type="checkbox"
                        checked={selected.includes(item.id)}
                        onChange={() => toggle(item.id)}
                        aria-label={`בחירת ${itemLabel(item)}`}
                      />
                    </td>
                    <td className={TD}>
                      <span className="font-bold text-ink">{itemLabel(item)}</span>
                      <span className="mr-1.5 text-[11px] text-muted">{ITEM_KIND_LABEL[item.kind]}</span>
                    </td>
                    <td className={`${TD} text-muted`}>{item.serial || "—"}</td>
                    <td className={TD}>{nameOf(item.location)}</td>
                    <td className={`${TD} tabular-nums`}>{money(item.unitCost)}</td>
                    <td className={`${TD} text-muted`}>{ITEM_STATUS_LABEL[item.status]}</td>
                    {status === "sold" && (
                      <td className={`${TD} tabular-nums font-bold text-ink`}>
                        {selected.includes(item.id) ? money(shares.get(item.id) ?? 0) : "—"}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {status === "sold" && selectedItems.length > 1 && (
          <p className="border-t border-card-border px-4 py-2.5 text-[11.5px] leading-relaxed text-muted">
            התמורה מתחלקת בין הפריטים <b className="text-ink">ביחס לעלות שלהם</b>, לא שווה בשווה: מכירת
            מחשב של 1,500 ₪ יחד עם תיק של 100 ₪ תמורת 1,000 ₪ לא מימשה 500 ₪ על התיק.
          </p>
        )}
      </section>

      <form action={submit} className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <div className="border-b border-card-border px-4 py-3">
          <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-ink">
            <PackageMinus className="h-4 w-4" />
            רישום היציאה
          </h2>
          <p className="mt-0.5 text-[12px] text-muted">
            התמורה היא החזר הון — לא הכנסה, ולא מתחלקת עם אף שותף
          </p>
        </div>
        <div className="flex flex-col gap-2.5 p-3.5">
          {selected.map((id) => (
            <input key={id} type="hidden" name="itemIds" value={id} />
          ))}

          <div>
            <span className={LABEL}>סיבת היציאה</span>
            <div className="flex flex-col gap-1">
              {(["sold", "writeoff", "lost"] as const).map((s) => (
                <label
                  key={s}
                  className={`cursor-pointer rounded-lg border px-3 py-2 text-[12.5px] font-bold transition ${
                    status === s ? "border-teal bg-teal-bg text-teal-dark" : "border-card-border text-muted"
                  }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={s}
                    checked={status === s}
                    onChange={() => setStatus(s)}
                    className="sr-only"
                  />
                  {EXIT_REASON_LABEL[s]}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className={LABEL} htmlFor="date">
              תאריך
            </label>
            <input
              id="date"
              name="date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              className={FIELD}
            />
          </div>

          {status === "sold" && (
            <>
              <div>
                <label className={LABEL} htmlFor="buyer">
                  למי נמכר
                </label>
                <input id="buyer" name="buyer" required placeholder="שם הקונה" className={FIELD} />
              </div>
              <div>
                <label className={LABEL} htmlFor="proceeds">
                  סכום כולל שהתקבל
                </label>
                <input
                  id="proceeds"
                  name="proceeds"
                  type="number"
                  min={1}
                  step="1"
                  value={proceeds}
                  onChange={(e) => setProceeds(e.target.value)}
                  className={FIELD}
                />
              </div>
              <div>
                <label className={LABEL} htmlFor="invoiceNo">
                  מספר חשבונית (רשות)
                </label>
                <input id="invoiceNo" name="invoiceNo" className={FIELD} />
              </div>
            </>
          )}

          <div>
            <label className={LABEL} htmlFor="note">
              הערה (רשות)
            </label>
            <input id="note" name="note" className={FIELD} />
          </div>

          <div className="rounded-card border border-card-border bg-[#f9fafb] px-3 py-2.5 text-[12.5px]">
            <p className="font-extrabold text-ink">{selectedItems.length} פריטים נבחרו</p>
            <div className="mt-1.5 flex flex-col gap-0.5 text-muted">
              <span>
                עלות מקורית: <b className="text-ink">{money(cost)}</b>
              </span>
              {status === "sold" && (
                <span>
                  תמורה: <b className="text-ink">{money(proceedsNum)}</b>
                </span>
              )}
              <span className={gain >= 0 ? "text-emerald-700" : "text-red-600"}>
                {gain >= 0 ? "רווח הוני" : "הפסד הוני"}: <b>{money(Math.abs(gain))}</b>
              </span>
            </div>
            <p className="mt-2 leading-relaxed text-muted">
              ההכנסות של הסניף, הנטו שלו וההעברה מהשותף — <b className="text-ink">לא ישתנו כלל</b>. הציוד
              מעולם לא היה שלו, והיציאה קורית כולה בשכבות 1 ו-2.
            </p>
          </div>

          {result && (
            <p className={`text-[12.5px] font-bold ${result.ok ? "text-emerald-600" : "text-red-600"}`} role="status">
              {result.ok ? "✓ " : "✕ "}
              {result.message}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || selectedItems.length === 0 || (status === "sold" && proceedsNum <= 0)}
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2.5 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "שומר…" : status === "sold" ? "רישום המכירה" : "רישום היציאה"}
          </button>
        </div>
      </form>
    </div>
  );
}
