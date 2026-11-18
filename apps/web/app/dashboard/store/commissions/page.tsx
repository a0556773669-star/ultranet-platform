import Link from "next/link";
import { Coins } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { COMMISSION_CATEGORY_LABEL, dealSettlement } from "@/lib/store-commission";
import { COMMISSION_CATEGORIES, currentIsraelMonth, loadEffectiveRules } from "@/lib/store-commission-data";
import type { StoreRequest } from "@ultranet/shared-types";
import { StoreTabs } from "../store-tabs";
import { saveCommissionRulesAction } from "../actions";

export const dynamic = "force-dynamic";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const money = (n: number) => `${Math.round(n).toLocaleString("he-IL")} ₪`;

export default async function CommissionsPage({ searchParams }: { searchParams: { month?: string } }) {
  await requireOwner();
  const month = /^\d{4}-\d{2}$/.test(searchParams.month ?? "") ? searchParams.month! : currentIsraelMonth();
  const rules = await loadEffectiveRules();
  const snap = await getAdminFirestore().collection("n_store_requests").where("collection.by", "==", "branch").get();
  const deals = snap.docs
    .map((d) => ({ ...(d.data() as Omit<StoreRequest, "id">), id: d.id }) as StoreRequest)
    .filter((r) => dealSettlement(r).month === month);

  const byBranch = new Map<string, { name: string; count: number; collected: number; commission: number }>();
  for (const r of deals) {
    const s = dealSettlement(r);
    const row = byBranch.get(r.branchId) ?? { name: r.branchName, count: 0, collected: 0, commission: 0 };
    row.count += 1;
    row.collected += s.collected;
    row.commission += s.commission;
    byBranch.set(r.branchId, row);
  }
  const rows = Array.from(byBranch.values()).sort((a, b) => a.name.localeCompare(b.name, "he"));

  return (
    <div className="max-w-3xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Coins className="h-5 w-5" />
        עמלות סניפים
      </h1>
      <StoreTabs isOwner />

      <form action={saveCommissionRulesAction} className="card mb-4 flex flex-col gap-3">
        <h2 className="text-base font-bold text-ink">כללי עמלה לכל מוצר</h2>
        <p className="text-xs text-muted">
          עמלה נקבעת בסגירת העסקה ונשמרת עליה. שינוי כאן לא משנה עסקאות שנסגרו. 0 = אין עמלה.
          ברירת המחדל: 150 ₪ לכל מחשב ו-20 ₪ לכל אביזר. עמלה מגיעה רק כשהסניף גבה את הכסף, וניתן לעדכן אותה לכל הזמנה לפני שליחת תשובת בדיקת המלאי.
        </p>
        {COMMISSION_CATEGORIES.map((c) => {
          const rule = rules.get(c);
          return (
            <div key={c} className="flex flex-wrap items-center gap-2">
              <span className="w-56 text-sm font-semibold text-ink">{COMMISSION_CATEGORY_LABEL[c]}</span>
              <select name={`${c}_kind`} defaultValue={rule?.kind ?? "fixed"} className={FIELD}>
                <option value="fixed">{c === "accessory" ? "סכום קבוע ₪ לכל אביזר" : "סכום קבוע ₪ למחשב"}</option>
                <option value="percent">אחוז מהמחיר הסופי</option>
              </select>
              <input name={`${c}_value`} defaultValue={rule?.value ?? ""} inputMode="decimal" className={`w-24 ${FIELD}`} />
            </div>
          );
        })}
        <button type="submit" className="btn-primary w-fit">שמירת כללים</button>
      </form>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-base font-bold text-ink">התחשבנות חנות - {month}</h2>
          <form className="flex items-center gap-1">
            <input type="month" name="month" defaultValue={month} className={FIELD} />
            <button className="btn-outline text-xs">הצגה</button>
          </form>
        </div>
        {!rows.length ? (
          <p className="text-sm text-muted">אין עסקאות שנגבו ע״י סניפים בחודש הזה.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-right text-xs text-muted">
                <th className="py-1">סניף</th><th>עסקאות</th><th>נגבה</th><th>עמלה</th><th>מועבר אליי</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t border-card-border">
                  <td className="py-1.5 font-semibold text-ink">{r.name}</td>
                  <td>{r.count}</td>
                  <td>{money(r.collected)}</td>
                  <td className="text-teal-dark">{money(r.commission)}</td>
                  <td className="font-bold">{money(r.collected - r.commission)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-muted">
          בסניפי השכרות הסכום בעמודה האחרונה כבר נכלל אוטומטית ב״צריך להעביר״ של החודש (דף העברות ובדו״ח החודשי).
          בסוגי סניפים אחרים הוא מוצג כאן בלבד.
        </p>
        <div className="mt-2 text-xs">
          <Link href="/dashboard/store/requests" className="font-semibold text-teal hover:underline">לכל הבקשות</Link>
        </div>
      </div>
    </div>
  );
}
