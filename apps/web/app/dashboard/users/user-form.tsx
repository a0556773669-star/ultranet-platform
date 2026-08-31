"use client";

import { useState } from "react";
import type { AppUser, Branch, UserRole } from "@ultranet/shared-types";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "employee", label: "עובד" },
  { value: "partner", label: "שותף" },
  { value: "owner", label: "בעלים" },
];

/**
 * Only the two permissions that still gate a screen. The keys of the modules that were removed
 * stay in `n_users.perms` untouched — they are simply no longer editable here, so a user document
 * written before the cleanup keeps its history and nothing is silently reset to false.
 */
const PERM_OPTIONS: { key: keyof NonNullable<AppUser["perms"]>; label: string }[] = [
  { key: "accounting", label: "הנה\"ח" },
  { key: "rentals", label: "העברות, דוחות והוצאות סניף" },
];

export function UserForm({
  action,
  branches,
  initial,
  submitLabel,
}: {
  action: (formData: FormData) => void;
  branches: Branch[];
  initial?: Partial<AppUser>;
  submitLabel: string;
}) {
  const [role, setRole] = useState<UserRole>(initial?.role ?? "employee");
  const [perms, setPerms] = useState<Partial<Record<string, boolean>>>(initial?.perms ?? {});
  const [viewBranches, setViewBranches] = useState<string[]>(initial?.viewClientBranchIds ?? []);

  const togglePerm = (key: string) => {
    setPerms((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleViewBranch = (id: string) => {
    setViewBranches((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      <div>
        <label className={LABEL}>שם מלא</label>
        <input name="name" required defaultValue={initial?.name} className={FIELD} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>אימייל</label>
          <input type="email" name="email" required defaultValue={initial?.email} className={FIELD} />
        </div>
        <div>
          <label className={LABEL}>
            {initial ? "סיסמה חדשה (השאירו ריק כדי לא לשנות)" : "סיסמה"}
          </label>
          <input type="text" name="pass" required={!initial} className={FIELD} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={LABEL}>תפקיד</label>
          <select
            name="role"
            value={role}
            onChange={(e) => setRole(e.target.value as UserRole)}
            className={FIELD}
          >
            {ROLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={LABEL}>סניף</label>
          <select name="branchId" defaultValue={initial?.branchId ?? ""} className={FIELD}>
          <option value="">בחר סניף</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        {role === "owner" && (
          <p className="mt-1 text-[11px] text-muted">
            בעלים משויך לכל הסניפים בכל מקום במערכת. הבחירה כאן משמשת רק כברירת מחדל בעת פתיחת השכרה חדשה - עדיין ניתן לבחור כל סניף אחר בטופס ההשכרה עצמו.
          </p>
        )}
      </div>
      </div>

      {role !== "owner" && (
        <div>
          <label className={LABEL}>הרשאות מודולים</label>
          <div className="flex flex-wrap gap-2">
            {PERM_OPTIONS.map((p) => {
              const active = Boolean(perms[p.key]);
              return (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => togglePerm(p.key)}
                  className={
                    active
                      ? "rounded-full border border-teal bg-teal-bg px-3 py-1 text-xs font-bold text-teal-dark"
                      : "rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted"
                  }
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          {PERM_OPTIONS.map((p) => (
            <input key={p.key} type="hidden" name={`perm_${p.key}`} value={perms[p.key] ? "on" : ""} />
          ))}
              <div className="mt-3">
                <label className="mb-1 block text-[11px] font-semibold text-muted">סניפים נוספים שהלקוחות שלהם יוצגו גם למשתמש זה</label>
                <div className="flex flex-wrap gap-2">
                  {branches.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => toggleViewBranch(b.id)}
                      className={
                        viewBranches.includes(b.id)
                          ? "rounded-full border border-teal bg-teal-bg px-3 py-1 text-xs font-bold text-teal-dark"
                          : "rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted"
                      }
                    >
                      {b.name}
                    </button>
                  ))}
                </div>
                {branches.map((b) => (
                  <input
                    key={b.id}
                    type="hidden"
                    name={`viewBranch_${b.id}`}
                    value={viewBranches.includes(b.id) ? "on" : ""}
                  />
                ))}
              </div>
        </div>
      )}

      <button
        type="submit"
        className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        {submitLabel}
      </button>
    </form>
  );
}
