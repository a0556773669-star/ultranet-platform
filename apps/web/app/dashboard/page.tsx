import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Laptop as LaptopIcon, AlertTriangle, ArrowLeft, Plus, Search, Target, ListChecks } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  getAssignments,
  isOwnerSession,
  resolveModuleScope,
  unionPerms,
  type PermKey,
} from "@/lib/perms";
import HomeClock from "./home-clock";
import type { ExpenseScope, Laptop, RecurringVariableExpense, Rental } from "@ultranet/shared-types";
import { loadMainLedger } from "@/lib/main-ledger";
import { loadCoworkingData, paymentForMonth, currentMonth as coworkingMonth } from "@/lib/coworking";
import { loadRecurringVariableExpenses } from "@/lib/recurring-expenses";
import { HomeRecurringReminders } from "@/components/recurring-expenses/home-recurring-reminders";
import { loadPendingReportReminder } from "@/lib/branch-report-send";
import { monthLabel as heMonthLabel } from "@/lib/branch-month-report";
import { loadHomeTasks, type HomeTasks } from "@/lib/home-tasks";

/** באיזו הרשאה מותנה כל scope של הוצאה קבועה משתנה בתזכורת שבדף הבית. */
const RECURRING_SCOPE_PERM: Record<ExpenseScope, PermKey> = {
  computers: "computers",
  rentals: "rentals",
  coworking: "coworking",
  main: "accounting",
};

export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  // דף הבית הוא היחיד שמסתכל על כמה מודולים בבת אחת, ולכן הוא צריך את כל הכובעים ולא
  // כובע אחד: ההרשאות הן האיחוד, והסינון לפי סניף נעשה בכל כרטיס לפי הכובע של **אותו**
  // מודול. מי שהוא שותף בסניף השכרות וגם עובד בחדר מחשבים רואה כאן את שניהם, כל אחד
  // בסניף הנכון שלו.
  const assignments = getAssignments(session);
  const perms = unionPerms(assignments);
  const name = session.user?.name ?? session.user?.email ?? "";
  const isOwner = isOwnerSession(session);
  const has = (key: PermKey) => isOwner || Boolean(perms[key]);
  const scopeOf = (key: PermKey) => resolveModuleScope(session, key);
  const rentalsScope = scopeOf("rentals");
  const coworkingScope = scopeOf("coworking");

  const db = getAdminFirestore();

  let moneyStats: {
    totalIncome: number;
    totalExpenses: number;
    monthIncome: number;
    monthExpenses: number;
  } | null = null;

  // כרטיסי הכסף הם הסה"כ של ההנה"ח הראשית — ולכן לבעלים בלבד, בדיוק כמו המסך עצמו
  // (`requireOwner` בכל `/dashboard/accounting`). עד 2026-10-15 הם הוצגו לכל מי שיש לו הרשאת
  // `accounting`, כלומר גם למי שנחסם מההנה"ח עצמה (החלטת יוני).
  if (isOwner) {
    // Read from the same ledger the accounting screen shows, so the number on the home page and
    // the number on /dashboard/accounting can never disagree: both are the sum of the rows
    // marked countsToMain, and nothing is added back on top here.
    // "עד היום" = הסה"כ המצטבר, בדיוק "הכנסנו/הוצאנו עד היום" של ההנה"ח הראשית. עד עכשיו
    // נספרו כאן רק שורות שתאריכן היום, כך שהקוביות הראו כמעט תמיד 0.
    const ledger = await loadMainLedger();
    moneyStats = {
      totalIncome: ledger.totals.income,
      totalExpenses: ledger.totals.expense,
      monthIncome: ledger.thisMonth.income,
      monthExpenses: ledger.thisMonth.expense,
    };
  }

  let rentedLaptops: { name: string; startDate: string }[] | null = null;
  let unpaidRentals: { id: string; clientName: string; itemName: string; amount: number }[] | null = null;

  if (has("rentals")) {
    // One wave instead of two: the second pair used to wait on the first for no reason, doubling
    // this section's latency. The laptop and client collections are read for names only, so they
    // fetch just that field rather than every document in full.
    const [laptopsSnap, rentalsSnap, clientsSnap2, unpaidSnap] = await Promise.all([
      db.collection("n_laptops").select("name").get(),
      db.collection("n_rentals").where("status", "==", "active").where("kind", "==", "laptop").get(),
      db.collection("n_rental_clients").select("name").get(),
      db.collection("n_rentals").where("status", "==", "returned").where("paid", "==", false).get(),
    ]);
    const laptopNames: Record<string, string> = {};
    laptopsSnap.docs.forEach((d) => {
      laptopNames[d.id] = (d.data() as Laptop).name;
    });
    rentedLaptops = rentalsSnap.docs
      .map((d) => d.data() as Rental)
      .filter((r) => rentalsScope.allows(r.branchId))
      .map((r) => ({ name: laptopNames[r.itemId] || "נייד", startDate: r.startDate }));

    const clientNames: Record<string, string> = {};
    clientsSnap2.docs.forEach((d) => {
      clientNames[d.id] = (d.data() as { name: string }).name;
    });
    unpaidRentals = unpaidSnap.docs
      .map((d) => ({ ...(d.data() as Omit<Rental, "id">), id: d.id }))
      .filter((r) => rentalsScope.allows(r.branchId))
      .map((r) => ({
        id: r.id,
        clientName: clientNames[r.clientId] || "לקוח",
        itemName: laptopNames[r.itemId] || "פריט",
        amount: r.finalPrice ?? r.calcPrice,
      }));
  }

  // המשרד השיתופי: מי מהשוכרים לא שילם את החודש. יום התשלום של כל עמדה הוא היום שבו
  // התחילה השכירות שלה, ולכן בכל 1 בחודש הרשימה מתמלאת מחדש מעצמה. הסימון עצמו נעשה
  // במסך העמדות, ששם גם נרשמת ההכנסה בראשי.
  //
  // הכרטיס סופר את כל ההשכרות ולא רק את אלה ששייכות לסניף חי, ולכן הוא יכול להתריע גם על
  // השכרה יתומה — רשומה שה-`branchId` שלה מצביע על סניף מחוק או לא קיים. התראה כזו נראתה
  // בעבר כמו תשלום בלי שום מסך מאחוריו; היא מסומנת כאן במפורש, ומסך המשרד השיתופי מציג
  // אותה בסעיף נפרד עם אפשרות לשייך או למחוק.
  let coworkingDue:
    | {
        clients: {
          id: string;
          name: string;
          station: string;
          branchName: string;
          cost: number;
          paid: boolean;
          orphan: boolean;
        }[];
        month: string;
        multiBranch: boolean;
        orphanCount: number;
      }
    | null = null;

  if (has("coworking")) {
    const cw = await loadCoworkingData(isOwner ? undefined : { branchId: coworkingScope.branchId });
    const month = coworkingMonth();
    const clients = cw.statuses
      .filter((st) => st.active)
      .map((st) => ({
        id: st.client.id,
        name: st.client.name,
        station: st.client.stationNumber ?? st.station?.name ?? "-",
        branchName: st.branchName,
        cost: st.cost,
        paid: Boolean(paymentForMonth(st.client, month)),
        orphan: st.orphan,
      }));
    coworkingDue = {
      month,
      clients,
      multiBranch: cw.branches.length > 1,
      orphanCount: clients.filter((c) => c.orphan).length,
    };
  }

  // ההוצאות הקבועות המשתנות שהמשתמש הזה בכלל רשאי לראות. הכרטיס יושב בדף הבית מפני
  // שתזכורת שחיה בתוך מסך ההוצאות של הסניף דורשת שכבר יזכרו להיכנס אליו — והמודול כולו
  // קיים בדיוק בשביל מה ששוכחים.
  const visibleScopes = new Set(
    (Object.keys(RECURRING_SCOPE_PERM) as ExpenseScope[]).filter((scope) => has(RECURRING_SCOPE_PERM[scope])),
  );
  let recurringExpenses: RecurringVariableExpense[] = [];
  if (visibleScopes.size > 0) {
    const all = await loadRecurringVariableExpenses();
    // עובד סניף רואה ומעדכן רק את הסניף שלו — בדיוק מה ש-`requireAccess` בפעולות מתיר,
    // כדי שלא יוצג כאן טופס שכל שליחה שלו תיפול על "אין הרשאה".
    // כל סוג הוצאה נבדק מול הכובע של המודול שלו — הוצאה של חדר מחשבים מול השיוך בחדרי
    // המחשבים, של השכרות מול השיוך בהשכרות.
    recurringExpenses = all.filter((e) => {
      if (!visibleScopes.has(e.scope)) return false;
      if (isOwner) return true;
      return Boolean(e.branchId) && scopeOf(RECURRING_SCOPE_PERM[e.scope]).allows(e.branchId ?? "");
    });
  }

  // מלאי (בדיקות V/X בחדרי מחשבים) הוסתר מהממשק ולא מוצג בדף הבית — סעיף 10 באפיון השדרוג.
  // הנתונים נשמרים כמו שהם; ראו `STOCK_MODULE_HIDDEN` ב-`lib/feature-flags.ts`.

  // קבוע ולא `let`: TypeScript לא שומר צמצום טיפוס של משתנה משתנה בתוך קולבק, וכרטיס
  // המשרד השיתופי קורא את השדות שלו גם בתוך `map`.
  const cwDue = coworkingDue;

  // משימות ליוני, השבוע והרבעון — רק למי שיש לו את מודול המשימות. כשהמקור לא נטען מוצג
  // "לא נטען" ולא 0 (סעיף 1 באפיון השדרוג).
  let homeTasks: HomeTasks | "error" | null = null;
  if (has("duxus")) {
    homeTasks = await loadHomeTasks().catch(() => "error" as const);
  }

  // הדו"ח החודשי לשותפים נשלח רק בלחיצת כפתור - ולכן מה-1 לחודש ועד שהוא נשלח, הבעלים
  // רואה כאן תזכורת לשלוח אותו (ראו loadPendingReportReminder).
  const reportReminder = isOwner ? await loadPendingReportReminder().catch(() => null) : null;

  const unpaidCount = unpaidRentals?.length ?? 0;
  const unpaidSum = (unpaidRentals ?? []).reduce((sum, u) => sum + (u.amount || 0), 0);
  const cwUnpaid = cwDue ? cwDue.clients.filter((c) => !c.paid).length : 0;
  const recurringMissing = recurringExpenses.length;
  const attentionRows = [
    recurringExpenses.length > 0 && {
      key: "recurring",
      label: "הוצאות קבועות משתנות שחסר להן סכום",
      value: String(recurringMissing),
      href: "#recurring",
      tone: "amber" as const,
    },
    unpaidRentals && {
      key: "debts",
      label: unpaidCount > 0 ? `חובות השכרות · ₪${unpaidSum.toLocaleString("he-IL")}` : "חובות השכרות",
      value: String(unpaidCount),
      href: "/dashboard/rentals/manage",
      tone: unpaidCount > 0 ? ("red" as const) : ("muted" as const),
    },
    cwDue && {
      key: "coworking",
      label: `תשלומי משרד שיתופי חסרים — ${cwDue.month}`,
      value: String(cwUnpaid),
      href: "/dashboard/coworking",
      tone: cwUnpaid > 0 ? ("amber" as const) : ("muted" as const),
    },
  ].filter(Boolean) as { key: string; label: string; value: string; href: string; tone: "red" | "amber" | "muted" }[];
  const toneClass = { red: "text-red-600", amber: "text-amber-600", muted: "text-muted" };
  const openAttention =
    recurringMissing + unpaidCount + cwUnpaid;

  const canRent = has("rentals");
  const tasks = homeTasks;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <HomeClock name={name} />

      {reportReminder && (
        <Link
          href={`/dashboard/accounting/mobile?month=${reportReminder.month}`}
          className="flex items-center gap-3 rounded-card border-2 border-amber-400 bg-amber-50 p-4 shadow-card transition hover:bg-amber-100"
        >
          <AlertTriangle className="h-6 w-6 shrink-0 text-amber-600" />
          <div className="flex-1">
            <div className="text-[15px] font-extrabold text-amber-900">
              {`עליך לשלוח את הדו"ח החודשי של ${heMonthLabel(reportReminder.month)} לסניפים`}
            </div>
            <div className="mt-0.5 text-[12.5px] text-amber-800">
              {`עוד לא נשלח אל: ${reportReminder.branchNames.join(", ")}. לפני השליחה כדאי לעבור על התצוגה המקדימה ולוודא שכל ההעברות וההוצאות של החודש נרשמו.`}
            </div>
          </div>
          <ArrowLeft className="h-5 w-5 shrink-0 text-amber-700" />
        </Link>
      )}

      {(canRent || isOwner) && (
        <div className="flex flex-wrap gap-2">
          {canRent && (
            <Link href="/dashboard/rentals/new" className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90">
              <Plus className="h-4 w-4" />
              {"השכרה חדשה"}
            </Link>
          )}
          {canRent && (
            <Link href="/dashboard/rentals/manage" className="btn-outline flex items-center gap-1.5">
              <Search className="h-4 w-4" />
              {"איתור השכרה / החזרה"}
            </Link>
          )}
          {isOwner && (
            <Link href="/dashboard/accounting" className="btn-outline flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              {"הכנסה"}
            </Link>
          )}
          {isOwner && (
            <Link href="/dashboard/accounting" className="btn-outline flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              {"הוצאה"}
            </Link>
          )}
        </div>
      )}

      {(rentedLaptops || moneyStats) && (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {rentedLaptops && (
            <Link
              href="/dashboard/rentals/manage"
              className="rounded-card bg-gradient-to-br from-teal-dark to-teal p-4 text-white shadow-primary transition hover:opacity-95"
            >
              <div className="flex items-center gap-1.5 text-[12px] font-semibold text-white/85">
                <LaptopIcon className="h-4 w-4" />
                {"מחשבים מושכרים כעת"}
              </div>
              <div className="mt-1 text-[28px] font-black tabular-nums">{rentedLaptops.length}</div>
              <div className="text-[11px] text-white/80">{"מחשבים ניידים בלבד, בלי סטיקים · לפירוט"}</div>
            </Link>
          )}
          {moneyStats && (
            <>
              <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
                <div className="text-[12px] font-semibold text-muted">{"נכנס עד היום"}</div>
                <div className="mt-1 text-[24px] font-black tabular-nums text-emerald-600">
                  {moneyStats.totalIncome.toLocaleString()} ₪
                </div>
                <div className="text-[11px] tabular-nums text-muted">{`החודש ${moneyStats.monthIncome.toLocaleString()} ₪`}</div>
              </div>
              <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
                <div className="text-[12px] font-semibold text-muted">{"הוצאתי עד היום"}</div>
                <div className="mt-1 text-[24px] font-black tabular-nums text-red-600">
                  {moneyStats.totalExpenses.toLocaleString()} ₪
                </div>
                <div className="text-[11px] tabular-nums text-muted">{`החודש ${moneyStats.monthExpenses.toLocaleString()} ₪`}</div>
              </div>
              <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
                <div className="text-[12px] font-semibold text-muted">{"הפרש (נכנס פחות יצא)"}</div>
                <div
                  className={`mt-1 text-[24px] font-black tabular-nums ${
                    moneyStats.totalIncome - moneyStats.totalExpenses >= 0 ? "text-teal-dark" : "text-red-600"
                  }`}
                >
                  {(moneyStats.totalIncome - moneyStats.totalExpenses).toLocaleString()} ₪
                </div>
                <div className="text-[11px] tabular-nums text-muted">
                  {`החודש ${(moneyStats.monthIncome - moneyStats.monthExpenses).toLocaleString()} ₪`}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {attentionRows.length > 0 && (
          <div className="card">
            <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted">
              <span className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" />
                {"דורש טיפול"}
              </span>
              {openAttention > 0 && (
                <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-red-700">{openAttention}</span>
              )}
            </div>
            {attentionRows.map((row) => (
              <Link
                key={row.key}
                href={row.href}
                className="flex items-center justify-between gap-2 border-b border-card-border py-2 text-[13px] last:border-b-0 hover:text-teal-dark"
              >
                <span className="font-medium text-ink">{row.label}</span>
                <span className={`font-extrabold tabular-nums ${toneClass[row.tone]}`}>{row.value}</span>
              </Link>
            ))}
            {cwDue && cwDue.orphanCount > 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-900">
                {cwDue.orphanCount === 1
                  ? "השכרה אחת במשרד השיתופי אינה משויכת לסניף פעיל — אפשר לשייך אותה במסך המשרד השיתופי."
                  : `${cwDue.orphanCount} השכרות במשרד השיתופי אינן משויכות לסניף פעיל — אפשר לשייך אותן במסך המשרד השיתופי.`}
              </p>
            )}
          </div>
        )}

        {tasks === "error" && (
          <div className="card lg:col-span-2">
            <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted">
              <ListChecks className="h-4 w-4" />
              {"משימות"}
            </div>
            <div className="text-sm text-muted">{"מקור המשימות לא נטען כרגע — המספרים לא מוצגים כדי שלא ייראו כמו 0."}</div>
          </div>
        )}

        {tasks && tasks !== "error" && (
          <>
            <div className="card">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-muted">
                <ListChecks className="h-4 w-4" />
                {"המשימות שלי"}
              </div>
              {tasks.personal ? (
                <>
                  <Link href="/dashboard/duxus/personal" className="flex items-center justify-between border-b border-card-border py-2 text-[13px] hover:text-teal-dark">
                    <span className="font-medium text-ink">{"משימות ליוני — פתוחות"}</span>
                    <span className="font-extrabold tabular-nums text-ink">{tasks.personal.open}</span>
                  </Link>
                  <Link href="/dashboard/duxus/personal" className="flex items-center justify-between border-b border-card-border py-2 text-[13px] hover:text-teal-dark">
                    <span className="font-medium text-ink">{"מתוכן דחופות"}</span>
                    <span className={`font-extrabold tabular-nums ${tasks.personal.urgent > 0 ? "text-red-600" : "text-muted"}`}>
                      {tasks.personal.urgent}
                    </span>
                  </Link>
                </>
              ) : null}
              <Link href="/dashboard/duxus/rocks/week" className="flex items-center justify-between py-2 text-[13px] hover:text-teal-dark">
                <span className="font-medium text-ink">{"השבוע: נבחרו / הושלמו"}</span>
                <span className="font-extrabold tabular-nums text-ink">
                  {tasks.week ? `${tasks.week.selected} / ${tasks.week.done}` : "לא נפתח"}
                </span>
              </Link>
            </div>

            <div className="card">
              <div className="mb-2 flex items-center justify-between text-xs font-bold text-muted">
                <span className="flex items-center gap-1.5">
                  <Target className="h-4 w-4" />
                  {"הרבעון"}
                </span>
                {tasks.quarterLabel && <span className="font-medium">{tasks.quarterLabel}</span>}
              </div>
              {tasks.rocks.length === 0 ? (
                <div className="text-sm text-muted">{"עוד לא הוגדרו סלעים לרבעון"}</div>
              ) : (
                tasks.rocks.map((rock) => (
                  <Link key={rock.id} href="/dashboard/duxus/rocks/quarter" className="block border-b border-card-border py-2 last:border-b-0">
                    <div className="flex items-center justify-between gap-2 text-[13px]">
                      <span className="font-medium text-ink">{rock.title}</span>
                      <span className="font-extrabold tabular-nums text-ink">
                        {rock.total === 0 ? "אין אבני דרך" : `${rock.percent}%`}
                      </span>
                    </div>
                    {rock.total > 0 && (
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#f4f6f9]">
                        <div className="h-full rounded-full bg-teal" style={{ width: `${rock.percent}%` }} />
                      </div>
                    )}
                  </Link>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {recurringExpenses.length > 0 && (
        <div id="recurring">
          <HomeRecurringReminders expenses={recurringExpenses} canManage />
        </div>
      )}
    </div>
  );
}
