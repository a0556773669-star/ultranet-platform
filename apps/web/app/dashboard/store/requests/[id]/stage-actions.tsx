"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { StoreRequestStatus } from "@ultranet/shared-types";
import type { ActionResult } from "@/lib/action-result";
import {
  closeDealAction,
  confirmStockAction,
  markDeliveredAction,
  markShippedAction,
  noStockAction,
  requestStockCheckAction,
  setStoreRequestStatusAction,
} from "../../actions";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

type Props = {
  id: string;
  status: StoreRequestStatus;
  isOwner: boolean;
  options: { label: string }[];
  finalPriceILS?: number;
  accessoriesFinalILS?: number;
  hasAccessories: boolean;
  /** העמלה הצפויה לסניף על ההזמנה (ברירת מחדל לפי הכללים, או מה שהבעלים קבע) */
  expectedCommissionILS: number;
  commissionOverridden: boolean;
};

/** הפעולה הבאה בשרשרת (מהצעה לעסקה) - לסניף או לבעלים, לפי הסטטוס. */
export function StageActions({ id, status, isOwner, options, finalPriceILS, accessoriesFinalILS, hasAccessories, expectedCommissionILS, commissionOverridden }: Props) {
  const [collectedBy, setCollectedBy] = useState<"branch" | "owner">("branch");
  const [method, setMethod] = useState<"cash" | "card" | "transfer">("cash");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");

  function run(fn: () => Promise<ActionResult<void>>) {
    setError("");
    startTransition(async () => {
      try {
        const res = await fn();
        if (!res.ok) {
          setError(res.error);
          return;
        }
        router.refresh();
      } catch {
        setError("אירעה שגיאה בחיבור לשרת (ייתכן שהפעולה ארכה מדי). רעננו את הדף ובדקו אם הפעולה בוצעה.");
      }
    });
  }

  const err = error ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{error}</div> : null;

  if (status === "answered" && options.length) {
    return (
      <div className="card flex flex-col gap-2">
        <h2 className="text-base font-bold text-ink">הלקוח החליט?</h2>
        <p className="text-xs text-muted">בוחרים את האפשרות שהלקוח אישר. הבקשה עוברת אלינו לבדיקת מלאי, ונחזיר מחיר סופי.</p>
        <div className="flex flex-wrap gap-2">
          {options.map((o, i) => (
            <button key={i} type="button" disabled={pending} onClick={() => run(() => requestStockCheckAction(id, i))} className="btn-primary disabled:opacity-40">
              הלקוח מאשר: {o.label} - בדיקת מלאי
            </button>
          ))}
        </div>
        {err}
      </div>
    );
  }

  if (status === "stock_check") {
    if (!isOwner) return <div className="card text-sm text-muted">בדיקת המלאי אצלנו. נחזור עם מחיר סופי.</div>;
    return (
      <form
        className="card flex flex-col gap-2"
        action={(fd) => run(() => confirmStockAction(id, fd))}
      >
        <h2 className="text-base font-bold text-ink">בדיקת מלאי (הנהלה)</h2>
        <input name="finalPriceILS" inputMode="numeric" placeholder="מחיר סופי למחשב ₪" className={FIELD} />
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">עמלת הסניף על ההזמנה הזו (₪) - ניתן לעדכן לפני השליחה</label>
          <input name="commissionOverrideILS" defaultValue={expectedCommissionILS} inputMode="numeric" className={FIELD} />
        </div>
        {hasAccessories ? <input name="accessoriesFinalILS" inputMode="numeric" placeholder="מחיר סופי לציוד נלווה ₪ (אם יש)" className={FIELD} /> : null}
        <input name="stockNote" placeholder="הערה לסניף / סיבה אם אין מלאי (רשות)" className={FIELD} />
        <div className="flex gap-2">
          <button type="submit" disabled={pending} className="btn-primary disabled:opacity-40">אישור מלאי + מחיר סופי</button>
          <button type="button" disabled={pending} className="btn-outline" onClick={(e) => { const fd = new FormData((e.currentTarget.form as HTMLFormElement)); run(() => noStockAction(id, fd)); }}>
            אין מלאי
          </button>
        </div>
        {err}
      </form>
    );
  }

  if (status === "stock_confirmed") {
    if (isOwner) return <div className="card text-sm text-muted">ממתינים שהסניף יסגור את העסקה עם הלקוח.</div>;
    const total = (finalPriceILS ?? 0) + (accessoriesFinalILS ?? 0);
    return (
      <div className="card flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink">יש מלאי - סגירת עסקה</h2>
        <p className="text-sm text-ink">
          המחיר הסופי ללקוח: <b>{total.toLocaleString("he-IL")} ₪</b>
          {accessoriesFinalILS ? <span className="text-xs text-muted"> (כולל ציוד נלווה {accessoriesFinalILS.toLocaleString("he-IL")} ₪)</span> : null}. סוגרים עם הלקוח במחיר הזה.
        </p>
        <p className="text-sm text-ink">
          העמלה שלכם על העסקה (אם אתם גובים): <b className="text-teal-dark">{expectedCommissionILS.toLocaleString("he-IL")} ₪</b>
          {commissionOverridden ? <span className="text-xs text-muted"> (נקבעה להזמנה זו)</span> : null}
        </p>
        <div>
          <div className="mb-1 text-xs font-semibold text-muted">מי גובה את הכסף?</div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setCollectedBy("branch")} className={collectedBy === "branch" ? "pill-active" : "pill-inactive"}>הסניף גובה (זכאי לעמלה)</button>
            <button type="button" onClick={() => setCollectedBy("owner")} className={collectedBy === "owner" ? "pill-active" : "pill-inactive"}>הנהלה גובה ישירות</button>
          </div>
        </div>
        {collectedBy === "branch" ? (
          <div>
            <div className="mb-1 text-xs font-semibold text-muted">באיזה אמצעי נגבה?</div>
            <div className="flex flex-wrap gap-2">
              {([["cash", "מזומן"], ["card", "אשראי"], ["transfer", "העברה"]] as const).map(([k, label]) => (
                <button key={k} type="button" onClick={() => setMethod(k)} className={method === k ? "pill-active" : "pill-inactive"}>{label}</button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">הסכום שגבתם נכנס להתחשבנות החודשית מול הנהלה, והעמלה שלכם על העסקה מופחתת ממנו אוטומטית.</p>
          </div>
        ) : null}
        <p className="text-xs text-muted">אחרי הסגירה המחשב יוצא אליכם במשלוח ויגיע לסניף בעוד כמה ימים. מומלץ להגיד ללקוח שזה ייקח כמה ימים.</p>
        <button type="button" disabled={pending} onClick={() => run(() => closeDealAction(id, { collectedBy, method: collectedBy === "branch" ? method : undefined }))} className="btn-primary w-fit disabled:opacity-40">
          סגרתי את העסקה
        </button>
        {err}
      </div>
    );
  }

  if (status === "deal_closed") {
    if (!isOwner) return <div className="card text-sm text-muted">העסקה נסגרה. אנחנו מוציאים משלוח לסניף.</div>;
    return (
      <form className="card flex flex-col gap-2" action={(fd) => run(() => markShippedAction(id, fd))}>
        <h2 className="text-base font-bold text-ink">הוצאת משלוח (הנהלה)</h2>
        <input name="shippingNote" placeholder="מספר מעקב / חברת שילוח (רשות)" className={FIELD} />
        <button type="submit" disabled={pending} className="btn-primary disabled:opacity-40">סימון ״נשלח לסניף״</button>
        {err}
      </form>
    );
  }

  if (status === "shipped") {
    if (isOwner) return <div className="card text-sm text-muted">נשלח. ממתינים שהסניף יאשר קבלה.</div>;
    return (
      <div className="card flex flex-col gap-2">
        <h2 className="text-base font-bold text-ink">המחשב בדרך</h2>
        <button type="button" disabled={pending} onClick={() => run(() => markDeliveredAction(id))} className="btn-primary disabled:opacity-40">
          המחשב התקבל בסניף
        </button>
        {err}
      </div>
    );
  }

  if (status === "delivered") {
    return (
      <div className="card flex flex-col gap-2 text-sm">
        <h2 className="text-base font-bold text-ink">מכינים את המחשב ללקוח</h2>
        <p className="text-ink">מתקינים לפי ההדרכות והנהלים בחנות, ומוסרים ללקוח.</p>
        <Link href="/dashboard/store" className="font-semibold text-teal hover:underline">לנהלים ולהדרכות ההתקנה</Link>
        {isOwner ? (
          <button type="button" disabled={pending} onClick={() => run(() => setStoreRequestStatusAction(id, "closed"))} className="btn-outline w-fit disabled:opacity-40">
            סגירת הבקשה
          </button>
        ) : null}
        {err}
      </div>
    );
  }

  return null;
}
