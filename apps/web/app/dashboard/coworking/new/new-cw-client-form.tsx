"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import type { Branch, CoworkingStation } from "@ultranet/shared-types";
import { createCoworkingClientAction } from "../actions";

type Props = {
  branches: Branch[];
  stations: CoworkingStation[];
  defaultBranchId: string;
  lockBranch: boolean;
};

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none disabled:opacity-60";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export function NewCoworkingClientForm({ branches, stations, defaultBranchId, lockBranch }: Props) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const branchStations = stations.filter((s) => s.branchId === branchId);

  return (
    <form
      action={createCoworkingClientAction}
      className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card"
    >
      <div>
        <label className={LABEL}>סניף</label>
        <select
          name="branchId"
          value={branchId}
          disabled={lockBranch}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setBranchId(e.target.value)}
          className={FIELD}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>שם לקוח</label>
        <input name="name" required className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>טלפון</label>
        <input name="phone" dir="ltr" className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>עמדה</label>
        <select name="stationId" required className={FIELD}>
          <option value="">בחירת עמדה</option>
          {branchStations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.price} ₪)
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>מספר עמדה (כפי שמוצג ללקוח)</label>
        <input name="stationNumber" className={FIELD} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>תאריך התחלה</label>
          <input type="date" name="startDate" required className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>תאריך סיום (רק אם כבר הפסיק)</label>
          <input type="date" name="endDate" className={FIELD} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>עלות חודשית (לא חובה — ברירת מחדל: מחיר העמדה)</label>
          <input type="number" name="customPrice" min={0} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>יום חיוב בחודש (ברירת מחדל: יום ההתחלה)</label>
          <input type="number" name="payDay" min={1} max={31} className={FIELD} />
        </div>
      </div>

      <button
        type="submit"
        className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        הוספת לקוח
      </button>
    </form>
  );
}
