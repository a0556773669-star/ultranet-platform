"use client";

/**
 * The shipment screen: pick items, pick a destination, confirm.
 *
 * There is no amount field here, and there never will be. That single absence is what makes
 * double counting structurally impossible at this step - see כלל 2. The panel shows the value
 * that is about to move only so the owner can see the investment shifting from one column to
 * another; it is computed from the items themselves and cannot be typed into.
 */
import { useMemo, useState } from "react";
import { PackageCheck } from "lucide-react";
import type { Item } from "@ultranet/shared-types";
import { ITEM_KIND_LABEL, ITEM_STATUS_LABEL, WAREHOUSE_LABEL, WAREHOUSE_LOCATION, itemLabel } from "@/lib/assets";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const LABEL = "mb-1 block text-[11px] font-extrabold tracking-wide text-muted";
const FIELD =
  "w-full min-w-0 rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-2 text-[13px] font-semibold text-ink focus:border-teal focus:bg-white focus:outline-none";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] text-[12.5px]";

export interface LocationOption {
  id: string;
  name: string;
}

export function ShipmentClient({
  items,
  locations,
  moveAction,
  statusAction,
}: {
  items: Item[];
  locations: LocationOption[];
  moveAction: (formData: FormData) => Promise<void>;
  statusAction: (formData: FormData) => Promise<void>;
}) {
  const [from, setFrom] = useState<string>(WAREHOUSE_LOCATION);
  const [selected, setSelected] = useState<string[]>([]);
  const [to, setTo] = useState<string>("");

  const locationName = useMemo(() => {
    const map = new Map(locations.map((l) => [l.id, l.name]));
    map.set(WAREHOUSE_LOCATION, WAREHOUSE_LABEL);
    return (id: string) => map.get(id) ?? id;
  }, [locations]);

  const atFrom = useMemo(
    () => items.filter((i) => (i.location || WAREHOUSE_LOCATION) === from),
    [items, from],
  );
  const selectedItems = useMemo(
    () => atFrom.filter((i) => selected.includes(i.id)),
    [atFrom, selected],
  );
  const movingValue = selectedItems.reduce((s, i) => s + (i.unitCost || 0), 0);
  const fromValue = atFrom.reduce((s, i) => s + (i.unitCost || 0), 0);

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function changeFrom(next: string) {
    setFrom(next);
    setSelected([]);
  }

  const destinations = [{ id: WAREHOUSE_LOCATION, name: WAREHOUSE_LABEL }, ...locations].filter(
    (l) => l.id !== from,
  );

  return (
    <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <section className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <div className="flex flex-wrap items-end justify-between gap-2.5 border-b border-card-border px-4 py-3">
          <div>
            <h2 className="text-[15px] font-extrabold text-ink">בחירת פריטים</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {atFrom.length} פריטים ב{locationName(from)} · שווי {money(fromValue)}
            </p>
          </div>
          <div className="w-56">
            <label className={LABEL} htmlFor="from">
              מאיפה
            </label>
            <select id="from" value={from} onChange={(e) => changeFrom(e.target.value)} className={FIELD}>
              <option value={WAREHOUSE_LOCATION}>{WAREHOUSE_LABEL}</option>
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {atFrom.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted">אין פריטים ב{locationName(from)}.</p>
        ) : (
          <div className="max-h-[520px] overflow-auto">
            <table className="w-full border-collapse">
              <thead className="sticky top-0">
                <tr>
                  <th className={TH}>
                    <input
                      type="checkbox"
                      checked={selected.length === atFrom.length && atFrom.length > 0}
                      onChange={(e) => setSelected(e.target.checked ? atFrom.map((i) => i.id) : [])}
                      aria-label="סימון הכל"
                    />
                  </th>
                  <th className={TH}>פריט</th>
                  <th className={TH}>מספר סידורי</th>
                  <th className={TH}>עלות</th>
                  <th className={TH}>מצב</th>
                  <th className={TH}>נרכש</th>
                </tr>
              </thead>
              <tbody>
                {atFrom.map((item) => (
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
                    <td className={`${TD} tabular-nums`}>{money(item.unitCost)}</td>
                    <td className={`${TD} text-muted`}>{ITEM_STATUS_LABEL[item.status]}</td>
                    <td className={`${TD} tabular-nums text-muted`}>{item.acquiredAt || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-col gap-3.5">
        <form
          action={moveAction}
          className="overflow-hidden rounded-card border border-card-border bg-white shadow-card"
        >
          <div className="border-b border-card-border px-4 py-3">
            <h2 className="flex items-center gap-1.5 text-[15px] font-extrabold text-ink">
              <PackageCheck className="h-4 w-4" />
              משלוח
            </h2>
            <p className="mt-0.5 text-[12px] text-muted">שים לב: אין במסך הזה שדה סכום. אין מה להקליד.</p>
          </div>
          <div className="flex flex-col gap-2.5 p-3.5">
            {selected.map((id) => (
              <input key={id} type="hidden" name="itemIds" value={id} />
            ))}

            <div>
              <label className={LABEL} htmlFor="to">
                לאן
              </label>
              <select id="to" name="to" value={to} onChange={(e) => setTo(e.target.value)} required className={FIELD}>
                <option value="">בחירת יעד…</option>
                {destinations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
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
            <div>
              <label className={LABEL} htmlFor="reason">
                סיבה
              </label>
              <select id="reason" name="reason" defaultValue="allocation" className={FIELD}>
                <option value="allocation">משלוח לסניף</option>
                <option value="return">החזרה למחסן</option>
                <option value="transfer">העברה בין סניפים</option>
                <option value="repair">יצא לתיקון</option>
              </select>
            </div>
            <div>
              <label className={LABEL} htmlFor="note">
                הערה (רשות)
              </label>
              <input id="note" name="note" className={FIELD} />
            </div>

            <div className="rounded-card border border-card-border bg-[#f9fafb] px-3 py-2.5 text-[12.5px]">
              <p className="font-extrabold text-ink">{selectedItems.length} פריטים נבחרו</p>
              <p className="mt-1 text-muted">
                שווי שנוסע איתם: <b className="text-ink">{money(movingValue)}</b>
              </p>
              <p className="mt-1.5 leading-relaxed text-muted">
                השווי הזה יעבור מ{locationName(from)} ל{to ? locationName(to) : "יעד שייבחר"} —{" "}
                <b className="text-ink">בלי שיירשם שקל אחד חדש</b>. סכום ההשקעה בכל הסניפים ועוד המחסן יישאר
                בדיוק כפי שהיה.
              </p>
            </div>

            <button
              type="submit"
              disabled={selectedItems.length === 0 || !to}
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2.5 text-[13px] font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              אישור המשלוח
            </button>
          </div>
        </form>

        <form
          action={statusAction}
          className="overflow-hidden rounded-card border border-card-border bg-white shadow-card"
        >
          <div className="border-b border-card-border px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-ink">שינוי מצב הפריטים שנבחרו</h2>
          </div>
          <div className="flex flex-col gap-2.5 p-3.5">
            {selected.map((id) => (
              <input key={id} type="hidden" name="itemIds" value={id} />
            ))}
            <select name="status" defaultValue="repair" className={FIELD}>
              <option value="active">תקין ופעיל</option>
              <option value="repair">בתיקון</option>
              <option value="lost">אבד</option>
              <option value="sold">נמכר</option>
              <option value="writtenoff">הושבת</option>
            </select>
            <p className="text-[11.5px] leading-relaxed text-muted">
              פריט שנמכר או אבד מפסיק להיחשב כהשקעה בסניף — הוא באמת כבר לא שם. תנועת הרכש שלו נשארת
              בשכבת הכסף לתמיד, כי הכסף הזה באמת יצא.
            </p>
            <button
              type="submit"
              disabled={selectedItems.length === 0}
              className="rounded-[10px] border border-card-border px-5 py-2 text-[13px] font-bold text-ink transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              עדכון מצב
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
