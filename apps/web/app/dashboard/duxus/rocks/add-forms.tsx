"use client";

import { useState } from "react";
import { ROCK_OWNERS } from "./owners";
import type { MilestonePriority } from "@ultranet/shared-types";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const SMALL =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none";

function OwnerSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} aria-label="אחראי" className={SMALL}>
      <option value="">אחראי (רשות)</option>
      {ROCK_OWNERS.map((name) => (
        <option key={name} value={name}>
          {name}
        </option>
      ))}
    </select>
  );
}

export function AddRockForm({
  placeholder,
  onSubmit,
  onCancel,
}: {
  placeholder: string;
  onSubmit: (input: { title: string; description: string; ownerName: string; dueDate: string }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [dueDate, setDueDate] = useState("");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-card-border bg-white p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} className={FIELD} autoFocus />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="תיאור (רשות)"
        rows={2}
        className={FIELD}
      />
      <div className="flex flex-wrap items-center gap-2">
        <OwnerSelect value={ownerName} onChange={setOwnerName} />
        <label className="flex items-center gap-1 text-xs text-muted">
          יעד
          <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={SMALL} />
        </label>
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return;
            onSubmit({ title: title.trim(), description: description.trim(), ownerName, dueDate });
            setTitle("");
            setDescription("");
            setOwnerName("");
            setDueDate("");
          }}
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
        >
          שמירה
        </button>
        <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted hover:underline">
          ביטול
        </button>
      </div>
    </div>
  );
}

/**
 * הוספת אבן דרך בשורה אחת. האחראי אינו חובה ברבעון, אך **לפני שיבוץ לשבוע** השרת
 * ידרוש אותו (סעיף 14) - ולכן הטופס במסך השבוע מגיע עם `requireOwner`.
 */
export function AddMilestoneForm({
  placeholder = "שם אבן הדרך",
  requireOwner = false,
  onSubmit,
  onCancel,
}: {
  placeholder?: string;
  requireOwner?: boolean;
  onSubmit: (input: { title: string; ownerName: string; dueDate: string; priority: MilestonePriority }) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState<MilestonePriority>("normal");
  const blocked = !title.trim() || (requireOwner && !ownerName);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-card-border bg-white p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        autoFocus
        className="min-w-[160px] flex-1 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
      />
      <OwnerSelect value={ownerName} onChange={setOwnerName} />
      <select
        value={priority}
        onChange={(e) => setPriority(e.target.value as MilestonePriority)}
        aria-label="עדיפות"
        className={SMALL}
      >
        <option value="normal">עדיפות רגילה</option>
        <option value="high">עדיפות גבוהה</option>
        <option value="low">עדיפות נמוכה</option>
      </select>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} aria-label="תאריך יעד" className={SMALL} />
      <button
        type="button"
        disabled={blocked}
        title={requireOwner && !ownerName ? "לפני שיבוץ לשבוע יש לבחור אחראי" : undefined}
        onClick={() => {
          if (blocked) return;
          onSubmit({ title: title.trim(), ownerName, dueDate, priority });
          setTitle("");
          setOwnerName("");
          setDueDate("");
          setPriority("normal");
        }}
        className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-3 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
      >
        הוספה
      </button>
      <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted hover:underline">
        ביטול
      </button>
    </div>
  );
}
