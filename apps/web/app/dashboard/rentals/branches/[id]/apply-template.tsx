"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/toast";
import { applyBranchTemplateAction } from "../templates/actions";

/**
 * "החלת תבנית" בכרטיס סניף חדש (מסמך המשך סעיף 50). שני אישורים מפורשים לכל היותר:
 * אישור ההחלה עצמה, ואם השרת מוצא שהתבנית כבר הוחלה על הסניף — אישור נוסף להחלה חוזרת.
 */
export function ApplyTemplate({
  branchId,
  branchName,
  templates,
}: {
  branchId: string;
  branchName: string;
  templates: { id: string; name: string; steps: number }[];
}) {
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function apply() {
    const t = templates.find((x) => x.id === templateId);
    if (!t) return;
    if (!confirm(`להחיל את "${t.name}" על ${branchName}? ייווצרו ${t.steps} משימות חדשות ב"משימות ליוני".`)) return;
    startTransition(async () => {
      try {
        let r = await applyBranchTemplateAction(branchId, t.id, false);
        if (!r.ok && r.needsConfirm) {
          if (!confirm(r.message)) return;
          r = await applyBranchTemplateAction(branchId, t.id, true);
        }
        if (r.ok) {
          showSuccess(`נוצרו ${r.created ?? 0} משימות`);
          router.refresh();
        } else showError(r.message);
      } catch (e) {
        showError(e instanceof Error ? e.message : "אירעה שגיאה");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={templateId}
        onChange={(e) => setTemplateId(e.target.value)}
        className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:outline-none"
      >
        {templates.map((t) => (
          <option key={t.id} value={t.id}>{`${t.name} (${t.steps} צעדים)`}</option>
        ))}
      </select>
      <button type="button" onClick={apply} disabled={isPending || !templateId} className="btn-outline disabled:opacity-50">
        {"החלת תבנית"}
      </button>
      {toastNode}
    </div>
  );
}
