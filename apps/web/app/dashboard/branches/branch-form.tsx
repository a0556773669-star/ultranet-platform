"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import type { Branch } from "@ultranet/shared-types";

type BranchFormProps = {
  action: (formData: FormData) => void;
  initial?: Partial<Branch>;
};

const TYPE_OPTIONS: { value: Branch["branchType"]; label: string }[] = [
  { value: "computers", label: "מחשבים" },
  { value: "rentals", label: "השכרות" },
  { value: "coworking", label: "קוורקינג" },
];

export function BranchForm({ action, initial }: BranchFormProps) {
  const [isMine, setIsMine] = useState(initial?.isMine ?? true);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">שם הסניף</label>
        <input
          name="name"
          required
          defaultValue={initial?.name}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">סוג סניף</label>
          <select
            name="branchType"
            defaultValue={initial?.branchType ?? "computers"}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">מיקום</label>
          <input
            name="location"
            defaultValue={initial?.location}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          name="isMine"
          checked={isMine}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setIsMine(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        בבעלות מלאה (ללא שותף)
      </label>

      {!isMine && (
        <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">שם השותף</label>
            <input
              name="partnerName"
              defaultValue={initial?.partnerName}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">מייל השותף</label>
            <input
              name="partnerEmail"
              type="email"
              dir="ltr"
              defaultValue={initial?.partnerEmail}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">האחוז שלי (%)</label>
            <input
              name="myPct"
              type="number"
              min={0}
              max={100}
              defaultValue={initial?.myPct ?? 50}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">האחוז של השותף (%)</label>
            <input
              name="partnerPct"
              type="number"
              min={0}
              max={100}
              defaultValue={initial?.partnerPct ?? 50}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
            />
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">עלות הקמה</label>
        <input
          name="setupCost"
          type="number"
          min={0}
          defaultValue={initial?.setupCost}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-700">הערות</label>
        <textarea
          name="notes"
          rows={3}
          defaultValue={initial?.notes}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
        />
      </div>

      <button
        type="submit"
        className="mt-2 self-start rounded-lg bg-teal px-6 py-2 font-medium text-white transition hover:bg-teal-dark"
      >
        שמירה
      </button>
    </form>
  );
}
