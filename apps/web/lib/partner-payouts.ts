/**
 * מה שאני חייב לשותף-מחשבים חיצוני, מצטבר.
 *
 * `lib/partner-settlement.ts` כבר יודע לחשב כמה מגיע לשותף על חודש בודד (אחוז מהברוטו
 * של המחשבים שסומנו כשלו - למשל 15% על מחשבים 76-79 לשלמה גולדשמידט). מה שחסר היה
 * הזיכרון: חודש שלא סימנתי שהעברתי עליו פשוט נעלם מהמסך בחודש הבא.
 *
 * כאן החוב הוא הפרש בין שני סכומים על פני כל החודשים: מה שהצטבר לזכותו, פחות מה
 * שנרשם ששולם (`n_partner_payouts`). לכן חודש שלא סומן ממשיך להופיע ביתרה עד שיסומן,
 * וסימון של חודש ישן מקטין את היתרה מיד - בלי שאף מסך צריך לדעת "עד איפה הגענו".
 */
import { getAdminFirestore } from "./firebase-admin";
import type { PartnerPayout } from "@ultranet/shared-types";
import { computePartnerSettlement, type PartnerSettlementLine } from "./partner-settlement";
import { monthsBetween } from "./branch-accounting";

export const PARTNER_PAYOUTS_COLLECTION = "n_partner_payouts";

/** מזהה דטרמיניסטי: סימון "העברתי" הוא upsert ולא יכול ליצור שתי רשומות לאותו חודש. */
export function payoutDocId(partnerName: string, month: string): string {
  const slug = partnerName.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "partner";
  return `${slug}_${month}`;
}

export interface PartnerMonthRow {
  month: string;
  /** מה שהצטבר לזכותו החודש לפי המחשבים שלו */
  due: number;
  /** מה שנרשם ששולם עבור החודש הזה */
  paid: number;
  computerNames: string[];
  totalRevenue: number;
  pct: number;
}

export interface PartnerPayoutSummary {
  partnerName: string;
  rows: PartnerMonthRow[];
  totalDue: number;
  totalPaid: number;
  /** מה שנשאר חוב עכשיו - זה המספר שמעניין */
  outstanding: number;
}

/**
 * מרכיב את היתרה של כל שותף-מחשבים חיצוני על פני חלון חודשים.
 * `months` הוא החלון להצגה; היתרה עצמה מחושבת על אותו חלון בלבד, ולכן כדאי להתחיל
 * אותו מהחודש הראשון שיש בו פעילות שותפים ולא מ-12 חודשים אחורה בלבד.
 */
export async function loadPartnerPayouts(months: string[]): Promise<PartnerPayoutSummary[]> {
  const db = getAdminFirestore();
  const [payoutsSnap, ...settlements] = await Promise.all([
    db.collection(PARTNER_PAYOUTS_COLLECTION).get(),
    ...months.map((m) => computePartnerSettlement(m)),
  ]);

  const paidByKey = new Map<string, number>();
  for (const d of payoutsSnap.docs) {
    const p = { ...(d.data() as Omit<PartnerPayout, "id">), id: d.id } as PartnerPayout;
    const key = `${p.partnerName}|${p.month}`;
    paidByKey.set(key, (paidByKey.get(key) ?? 0) + (p.paidAmount || 0));
  }

  const byPartner = new Map<string, PartnerMonthRow[]>();
  months.forEach((month, idx) => {
    const lines = (settlements[idx] ?? []) as PartnerSettlementLine[];
    // A partner can hold computers in more than one branch; the debt is to the person, so the
    // branch-level lines are merged back into one row per partner per month.
    const merged = new Map<string, PartnerMonthRow>();
    for (const line of lines) {
      const row = merged.get(line.partnerName) ?? {
        month,
        due: 0,
        paid: 0,
        computerNames: [],
        totalRevenue: 0,
        pct: line.pct,
      };
      row.due += line.amountOwed;
      row.totalRevenue += line.totalRevenue;
      for (const n of line.computerNames) if (!row.computerNames.includes(n)) row.computerNames.push(n);
      merged.set(line.partnerName, row);
    }
    for (const [name, row] of merged) {
      row.paid = paidByKey.get(`${name}|${month}`) ?? 0;
      const arr = byPartner.get(name) ?? [];
      arr.push(row);
      byPartner.set(name, arr);
    }
  });

  // A month with nothing due but something already paid still belongs in the table - otherwise a
  // payment recorded against a quiet month would silently vanish from the balance.
  for (const [key, paid] of paidByKey) {
    const [name, month] = key.split("|") as [string, string];
    if (!months.includes(month)) continue;
    const arr = byPartner.get(name) ?? [];
    if (arr.some((r) => r.month === month)) continue;
    arr.push({ month, due: 0, paid, computerNames: [], totalRevenue: 0, pct: 0 });
    byPartner.set(name, arr);
  }

  return [...byPartner.entries()]
    .map(([partnerName, rows]) => {
      rows.sort((a, b) => a.month.localeCompare(b.month));
      const totalDue = rows.reduce((s, r) => s + r.due, 0);
      const totalPaid = rows.reduce((s, r) => s + r.paid, 0);
      return { partnerName, rows, totalDue, totalPaid, outstanding: totalDue - totalPaid };
    })
    .sort((a, b) => b.outstanding - a.outstanding);
}

/** חלון החודשים לתצוגה: `count` חודשים אחורה עד `end` (כולל). */
export function monthWindow(end: string, count: number): string[] {
  const [y, m] = end.split("-").map(Number);
  let sy = y ?? new Date().getFullYear();
  let sm = (m ?? 1) - (count - 1);
  while (sm < 1) {
    sm += 12;
    sy -= 1;
  }
  return monthsBetween(`${sy}-${String(sm).padStart(2, "0")}`, end);
}
