/**
 * מדד סניפים — שבעה שלבים מהפתיחה ועד 150 ₪ נטו למחשב, לכל סניף השכרות פעיל.
 *
 * שלושה שלבים נגזרים מהנתונים בכל טעינה ולכן לעולם לא "נתקעים" מסומנים:
 *  1. הסניף נפתח — קיים, לא מסומן "עדיין לא התחיל לפעול", ותאריך הפתיחה שלו (אם הוזן) כבר הגיע.
 *  4. המחשבים והסימים הוזנו — יש לפחות מחשב פעיל אחד, ולכל מחשב עם סטיק ולכל סטיק פעיל יש מספר סים.
 *  7. 150 ₪ נטו למחשב — הרווח-פר-מחשב של החודש האחרון שהסתיים (או של החודש הנוכחי, אם כבר עבר
 *     את היעד) לפי אותו חישוב בדיוק כמו טבלת המעקב ב-`/dashboard/accounting/mobile`.
 * שאר השלבים (2, 3, 5, 6) הם סימון ידני של הבעלים, ב-`n_branch_progress`.
 */
import type { Branch, BranchProgress, BranchProgressManualStage, Stick } from "@ultranet/shared-types";
import { getAdminFirestore } from "./firebase-admin";
import { loadBranchAccountingRawData, currentMonth } from "./branch-accounting-data";
import { buildLaptopBranchTracking, trackingWindow } from "./laptop-branch-tracking";
import { isLaptopActive } from "./laptop-names";

export const BRANCH_PROGRESS_COLLECTION = "n_branch_progress";

export type StageNo = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface StageDef {
  no: StageNo;
  title: string;
  auto: boolean;
}

export const STAGES: StageDef[] = [
  { no: 1, title: "פתיחת סניף", auto: true },
  { no: 2, title: "קיבל מחשבים וסימים — הכל עובד", auto: false },
  { no: 3, title: "גרפיקה מוכנה", auto: false },
  { no: 4, title: "מחשבים וסימים הוזנו לאתר", auto: true },
  { no: 5, title: "מפרסמים", auto: false },
  { no: 6, title: "העסק דופק", auto: false },
  { no: 7, title: "150 ₪ נטו למחשב", auto: true },
];

export const MANUAL_STAGES: BranchProgressManualStage[] = ["2", "3", "5", "6"];

export interface StageState {
  no: StageNo;
  done: boolean;
  /** הסבר קצר מתחת לשלב — מה חסר / מה נמדד */
  hint?: string;
  at?: string;
}

export interface BranchProgressRow {
  branchId: string;
  name: string;
  location?: string;
  partnerName?: string;
  isMine: boolean;
  stages: StageState[];
  doneCount: number;
  /** השלב הראשון שעוד לא הושלם; 8 = הכל הושלם */
  currentStage: number;
  laptopCount: number;
  perComputer: number | null;
}

export interface BranchProgressBoard {
  rows: BranchProgressRow[];
  target: number;
  measuredMonth: string;
}

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

export async function loadBranchProgressBoard(): Promise<BranchProgressBoard> {
  const db = getAdminFirestore();
  const [raw, progressSnap, sticksSnap] = await Promise.all([
    loadBranchAccountingRawData(),
    db.collection(BRANCH_PROGRESS_COLLECTION).get(),
    db.collection("n_sticks").get(),
  ]);

  const progressById = new Map<string, BranchProgress>(
    progressSnap.docs.map((d) => [d.id, { id: d.id, ...(d.data() as Omit<BranchProgress, "id">) }]),
  );
  const sticksByBranch = new Map<string, Stick[]>();
  for (const d of sticksSnap.docs) {
    const s = { id: d.id, ...(d.data() as Omit<Stick, "id">) };
    if (!s.branchId) continue;
    const list = sticksByBranch.get(s.branchId) ?? [];
    list.push(s);
    sticksByBranch.set(s.branchId, list);
  }

  const branches: Branch[] = raw.branches.filter(
    (b) => b.branchType === "rentals" && !b.deleted && !b.closedAt,
  );

  // חודש נוכחי + החודש שלפניו: הקודם הוא החודש המלא האחרון, הנוכחי עדיין חלקי.
  const now = currentMonth();
  const months = trackingWindow(now, 2);
  const tracking = buildLaptopBranchTracking(branches, raw, months);
  const today = new Date().toISOString().slice(0, 10);

  const rows: BranchProgressRow[] = tracking.rows.map(({ branch, cells }) => {
    const marks = progressById.get(branch.id)?.marks ?? {};
    const laptops = (raw.laptopsByBranch.get(branch.id) ?? []).filter(isLaptopActive);
    const sticks = (sticksByBranch.get(branch.id) ?? []).filter((s) => (s.status ?? "active") === "active");

    // 1 — פתיחה
    const openDate = branch.openedAt || branch.founded;
    const opened = !branch.notStarted && (!openDate || openDate.slice(0, 10) <= today);
    const s1: StageState = {
      no: 1,
      done: opened,
      hint: opened
        ? openDate
          ? `נפתח ${openDate.slice(0, 10).split("-").reverse().join("/")}`
          : undefined
        : branch.notStarted
          ? 'מסומן "עדיין לא התחיל לפעול"'
          : "תאריך הפתיחה עוד לא הגיע",
    };

    // 4 — מחשבים וסימים באתר
    const laptopsMissingSim = laptops.filter((l) => l.hasStick && !l.simNumber?.trim()).length;
    const sticksMissingSim = sticks.filter((s) => !s.linkedLaptopId && !s.sim?.trim()).length;
    const missingSims = laptopsMissingSim + sticksMissingSim;
    const s4: StageState = {
      no: 4,
      done: laptops.length > 0 && missingSims === 0,
      hint:
        laptops.length === 0
          ? "עוד לא הוזן אף מחשב"
          : missingSims > 0
            ? `${laptops.length} מחשבים · חסרים ${missingSims} מספרי סים`
            : `${laptops.length} מחשבים · ${sticks.length} סטיקים`,
    };

    // 7 — 150 ₪ נטו למחשב
    const [prev, cur] = cells;
    const reached = !!prev?.isHealthy || !!cur?.isHealthy;
    const measured = prev?.profitPerComputer ?? cur?.profitPerComputer ?? null;
    const s7: StageState = {
      no: 7,
      done: reached,
      hint: measured === null ? "אין עדיין נתון" : `${money(measured)} למחשב בחודש האחרון`,
    };

    const manual = (no: 2 | 3 | 5 | 6): StageState => {
      const m = marks[String(no) as BranchProgressManualStage];
      return { no, done: !!m?.done, at: m?.done ? m.at : undefined };
    };

    const stages = [s1, manual(2), manual(3), s4, manual(5), manual(6), s7];
    const doneCount = stages.filter((s) => s.done).length;
    const firstOpen = stages.find((s) => !s.done);

    return {
      branchId: branch.id,
      name: branch.name,
      location: branch.location,
      partnerName: branch.partnerName,
      isMine: branch.isMine !== false,
      stages,
      doneCount,
      currentStage: firstOpen ? firstOpen.no : 8,
      laptopCount: laptops.length,
      perComputer: measured,
    };
  });

  rows.sort((a, b) => b.doneCount - a.doneCount || a.name.localeCompare(b.name, "he", { numeric: true }));
  return { rows, target: tracking.target, measuredMonth: months[0] ?? now };
}
