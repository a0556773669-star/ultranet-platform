"use client";

import { useState } from "react";
import { X, Wrench, ChevronLeft } from "lucide-react";
import type { SetupCostItem } from "@ultranet/shared-types";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

/**
 * קוביית "עלות הקמה" — מספר אחד בלבד, והפירוט בחלון קטן שנפתח בלחיצה.
 *
 * הפירוט ישב קודם בתוך הקובייה עצמה, וסניף עם עשר שורות הקמה מתח את כל שורת הקוביות
 * לגובה שדחף את כל שאר המסך מטה. הוא עדיין נגיש בלחיצה אחת — רק לא על חשבון תמונת המצב.
 */
export function SetupCostCard({
  amount,
  items,
  fromAssets,
}: {
  amount: number;
  items: SetupCostItem[];
  fromAssets: boolean;
}) {
  const [open, setOpen] = useState(false);
  const detailed = items.length > 0;
  const listed = items.reduce((sum, i) => sum + i.amount, 0);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-card border border-card-border bg-white px-3 py-2.5 text-center shadow-card transition hover:border-teal"
      >
        <p className="flex items-center justify-center gap-1 text-[10.5px] font-bold uppercase tracking-wide text-muted">
          עלות הקמה
          <ChevronLeft className="h-3 w-3" />
        </p>
        <p className="mt-0.5 text-lg font-black leading-tight text-ink">{money(amount)}</p>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setOpen(false)}>
          <div
            className="max-h-[80vh] w-full max-w-sm overflow-y-auto rounded-card bg-white p-5 text-right shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
                <Wrench className="h-4 w-4" />
                עלות ההקמה
              </h2>
              <button type="button" onClick={() => setOpen(false)} className="text-muted transition hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-3 text-[11.5px] leading-relaxed text-muted">
              {fromAssets
                ? "המספר נקרא משכבת הנכסים — הציוד שבאמת נקנה ויושב בסניף, לפי סוג פריט."
                : "המספר מגיע מהשדה בטופס הסניף."}
            </p>

            {detailed ? (
              <table className="w-full border-collapse text-right text-[13px]">
                <tbody className="tabular-nums">
                  {items.map((item, idx) => (
                    <tr key={idx} className="border-b border-card-border last:border-b-0">
                      <td className="py-2 pl-2 text-muted">{item.label}</td>
                      <td className="py-2 text-left font-bold text-ink">{money(item.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-card-border tabular-nums">
                    <td className="py-2 pl-2 font-black text-ink">סה&quot;כ</td>
                    <td className="py-2 text-left font-black text-ink">{money(listed)}</td>
                  </tr>
                </tfoot>
              </table>
            ) : (
              <p className="rounded-lg bg-[#f4f6f9] p-3 text-[12.5px] text-muted">
                לא הוזן פירוט להקמה — יש רק סכום כולל של {money(amount)}.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
