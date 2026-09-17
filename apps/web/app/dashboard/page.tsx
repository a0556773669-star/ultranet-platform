import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Laptop as LaptopIcon, Users, FolderOpen, AlertCircle, Package, CheckCircle2, AlertTriangle, ArrowLeft, Armchair, Stethoscope } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import {
  getAssignments,
  isOwnerSession,
  resolveModuleScope,
  topRole,
  unionPerms,
  type PermKey,
} from "@/lib/perms";
import { NAV_ITEMS, visibleFor, type NavItem } from "@/lib/nav-items";
import HomeClock from "./home-clock";
import type { ExpenseScope, Laptop, RecurringVariableExpense, Rental } from "@ultranet/shared-types";
import { getStockSnapshotAction } from "./(computer-rooms)/operations/actions";
import { loadMainLedger } from "@/lib/main-ledger";
import { loadCoworkingData, paymentForMonth, currentMonth as coworkingMonth } from "@/lib/coworking";
import { loadRecurringVariableExpenses } from "@/lib/recurring-expenses";
import { HomeRecurringReminders } from "@/components/recurring-expenses/home-recurring-reminders";

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
  const role = topRole(assignments);
  const perms = unionPerms(assignments);
  const name = session.user?.name ?? session.user?.email ?? "";
  const isOwner = isOwnerSession(session);
  const has = (key: PermKey) => isOwner || Boolean(perms[key]);
  const scopeOf = (key: PermKey) => resolveModuleScope(session, key);
  const rentalsScope = scopeOf("rentals");
  const coworkingScope = scopeOf("coworking");

  const db = getAdminFirestore();

  let moneyStats: {
    todayIncome: number;
    todayExpenses: number;
    monthIncome: number;
    monthExpenses: number;
  } | null = null;

  if (has("accounting")) {
    // Read from the same ledger the accounting screen shows, so the number on the home page and
    // the number on /dashboard/accounting can never disagree: both are the sum of the rows
    // marked countsToMain, and nothing is added back on top here.
    const ledger = await loadMainLedger();
    const today = new Date().toISOString().slice(0, 10);
    moneyStats = {
      todayIncome: ledger.income.filter((r) => r.date === today).reduce((s, r) => s + r.amount, 0),
      todayExpenses: ledger.expenses.filter((r) => r.date === today).reduce((s, r) => s + r.amount, 0),
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

  // חוסרי מלאי מגיעים ממודול התפעול: מה שסניף סימן עליו X בבדיקה של החודש הנוכחי.
  // `getStockSnapshotAction` כבר מסנן לסניפים שהמשתמש רשאי לראות, ולכן אין כאן סינון נוסף.
  let stockPending = 0;
  let missingStock: { name: string; branchName: string }[] | null = null;

  if (has("computers")) {
    const snapshot = await getStockSnapshotAction();
    if (snapshot.alerts) {
      missingStock = snapshot.alerts.flatMap((a) =>
        a.missing.map((name) => ({ name, branchName: a.branchName })),
      );
      stockPending = snapshot.alerts.reduce((sum, a) => sum + a.pending, 0);
    } else {
      const branchName = snapshot.branches[0]?.name ?? "";
      missingStock = snapshot.rows.filter((r) => r.status === "missing").map((r) => ({ name: r.name, branchName }));
      stockPending = snapshot.rows.filter((r) => r.status === null).length;
    }
    missingStock = missingStock.slice(0, 6);
  }

  // קבוע ולא `let`: TypeScript לא שומר צמצום טיפוס של משתנה משתנה בתוך קולבק, וכרטיס
  // המשרד השיתופי קורא את השדות שלו גם בתוך `map`.
  const cwDue = coworkingDue;

  const categories: (NavItem)[] = NAV_ITEMS.filter(
    (item) => item.href !== "/dashboard" && visibleFor(role, perms, item),
  );
  if (isOwner) {
    categories.push({ href: "/dashboard/users", label: "משתמשים והרשאות", icon: Users });
    // הכניסה היחידה לרשומות שאין להן מסך. היא בדף הבית מפני ששם רואים את ההתראות שהן
    // מייצרות, וזו השאלה שהן מעלות: "מאיפה ההתראה הזו, ואיפה מטפלים בה".
    categories.push({ href: "/dashboard/maintenance", label: "בדיקת נתונים", icon: Stethoscope });
  }

  return (
    <div>
      <div className="mb-4">
        <HomeClock name={name} />
      </div>

        {rentedLaptops && (
          <div className="card">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
              <span className="flex items-center gap-1.5"><LaptopIcon className="h-4 w-4" />{"ניידים מושכרים כעת"}</span>
              <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">{rentedLaptops.length}</span>
            </div>
            {rentedLaptops.length === 0 ? (
              <div className="text-sm text-muted">{"אין השכרות פעילות"}</div>
            ) : (
              rentedLaptops.map((l, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-card-border py-2 text-[13px] last:border-b-0">
                  <span className="h-2 w-2 rounded-full bg-teal" />
                  <span className="flex-1 font-medium text-ink">{l.name}</span>
                  <span className="text-[11px] text-muted">{"מאז " + l.startDate}</span>
                </div>
              ))
            )}
          </div>
        )}

      {moneyStats && (
        <div className="mb-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
            <span className="absolute right-0 top-0 h-full w-1 bg-emerald-500" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{"הכנסות עד היום"}</div>
            <div className="mt-1 text-[25px] font-black text-emerald-600">{moneyStats.todayIncome.toLocaleString()} ₪</div>
          </div>
          <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
            <span className="absolute right-0 top-0 h-full w-1 bg-red-500" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{"הוצאות עד היום"}</div>
            <div className="mt-1 text-[25px] font-black text-red-600">{moneyStats.todayExpenses.toLocaleString()} ₪</div>
          </div>
          <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
            <span className="absolute right-0 top-0 h-full w-1 bg-teal" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{"הכנסות החודש"}</div>
            <div className="mt-1 text-[25px] font-black text-teal-dark">{moneyStats.monthIncome.toLocaleString()} ₪</div>
          </div>
          <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 shadow-card">
            <span className="absolute right-0 top-0 h-full w-1 bg-amber-500" />
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{"הוצאות החודש"}</div>
            <div className="mt-1 text-[25px] font-black text-amber-600">{moneyStats.monthExpenses.toLocaleString()} ₪</div>
          </div>
        </div>
      )}

      <div className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted"><FolderOpen className="h-4 w-4" />{"הקטגוריות שלי"}</div>
      <div className="mb-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {categories.length === 0 && (
          <div className="col-span-full rounded-card border border-card-border bg-white p-6 text-center text-sm text-muted shadow-card">
            {"אין קטגוריות זמינות עבורך"}
          </div>
        )}
        {categories.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="flex flex-col items-center gap-1 rounded-card border border-card-border bg-white p-4 text-center shadow-card transition hover:-translate-y-0.5 hover:border-teal hover:shadow-primary"
          >
            <c.icon className="h-6 w-6 text-teal-dark" />
            <span className="text-[13px] font-bold text-ink">{c.label}</span>
          </Link>
        ))}
      </div>

      {recurringExpenses.length > 0 && (
        <div className="mb-3">
          <HomeRecurringReminders expenses={recurringExpenses} canManage />
        </div>
      )}

      <div className="mb-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        {cwDue && cwDue.clients.length > 0 && (
          <div className="card">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
              <span className="flex items-center gap-1.5">
                <Armchair className="h-4 w-4" />
                {`תשלומי משרד שיתופי — ${cwDue.month}`}
              </span>
              <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">
                {cwDue.clients.filter((c) => !c.paid).length} לא שולמו
              </span>
            </div>
            {cwDue.clients.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-2 border-b border-card-border py-2 text-[13px] last:border-b-0"
              >
                <span className={`h-2 w-2 rounded-full ${c.paid ? "bg-emerald-500" : "bg-red-500"}`} />
                <span className="flex-1 font-medium text-ink">
                  {c.name} <span className="text-[11px] text-muted">· עמדה {c.station}</span>
                  {cwDue.multiBranch && !c.orphan && (
                    <span className="text-[11px] text-muted"> · {c.branchName}</span>
                  )}
                  {c.orphan && (
                    <span className="mr-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-extrabold text-amber-900">
                      ללא סניף פעיל
                    </span>
                  )}
                </span>
                <span className={`text-[11px] font-bold ${c.paid ? "text-emerald-600" : "text-red-600"}`}>
                  {c.paid ? "שולם" : `${c.cost.toLocaleString()} ₪ חסר`}
                </span>
              </div>
            ))}
            {cwDue.orphanCount > 0 && (
              <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-bold text-amber-900">
                {cwDue.orphanCount === 1
                  ? "השכרה אחת כאן אינה משויכת לסניף משרד שיתופי פעיל — לכן היא לא מופיעה בעמדות. במסך המשרד השיתופי אפשר לשייך אותה לסניף ולעמדה, או למחוק אותה."
                  : `${cwDue.orphanCount} מההשכרות כאן אינן משויכות לסניף משרד שיתופי פעיל — לכן הן לא מופיעות בעמדות. במסך המשרד השיתופי אפשר לשייך אותן לסניף ולעמדה, או למחוק אותן.`}
              </p>
            )}
            <Link
              href="/dashboard/coworking"
              className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-teal hover:underline"
            >
              {cwDue.orphanCount > 0
                ? "לסימון תשלום ולטיפול בהשכרות ללא סניף"
                : "לסימון תשלום במסך הסניפים והעמדות"}
              <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>
        )}

        {unpaidRentals && unpaidRentals.length > 0 && (
        <div className="card border-red-300 bg-red-50">
          <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-red-700">
            <span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4" />{"חובות השכרות"}</span>
            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-red-700 normal-case">{unpaidRentals.length}</span>
          </div>
          {unpaidRentals.map((u) => (
            <div key={u.id} className="flex items-center gap-2 border-b border-red-100 py-2 text-[13px] last:border-b-0">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span className="flex-1 font-medium text-ink">{u.clientName} – {u.itemName}</span>
              <span className="text-[11px] font-bold text-red-700">{u.amount} ₪</span>
            </div>
          ))}
          <Link href="/dashboard/rentals/manage" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-red-700 hover:underline">
            {"למעבר לאיחוד השכרות"}
            <ArrowLeft className="h-3 w-3" />
          </Link>
        </div>
      )}

      {missingStock && (
          <div className="card">
            <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
              <span className="flex items-center gap-1.5"><Package className="h-4 w-4" />{"מלאי - פריטים בחוסר"}</span>
              {stockPending > 0 && (
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 normal-case text-amber-700">
                  {stockPending}{" "}{"טרם סומנו"}
                </span>
              )}
            </div>
            {missingStock.length === 0 ? (
              <div className="text-sm text-muted">{"אין פריטים בחוסר במלאי"}</div>
            ) : (
              missingStock.map((it, i) => (
                <div key={i} className="flex items-center gap-2 border-b border-card-border py-2 text-[13px] last:border-b-0">
                  <span className="h-2 w-2 rounded-full bg-red-500" />
                  <span className="flex-1 font-medium text-ink">{it.name}</span>
                  <span className="text-[11px] text-muted">{it.branchName}</span>
                </div>
              ))
            )}
            <Link href="/dashboard/operations/stock" className="mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-teal hover:underline">
              {"לעדכון המלאי"}
              <ArrowLeft className="h-3 w-3" />
            </Link>
          </div>
        )}
      </div>
      <div className="card">
        <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" />{"משימות לטיפול"}</span>
          <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">0</span>
        </div>
        <div className="text-sm text-muted">{"ריכוז משימות ייבנה לכל אורך הפיתוח, לפי קטגוריה וצבע"}</div>
      </div>
      <div className="card">
        <div className="mb-3 flex items-center justify-between text-xs font-bold uppercase tracking-wide text-muted">
          <span className="flex items-center gap-1.5"><AlertTriangle className="h-4 w-4" />{"התראות"}</span>
          <span className="rounded-full bg-[#f4f6f9] px-2.5 py-0.5 text-ink normal-case">0</span>
        </div>
        <div className="text-sm text-muted">{"התראות יופיעו כאן בהמשך הפיתוח"}</div>
      </div>
    </div>
  );
}