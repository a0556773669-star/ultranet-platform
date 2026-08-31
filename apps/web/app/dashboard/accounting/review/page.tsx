import Link from "next/link";
import { ClipboardCheck, AlertTriangle } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { TX_COLLECTION } from "@/lib/tx";
import { TX_FLAG_LABEL, TX_FLAG_WHY, RECEIPT_REQUIRED_ABOVE, sortForReview } from "@/lib/expense-review";
import type { Branch, Transaction } from "@ultranet/shared-types";
import { AccountingTabs } from "../accounting-tabs";
import { markReviewedAction, markAllReviewedAction } from "./actions";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";
const TH = "bg-[#f4f6f9] px-2.5 py-2 text-right text-[10.5px] font-extrabold text-muted border-b border-card-border";
const TD = "px-2.5 py-2 border-b border-[#eef1f6] text-[12.5px]";

export const dynamic = "force-dynamic";

export default async function ReviewPage() {
  await requireOwner();
  const db = getAdminFirestore();

  const [txSnap, branchesSnap] = await Promise.all([
    db.collection(TX_COLLECTION).get(),
    db.collection("n_branches").get(),
  ]);

  const branchName = new Map(
    branchesSnap.docs.map((d) => [d.id, (d.data() as Branch).name ?? d.id]),
  );

  const all = txSnap.docs.map((d) => ({ ...(d.data() as Omit<Transaction, "id">), id: d.id }) as Transaction);
  // Only rows a branch manager entered themselves - the owner's own entries need no review.
  const entered = all.filter((t) => !!t.enteredBy);
  const pending = sortForReview(entered.filter((t) => !t.reviewedAt));
  const flaggedCount = pending.filter((t) => (t.flags?.length ?? 0) > 0).length;
  const pendingTotal = pending.reduce((sum, t) => sum + (t.amount || 0), 0);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
            <ClipboardCheck className="h-5 w-5" />
            הוצאות שהסניפים הזינו
          </h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            רשימת סקירה — לא שער אישור. השורות כבר נספרות; זה רק המקום לעבור עליהן
          </p>
        </div>
        <AccountingTabs active="/dashboard/accounting/review" />
      </div>

      <div className={`${CARD} mb-3.5 px-4 py-3 text-[12.5px] leading-relaxed text-muted`}>
        <b className="text-ink">למה רשימה ולא אישור:</b> אישור חוסם היה אומר שמנהל הסניף מחכה לך, וזו
        בדיוק החיכוך שהמודל בא למנוע — ובפועל זה מחזיר את כולם לוואטסאפ. לכן ההוצאה נכנסת מיד ונספרת
        מיד, ואצלך היא מופיעה כאן עם תיבת סימון אחת. שורה חריגה מסומנת אוטומטית ועולה לראש. בחודש
        רגיל הרשימה כמעט ריקה ותעבור עליה בדקה — זה ההבדל בין שליטה לבין בירוקרטיה.
      </div>

      <div className="mb-3.5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
        {[
          { label: "ממתינות לסקירה", value: String(pending.length), color: "#1a8a76" },
          { label: "מתוכן מסומנות", value: String(flaggedCount), color: flaggedCount > 0 ? "#c2410c" : "#8a93a5" },
          { label: 'סה"כ בשורות שממתינות', value: money(pendingTotal), color: "#0f6e56" },
        ].map((c) => (
          <article key={c.label} className={`${CARD} relative overflow-hidden py-2.5 pl-3.5 pr-3`}>
            <span className="absolute right-0 top-0 h-full w-[3px]" style={{ background: c.color }} />
            <p className="text-[11px] font-extrabold text-muted">{c.label}</p>
            <p className="mt-px text-[21px] font-black leading-tight tabular-nums" style={{ color: c.color }}>
              {c.value}
            </p>
          </article>
        ))}
      </div>

      {pending.length === 0 ? (
        <p className={`${CARD} px-4 py-8 text-center text-[15px] font-extrabold text-[#0f6e56]`}>
          ✓ אין הוצאות שממתינות לסקירה.
        </p>
      ) : (
        <section className={`${CARD} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card-border px-4 py-3">
            <h2 className="text-[15px] font-extrabold text-ink">{pending.length} שורות</h2>
            <form action={markAllReviewedAction}>
              <button type="submit" className="text-xs font-bold text-teal hover:underline">
                סימון הכל כנסקר
              </button>
            </form>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className={TH}>תאריך</th>
                  <th className={TH}>סניף</th>
                  <th className={TH}>מי הזין</th>
                  <th className={TH}>תיאור</th>
                  <th className={TH}>קטגוריה</th>
                  <th className={TH}>סכום</th>
                  <th className={TH}>קבלה</th>
                  <th className={TH}>למה זה כאן</th>
                  <th className={TH} />
                </tr>
              </thead>
              <tbody>
                {pending.map((t) => {
                  const flags = t.flags ?? [];
                  return (
                    <tr key={t.id} className={flags.length > 0 ? "bg-[#fffaf2]" : "transition hover:bg-[#fafbfc]"}>
                      <td className={`${TD} whitespace-nowrap tabular-nums text-muted`}>
                        {t.recurring?.from ? `חוזרת מ-${t.recurring.from}` : t.date}
                      </td>
                      <td className={`${TD} font-bold text-ink`}>
                        <Link
                          href={`/dashboard/accounting/overview/${t.node?.branchId}`}
                          className="text-teal hover:underline"
                        >
                          {branchName.get(t.node?.branchId ?? "") ?? t.node?.branchId}
                        </Link>
                      </td>
                      <td className={`${TD} text-muted`}>{t.enteredBy?.name ?? "—"}</td>
                      <td className={TD}>{t.desc}</td>
                      <td className={`${TD} text-muted`}>{t.category ?? "—"}</td>
                      <td className={`${TD} font-bold tabular-nums text-ink`}>{money(t.amount)}</td>
                      <td className={`${TD} text-muted`}>{t.doc ? "✓" : "—"}</td>
                      <td className={TD}>
                        {flags.length === 0 ? (
                          <span className="text-[11.5px] text-muted">שגרתי</span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            {flags.map((f) => (
                              <span
                                key={f}
                                className="flex items-center gap-1 text-[11.5px] font-bold text-[#7a4a12]"
                                title={TX_FLAG_WHY[f]}
                              >
                                <AlertTriangle className="h-3 w-3" />
                                {TX_FLAG_LABEL[f]}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className={TD}>
                        <form action={markReviewedAction.bind(null, t.id)}>
                          <button type="submit" className="whitespace-nowrap text-xs font-bold text-teal hover:underline">
                            נסקר ✓
                          </button>
                        </form>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={`${CARD} mt-3.5 overflow-hidden`}>
        <div className="border-b border-card-border px-4 py-3">
          <h2 className="text-[15px] font-extrabold text-ink">מתי שורה מסומנת אוטומטית</h2>
        </div>
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className={TH}>הטריגר</th>
              <th className={TH}>למה זה שווה בדיקה</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(TX_FLAG_LABEL) as (keyof typeof TX_FLAG_LABEL)[]).map((f) => (
              <tr key={f}>
                <td className={`${TD} font-bold text-ink`}>
                  {TX_FLAG_LABEL[f]}
                  {f === "no_receipt" && ` (מעל ${money(RECEIPT_REQUIRED_ABOVE)})`}
                </td>
                <td className={`${TD} text-muted`}>{TX_FLAG_WHY[f]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="border-t border-card-border px-4 py-2.5 text-[11.5px] leading-relaxed text-muted">
          הממוצע שמולו נמדדת קפיצה הוא <b className="text-ink">של הסניף עצמו</b> בשלושת החודשים
          האחרונים, לא של כל הסניפים — אחרת סניף ששכר הדירה שלו גבוה לגיטימית היה מסומן בכל חודש,
          ורשימה שצועקת זאב היא רשימה שאף אחד לא פותח.
        </p>
      </section>
    </div>
  );
}
