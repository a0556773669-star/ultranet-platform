"use client";

import { useEffect, useState } from "react";

export type AcceptanceSection = { key: string; title: string; items: { id: string; text: string }[] };

/** סימוני הבדיקה — בדפדפן בלבד (לפי מייל), בלי שום כתיבה למסד הנתונים. */
export function AcceptanceChecklist({ email, sections }: { email: string; sections: AcceptanceSection[] }) {
  const key = `ultranet.acceptance.v1:${email.toLowerCase()}`;
  const [checked, setChecked] = useState<Record<string, boolean>>({});

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw) setChecked(JSON.parse(raw) as Record<string, boolean>);
    } catch {
      /* אחסון חסום או פגום — מתחילים ריק */
    }
  }, [key]);

  function persist(next: Record<string, boolean>) {
    setChecked(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      /* אחסון חסום — הסימון נשאר רק עד רענון */
    }
  }

  const total = sections.reduce((n, s) => n + s.items.length, 0);
  const done = sections.reduce((n, s) => n + s.items.filter((i) => checked[i.id]).length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[13px] text-muted">
        <span className="font-bold">{`נבדקו ${done} מתוך ${total}`}</span>
        {done > 0 && (
          <button
            type="button"
            onClick={() => confirm("לנקות את כל הסימונים?") && persist({})}
            className="pill-inactive"
          >
            {"איפוס"}
          </button>
        )}
      </div>
      {sections.map((s) => (
        <section key={s.key} className="card">
          <h2 className="mb-2 text-sm font-extrabold text-ink">{s.title}</h2>
          <ul className="flex flex-col">
            {s.items.map((i) => (
              <li key={i.id} className="border-b border-card-border last:border-b-0">
                <label className="flex cursor-pointer items-start gap-2 py-1.5 text-[13px]">
                  <input
                    type="checkbox"
                    checked={Boolean(checked[i.id])}
                    onChange={(e) => persist({ ...checked, [i.id]: e.target.checked })}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-teal"
                  />
                  <span className={checked[i.id] ? "text-muted line-through" : "text-ink"}>{i.text}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
