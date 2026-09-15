/**
 * מסך ההנה"ח שהשותף רואה - וזה כל מה שהוא רואה.
 *
 * שש משבצות ותו לא: שלוש לחודש הנוכחי, שלוש "עד היום", ומתחתן שורת "חשבון פתוח".
 * כל סכום כאן הוא *החלק של השותף* ולא המחזור של הסניף:
 *   - הכנסות = ההכנסה שנגבתה בסניף כפול אחוז השותף.
 *   - הוצאות = רק מה שהשותף אמור לשאת בו בפועל (amount - ownerShare). הוצאה שכולה על
 *     הבעלים יוצאת 0 ולא מופיעה בסכום; הוצאה משותפת נכנסת בחלקו בלבד - בלי קשר לשאלה מי
 *     שילם אותה בפועל, שזו כבר שאלה של החשבון הפתוח ולא של הרווח.
 *   - מאזן = הכנסות פחות הוצאות, כלומר כמה השותף באמת הרוויח.
 * החישוב עצמו יושב ב-computeBranchFinancials (lib/branch-accounting-data.ts) ולא שוכפל כאן.
 *
 * "חשבון פתוח" הוא היתרה המצטברת מהספר (lib/branch-ledger.ts) ולא הקיזוז של החודש הבודד:
 * הוא כולל את כל מה שנגרר מחודשים קודמים, ויורד ל-0 ברגע שהבעלים מסמן שההעברה בוצעה.
 */
import { ArrowDownLeft, ArrowUpRight, CheckCircle2 } from "lucide-react";
import type { BranchFinancials } from "@/lib/branch-accounting-data";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

function Box({ label, value, tone }: { label: string; value: number; tone?: "good" | "bad" }) {
  const color = tone === "bad" ? "text-red-600" : tone === "good" ? "text-teal-dark" : "text-ink";
  return (
    <div className="rounded-card border border-card-border bg-white p-4 text-center">
      <div className="text-xs text-muted">{label}</div>
      <div className={`mt-1 text-xl font-extrabold ${color}`}>{money(value)}</div>
    </div>
  );
}

/** היתרה המצטברת מול הבעלים. חיובי = השותף חייב לבעלים, שלילי = הבעלים חייב לשותף. */
function OpenAccount({ balance }: { balance: number }) {
  const settled = Math.abs(balance) < 1;
  return (
    <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
      <div className="text-xs font-bold uppercase tracking-wide text-muted">חשבון פתוח</div>
      {settled ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-lg font-black text-muted">
          <CheckCircle2 className="h-4 w-4" />
          0 ₪
          <span className="text-xs font-semibold">אין חוב פתוח</span>
        </div>
      ) : balance > 0 ? (
        <div className="mt-1.5 flex items-center gap-1.5 text-lg font-black text-red-600">
          <ArrowUpRight className="h-4 w-4" />
          {money(balance)}
          <span className="text-xs font-semibold text-muted">עליך להעביר לבעלים</span>
        </div>
      ) : (
        <div className="mt-1.5 flex items-center gap-1.5 text-lg font-black text-teal-dark">
          <ArrowDownLeft className="h-4 w-4" />
          {money(-balance)}
          <span className="text-xs font-semibold text-muted">הבעלים צריך להעביר אליך</span>
        </div>
      )}
    </div>
  );
}

export interface PartnerBranchView {
  financials: BranchFinancials;
  /** currentBalance של הספר: חיובי = השותף חייב לבעלים, שלילי = הבעלים חייב לשותף */
  openBalance: number;
  /** הסניף נסגר או נמחק. מוצג בכל זאת - החשבון הפתוח שלו עדיין שלו. */
  closed: boolean;
}

export function PartnerAccountingView({ view }: { view: PartnerBranchView }) {
  const f = view.financials;
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-extrabold text-ink">
        {f.branch.name}
        {view.closed && <span className="mr-1.5 text-[11px] font-bold text-muted">(נסגר)</span>}
      </h2>
      <div className="grid grid-cols-3 gap-3">
        <Box label="הכנסות החודש" value={f.incomeThisMonth} />
        <Box label="הוצאות החודש" value={f.expenseThisMonth} />
        <Box label="מאזן החודש" value={f.balanceThisMonth} tone={f.balanceThisMonth >= 0 ? "good" : "bad"} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Box label="הכנסות עד היום" value={f.incomeToDate} />
        <Box label="הוצאות עד היום" value={f.expenseToDate} />
        <Box label="מאזן עד היום" value={f.balanceToDate} tone={f.balanceToDate >= 0 ? "good" : "bad"} />
      </div>
      <OpenAccount balance={view.openBalance} />
    </div>
  );
}
