import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  ClipboardCheck,
  PackageMinus,
  Receipt,
  Scale,
  ShieldCheck,
} from "lucide-react";
import { authOptions } from "@/lib/auth";
import { loadTransactionModel } from "@/lib/tx-data";
import { loadAssets } from "@/lib/assets-data";
import { flowSnapshot, FLOW_LABEL } from "@/lib/business-ledger";
import { WAREHOUSE_LOCATION } from "@/lib/assets";
import HomeClock from "./home-clock";

const nf = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n: number) => `${nf.format(Math.round(n))} ₪`;

const CARD = "rounded-card border border-card-border bg-white shadow-card";

/**
 * The home screen of the accounting model.
 *
 * Deliberately small: five numbers and the way in. Everything else the business does now lives
 * behind one module, so a home page that tried to summarise "everything" would just be the wall
 * of tiles this rebuild exists to remove.
 */
export default async function DashboardHomePage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const isOwner = session.user?.role === "owner";
  const name = session.user?.name ?? session.user?.email ?? "";

  // A branch manager has exactly one screen: entering what he spent.
  if (!isOwner) redirect("/dashboard/my-expenses");

  const [model, assets] = await Promise.all([loadTransactionModel(), loadAssets()]);
  const snap = flowSnapshot(model.transactions, new Date().toISOString().slice(0, 10));
  const inBranches = [...assets.investmentByLocation.entries()]
    .filter(([loc]) => loc !== WAREHOUSE_LOCATION)
    .reduce((sum, [, inv]) => sum + inv.total, 0);

  const cells = [
    { label: `${FLOW_LABEL} — נכנס החודש`, value: money(snap.monthIncome), color: "#059669" },
    { label: `${FLOW_LABEL} — יצא החודש`, value: money(snap.monthExpenses), color: "#dc2626" },
    {
      label: "מאזן החודש",
      value: money(snap.monthIncome - snap.monthExpenses),
      color: snap.monthIncome - snap.monthExpenses >= 0 ? "#0f6e56" : "#dc2626",
    },
    { label: "השקעה בציוד בסניפים", value: money(inBranches), color: "#6b46c1" },
  ];

  const links = [
    { href: "/dashboard/accounting/entries", label: "רישום ותנועות", note: "המסך היחיד שיוצר כסף", icon: Receipt },
    { href: "/dashboard/accounting/overview", label: "סקירה", note: "מצב העסק לפי סניף", icon: BarChart3 },
    { href: "/dashboard/accounting/bottom-line", label: "השורה התחתונה", note: "שורת מאזן אחת + המזכר ההוני", icon: Scale },
    { href: "/dashboard/accounting/purchases", label: "רכש וציוד", note: "חשבוניות מהספקים", icon: Boxes },
    { href: "/dashboard/accounting/sales", label: "יציאת ציוד", note: "מכירה, גריטה ואבדן", icon: PackageMinus },
    { href: "/dashboard/accounting/review", label: "סקירת הזנות", note: "מה שהסניפים הזינו", icon: ClipboardCheck },
    { href: "/dashboard/accounting/integrity", label: "בדיקת שלמות", note: "האם המספרים מסתדרים", icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-extrabold text-ink">שלום {name}</h1>
          <p className="mt-0.5 text-[12.5px] text-muted">
            הכסף נרשם פעם אחת ברגע שהוא זז. כל מספר אחר בעסק הוא תצוגה שלו.
          </p>
        </div>
        <HomeClock name={name} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {cells.map((c) => (
          <article key={c.label} className={`${CARD} relative overflow-hidden py-2.5 pl-3.5 pr-3`}>
            <span className="absolute right-0 top-0 h-full w-[3px]" style={{ background: c.color }} />
            <p className="text-[11px] font-extrabold text-muted">{c.label}</p>
            <p className="mt-px text-[21px] font-black leading-tight tabular-nums" style={{ color: c.color }}>
              {c.value}
            </p>
          </article>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={`${CARD} flex items-center gap-3 px-4 py-3 transition hover:border-teal`}
          >
            <l.icon className="h-5 w-5 shrink-0 text-teal" />
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-extrabold text-ink">{l.label}</span>
              <span className="block text-[11.5px] text-muted">{l.note}</span>
            </span>
            <ArrowLeft className="h-4 w-4 shrink-0 text-muted" />
          </Link>
        ))}
      </div>
    </div>
  );
}
