"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Plus, X } from "lucide-react";
import type { PersonalTaskPriority } from "@ultranet/shared-types";
import { PERSONAL_PRIORITIES, PERSONAL_PRIORITY_LABEL } from "./personal-task-ui";
import { findPersonalDuplicates, type DuplicateHit, type PersonalTaskInput } from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

const EMPTY: PersonalTaskInput = { title: "", description: "", contactName: "", contactPhone: "", priority: "normal", dueDate: "", dueTime: "" };

/**
 * הזנה מהירה (סעיף 6): הסמן יושב מיד בכותרת, `Ctrl/Cmd + Enter` שומר, והחלונית
 * נשארת פתוחה אחרי שמירה כדי להזין משימה נוספת - זה בדיוק מה שהמזכירה עושה
 * כשהיא מקבלת כמה פניות ברצף.
 *
 * כותרת היא השדה היחיד שחובה למלא (סעיף 20). אזהרת הכפילות ואזהרת היציאה ללא
 * שמירה מודיעות ואינן חוסמות.
 */
export function QuickAdd({
  open,
  onClose,
  onCreate,
  onOpenTask,
}: {
  open: boolean;
  onClose: () => void;
  onCreate: (input: PersonalTaskInput) => Promise<boolean>;
  onOpenTask: (id: string) => void;
}) {
  const [form, setForm] = useState<PersonalTaskInput>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [duplicates, setDuplicates] = useState<DuplicateHit[]>([]);
  const [savedCount, setSavedCount] = useState(0);
  const titleRef = useRef<HTMLInputElement>(null);

  const dirty = Boolean(form.title || form.description || form.contactName || form.contactPhone || form.dueDate);

  useEffect(() => {
    if (!open) return;
    setForm(EMPTY);
    setError("");
    setDuplicates([]);
    setSavedCount(0);
    // מיקוד מיידי בכותרת - הזנה בלי לחיצות מיותרות.
    const timer = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(timer);
  }, [open]);

  // בדיקת כפילות מושהית, כדי לא לשלוח בקשה על כל הקשה.
  useEffect(() => {
    if (!open) return;
    const title = form.title?.trim() ?? "";
    const phone = form.contactPhone?.trim() ?? "";
    if (title.length < 3 && phone.length < 7) {
      setDuplicates([]);
      return;
    }
    const timer = setTimeout(() => {
      findPersonalDuplicates(title, phone).then(setDuplicates).catch(() => setDuplicates([]));
    }, 500);
    return () => clearTimeout(timer);
  }, [open, form.title, form.contactPhone]);

  function set<K extends keyof PersonalTaskInput>(key: K, value: PersonalTaskInput[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function save() {
    if (saving) return;
    if (!form.title?.trim()) {
      setError("יש להזין כותרת למשימה");
      titleRef.current?.focus();
      return;
    }
    setSaving(true);
    setError("");
    const ok = await onCreate({ ...form, title: form.title.trim() });
    setSaving(false);
    if (!ok) {
      setError("השמירה נכשלה. יש לנסות שוב.");
      return;
    }
    // סעיף 17: לא מציגים הצלחה לפני שהשרת אישר. רק אחרי אישור מנקים את הטופס.
    setSavedCount((n) => n + 1);
    setForm(EMPTY);
    setDuplicates([]);
    titleRef.current?.focus();
  }

  function requestClose() {
    if (dirty && !window.confirm("יש טקסט שלא נשמר. לסגור בכל זאת?")) return;
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/30 p-4 pt-16" role="dialog" aria-modal="true">
      <div
        className="w-full max-w-lg rounded-card border border-card-border bg-white p-4 shadow-card"
        onKeyDown={(e) => {
          if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault();
            void save();
          }
          if (e.key === "Escape") requestClose();
        }}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-extrabold text-ink">משימה חדשה</h2>
          <button type="button" onClick={requestClose} aria-label="סגירה" className="rounded-md p-1 text-muted transition hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-2.5">
          <label className="text-xs font-bold text-muted">
            כותרת <span className="text-red-600">*</span>
            <input
              ref={titleRef}
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="מה צריך לעשות"
              className={`mt-1 ${FIELD}`}
            />
          </label>

          {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}

          {duplicates.length > 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <p className="mb-1 flex items-center gap-1 font-bold">
                <AlertTriangle className="h-3.5 w-3.5" />
                יש כבר משימה פעילה דומה
              </p>
              {duplicates.map((hit) => (
                <button
                  key={hit.id}
                  type="button"
                  onClick={() => onOpenTask(hit.id)}
                  className="block text-right underline underline-offset-2 hover:opacity-80"
                >
                  {hit.title}
                  {hit.contactName ? ` · ${hit.contactName}` : ""}
                </button>
              ))}
              <p className="mt-1 font-normal">אפשר לשמור בכל זאת.</p>
            </div>
          ) : null}

          <label className="text-xs font-bold text-muted">
            פירוט
            <textarea
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              rows={2}
              placeholder="נוסח ההודעה או פרטי השיחה"
              className={`mt-1 ${FIELD}`}
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-bold text-muted">
              שם הפונה
              <input value={form.contactName} onChange={(e) => set("contactName", e.target.value)} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="text-xs font-bold text-muted">
              טלפון
              <input
                value={form.contactPhone}
                onChange={(e) => set("contactPhone", e.target.value)}
                dir="ltr"
                inputMode="tel"
                className={`mt-1 ${FIELD} text-right`}
              />
            </label>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <label className="text-xs font-bold text-muted">
              דחיפות
              <select
                value={form.priority}
                onChange={(e) => set("priority", e.target.value as PersonalTaskPriority)}
                className={`mt-1 ${FIELD}`}
              >
                {PERSONAL_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {PERSONAL_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs font-bold text-muted">
              תאריך יעד
              <input type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={`mt-1 ${FIELD}`} />
            </label>
            <label className="text-xs font-bold text-muted">
              שעה
              <input
                type="time"
                value={form.dueTime}
                onChange={(e) => set("dueTime", e.target.value)}
                disabled={!form.dueDate}
                className={`mt-1 ${FIELD} disabled:opacity-50`}
              />
            </label>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving}
              className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              {saving ? "שומר..." : "שמירה"}
            </button>
            <button type="button" onClick={requestClose} className="btn-outline">
              סגירה
            </button>
            <span className="text-[11px] text-muted">
              {savedCount > 0 ? `נשמרו ${savedCount} · ` : ""}
              Ctrl/⌘ + Enter לשמירה
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
