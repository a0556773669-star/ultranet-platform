"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AppUser, Branch, PermissionKey, UserAssignment, UserRole } from "@ultranet/shared-types";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";
const CHIP_ON = "rounded-full border border-teal bg-teal-bg px-3 py-1 text-xs font-bold text-teal-dark";
const CHIP_OFF = "rounded-full border border-card-border bg-[#f4f6f9] px-3 py-1 text-xs font-bold text-muted";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "employee", label: "עובד" },
  { value: "partner", label: "שותף" },
  { value: "owner", label: "בעלים" },
];

const PERM_OPTIONS: { key: PermissionKey; label: string; hint?: string }[] = [
  { key: "branches", label: "סניפים", hint: "ניהול סניפים — לשותף בלבד" },
  { key: "computers", label: "מלאי", hint: "עדכון מלאי ומשימות בחדר המחשבים" },
  { key: "tasks", label: "משימות", hint: "מסך המשימות בלבד, בלי המלאי" },
  { key: "rentals", label: "השכרות" },
  { key: "coworking", label: "משרד שיתופי" },
  { key: "accounting", label: "הנה\"ח" },
  { key: "charging", label: "סליקה וקבלות" },
  { key: "shop", label: "חנות AI" },
  { key: "duxus", label: "משימות ונהלים" },
];

const BRANCH_TYPE_LABEL: Record<string, string> = {
  computers: "חדר מחשבים",
  rentals: "השכרות",
  coworking: "משרד שיתופי",
};

type DraftAssignment = { role: UserRole; branchId: string; perms: Partial<Record<PermissionKey, boolean>> };

function toDraft(a: UserAssignment): DraftAssignment {
  return { role: a.role, branchId: a.branchId ?? "", perms: { ...(a.perms ?? {}) } };
}

/** השיוכים ההתחלתיים: הרשימה החדשה אם קיימת, אחרת השדות הישנים כשיוך יחיד. */
function initialAssignments(initial?: Partial<AppUser>): DraftAssignment[] {
  if (initial?.assignments?.length) return initial.assignments.map(toDraft);
  if (!initial) return [{ role: "employee", branchId: "", perms: {} }];
  return [{ role: initial.role ?? "employee", branchId: initial.branchId ?? "", perms: { ...(initial.perms ?? {}) } }];
}

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
  const [assignments, setAssignments] = useState<DraftAssignment[]>(() => initialAssignments(initial));
  const [viewBranches, setViewBranches] = useState<string[]>(initial?.viewClientBranchIds ?? []);

  const patch = (index: number, next: Partial<DraftAssignment>) =>
    setAssignments((prev) => prev.map((a, i) => (i === index ? { ...a, ...next } : a)));

  const togglePerm = (index: number, key: PermissionKey) =>
    setAssignments((prev) =>
      prev.map((a, i) => (i === index ? { ...a, perms: { ...a.perms, [key]: !a.perms[key] } } : a)),
    );

  const addAssignment = () =>
    setAssignments((prev) => [...prev, { role: "employee", branchId: "", perms: {} }]);

  const removeAssignment = (index: number) =>
    setAssignments((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== index)));

  const toggleViewBranch = (id: string) =>
    setViewBranches((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // סוג הסניף נשלח יחד עם כל שיוך: הוא מה שמכריע איזה תפקיד חל באיזה מודול (`resolveModuleScope`).
  const payload = assignments.map((a) => ({
    role: a.role,
    branchId: a.branchId,
    branchType: branches.find((b) => b.id === a.branchId)?.branchType,
    perms: a.perms,
  }));

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

      <div className="flex flex-col gap-3">
        <div>
          <span className="text-xs font-semibold text-muted">תפקידים</span>
          <p className="mt-0.5 text-[11px] text-muted">
            לאותו אדם אפשר לתת כמה תפקידים — למשל שותף שמנהל סניף השכרות וגם עובד בחדר מחשבים.
            בכל מודול יחול התפקיד של הסניף מאותו סוג.
          </p>
        </div>

        {assignments.map((assignment, index) => (
          <div key={index} className="rounded-card border border-card-border bg-[#fafbfc] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold text-ink">תפקיד {index + 1}</span>
              {assignments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeAssignment(index)}
                  className="flex items-center gap-1 rounded-lg border border-card-border px-2 py-1 text-[11px] font-bold text-muted transition hover:border-red-400 hover:text-red-500"
                >
                  <Trash2 className="h-3 w-3" />
                  הסרה
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={LABEL}>תפקיד</label>
                <select
                  value={assignment.role}
                  onChange={(e) => patch(index, { role: e.target.value as UserRole })}
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
                <select
                  value={assignment.branchId}
                  onChange={(e) => patch(index, { branchId: e.target.value })}
                  className={FIELD}
                >
                  <option value="">בחר סניף</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                      {b.branchType ? ` · ${BRANCH_TYPE_LABEL[b.branchType] ?? b.branchType}` : ""}
                    </option>
                  ))}
                </select>
                {assignment.role === "owner" && (
                  <p className="mt-1 text-[11px] text-muted">
                    בעלים משויך לכל הסניפים בכל מקום במערכת. הבחירה כאן משמשת רק כברירת מחדל בעת פתיחת השכרה חדשה - עדיין ניתן לבחור כל סניף אחר בטופס ההשכרה עצמו.
                  </p>
                )}
              </div>
            </div>

            {assignment.role !== "owner" && (
              <div className="mt-3">
                <label className={LABEL}>הרשאות מודולים</label>
                <div className="flex flex-wrap gap-2">
                  {PERM_OPTIONS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      title={p.hint}
                      onClick={() => togglePerm(index, p.key)}
                      className={assignment.perms[p.key] ? CHIP_ON : CHIP_OFF}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                {assignment.role === "employee" && (
                  <p className="mt-2 text-[11px] text-muted">
                    עובד מתפעל בלבד: בחדרי מחשבים הוא מגיע למלאי ולמשימות, ולא להוצאות, לניהול
                    הסניפים או להנהלת החשבונות של הסניף — אלה נשארים לשותף שמנהל אותו.
                  </p>
                )}
              </div>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addAssignment}
          className="flex items-center gap-1.5 self-start rounded-lg border border-dashed border-card-border px-3 py-2 text-xs font-bold text-muted transition hover:border-teal hover:text-teal"
        >
          <Plus className="h-3.5 w-3.5" />
          הוספת תפקיד נוסף
        </button>
      </div>

      <input type="hidden" name="assignments" value={JSON.stringify(payload)} />

      {!assignments.every((a) => a.role === "owner") && (
        <div>
          <label className="mb-1 block text-[11px] font-semibold text-muted">
            סניפים נוספים שהלקוחות שלהם יוצגו גם למשתמש זה
          </label>
          <div className="flex flex-wrap gap-2">
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => toggleViewBranch(b.id)}
                className={viewBranches.includes(b.id) ? CHIP_ON : CHIP_OFF}
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
