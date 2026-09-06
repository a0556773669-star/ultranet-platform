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
import type { Branch, CoworkingClient, CoworkingStation, FixedExpense, VariableExpense } from "@ultranet/shared-types";
import { monthsBetween } from "./branch-accounting";
import { countsToMain } from "./counts-to-main";

export function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** העלות החודשית של הלקוח: מחיר מיוחד אם יש, אחרת מחיר העמדה. */
export function monthlyCost(client: CoworkingClient, station?: CoworkingStation): number {
  return client.customPrice ?? station?.price ?? 0;
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
    active: !client.endDate,
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

  const now = new Date();
  const statuses = clients
    .map((c) => clientStatus(c, stationsById.get(c.stationId), branchesById.get(c.branchId)?.name ?? "-", now))
    .sort((a, b) => a.client.name.localeCompare(b.client.name, "he"));

  return { clients, stationsById, branchesById, branches, statuses };
}

export interface CoworkingLedger {
  /** מה ששילמתי עד היום — כל ההוצאות של המשרד השיתופי, בכל הסוגים */
  paidToDate: number;
  setupToDate: number;
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

  let setupToDate = 0;
  let variableToDate = 0;
  for (const e of params.variable) {
    if (e.month > upto) continue;
    if (e.category === SETUP_CATEGORY) setupToDate += e.amount || 0;
    else variableToDate += e.amount || 0;
  }

  const receivedToDate = params.clients
    .flatMap((c) => c.payments ?? [])
    .filter((p) => p.month <= upto)
    .reduce((s, p) => s + (p.amount || 0), 0);

  const paidToDate = setupToDate + fixedToDate + variableToDate;
  return { paidToDate, setupToDate, fixedToDate, variableToDate, receivedToDate, balance: receivedToDate - paidToDate };
}
