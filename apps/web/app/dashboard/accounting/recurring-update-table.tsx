"use client";

import { useCallback, useMemo, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Gauge } from "lucide-react";
import { useToast } from "@/lib/toast";
import { setRecurringMonthAmountAction } from "@/components/recurring-expenses/actions";
import { DataTable, money, type DataColumn } from "./data-table";
import { RecurringRowControls } from "./recurring-row-controls";

/**
 * עדכון ההוצאות הקבועות המשתנות — של **כל המודולים**, במקום אחד.
 *
 * זו הפעולה החוזרת היחידה שההנה"ח דורשת: ב-1 לחודש מישהו צריך להגיד כמה היה החשמל.
 * עד היום היא הייתה מפוזרת על פני ארבעה מסכים — חדרי מחשבים, השכרות, משרד שיתופי
 * והוצאות נוספות — ולכן היא נעשתה חלקית: מי שעדכן את החשמל של הסניף לא ידע שחסר גם
 * המע"מ של העסק. כאן כל השורות יושבות יחד, עם בורר חודש אחד למעלה, ואפשר לרוץ עליהן
 * מלמעלה למטה.
 *
 * ברירת המחדל היא **החודש שנסגר** ולא החודש הרץ: את חשבון החשמל של ספטמבר אי אפשר
 * לעדכן ב-15 בספטמבר, כי הוא עוד לא הגיע. החודש הרץ נמצא ברשימה בכל זאת, כי מי שכן
 * יודע את הסכום מראש צריך דרך להזין אותו.
 */

export interface RecurringUpdateRow {
  id: string;
  name: string;
  /** "הנה"ח ראשית" / "חדרי מחשבים — סניף X" — מאיזה מודול השורה הגיעה */
  scopeLabel: string;
  category: string;
  frequencyLabel: string;
  /** הסכום שנרשם לכל חודש בחלון המוצג */
  values: Record<string, number>;
  /** החודשים בחלון שבהם באמת מגיע תשלום */
  due: string[];
  /** הסכום האחרון שנרשם (או ברירת המחדל) — ההצעה בשדה הריק */
  suggested: number;
  /** חודשים שנסגרו ועדיין אין להם סכום */
  missingCount: number;
  totalToDate: number;
  countsToMain: boolean;
  /** ריק = פעילה. תאריך = הופסקה בו */
  endDate: string;
}

function monthLabel(month: string) {
  const [y, m] = month.split("-");
  return `${m}/${(y ?? "").slice(2)}`;
}

/** תא הזנה אחד. `key={month}` בקריאה מחוץ לו הוא מה שמאפס את השדה בהחלפת חודש. */
function MonthAmountCell({
  id,
  month,
  value,
  suggested,
}: {
  id: string;
  month: string;
  value: number | undefined;
  suggested: number;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await setRecurringMonthAmountAction(id, formData);
        router.refresh();
        showSuccess(`הסכום של ${monthLabel(month)} נשמר`);
      } catch (err) {
        showError(err instanceof Error ? err.message : "אירעה שגיאה בשמירה");
      }
    });
  }

  return (
    <>
      <form action={handleSubmit} className="flex items-center justify-center gap-1">
        <input type="hidden" name="month" value={month} />
        <input
          name="amount"
          type="number"
          step="0.01"
          required
          defaultValue={value ?? ""}
          placeholder={suggested > 0 ? String(Math.round(suggested)) : "₪"}
          className={`w-20 rounded border px-1 py-0.5 text-center text-[11px] tabular-nums focus:outline-none ${
            value === undefined ? "border-amber-300 bg-white" : "border-card-border bg-white"
          }`}
        />
        <button
          type="submit"
          disabled={isPending}
          className={`rounded px-1.5 py-0.5 text-[10px] font-bold text-white transition disabled:opacity-50 ${
            value === undefined ? "bg-amber-500" : "bg-teal"
          }`}
        >
          {isPending ? "..." : value === undefined ? "עדכן" : "שנה"}
        </button>
      </form>
      {toastNode}
    </>
  );
}

export function RecurringUpdateTable({
  rows,
  months,
  defaultMonth,
  currentMonth,
  lastClosedMonth,
  today,
  historyPanels,
}: {
  rows: RecurringUpdateRow[];
  /** חלון החודשים לבחירה, מהחדש לישן */
  months: string[];
  defaultMonth: string;
  currentMonth: string;
  lastClosedMonth: string;
  /** YYYY-MM-DD — ברירת המחדל בשדה ההפסקה */
  today: string;
  /** פאנלי ההיסטוריה המלאה (`RecurringHistoryPanel`), מרונדרים בשרת ונמסרים כ-ReactNode:
   *  הם Server Components עם Server Actions בתוכם, ולכן אי אפשר לבנות אותם מכאן. */
  historyPanels?: ReactNode;
}) {
  const [month, setMonth] = useState(defaultMonth);

  const statusOf = useCallback(
    (r: RecurringUpdateRow) => {
      if (!r.due.includes(month)) return "לא נדרש בחודש זה";
      if (r.values[month] !== undefined) return "עודכן";
      return month > lastClosedMonth ? "החודש עוד לא נסגר" : "חסר עדכון";
    },
    [month, lastClosedMonth],
  );

  const columns = useMemo<DataColumn<RecurringUpdateRow>[]>(
    () => [
      {
        key: "name",
        label: "הוצאה",
        className: "min-w-0",
        value: (r) => r.name,
        render: (r) => (
          <div className="min-w-0" title={`${r.name} · ${r.category || "ללא קטגוריה"}`}>
            <p className="truncate font-bold text-ink">
              {r.name}
              {r.endDate && <span className="mr-1.5 text-[10.5px] font-bold text-muted">(הופסקה)</span>}
            </p>
            <p className="truncate text-[10.5px] text-muted">{r.category || "ללא קטגוריה"}</p>
          </div>
        ),
      },
      {
        key: "scope",
        label: "מודול",
        className: "w-[168px] truncate",
        filterable: true,
        allLabel: "כל המודולים",
        value: (r) => r.scopeLabel,
        render: (r) => (
          <span className="text-muted" title={r.scopeLabel}>
            {r.scopeLabel}
          </span>
        ),
      },
      {
        key: "frequency",
        label: "תדירות",
        className: "w-[104px] truncate",
        filterable: true,
        allLabel: "כל התדירויות",
        value: (r) => r.frequencyLabel,
        render: (r) => <span className="text-muted">{r.frequencyLabel}</span>,
      },
      {
        key: "status",
        label: "סטטוס",
        className: "w-[136px] truncate",
        align: "center",
        filterable: true,
        allLabel: "כל הסטטוסים",
        value: statusOf,
        render: (r) => {
          const status = statusOf(r);
          const tone =
            status === "עודכן"
              ? "bg-teal-bg text-teal-dark"
              : status === "חסר עדכון"
                ? "bg-amber-100 text-amber-800"
                : "bg-[#f4f6f9] text-muted";
          return (
            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${tone}`}>{status}</span>
          );
        },
      },
      {
        key: "amount",
        label: `סכום ${monthLabel(month)}`,
        className: "w-[152px]",
        align: "center",
        value: (r) => r.values[month] ?? 0,
        render: (r) =>
          r.due.includes(month) ? (
            <MonthAmountCell
              key={month}
              id={r.id}
              month={month}
              value={r.values[month]}
              suggested={r.suggested}
            />
          ) : (
            <span className="text-muted" title="בתדירות הזו אין חיוב בחודש הנבחר">
              —
            </span>
          ),
      },
      {
        key: "missing",
        label: "חודשים חסרים",
        className: "w-[118px]",
        align: "center",
        value: (r) => r.missingCount,
        render: (r) =>
          r.missingCount > 0 ? (
            <span className="font-extrabold tabular-nums text-amber-700">{r.missingCount}</span>
          ) : (
            <span className="text-muted">—</span>
          ),
      },
      {
        key: "total",
        label: 'סה"כ עד היום',
        className: "w-[118px]",
        align: "center",
        value: (r) => r.totalToDate,
        render: (r) => <span className="font-extrabold tabular-nums text-red-600">{money(r.totalToDate)}</span>,
      },
      {
        key: "actions",
        label: "",
        align: "left",
        className: "w-[186px]",
        render: (r) => <RecurringRowControls id={r.id} endDate={r.endDate} today={today} />,
      },
    ],
    [month, statusOf, today],
  );

  const table = (
    <DataTable
      title="עדכון הוצאות קבועות משתנות"
      icon={Gauge}
      rows={rows}
      columns={columns}
      getKey={(r) => r.id}
      searchText={(r) => `${r.name} ${r.category} ${r.scopeLabel} ${r.frequencyLabel}`}
      searchHint="חיפוש הוצאה, קטגוריה או מודול..."
      amountOf={(r) => r.values[month] ?? 0}
      amountClass="text-red-600"
      totalLabel={`נרשם ב-${monthLabel(month)}`}
      defaultSortKey="missing"
      emptyText="אין עדיין הוצאות קבועות משתנות באף מודול"
      minWidth={1180}
      toolbar={
        <label className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted">
          חודש לעדכון
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="rounded-lg border border-card-border bg-white px-2 py-1 text-[11px] font-bold text-ink focus:border-teal focus:outline-none"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabel(m)}
                {m === currentMonth ? " (החודש הנוכחי)" : m === lastClosedMonth ? " (החודש שנסגר)" : ""}
              </option>
            ))}
          </select>
        </label>
      }
      note={
        <>
          השורות כאן הן כל ההוצאות הקבועות המשתנות מכל המודולים — חדרי מחשבים, השכרות, משרד שיתופי
          והעסק עצמו — וכל עדכון נשמר במודול שההוצאה שייכת לו. חודש שעדיין רץ פתוח להזנה מוקדמת אבל
          אינו נספר כפיגור; &quot;חודשים חסרים&quot; סופר רק חודשים שכבר נסגרו.
        </>
      }
    />
  );

  if (!historyPanels) return table;

  return (
    <div className="flex flex-col gap-2">
      {table}
      {/* ההיסטוריה המלאה נשארת מתחת לטבלה ומקופלת: הטבלה היא העבודה של ה-1 לחודש, וכל
          השאר — למלא שנה שלמה שנרשמה באיחור, לתקן הקלדה מלפני חצי שנה, לשנות תדירות —
          נעשה מדי פעם ולא צריך לתפוס מקום בכל כניסה. */}
      <div className="flex flex-col gap-1.5">{historyPanels}</div>
    </div>
  );
}
