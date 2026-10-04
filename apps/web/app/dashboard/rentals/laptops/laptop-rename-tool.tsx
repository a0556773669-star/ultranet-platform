"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Type } from "lucide-react";
import { Modal } from "@/components/modal";
import { useToast } from "@/lib/toast";
import { applyLaptopRenameAction, previewLaptopRenameAction, type RenamePlanRow } from "./actions";

/**
 * "האחדת שמות" — הופך כל שם קיים ל"מחשב N" / "מחשב N גרפיקה" (בעלים בלבד).
 *
 * קודם תצוגה מקדימה של מה ישתנה, ורק אז החלה: שינוי שם של עשרות מחשבים בלחיצה אחת הוא בדיוק
 * הפעולה שצריך לראות לפני שעושים. שם בלי אף מספר לא ניתן לנרמול, ומוצג כדי לתקן ידנית.
 */
export function LaptopRenameTool({ branchNames }: { branchNames: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const [plan, setPlan] = useState<RenamePlanRow[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function openPreview() {
    setOpen(true);
    setPlan(null);
    startTransition(async () => {
      try {
        setPlan(await previewLaptopRenameAction());
      } catch (e) {
        showError(e instanceof Error ? e.message : "אירעה שגיאה");
        setOpen(false);
      }
    });
  }

  function apply() {
    startTransition(async () => {
      try {
        const { renamed, skipped } = await applyLaptopRenameAction();
        router.refresh();
        setOpen(false);
        showSuccess(`שמות ${renamed} מחשבים עודכנו${skipped ? ` · ${skipped} דורשים תיקון ידני` : ""}`);
      } catch (e) {
        showError(e instanceof Error ? e.message : "אירעה שגיאה");
      }
    });
  }

  const fixable = plan?.filter((r) => r.to) ?? [];
  const broken = plan?.filter((r) => !r.to) ?? [];

  return (
    <>
      <button
        type="button"
        onClick={openPreview}
        className="flex items-center gap-1.5 rounded-[10px] border border-card-border bg-white px-4 py-2 text-xs font-bold text-ink hover:bg-[#f4f6f9]"
        title='משנה את כל השמות לפורמט אחד: "מחשב 145" / "מחשב 56 גרפיקה"'
      >
        <Type className="h-3.5 w-3.5" />
        האחדת שמות
      </button>
      {open && (
        <Modal title="האחדת שמות המחשבים" icon={Type} onClose={() => setOpen(false)} wide>
          {!plan ? (
            <p className="py-6 text-center text-sm text-muted">טוען...</p>
          ) : plan.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">כל השמות כבר בפורמט הנכון.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <p className="text-[12px] leading-relaxed text-muted">
                כל מחשב ייקרא &quot;מחשב&quot; + המספר שלו; מחשב שבשמו כתוב גרפיקה יקבל &quot;גרפיקה&quot; בסוף.
                גם שם הסטיק המקושר יתעדכן (&quot;סטיק N&quot;).
              </p>
              {fixable.length > 0 && (
                <div className="max-h-[45vh] overflow-y-auto rounded-lg border border-card-border">
                  <table className="w-full text-right text-[12.5px]">
                    <thead className="sticky top-0 bg-[#f4f6f9] text-[11px] font-bold text-muted">
                      <tr>
                        <th className="px-2.5 py-1.5">סניף</th>
                        <th className="px-2.5 py-1.5">היום</th>
                        <th className="px-2.5 py-1.5">אחרי</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fixable.map((r) => (
                        <tr key={r.id} className="border-t border-card-border">
                          <td className="px-2.5 py-1.5 text-muted">{branchNames[r.branchId] ?? "-"}</td>
                          <td className="px-2.5 py-1.5 text-ink">{r.from || "—"}</td>
                          <td className="px-2.5 py-1.5 font-bold text-teal-dark">{r.to}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {broken.length > 0 && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                  בשמות האלה אין מספר ולכן הם לא ישתנו — יש להיכנס לעריכה ולהזין מספר:{" "}
                  <b>{broken.map((r) => r.from || "(ללא שם)").join(", ")}</b>
                </p>
              )}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={apply}
                  disabled={isPending || fixable.length === 0}
                  className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
                >
                  {isPending ? "מעדכן..." : `עדכון ${fixable.length} שמות`}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink hover:bg-[#f4f6f9]"
                >
                  ביטול
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
      {toastNode}
    </>
  );
}
