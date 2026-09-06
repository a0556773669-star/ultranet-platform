import { COUNTS_TO_MAIN_HINT, COUNTS_TO_MAIN_LABEL } from "@/lib/counts-to-main";

/**
 * הצ'קבוקס היחיד שמחליט אם השורה נכנסת להנה"ח הראשית.
 *
 * הוא נראה אותו דבר בכל טופס בכוונה - הוצאה שוטפת בחדר מחשבים, הוצאה על כמה סניפים,
 * תשלום במשרד השיתופי, הוצאה קבועה משתנה. זו אותה שאלה בכל מקום, ולכן זו אותה קוביה.
 * ראה `lib/counts-to-main.ts`.
 */
export function CountsToMainField({
  defaultChecked = false,
  className = "",
  name = "countsToMain",
}: {
  defaultChecked?: boolean;
  className?: string;
  name?: string;
}) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2 rounded-lg border border-card-border bg-[#f8fafc] px-3 py-2 ${className}`}
    >
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-0.5 h-4 w-4 shrink-0 accent-teal"
      />
      <span>
        <span className="block text-xs font-bold text-ink">{COUNTS_TO_MAIN_LABEL}</span>
        <span className="mt-0.5 block text-[11px] leading-snug text-muted">{COUNTS_TO_MAIN_HINT}</span>
      </span>
    </label>
  );
}

/** תגית קטנה לרשימות: האם השורה הזו מתחשבנת בראשי. */
export function CountsToMainBadge({ on }: { on: boolean }) {
  return (
    <span
      className={
        on
          ? "rounded-full bg-teal-bg px-2 py-0.5 text-[10px] font-extrabold text-teal-dark"
          : "rounded-full bg-[#f4f6f9] px-2 py-0.5 text-[10px] font-bold text-muted"
      }
      title={on ? 'נספר בהנה"ח הראשית' : 'נספר בסניף/במודול בלבד'}
    >
      {on ? 'ראשי' : 'סניף בלבד'}
    </span>
  );
}
