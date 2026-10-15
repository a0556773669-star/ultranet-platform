/**
 * תקצירי ציוד לקריאה בלבד במסך "מלאי מחשבים" — מודול טהור (בלי firebase-admin).
 *
 * - `equipmentSummaryByBranch` — פריט 16: כמה מחשבים רגילים/גרפיקה, סטיקים ובתיקון יש בכל סניף.
 * - `idleEquipment` — פריט 46: ציוד שלא הושכר זמן רב, ממוין לפי ההשכרה האחרונה.
 *
 * שום דבר כאן לא כותב, לא מסמן תקלה ולא משנה מחיר. המספרים כאן **לא** משמשים בחישובי רווחיות —
 * ספירת המחשבים לרווח למחשב נשארת ב-`laptop-branch-tracking.ts` כפי שהיא.
 */
import type { Laptop, Rental, Stick } from "@ultranet/shared-types";
import { isLaptopActive } from "./laptop-names";

export function isGraphicsLaptop(l: Pick<Laptop, "isGraphics" | "name">): boolean {
  return l.isGraphics ?? /גרפיקה/.test(l.name ?? "");
}

export interface BranchEquipmentSummary {
  branchId: string;
  regular: number;
  graphics: number;
  /** מחשבים בלבד (רגיל + גרפיקה). סטיק משויך לא מוסיף מחשב. */
  computers: number;
  /** סטיקים שמשויכים למחשב פעיל — יוצאים יחד איתו, לא "מחשב" נוסף */
  linkedSticks: number;
  /** סטיקים פעילים שלא משויכים למחשב פעיל (מושכרים לבד בלבד) */
  standaloneSticks: number;
  /** מחשבים פעילים עם תקופת תיקון פתוחה (כלולים גם ב-regular/graphics) */
  inRepair: number;
}

/**
 * תקציר לכל סניף. רק ציוד פעיל (לא נמכר/הוצא). סטיק נספר כ"משויך" רק אם המחשב שלו עדיין פעיל
 * — סטיק שהמחשב שלו יצא בלעדיו הוא בפועל סטיק עצמאי.
 */
export function equipmentSummaryByBranch(
  laptops: Laptop[],
  sticks: Stick[],
  repairLaptopIds: ReadonlySet<string>,
): Map<string, BranchEquipmentSummary> {
  const out = new Map<string, BranchEquipmentSummary>();
  const row = (branchId: string) => {
    let r = out.get(branchId);
    if (!r) {
      r = { branchId, regular: 0, graphics: 0, computers: 0, linkedSticks: 0, standaloneSticks: 0, inRepair: 0 };
      out.set(branchId, r);
    }
    return r;
  };
  const activeLaptopIds = new Set<string>();
  for (const l of laptops) {
    if (!isLaptopActive(l)) continue;
    activeLaptopIds.add(l.id);
    const r = row(l.branchId);
    if (isGraphicsLaptop(l)) r.graphics++;
    else r.regular++;
    r.computers++;
    if (repairLaptopIds.has(l.id)) r.inRepair++;
  }
  for (const s of sticks) {
    if (!isLaptopActive(s)) continue;
    const r = row(s.branchId);
    if (s.linkedLaptopId && activeLaptopIds.has(s.linkedLaptopId)) r.linkedSticks++;
    else r.standaloneSticks++;
  }
  return out;
}

export type IdleStatus =
  /** יש השכרה קודמת ברשומות */
  | "rented-before"
  /** אין אף השכרה, והמחשב נוסף אחרי תחילת הרשומות — באמת לא הושכר מאז שנוסף */
  | "never"
  /** אין השכרה ברשומות, אבל אי אפשר לדעת בוודאות: אין תאריך הוספה, או שנוסף לפני ההשכרה
   *  המוקדמת ביותר שקיימת ב-`n_rentals` (ההיסטוריה עלולה להיות חלקית) */
  | "no-history";

export interface IdleEquipmentRow {
  id: string;
  kind: "laptop" | "stick";
  name: string;
  branchId: string;
  status: IdleStatus;
  /** תאריך תחילת ההשכרה האחרונה */
  lastStart?: string;
  /** מתי ההשכרה האחרונה הסתיימה (`returnDate` ← `endDate` ← `startDate`) */
  lastEnd?: string;
  /** ימים מאז `lastEnd` (או מאז `addedDate` כשלא הושכר מעולם) */
  idleDays?: number;
  addedDate?: string;
}

type RentalLite = Pick<Rental, "itemId" | "kind" | "startDate" | "status" | "returnDate" | "endDate">;

function daysSince(date: string, today: string): number {
  const ms = Date.parse(`${today}T00:00:00Z`) - Date.parse(`${date.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.max(0, Math.round(ms / 86_400_000)) : 0;
}

/**
 * ציוד פעיל שלא מושכר כרגע, מהזמן הרב ביותר בלי השכרה ועד הקצר. סדר: קודם מה שאין לו השכרה
 * בכלל (לפי תאריך הוספה, הוותיק קודם), ואחריו לפי סיום ההשכרה האחרונה (הישן קודם).
 *
 * כולל מחשבים פעילים וסטיקים פעילים **שלא משויכים למחשב פעיל** — סטיק משויך יוצא עם המחשב שלו,
 * כך שהיעדר השכרה נפרדת שלו לא אומר כלום.
 */
export function idleEquipment(
  laptops: Laptop[],
  sticks: Stick[],
  rentals: RentalLite[],
  today: string,
): IdleEquipmentRow[] {
  const activeLaptops = laptops.filter((l) => isLaptopActive(l));
  const activeLaptopIds = new Set(activeLaptops.map((l) => l.id));
  const standaloneSticks = sticks.filter(
    (s) => isLaptopActive(s) && !(s.linkedLaptopId && activeLaptopIds.has(s.linkedLaptopId)),
  );

  let earliestRecord: string | undefined;
  const rentedNow = new Set<string>();
  const last = new Map<string, { start: string; end: string }>();
  for (const r of rentals) {
    if (!r.startDate) continue;
    if (!earliestRecord || r.startDate < earliestRecord) earliestRecord = r.startDate;
    const key = `${r.kind}::${r.itemId}`;
    if (r.status === "active") {
      rentedNow.add(key);
      continue;
    }
    const end = (r.returnDate ?? r.endDate ?? r.startDate).slice(0, 10);
    const prev = last.get(key);
    if (!prev || end > prev.end) last.set(key, { start: r.startDate.slice(0, 10), end });
  }

  const rows: IdleEquipmentRow[] = [];
  const push = (kind: "laptop" | "stick", item: { id: string; name: string; branchId: string; addedDate?: string }) => {
    const key = `${kind}::${item.id}`;
    if (rentedNow.has(key)) return;
    const l = last.get(key);
    if (l) {
      rows.push({
        id: item.id,
        kind,
        name: item.name,
        branchId: item.branchId,
        status: "rented-before",
        lastStart: l.start,
        lastEnd: l.end,
        idleDays: daysSince(l.end, today),
        addedDate: item.addedDate,
      });
      return;
    }
    const sure = !!item.addedDate && !!earliestRecord && item.addedDate >= earliestRecord;
    rows.push({
      id: item.id,
      kind,
      name: item.name,
      branchId: item.branchId,
      status: sure ? "never" : "no-history",
      idleDays: item.addedDate ? daysSince(item.addedDate, today) : undefined,
      addedDate: item.addedDate,
    });
  };
  for (const l of activeLaptops) push("laptop", l);
  for (const s of standaloneSticks) push("stick", { id: s.id, name: s.name, branchId: s.branchId });

  const rank = (r: IdleEquipmentRow) => (r.status === "rented-before" ? 1 : 0);
  return rows.sort((a, b) => {
    if (rank(a) !== rank(b)) return rank(a) - rank(b);
    if (rank(a) === 0) return (a.addedDate ?? "").localeCompare(b.addedDate ?? "");
    return (a.lastEnd ?? "").localeCompare(b.lastEnd ?? "");
  });
}
