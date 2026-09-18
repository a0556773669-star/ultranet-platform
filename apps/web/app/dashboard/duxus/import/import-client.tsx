"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, PlayCircle, ShieldCheck, AlertTriangle, CheckCircle2 } from "lucide-react";
import { exportModuleBackupAction, runImportAction, type ImportReport } from "./actions";
import { useToast } from "@/lib/toast";

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-[11px] border border-card-border bg-[#f9fafb] px-2.5 py-2 text-center">
      <div className="text-lg font-extrabold leading-none text-ink">{value}</div>
      <div className="mt-1 text-[11px] font-semibold text-muted">{label}</div>
    </div>
  );
}

/**
 * כלי הייבוא החד-פעמי של רבעון 1.
 *
 * הזרימה מחייבת סדר: קודם גיבוי, אחר כך הרצה יבשה שמראה בדיוק מה ייכתב, ורק
 * אחריה ייבוא בפועל. כפתור הייבוא נעול עד שההרצה היבשה רצה - כדי שאף אחד לא
 * יכתוב לדאטה החי בלי לראות קודם מה עומד לקרות.
 */
export function ImportClient() {
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [report, setReport] = useState<ImportReport | null>(null);
  const [committed, setCommitted] = useState(false);
  const [backedUp, setBackedUp] = useState(false);

  function handleBackup() {
    startTransition(async () => {
      const result = await exportModuleBackupAction();
      if (!result.ok) {
        showError(result.message);
        return;
      }
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `duxus-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setBackedUp(true);
      showSuccess(`גיבוי הורד · ${Object.values(result.counts).reduce((a2, b) => a2 + b, 0)} מסמכים`);
    });
  }

  function handleRun(commit: boolean) {
    if (commit && !confirm("להריץ את הייבוא בפועל? הפעולה כותבת לדאטה החי. היא בטוחה להרצה חוזרת ואינה מוחקת נתונים קיימים.")) return;
    startTransition(async () => {
      const result = await runImportAction(commit);
      if (!result.ok) {
        showError(result.message);
        return;
      }
      setReport(result.report);
      setCommitted(result.committed);
      showSuccess(result.committed ? "הייבוא הושלם" : "הרצה יבשה הסתיימה - לא נכתב דבר");
      if (result.committed) router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {toastNode}

      <section className="card">
        <h2 className="mb-1 text-base font-extrabold text-ink">ייבוא רבעון 1</h2>
        <p className="mb-3 text-xs text-muted">
          ייבוא חד-פעמי של תוכנית רבעון 1 - חודש 1 ושבועותיו כהיסטוריה, וחודש 2 ושבוע 1 כתקופות הפעילות. הייבוא בטוח
          להרצה חוזרת: הוא מזהה רשומות לפי מזהה מקור יציב, מעדכן במקום ליצור, ואינו מוחק או דורס נתונים שאינם חלק ממנו.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleBackup}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-60"
          >
            <Download className="h-3.5 w-3.5" />
            1. גיבוי והורדה
            {backedUp && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          </button>
          <button
            type="button"
            onClick={() => handleRun(false)}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-60"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            2. הרצה יבשה
            {report && !committed && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          </button>
          <button
            type="button"
            onClick={() => handleRun(true)}
            disabled={isPending || !report}
            title={!report ? "יש להריץ קודם הרצה יבשה" : undefined}
            className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            3. ייבוא בפועל
          </button>
          {isPending && <span className="text-xs font-semibold text-muted">רץ...</span>}
        </div>

        {!backedUp && (
          <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            מומלץ להוריד גיבוי לפני הייבוא בפועל.
          </p>
        )}
      </section>

      {report && (
        <section className="card">
          <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold text-ink">
            {committed ? "דוח הייבוא" : "דוח הרצה יבשה"}
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                committed ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-card-border bg-[#f4f6f9] text-muted"
              }`}
            >
              {committed ? "נכתב לדאטה" : "לא נכתב דבר"}
            </span>
          </h2>
          <p className="mb-3 text-xs text-muted">
            רבעון: {report.quarterLabel} · חודש פעיל: {report.activeMonthKey} · שבוע פעיל: {report.activeWeekKey}
          </p>

          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-5">
            <Stat label="סלעים" value={report.plan.rocks} />
            <Stat label="תתי-סלעים" value={report.plan.subRocks} />
            <Stat label="אבני דרך" value={report.plan.milestones} />
            <Stat label="שיוכי תקופה" value={report.plan.assignments} />
            <Stat label="כפילויות שאוחדו" value={report.plan.mergedDuplicates} />
            <Stat label="הושלמו" value={report.plan.done} />
            <Stat label="פתוחות" value={report.plan.open} />
            <Stat label="בחודש 2" value={report.plan.inMonth2} />
            <Stat label="בשבוע 1" value={report.plan.inWeek1} />
            <Stat label="בחודש ולא בשבוע" value={report.plan.monthOnlyNotInWeek} />
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="סלעים חדשים" value={report.rocksCreated} />
            <Stat label="סלעים שעודכנו" value={report.rocksUpdated} />
            <Stat label="אבני דרך חדשות" value={report.milestonesCreated} />
            <Stat label="אבני דרך שעודכנו" value={report.milestonesUpdated} />
          </div>

          <p className="mb-3 text-[11px] text-muted">
            לא נגענו ב-{report.untouchedRocks} סלעים וב-{report.untouchedMilestones} אבני דרך שאינם חלק מהייבוא.
          </p>

          {report.review.length > 0 && (
            <div className="rounded-[11px] border border-amber-300 bg-amber-50/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                סומנו לבדיקה ({report.review.length})
              </div>
              <ul className="list-disc space-y-1 pr-5 text-xs text-amber-900">
                {report.review.map((r) => (
                  <li key={r.key}>
                    <b>{r.title}</b> — {r.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
