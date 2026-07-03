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

export function NewCoworkingClientForm({ branches, stations, defaultBranchId, lockBranch }: Props) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const branchStations = stations.filter((s) => s.branchId === branchId);

  return (
    <form
      action={createCoworkingClientAction}
      className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6"
    >
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">סניף</label>
        <select
          name="branchId"
          value={branchId}
          disabled={lockBranch}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => setBranchId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none disabled:bg-gray-100"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">שם לקוח</label>
        <input
          name="name"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">טלפון</label>
        <input
          name="phone"
          dir="ltr"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">עמדה</label>
        <select
          name="stationId"
          required
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
        >
          <option value="">בחירת עמדה</option>
          {branchStations.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.price} ₪)
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">תאריך התחלה</label>
          <input
            type="date"
            name="startDate"
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">יום חיוב בחודש</label>
          <input
            type="number"
            name="payDay"
            min={1}
            max={31}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">מחיר מותאם אישי (לא חובה)</label>
        <input
          type="number"
          name="customPrice"
          min={0}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="mt-2 self-start rounded-lg bg-teal px-6 py-2 font-medium text-white transition hover:bg-teal-dark"
      >
        הוספת לקוח
      </button>
    </form>
  );
}
