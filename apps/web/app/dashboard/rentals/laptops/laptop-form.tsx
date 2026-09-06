"use client";
import { useState } from "react";
import type { Branch, BranchRentalPricing, Laptop, Stick } from "@ultranet/shared-types";

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";
const BTN = "mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90";

type Props = {
  action: (formData: FormData) => void;
  branches: Branch[];
  isOwner: boolean;
  initial?: Laptop;
  /** current pricing of the stick already linked to this laptop, if any (see syncLinkedStick) */
  initialStick?: Pick<Stick, "day1" | "day2" | "day3plus" | "weekPrice" | "monthPrice">;
  /** מחירון ברירת המחדל של כל סניף, להצגה כ-placeholder בשדות שנשארים ריקים */
  branchPricing?: Record<string, BranchRentalPricing | undefined>;
  /** הסניף של המחשב כשהמשתמש אינו owner (אין לו בורר סניף בטופס) */
  fixedBranchId?: string;
};

export function LaptopForm({
  action,
  branches,
  isOwner,
  initial,
  initialStick,
  branchPricing,
  fixedBranchId,
}: Props) {
  const [hasStick, setHasStick] = useState(!!initial?.hasStick);
  const [hasPartner, setHasPartner] = useState(!!initial?.hasPartner);
  const [branchId, setBranchId] = useState(initial?.branchId ?? fixedBranchId ?? branches[0]?.id ?? "");
  const defaults = branchPricing?.[branchId];

  /** "ברירת מחדל: 50 ₪" מתוך מחירון הסניף, או טקסט ניטרלי אם לא הוגדר שם כלום. */
  const ph = (n: number | undefined) => (n && n > 0 ? `ברירת מחדל: ${n}` : "לא הוגדר בסניף");

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      {isOwner ? (
        <div>
          <label className={LABEL}>סניף</label>
          <select
            name="branchId"
            required
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
            className={FIELD}
          >
            <option value="">בחר סניף</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.deleted ? `${b.name} (נמחק)` : b.name}</option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className={LABEL}>שם המחשב</label>
        <input name="name" required defaultValue={initial?.name} className={FIELD} />
      </div>

      <div className="rounded-lg border border-card-border bg-[#f9fafb] p-3">
        <p className="mb-1 text-xs font-bold text-ink">מחיר מיוחד למחשב הזה (₪) — רשות</p>
        <p className="mb-2 text-[11px] text-muted">
          כל שדה שנשאר ריק מתומחר לפי מחירון ברירת המחדל של הסניף. למלא כאן רק אם למחשב הזה יש
          מחיר שונה משאר המחשבים בסניף.
        </p>
        <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-x-3 gap-y-2">
          <span />
          <span className="text-center text-xs font-bold text-teal-dark">עם סטיק (אינטרנט)</span>
          <span className="text-center text-xs font-bold text-muted">בלי סטיק</span>

          <span className="text-xs font-semibold text-muted">ליום</span>
          <input
            name="dayPrice"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.dayPrice || ""}
            placeholder={ph(defaults?.laptop?.dayPrice)}
            className={FIELD}
          />
          <input
            name="noInternetDayPrice"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.noInternetDayPrice || ""}
            placeholder={ph(defaults?.laptop?.noInternetDayPrice)}
            className={FIELD}
          />

          <span className="text-xs font-semibold text-muted">לשבוע</span>
          <input
            name="weekPrice"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.weekPrice || ""}
            placeholder={ph(defaults?.laptop?.weekPrice)}
            className={FIELD}
          />
          <input
            name="noInternetWeekPrice"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.noInternetWeekPrice || ""}
            placeholder={ph(defaults?.laptop?.noInternetWeekPrice)}
            className={FIELD}
          />

          <span className="text-xs font-semibold text-muted">לחודש</span>
          <input
            name="monthPrice"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.monthPrice || ""}
            placeholder={ph(defaults?.laptop?.monthPrice)}
            className={FIELD}
          />
          <input
            name="noInternetMonthPrice"
            type="number"
            min={0}
            step={1}
            defaultValue={initial?.noInternetMonthPrice || ""}
            placeholder={ph(defaults?.laptop?.noInternetMonthPrice)}
            className={FIELD}
          />
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
          <div className="mt-3 flex flex-col gap-3">
            <div>
              <label className={LABEL}>מספר סים</label>
              <input name="simNumber" dir="ltr" defaultValue={initial?.simNumber} className={FIELD} />
            </div>
            <div>
              <p className="mb-1 text-xs font-bold text-ink">מחיר מיוחד לסטיק הזה (₪) — רשות</p>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={LABEL}>יום ראשון</label>
                  <input
                    name="stickDay1"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={initialStick?.day1 || ""}
                    placeholder={ph(defaults?.stick?.day1)}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>יום שני</label>
                  <input
                    name="stickDay2"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={initialStick?.day2 || ""}
                    placeholder={ph(defaults?.stick?.day2)}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>לכל יום נוסף</label>
                  <input
                    name="stickDay3plus"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={initialStick?.day3plus || ""}
                    placeholder={ph(defaults?.stick?.day3plus)}
                    className={FIELD}
                  />
                </div>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>מחיר לשבוע</label>
                  <input
                    name="stickWeekPrice"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={initialStick?.weekPrice || ""}
                    placeholder={ph(defaults?.stick?.weekPrice)}
                    className={FIELD}
                  />
                </div>
                <div>
                  <label className={LABEL}>מחיר לחודש</label>
                  <input
                    name="stickMonthPrice"
                    type="number"
                    min={0}
                    step={1}
                    defaultValue={initialStick?.monthPrice || ""}
                    placeholder={ph(defaults?.stick?.monthPrice)}
                    className={FIELD}
                  />
                </div>
              </div>
              <p className="mt-1 text-[11px] text-muted">
                גם כאן — שדה ריק מתומחר לפי מחירון הסניף. המחירים חלים כשמשכירים את הסטיק לבדו.
              </p>
            </div>
          </div>
        )}
      </div>

      {isOwner && (
        <div className="rounded-lg border border-card-border bg-[#f9fafb] p-3">
          <label className="flex items-center gap-2 text-sm font-semibold text-ink">
            <input
              type="checkbox"
              name="hasPartner"
              defaultChecked={hasPartner}
              onChange={(e) => setHasPartner(e.target.checked)}
            />
            יש שותף שמקבל אחוז מהשכרות המחשב הזה
          </label>
          {hasPartner && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>שם השותף (רשות)</label>
                <input name="partnerName" defaultValue={initial?.partnerName} className={FIELD} />
              </div>
              <div>
                <label className={LABEL}>אחוז לשותף</label>
                <input
                  name="partnerPct"
                  type="number"
                  min={0}
                  max={100}
                  defaultValue={initial?.partnerPct ?? 15}
                  className={FIELD}
                />
              </div>
            </div>
          )}
          <p className="mt-2 text-[11px] text-muted">
            יופיע בסיכום ההעברה החודשית לשותפים בעמוד הנה&quot;ח ← השכרות.
          </p>
        </div>
      )}

      <button type="submit" className={BTN}>שמירה</button>
    </form>
  );
}
