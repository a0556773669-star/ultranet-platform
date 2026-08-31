"use client";

import { useState } from "react";
import type { ChangeEvent } from "react";
import type { Branch } from "@ultranet/shared-types";

type BranchFormProps = {
  action: (formData: FormData) => void;
  initial?: Partial<Branch>;
};

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export function BranchForm({ action, initial }: BranchFormProps) {
  const [isMine, setIsMine] = useState(initial?.isMine ?? true);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      <div>
        <label className={LABEL}>שם הסניף</label>
        <input name="name" required defaultValue={initial?.name} className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>מיקום</label>
        <input name="location" defaultValue={initial?.location} className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>תאריך פתיחת הסניף</label>
        <input type="date" name="openedAt" defaultValue={initial?.openedAt?.slice(0, 10)} className={FIELD} />
        <p className="mt-1 text-[11.5px] text-muted">
          מהתאריך הזה מתחיל חישוב ההכנסות וההוצאות של הסניף. חודשים שלפניו לא מחושבים כלל.
        </p>
        <label className="mt-2 flex items-center gap-2 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm font-semibold text-ink">
          <input
            type="checkbox"
            name="notStarted"
            defaultChecked={initial?.notStarted ?? false}
            className="h-4 w-4 accent-teal"
          />
          הסניף עדיין לא התחיל לפעול
        </label>
        <p className="mt-1 text-[11.5px] text-muted">
          כשמסומן — הסניף לא נכנס לשום חישוב: אין לו הוצאות תעריפון, אין הכנסות ואין העברה לבעלים, גם אם כבר הוזנו
          אליו נתונים.
        </p>
      </div>

      <label className="flex items-center gap-2 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2.5 text-sm font-semibold text-ink">
        <input
          type="checkbox"
          name="isMine"
          checked={isMine}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setIsMine(e.target.checked)}
          className="h-4 w-4 accent-teal"
        />
        בבעלות מלאה (ללא שותף)
      </label>

      {!isMine && (
        <div className="grid grid-cols-2 gap-4 rounded-lg border border-card-border bg-[#f4f6f9] p-4">
          <div>
            <label className={LABEL}>שם השותף</label>
            <input name="partnerName" defaultValue={initial?.partnerName} className={`${FIELD} bg-white`} />
          </div>
          <div>
            <label className={LABEL}>מייל השותף</label>
            <input
              name="partnerEmail"
              type="email"
              dir="ltr"
              defaultValue={initial?.partnerEmail}
              className={`${FIELD} bg-white`}
            />
          </div>
          <div>
            <label className={LABEL}>האחוז שלי (%)</label>
            <input
              name="myPct"
              type="number"
              min={0}
              max={100}
              defaultValue={initial?.myPct ?? 50}
              className={`${FIELD} bg-white`}
            />
          </div>
          <div>
            <label className={LABEL}>האחוז של השותף (%)</label>
            <input
              name="partnerPct"
              type="number"
              min={0}
              max={100}
              defaultValue={initial?.partnerPct ?? 50}
              className={`${FIELD} bg-white`}
            />
          </div>
        </div>
      )}

      <div>
        <label className={LABEL}>עלות הקמה</label>
        <input name="setupCost" type="number" min={0} defaultValue={initial?.setupCost} className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>הערות</label>
        <textarea name="notes" rows={3} defaultValue={initial?.notes} className={FIELD} />
      </div>

      <button
        type="submit"
        className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        שמירה
      </button>
    </form>
  );
}
