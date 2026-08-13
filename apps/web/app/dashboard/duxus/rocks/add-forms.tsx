"use client";

import { useState } from "react";
import { ROCK_OWNERS } from "./owners";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

function OwnerSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
    >
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
  onSubmit: (title: string, description: string, ownerName: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [ownerName, setOwnerName] = useState("");

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-dashed border-card-border bg-white p-3">
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={placeholder} className={FIELD} />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="תיאור (רשות)"
        rows={2}
        className={FIELD}
      />
      <div className="flex flex-wrap items-center gap-2">
        <OwnerSelect value={ownerName} onChange={setOwnerName} />
        <button
          type="button"
          onClick={() => {
            if (!title.trim()) return;
            onSubmit(title, description, ownerName);
            setTitle("");
            setDescription("");
            setOwnerName("");
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

export function AddMilestoneForm({
  placeholder = "שם אבן הדרך",
  onSubmit,
  onCancel,
}: {
  placeholder?: string;
  onSubmit: (title: string, ownerName: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [ownerName, setOwnerName] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-card-border bg-white p-2">
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={placeholder}
        className="min-w-[160px] flex-1 rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-1.5 text-sm focus:border-teal focus:bg-white focus:outline-none"
      />
      <OwnerSelect value={ownerName} onChange={setOwnerName} />
      <button
        type="button"
        onClick={() => {
          if (!title.trim()) return;
          onSubmit(title, ownerName);
          setTitle("");
          setOwnerName("");
        }}
        className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-3 py-1.5 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
      >
        הוספה
      </button>
      <button type="button" onClick={onCancel} className="text-xs font-semibold text-muted hover:underline">
        ביטול
      </button>
    </div>
  );
}
