/**
 * המשרד השיתופי — לוח התשלומים, ההוצאות והמאזן.
 *
 * לקוח במשרד שיתופי הוא לא "מכירה" אלא מנוי: הוא התחיל בתאריך מסוים, משלם סכום קבוע
 * בכל חודש ביום שבו התחיל, ואולי הפסיק בתאריך אחר. מכאן שהשאלה היחידה שהמסך צריך לענות
 * עליה היא "מי לא שילם", והדרך לענות עליה היא להשוות בין החודשים שהוא היה אמור לשלם
 * לבין החודשים שנרשם בהם תשלום. זה כל מה שהמודול הזה עושה.
 *
 * `payDay` נגזר מיום ה-`startDate` כשלא הוגדר במפורש - מי שהתחיל ב-10 בחודש משלם ב-10,
 * וזו ההתנהגות שהבעלים תיאר. הוא נשמר בכל זאת כשדה נפרד כדי שאפשר יהיה לשנות סיכום
 * בלי לשכתב את תאריך ההתחלה, שהוא עובדה היסטורית.
 */
import { getAdminFirestore } from "./firebase-admin";
import type {
  Branch,
  CoworkingClient,
  CoworkingPayment,
  CoworkingStation,
  FixedExpense,
  VariableExpense,
} from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";
import { countsToMain } from "./counts-to-main";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** העלות החודשית של הלקוח: מחיר מיוחד אם יש, אחרת מחיר העמדה. */
export function monthlyCost(client: CoworkingClient, station?: CoworkingStation): number {
  return client.customPrice ?? station?.price ?? 0;
}

/**
 * האם ההשכרה פעילה בתאריך נתון.
 *
 * הגדרה אחת לכל המערכת, בכוונה: מסך העמדות שאל "אין תאריך סיום **או** שהסיום עוד לא הגיע",
 * ודף הבית שאל רק "אין תאריך סיום" — ולכן השכרה שנרשם לה סיום עתידי הופיעה כמושכרת במסך
 * ובלי התראת תשלום בבית, למרות שהחודש הזה עדיין נגבה. שתי השאלות הן אותה שאלה.
 */
export function isActiveOn(client: CoworkingClient, today = new Date()): boolean {
  if (!client.endDate) return true;
  return client.endDate >= today.toISOString().slice(0, 10);
}

/** היום בחודש שבו מגיע התשלום. */
export function payDayOf(client: CoworkingClient): number {
  if (client.payDay && client.payDay >= 1 && client.payDay <= 31) return client.payDay;
  const day = Number(client.startDate?.slice(8, 10));
  return day >= 1 && day <= 31 ? day : 1;
}

/** החודשים שהלקוח היה אמור לשלם בהם, מהחודש שהתחיל ועד היום או עד שהפסיק. */
export function billableMonths(client: CoworkingClient, upto = currentMonth()): string[] {
  if (!client.startDate) return [];
  const start = client.startDate.slice(0, 7);
  const end = client.endDate && client.endDate.slice(0, 7) < upto ? client.endDate.slice(0, 7) : upto;
  if (end < start) return [];
  return monthsBetween(start, end);
}

export interface CoworkingClientStatus {
  client: CoworkingClient;
  station?: CoworkingStation;
  branchName: string;
  cost: number;
  payDay: number;
  active: boolean;
  /**
   * ההשכרה לא משויכת לאף סניף משרד שיתופי חי (סניף שנמחק, סניף מסוג אחר, או `branchId`
   * שלא קיים כלל — בדרך כלל רשומה שהגיעה מ-`app.html` הישן).
   *
   * השדה קיים מפני שכל מסכי המודול מסננים לפי סניף ורשומה כזו נופלת מכולם, בעוד שדף הבית
   * סופר את כל הלקוחות: התוצאה הייתה התראת תשלום בדף הבית בלי שום מסך שמאחוריה. רשומה
   * יתומה היא מצב לתיקון, ולכן היא מסומנת ומוצגת — לא מסוננת בשקט.
   */
  orphan: boolean;
  /** חודשים שהיה אמור לשלם ולא נרשם עליהם תשלום */
  unpaidMonths: string[];
  /** האם התאריך של החודש כבר עבר — כלומר האם ההתראה על החודש הנוכחי כבר רלוונטית */
  dueNow: boolean;
  paidToDate: number;
  paidToMainToDate: number;
  lastPaymentMonth?: string;
}

export function clientStatus(
  client: CoworkingClient,
  station: CoworkingStation | undefined,
  branchName: string,
  today = new Date(),
  options?: { orphan?: boolean },
): CoworkingClientStatus {
  const upto = today.toISOString().slice(0, 7);
  const cost = monthlyCost(client, station);
  const payDay = payDayOf(client);
  const paidMonths = new Set((client.payments ?? []).map((p) => p.month));
  const expected = billableMonths(client, upto);

  // The current month only counts as "unpaid" once its due day has actually passed - before that
  // there is nothing to chase, and flagging it would make every client look overdue on the 1st.
  const unpaidMonths = expected.filter((m) => {
    if (paidMonths.has(m)) return false;
    if (m === upto && today.getDate() < payDay) return false;
    return true;
  });

  const payments = client.payments ?? [];
  return {
    client,
    station,
    branchName,
    cost,
    payDay,
    active: isActiveOn(client, today),
    orphan: Boolean(options?.orphan),
    unpaidMonths,
    dueNow: today.getDate() >= payDay && !paidMonths.has(upto) && expected.includes(upto),
    paidToDate: payments.reduce((s, p) => s + (p.amount || 0), 0),
    paidToMainToDate: payments.filter((p) => countsToMain(p)).reduce((s, p) => s + (p.amount || 0), 0),
    lastPaymentMonth: payments.map((p) => p.month).sort().at(-1),
  };
}

export interface CoworkingData {
  clients: CoworkingClient[];
  stationsById: Map<string, CoworkingStation>;
  branchesById: Map<string, Branch>;
  branches: Branch[];
  statuses: CoworkingClientStatus[];
}

export async function loadCoworkingData(params?: { branchId?: string }): Promise<CoworkingData> {
  const db = getAdminFirestore();
  const [clientsSnap, stationsSnap, branchesSnap] = await Promise.all([
    db.collection("n_cw_clients").get(),
    db.collection("n_cw_stations").get(),
    db.collection("n_branches").get(),
  ]);

  let clients = clientsSnap.docs.map(
    (d) => ({ ...(d.data() as Omit<CoworkingClient, "id">), id: d.id }) as CoworkingClient,
  );
  if (params?.branchId) clients = clients.filter((c) => c.branchId === params.branchId);

  const stationsById = new Map(
    stationsSnap.docs.map((d) => [d.id, { ...(d.data() as Omit<CoworkingStation, "id">), id: d.id } as CoworkingStation]),
  );
  const allBranches = branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch);
  const branchesById = new Map(allBranches.map((b) => [b.id, b]));
  const branches = allBranches.filter((b) => b.branchType === "coworking" && !b.deleted);

  // סניף "חי" = סניף משרד שיתופי שלא נמחק. כל השכרה שה-`branchId` שלה אינו אחד מאלה היא
  // יתומה: אף מסך במודול לא יציג אותה, כי כולם מסננים לפי הסניף הנבחר.
  const liveBranchIds = new Set(branches.map((b) => b.id));

  const now = new Date();
  const statuses = clients
    .map((c) =>
      clientStatus(c, stationsById.get(c.stationId), branchesById.get(c.branchId)?.name ?? "-", now, {
        orphan: !liveBranchIds.has(c.branchId),
      }),
    )
    .sort((a, b) => a.client.name.localeCompare(b.client.name, "he"));

  return { clients, stationsById, branchesById, branches, statuses };
}

/**
 * למה השכרה מסוימת יתומה — טקסט קצר שמופיע לצידה במסך.
 *
 * ההבחנה חשובה כי התיקון שונה: סניף שנמחק בטעות אפשר להחזיר, סניף מסוג אחר מעיד על
 * `branchId` שגוי ברשומה, ו-`branchId` שלא קיים בכלל הוא כמעט תמיד שריד מ-`app.html`.
 */
export function orphanReason(client: CoworkingClient, branchesById: Map<string, Branch>): string {
  const branch = client.branchId ? branchesById.get(client.branchId) : undefined;
  if (!client.branchId) return "לא נרשם סניף בהשכרה";
  if (!branch) return "הסניף שרשום בהשכרה לא קיים יותר";
  if (branch.deleted) return `הסניף "${branch.name}" נמחק`;
  if (branch.branchType !== "coworking") return `הסניף "${branch.name}" אינו סניף משרד שיתופי`;
  return "הסניף אינו סניף משרד שיתופי פעיל";
}

export interface CoworkingLedger {
  /** מה ששילמתי עד היום — כל ההוצאות של המשרד השיתופי, בכל הסוגים */
  paidToDate: number;
  /** סך ההקמה: שורות ההוצאה בקטגוריית "הקמה" + שדה `setupCost` של הסניפים עצמם */
  setupToDate: number;
  /** רק החלק שהגיע משורות ההוצאה */
  setupFromExpenses: number;
  /** רק החלק שהגיע מפירוט עלות ההקמה שבטופס הסניף */
  setupFromBranches: number;
  fixedToDate: number;
  variableToDate: number;
  /** מה שקיבלתי עד היום — כל תשלומי הלקוחות */
  receivedToDate: number;
  balance: number;
}

/** קטגוריית ההוצאה שמסמנת "הוצאת הקמה" - שדה `category` ולא קולקשן נפרד, כי זו אותה הוצאה. */
export const SETUP_CATEGORY = "הקמה";

export function buildCoworkingLedger(params: {
  fixed: FixedExpense[];
  variable: VariableExpense[];
  clients: CoworkingClient[];
  /** הסניפים עצמם - עלות ההקמה שלהם היא שדה על הסניף, לא שורת הוצאה */
  branches?: Branch[];
  upto?: string;
}): CoworkingLedger {
  const upto = params.upto ?? currentMonth();

  let fixedToDate = 0;
  for (const e of params.fixed) {
    if (!e.startDate) continue;
    const start = e.startDate.slice(0, 7);
    if (start > upto) continue;
    const end = e.endDate && e.endDate.slice(0, 7) < upto ? e.endDate.slice(0, 7) : upto;
    if (end < start) continue;
    const monthly = e.variableAmount && e.lastAmount != null ? e.lastAmount : e.amount || 0;
    fixedToDate += monthly * monthsBetween(start, end).length;
  }

  let setupFromExpenses = 0;
  let variableToDate = 0;
  for (const e of params.variable) {
    if (e.month > upto) continue;
    if (e.category === SETUP_CATEGORY) setupFromExpenses += e.amount || 0;
    else variableToDate += e.amount || 0;
  }

  // שני מקורות להקמה, בכוונה: שורות הוצאה (הדרך הוותיקה במודול הזה) ופירוט עלות ההקמה
  // שבטופס הסניף. הם נספרים זה לצד זה ולא במקום זה, ולכן הטופס מזהיר לא לרשום את אותה
  // הוצאה בשניהם. השדות נשארים נפרדים ב-`CoworkingLedger` כדי שהמסך יוכל להראות מאיפה מה.
  const setupFromBranches = (params.branches ?? [])
    .filter((b) => !b.deleted)
    .reduce((total, b) => total + (b.setupCost ?? 0), 0);
  const setupToDate = setupFromExpenses + setupFromBranches;

  const receivedToDate = params.clients
    .flatMap((c) => c.payments ?? [])
    .filter((p) => p.month <= upto)
    .reduce((s, p) => s + (p.amount || 0), 0);

  const paidToDate = setupToDate + fixedToDate + variableToDate;
  return {
    paidToDate,
    setupToDate,
    setupFromExpenses,
    setupFromBranches,
    fixedToDate,
    variableToDate,
    receivedToDate,
    balance: receivedToDate - paidToDate,
  };
}

/** ארבע העמדות הפיזיות במשרד. מספר העמדה הוא הזהות שלה, לא מסמך שמקימים. */
export const STATION_NUMBERS = [1, 2, 3, 4] as const;

/** התשלום שנרשם לחודש מסוים, אם נרשם. */
export function paymentForMonth(client: CoworkingClient, month: string) {
  return (client.payments ?? []).find((p) => p.month === month);
}

/**
 * עמדה אחת במסך העמדות: מי יושב בה עכשיו, ומה מצב התשלום של החודש הנוכחי.
 *
 * "השכרה פעילה" היא לקוח שהתחיל ועדיין לא הסתיים (או שתאריך הסיום שלו עוד לא הגיע) -
 * אותה הגדרה כמו בנייד מושכר, שממנה הועתק המסך.
 */
export interface StationOccupancy {
  stationNumber: number;
  station?: CoworkingStation;
  /** ההשכרה הפעילה כרגע, אם יש */
  current?: CoworkingClientStatus;
  /** השכרות שהסתיימו על העמדה הזו, מהחדשה לישנה */
  past: CoworkingClientStatus[];
}

export function buildStationOccupancy(
  stationNumbers: readonly number[],
  stations: CoworkingStation[],
  statuses: CoworkingClientStatus[],
  today = new Date(),
): StationOccupancy[] {
  const todayStr = today.toISOString().slice(0, 10);
  const stationByNumber = new Map(stations.map((s) => [s.name?.trim(), s]));

  return stationNumbers.map((n) => {
    const station = stationByNumber.get(String(n));
    const onThis = statuses.filter(
      (s) => (station && s.client.stationId === station.id) || s.client.stationNumber?.trim() === String(n),
    );
    const current = onThis.find((s) => !s.client.endDate || s.client.endDate >= todayStr);
    const past = onThis
      .filter((s) => s !== current)
      .sort((a, b) => (b.client.startDate ?? "").localeCompare(a.client.startDate ?? ""));
    return { stationNumber: n, station, current, past };
  });
}

/** חודש אחד בחיי ההשכרה: מה היה אמור להיגבות, ומה נרשם בפועל. */
export interface RentalMonthRow {
  month: string;
  expected: number;
  payment?: CoworkingPayment;
}

/**
 * לוח החודשים המלא של השכרה אחת - הבסיס למסך ההיסטוריה.
 *
 * השכרה שהסתיימה היא לא "נעלמה": היא עדיין שאלה פתוחה של מי שילם ומי לא, בדיוק כמו
 * השכרה פעילה, ולכן החישוב זהה לשתיהן ומשתמש ב-`billableMonths` שכבר יודע לעצור
 * בחודש הסיום. חודש שיש בו תשלום אבל אינו בטווח החיוב (תשלום שנרשם בטעות, או סיום
 * שהוזז אחורה) מצורף גם הוא - הסתרת כסף שנרשם הייתה גרועה יותר מהצגת שורה מוזרה.
 */
export function rentalMonths(status: CoworkingClientStatus): RentalMonthRow[] {
  const { client, cost } = status;
  const payments = client.payments ?? [];
  const months = new Set(billableMonths(client, currentMonth()));
  for (const p of payments) months.add(p.month);

  return [...months]
    .sort((a, b) => b.localeCompare(a))
    .map((month) => ({ month, expected: cost, payment: payments.find((p) => p.month === month) }));
}

/** סיכום כספי של השכרה אחת: כמה היה אמור, כמה שולם, כמה חסר. */
export function rentalTotals(status: CoworkingClientStatus) {
  const rows = rentalMonths(status);
  const billed = billableMonths(status.client, currentMonth()).length * status.cost;
  const paid = (status.client.payments ?? []).reduce((s, p) => s + (p.amount || 0), 0);
  return { rows, billed, paid, debt: Math.max(0, billed - paid) };
}
