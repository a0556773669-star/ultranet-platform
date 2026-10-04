"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteQuarterAction, getQuarterDeletionSummary, type QuarterDeletionSummary } from "./actions";
import { DeleteDialog } from "./delete-dialog";
import { useToast } from "@/lib/toast";

/**
 * מחיקת רבעון לצמיתות - הרבעון, הסלעים שלו, אבני הדרך שנולדו בו, השיוכים,
 * סיכומי הישיבות והיומן. פעולה בלתי הפיכה, ולכן הדיאלוג טוען קודם את המספרים
 * האמיתיים מהשרת ודורש הקלדת המילה "מחיקה".
 *
 * הארכוב (בכפתור שלידו) נשאר האפשרות השמרנית: הרבעון הופך לקריאה בלבד ונשאר
 * שלם בהיסטוריה.
 */
export function DeleteQuarterButton({
  quarterKey,
  label,
  variant = "button",
  onDeleted,
}: {
  quarterKey: string;
  label: string;
  /** `icon` לשורה צפופה (ציר הזמן בארכיון), `button` לשורת הרבעון */
  variant?: "button" | "icon";
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [summary, setSummary] = useState<QuarterDeletionSummary | null>(null);

  function handleOpen() {
    setSummary(null);
    setOpen(true);
    void getQuarterDeletionSummary(quarterKey).then(setSummary);
  }

  function handleDelete() {
    setOpen(false);
    startTransition(async () => {
      const result = await deleteQuarterAction(quarterKey);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess(`"${label}" נמחק לצמיתות`);
      if (onDeleted) onDeleted();
      else router.push("/dashboard/duxus/rocks/archive");
      router.refresh();
    });
  }

  return (
    <>
      {toastNode}
      <button
        type="button"
        onClick={handleOpen}
        disabled={isPending}
        title="מחיקת הרבעון לצמיתות"
        className={
          variant === "icon"
            ? "rounded-lg border border-card-border p-1.5 text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
            : "flex items-center gap-1 rounded-lg border border-card-border px-3 py-1.5 text-xs font-semibold text-muted transition hover:border-red-300 hover:text-red-600 disabled:opacity-60"
        }
      >
        <Trash2 className="h-3.5 w-3.5" />
        {variant === "button" ? "מחיקה" : <span className="sr-only">מחיקה</span>}
      </button>

      {open && (
        <DeleteDialog
          title={`מחיקת הרבעון "${label}"`}
          lines={
            summary
              ? [
                  "הרבעון עצמו",
                  `${summary.rocks} סלעים ותתי-סלעים`,
                  `${summary.milestones} אבני דרך שנולדו ברבעון הזה`,
                  `${summary.assignments} שיוכי תקופה`,
                  `${summary.reviews} סיכומי ישיבה רבעונית`,
                  `${summary.activity} רישומים ביומן הפעולות`,
                ]
              : ["טוען את פירוט התכולה..."]
          }
          warning={
            summary?.sharedWithOtherQuarters
              ? `${summary.sharedWithOtherQuarters} אבני דרך מהרבעון הזה משובצות גם ברבעונים אחרים - הן ייעלמו גם משם. אבני דרך שהגיעו לכאן מרבעון אחר לא יימחקו; רק ההתחייבות אליהן כאן תרד.`
              : "אבני דרך שהגיעו לכאן מרבעון אחר לא יימחקו - רק ההתחייבות אליהן ברבעון הזה תרד."
          }
          archiveHint="ארכוב (בכפתור שליד) הופך את הרבעון לקריאה בלבד ומשאיר הכל בהיסטוריה. המחיקה כאן אינה הפיכה."
          permanentLabel="מחיקת הרבעון"
          requireTyping
          isPending={isPending}
          onPermanent={handleDelete}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
