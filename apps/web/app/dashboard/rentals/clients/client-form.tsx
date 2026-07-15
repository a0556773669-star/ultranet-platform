"use client";

import { useState } from "react";
import type { Branch, RentalClient } from "@ultranet/shared-types";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export function ClientForm({
  action,
  branches,
  isOwner,
  myBranchId,
  initial,
}: {
  action: (formData: FormData) => void;
  branches: Branch[];
  isOwner: boolean;
  myBranchId?: string;
  initial?: RentalClient;
}) {
  const [depositType, setDepositType] = useState<"none" | "check" | "credit">(
    initial?.depositType ?? "none"
  );

  return (
    <form
      action={action}
      className="mb-6 grid grid-cols-1 gap-4 rounded-card border border-card-border bg-white p-5 shadow-card sm:grid-cols-2"
    >
      {isOwner ? (
        <div>
          <label className={LABEL}>סניף</label>
          <select name="branchId" required defaultValue={initial?.branchId} className={FIELD}>
            <option value="">בחר סניף</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="branchId" value={myBranchId ?? ""} />
      )}
      <div>
        <label className={LABEL}>שם</label>
        <input name="name" required defaultValue={initial?.name} className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>טלפון</label>
        <input name="phone" dir="ltr" defaultValue={initial?.phone} className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>מייל (רשות)</label>
        <input type="email" name="email" dir="ltr" defaultValue={initial?.email} className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>ת.ז.</label>
        <input name="idNum" dir="ltr" defaultValue={initial?.idNum} className={FIELD} />
      </div>
      <div className="sm:col-span-2">
        <label className={LABEL}>כתובת</label>
        <input name="address" defaultValue={initial?.address} className={FIELD} />
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="signedTerms"
          name="signedTerms"
          defaultChecked={initial?.signedTerms}
          className="h-4 w-4 rounded border-card-border"
        />
        <label htmlFor="signedTerms" className="text-sm font-semibold text-ink">
          חתם על טופס תקנון
        </label>
      </div>

      <div className="sm:col-span-2">
        <label className={LABEL}>פיקדון</label>
        <select
          name="depositType"
          value={depositType}
          onChange={(e) => setDepositType(e.target.value as "none" | "check" | "credit")}
          className={FIELD}
        >
          <option value="none">ללא פיקדון</option>
          <option value="check">צ׳ק</option>
          <option value="credit">כרטיס אשראי</option>
        </select>
      </div>

      {depositType === "credit" && (
        <div className="sm:col-span-2 rounded-lg border border-teal-light bg-teal-bg px-3 py-2">
          <p className="text-xs font-semibold text-teal-dark">
            {initial?.cardLast4
              ? `נשמר אמצעי תשלום: •••• ${initial.cardLast4}`
              : "לאחר השמירה ייפתח באותו חלון חלון מאבטח של נדרים פלאס להזנת פרטי האשראי"}
          </p>
          <p className="mt-1 text-[11px] text-muted">
            מספר הכרטיס וקוד ה-CVV לא נשמרים אצלנו בשום שלב (PCI-DSS) – הכל מוקלד ומאובטח דרך נדרים פלאס.
          </p>
        </div>
      )}

      <button
        type="submit"
        className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 sm:col-span-2"
      >
        {initial
          ? "עדכן פרטים"
          : depositType === "credit"
            ? "שמור פרטי לקוח ועבור למילוי פרטי אשראי"
            : "הוסף לקוח"}
      </button>
    </form>
  );
}
