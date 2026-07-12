"use client";
import { useState } from "react";
import type { Branch, Laptop } from "@ultranet/shared-types";

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";
const BTN = "mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90";

type Props = {
  action: (formData: FormData) => void;
  branches: Branch[];
  isOwner: boolean;
  initial?: Laptop;
};

export function LaptopForm({ action, branches, isOwner, initial }: Props) {
  const [hasStick, setHasStick] = useState(!!initial?.hasStick);
  const [altPricing, setAltPricing] = useState(!!initial?.altPricing);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      {isOwner ? (
        <div>
          <label className={LABEL}>סניף</label>
          <select name="branchId" required defaultValue={initial?.branchId ?? ""} className={FIELD}>
            <option value="">בחר סניף</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className={LABEL}>שם המחשב</label>
        <input name="name" required defaultValue={initial?.name} className={FIELD} />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={LABEL}>מחיר ליום</label>
          <input name="dayPrice" type="number" min={0} defaultValue={initial?.dayPrice ?? 0} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>מחיר לשבוע</label>
          <input name="weekPrice" type="number" min={0} defaultValue={initial?.weekPrice ?? 0} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>מחיר לחודש</label>
          <input name="monthPrice" type="number" min={0} defaultValue={initial?.monthPrice ?? 0} className={FIELD} />
        </div>
      </div>

      <div className="rounded-lg border border-card-border bg-[#f9fafb] p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name="hasStick"
            defaultChecked={hasStick}
            onChange={(e) => setHasStick(e.target.checked)}
          />
          יש סטיק משוייך למחשב זה
        </label>
        {hasStick && (
          <div className="mt-3">
            <label className={LABEL}>מספר סים</label>
            <input name="simNumber" dir="ltr" defaultValue={initial?.simNumber} className={FIELD} />
          </div>
        )}
      </div>

      <div className="rounded-lg border border-card-border bg-[#f9fafb] p-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name="altPricing"
            defaultChecked={altPricing}
            onChange={(e) => setAltPricing(e.target.checked)}
          />
          לקבוע מחירים נפרדים למחשב בלי אינטרנט / לסטיק בלבד
        </label>
        {altPricing && (
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <p className="mb-1 text-xs font-bold text-ink">מחשב בלי אינטרנט</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>ליום</label>
                  <input name="noInternetDayPrice" type="number" min={0} defaultValue={initial?.noInternetDayPrice ?? 0} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>לשבוע</label>
                  <input name="noInternetWeekPrice" type="number" min={0} defaultValue={initial?.noInternetWeekPrice ?? 0} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>לחודש</label>
                  <input name="noInternetMonthPrice" type="number" min={0} defaultValue={initial?.noInternetMonthPrice ?? 0} className={FIELD} />
                </div>
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-ink">סטיק בלבד</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>ליום</label>
                  <input name="stickOnlyDayPrice" type="number" min={0} defaultValue={initial?.stickOnlyDayPrice ?? 0} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>לשבוע</label>
                  <input name="stickOnlyWeekPrice" type="number" min={0} defaultValue={initial?.stickOnlyWeekPrice ?? 0} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>לחודש</label>
                  <input name="stickOnlyMonthPrice" type="number" min={0} defaultValue={initial?.stickOnlyMonthPrice ?? 0} className={FIELD} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <button type="submit" className={BTN}>שמירה</button>
    </form>
  );
}
