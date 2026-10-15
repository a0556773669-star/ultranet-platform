"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import type { BranchTemplate, BranchTemplateStep } from "@ultranet/shared-types";
import { useToast } from "@/lib/toast";
import { saveBranchTemplateAction, setBranchTemplateArchivedAction } from "./actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

type Draft = { id: string | null; name: string; steps: BranchTemplateStep[] };

function fmtDate(ms?: number) {
  return ms ? new Date(ms).toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" }) : "";
}

export function TemplatesClient({ templates }: { templates: BranchTemplate[] }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [paste, setPaste] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function updateStep(i: number, patch: Partial<BranchTemplateStep>) {
    setDraft((d) => (d ? { ...d, steps: d.steps.map((s, j) => (j === i ? { ...s, ...patch } : s)) } : d));
  }
  function moveUp(i: number) {
    setDraft((d) => {
      if (!d || i === 0) return d;
      const steps = [...d.steps];
      const [moved] = steps.splice(i, 1);
      if (moved) steps.splice(i - 1, 0, moved);
      return { ...d, steps };
    });
  }
  function removeStep(i: number) {
    setDraft((d) => (d ? { ...d, steps: d.steps.filter((_, j) => j !== i) } : d));
  }
  /** הדבקת רשימה (למשל מתוך נוהל קיים): כל שורה לא ריקה = צעד. */
  function addFromPaste() {
    const lines = paste
      .split("\n")
      .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, "").trim())
      .filter(Boolean);
    if (lines.length === 0) return;
    setDraft((d) => (d ? { ...d, steps: [...d.steps.filter((s) => s.title.trim()), ...lines.map((title) => ({ title }))] } : d));
    setPaste("");
  }

  function save() {
    if (!draft) return;
    startTransition(async () => {
      try {
        const r = await saveBranchTemplateAction(draft.id, { name: draft.name, steps: draft.steps });
        if (r.ok) {
          showSuccess("התבנית נשמרה ואושרה");
          setDraft(null);
          router.refresh();
        } else showError(r.message);
      } catch (e) {
        showError(e instanceof Error ? e.message : "אירעה שגיאה");
      }
    });
  }

  function toggleArchive(t: BranchTemplate) {
    const archive = !t.archivedAt;
    if (archive && !confirm(`להוציא משימוש את "${t.name}"? היא לא תוצע להחלה. משימות שכבר נוצרו ממנה לא משתנות.`)) return;
    startTransition(async () => {
      try {
        const r = await setBranchTemplateArchivedAction(t.id, archive);
        if (r.ok) {
          showSuccess(archive ? "התבנית הוצאה משימוש" : "התבנית חזרה לשימוש");
          router.refresh();
        } else showError(r.message);
      } catch (e) {
        showError(e instanceof Error ? e.message : "אירעה שגיאה");
      }
    });
  }

  if (draft) {
    return (
      <div className="card flex flex-col gap-3">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{"שם התבנית"}</label>
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className={FIELD} />
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-xs font-semibold text-muted">{"צעדים (לפי הסדר)"}</div>
          {draft.steps.map((s, i) => (
            <div key={i} className="flex items-start gap-2 rounded-lg border border-card-border p-2">
              <span className="mt-2 w-5 shrink-0 text-center text-[12px] font-bold text-muted">{i + 1}</span>
              <div className="flex flex-1 flex-col gap-1.5">
                <input
                  value={s.title}
                  placeholder="הצעד"
                  onChange={(e) => updateStep(i, { title: e.target.value })}
                  className={FIELD}
                />
                <input
                  value={s.note ?? ""}
                  placeholder="הערה (רשות)"
                  onChange={(e) => updateStep(i, { note: e.target.value })}
                  className={`${FIELD} text-[12.5px]`}
                />
              </div>
              <div className="flex flex-col gap-1">
                <button type="button" onClick={() => moveUp(i)} disabled={i === 0} className="rounded p-1 text-muted hover:bg-gray-100 disabled:opacity-30" aria-label="למעלה">
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => removeStep(i)} className="rounded p-1 text-muted hover:bg-gray-100 hover:text-red-600" aria-label="הסרת צעד">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setDraft({ ...draft, steps: [...draft.steps, { title: "" }] })}
            className="btn-outline flex w-fit items-center gap-1.5"
          >
            <Plus className="h-4 w-4" />
            {"צעד"}
          </button>
        </div>

        <details className="rounded-lg border border-card-border p-2 text-[13px]">
          <summary className="cursor-pointer font-bold text-muted">{"הדבקת רשימה (למשל מתוך נוהל קיים)"}</summary>
          <p className="mt-1 text-[12px] text-muted">{"כל שורה הופכת לצעד. מספור ותבליטים בתחילת שורה מוסרים."}</p>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} rows={5} className={`${FIELD} mt-1`} />
          <button type="button" onClick={addFromPaste} className="btn-outline mt-1">
            {"הוספה לצעדים"}
          </button>
        </details>

        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={isPending} className="btn-primary disabled:opacity-50">
            {"שמירה ואישור"}
          </button>
          <button type="button" onClick={() => setDraft(null)} disabled={isPending} className="btn-outline">
            {"ביטול"}
          </button>
        </div>
        {toastNode}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        onClick={() => setDraft({ id: null, name: "", steps: [{ title: "" }] })}
        className="flex w-fit items-center gap-1.5 rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        <Plus className="h-4 w-4" />
        {"תבנית חדשה"}
      </button>

      {templates.length === 0 ? (
        <div className="rounded-card border border-dashed border-card-border bg-white py-10 text-center text-muted">
          {"עדיין אין תבניות"}
        </div>
      ) : (
        templates.map((t) => (
          <div key={t.id} className={`card ${t.archivedAt ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[15px] font-extrabold text-ink">
                  {t.name}
                  {t.archivedAt ? <span className="mr-2 text-[11px] font-bold text-muted">{"הוצאה משימוש"}</span> : null}
                </div>
                <div className="text-[12px] text-muted">
                  {`${t.steps.length} צעדים${t.approvedAt ? ` · אושרה ${fmtDate(t.approvedAt)}${t.approvedBy ? ` ע"י ${t.approvedBy}` : ""}` : ""}`}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setDraft({ id: t.id, name: t.name, steps: t.steps.map((s) => ({ ...s })) })}
                  className="btn-outline flex items-center gap-1.5"
                >
                  <Pencil className="h-4 w-4" />
                  {"עריכה"}
                </button>
                <button type="button" onClick={() => toggleArchive(t)} disabled={isPending} className="btn-outline">
                  {t.archivedAt ? "החזרה לשימוש" : "הוצאה משימוש"}
                </button>
              </div>
            </div>
            <ol className="mt-2 list-inside list-decimal text-[13px] text-ink">
              {t.steps.map((s, i) => (
                <li key={i} className="py-0.5">
                  {s.title}
                  {s.note ? <span className="text-muted">{` — ${s.note}`}</span> : null}
                </li>
              ))}
            </ol>
          </div>
        ))
      )}
      {toastNode}
    </div>
  );
}
