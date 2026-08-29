import Link from "next/link";
import type { AccountingBook } from "@/lib/accounting-overview";
import { BOOK_LABEL, BOOK_SHORT } from "@/lib/accounting-overview";
import { money } from "./ui";

export interface BookSummary {
  book: AccountingBook;
  branchCount: number;
  runningCount: number;
  income: number;
  expense: number;
}

const STYLE: Record<AccountingBook, { border: string; bg: string; text: string; pill: string }> = {
  rentals: { border: "border-[#2563eb]", bg: "bg-[#f7faff]", text: "text-[#1d4fb8]", pill: "bg-[#e8effc] text-[#1d4fb8]" },
  rooms: { border: "border-[#6b3fa0]", bg: "bg-[#faf8fe]", text: "text-[#6b3fa0]", pill: "bg-[#f1ecfa] text-[#6b3fa0]" },
};

/**
 * The two books, side by side, as the way into the screen.
 * Their numbers are deliberately never added together anywhere: each branch sits in exactly one
 * book, so a combined total would only invite counting the same money twice.
 */
export function BookSwitcher({
  summaries,
  active,
  hrefFor,
  monthLabel,
}: {
  summaries: BookSummary[];
  active: AccountingBook;
  hrefFor: (book: AccountingBook) => string;
  monthLabel: string;
}) {
  return (
    <div className="mb-3.5 grid grid-cols-1 gap-2.5 lg:grid-cols-2">
      {summaries.map((s) => {
        const st = STYLE[s.book];
        const on = s.book === active;
        return (
          <Link
            key={s.book}
            href={hrefFor(s.book)}
            className={`rounded-card border-2 p-3.5 shadow-card transition ${
              on ? `${st.border} ${st.bg}` : "border-card-border bg-white hover:border-[#c7d0dd]"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className={`text-[15px] font-black ${st.text}`}>{BOOK_LABEL[s.book]}</div>
                <div className="mt-px text-[11px] text-muted">
                  {s.branchCount} סניפים · {s.runningCount} פעילים · {monthLabel}
                </div>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${st.pill}`}>
                {BOOK_SHORT[s.book]}
              </span>
            </div>
            <div className="mt-2.5 grid grid-cols-3 gap-2 border-t border-dashed border-card-border pt-2.5">
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted">הכנסות</span>
                <span className="text-[15px] font-black tabular-nums text-emerald-600">{money(s.income)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted">הוצאות</span>
                <span className="text-[15px] font-black tabular-nums text-red-600">{money(s.expense)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-muted">רווח</span>
                <span className="text-[15px] font-black tabular-nums text-teal-dark">
                  {money(s.income - s.expense)}
                </span>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
