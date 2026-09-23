"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, PlayCircle, ShieldCheck, AlertTriangle, CheckCircle2, Stethoscope, XCircle } from "lucide-react";
import { exportModuleBackupAction, runDiagnosticsAction, runImportAction, type ImportReport } from "./actions";
import { runPersonalImportAction, type PersonalImportReport } from "./personal-actions";
import { useToast } from "@/lib/toast";

type LogLine = { kind: "info" | "ok" | "error"; text: string; at: string };

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
  const [personalReport, setPersonalReport] = useState<PersonalImportReport | null>(null);
  const [personalCommitted, setPersonalCommitted] = useState(false);
  const [log, setLog] = useState<LogLine[]>([]);

  /**
   * יומן מתמשך על המסך. ה-toast נעלם אחרי שלוש שניות, וזה בדיוק הזמן שבו קל
   * לפספס כישלון ולחשוב ש"לא קרה כלום" - ולכן כל פעולה נרשמת גם כאן ונשארת.
   */
  function push(kind: LogLine["kind"], text: string) {
    setLog((prev) => [...prev, { kind, text, at: new Date().toLocaleTimeString("he-IL") }]);
  }

  /**
   * כל קריאה לשרת עוברת דרך כאן.
   *
   * בלי העטיפה הזו, חריגה בצד השרת (פסק זמן, הרשאה, תקלת Firestore) הייתה
   * מפילה את ה-Promise בשקט והמסך לא היה מציג **דבר**. עכשיו כל כישלון מגיע
   * למסך עם ההודעה האמיתית.
   */
  async function guard<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    push("info", `${label} - התחיל`);
    try {
      const value = await fn();
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      push("error", `${label} - נכשל: ${message}`);
      showError(`${label} נכשל: ${message}`);
      return null;
    }
  }

  function handleBackup() {
    startTransition(async () => {
      const result = await guard("גיבוי", () => exportModuleBackupAction());
      if (!result) return;
      if (!result.ok) {
        push("error", `גיבוי - ${result.message}`);
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
      const total = Object.values(result.counts).reduce((a2, b) => a2 + b, 0);
      push("ok", `גיבוי הורד · ${total} מסמכים · ${Object.entries(result.counts).map(([k, v]) => `${k}=${v}`).join(" · ")}`);
      showSuccess(`גיבוי הורד · ${total} מסמכים`);
    });
  }

  function handleRun(commit: boolean) {
    if (commit && !confirm("להריץ את הייבוא בפועל? הפעולה כותבת לדאטה החי. היא בטוחה להרצה חוזרת ואינה מוחקת נתונים קיימים.")) return;
    startTransition(async () => {
      const label = commit ? "ייבוא רבעון 1" : "הרצה יבשה - רבעון 1";
      const result = await guard(label, () => runImportAction(commit));
      if (!result) return;
      if (!result.ok) {
        push("error", `${label} - ${result.message}`);
        showError(result.message);
        return;
      }
      setReport(result.report);
      setCommitted(result.committed);
      push("ok", `${label} - הסתיים · ${result.report.plan.milestones} אבני דרך · ${result.report.rocksCreated} סלעים חדשים · ${result.report.milestonesCreated} אבני דרך חדשות`);
      showSuccess(result.committed ? "הייבוא הושלם" : "הרצה יבשה הסתיימה - לא נכתב דבר");
      if (result.committed) router.refresh();
    });
  }

  function handlePersonalRun(commit: boolean) {
    if (commit && !confirm("להריץ את ייבוא \"משימות ליוני\" בפועל? הפעולה כותבת לדאטה החי, אינה מוחקת דבר ובטוחה להרצה חוזרת.")) return;
    startTransition(async () => {
      const label = commit ? "ייבוא משימות ליוני" : "הרצה יבשה - משימות ליוני";
      const result = await guard(label, () => runPersonalImportAction(commit));
      if (!result) return;
      if (!result.ok) {
        push("error", `${label} - ${result.message}`);
        showError(result.message);
        return;
      }
      setPersonalReport(result.report);
      setPersonalCommitted(result.committed);
      push("ok", `${label} - הסתיים · ${result.report.created} ייווצרו · ${result.report.updated} יעודכנו · ${result.report.mergedIntoExisting.length} יאוחדו`);
      showSuccess(result.committed ? "ייבוא המשימות האישיות הושלם" : "הרצה יבשה הסתיימה - לא נכתב דבר");
      if (result.committed) router.refresh();
    });
  }

  function handleDiagnostics() {
    startTransition(async () => {
      const result = await guard("בדיקת חיבור", () => runDiagnosticsAction());
      if (!result) return;
      if (!result.ok) {
        push("error", `בדיקת חיבור - ${result.message}`);
        showError(result.message);
        return;
      }
      result.lines.forEach((line) => push("ok", line));
      showSuccess("בדיקת החיבור הסתיימה");
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {toastNode}

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold text-ink">בדיקת חיבור</h2>
          <button
            type="button"
            onClick={handleDiagnostics}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-60"
          >
            <Stethoscope className="h-3.5 w-3.5" />
            הרץ בדיקה
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          לוחצים על זה קודם. הבדיקה סופרת כמה מסמכים יש בכל קולקשן ומוודאת שהחיבור וההרשאות תקינים - כך שאם משהו לא
          עובד, תהיה תשובה ולא מסך שותק.
        </p>
      </section>

      {log.length > 0 && (
        <section className="card">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-ink">יומן הפעולות במסך</h2>
            <button type="button" onClick={() => setLog([])} className="text-xs font-semibold text-muted hover:underline">
              ניקוי
            </button>
          </div>
          <div className="flex flex-col gap-1 font-mono text-[11px]" dir="ltr">
            {log.map((line, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 rounded px-2 py-1 ${
                  line.kind === "error" ? "bg-red-50 text-red-700" : line.kind === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-[#f4f6f9] text-muted"
                }`}
              >
                {line.kind === "error" ? (
                  <XCircle className="mt-0.5 h-3 w-3 shrink-0" />
                ) : line.kind === "ok" ? (
                  <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                ) : null}
                <span className="shrink-0 opacity-60">{line.at}</span>
                <span dir="rtl" className="flex-1 text-right font-sans">{line.text}</span>
              </div>
            ))}
          </div>
        </section>
      )}

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

      {/* --- ייבוא שני, נפרד לגמרי: הטאב האישי "משימות ליוני" --- */}
      <section className="card">
        <h2 className="mb-1 text-base font-extrabold text-ink">ייבוא &quot;משימות ליוני&quot;</h2>
        <p className="mb-3 text-xs text-muted">
          ייבוא נפרד לחלוטין לטאב האישי: 12 משימות פעילות ו-17 היסטוריות. <b>אינו נוגע בסלעים, באבני הדרך או ברבעון.</b>{" "}
          משימה שכבר קיימת בטאב לא תידרס - המידע יאוחד לתוכה והיא תופיע בדוח.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => handlePersonalRun(false)}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9] disabled:opacity-60"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            הרצה יבשה
            {personalReport && !personalCommitted && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
          </button>
          <button
            type="button"
            onClick={() => handlePersonalRun(true)}
            disabled={isPending || !personalReport}
            title={!personalReport ? "יש להריץ קודם הרצה יבשה" : undefined}
            className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
          >
            <PlayCircle className="h-3.5 w-3.5" />
            ייבוא בפועל
          </button>
        </div>

        {!backedUp && (
          <p className="mt-2 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" />
            הגיבוי שלמעלה מכסה גם את הטאב הזה - מומלץ להוריד אותו קודם.
          </p>
        )}
      </section>

      {personalReport && (
        <section className="card">
          <h2 className="mb-1 flex items-center gap-2 text-base font-extrabold text-ink">
            {personalCommitted ? "דוח ייבוא - משימות ליוני" : "דוח הרצה יבשה - משימות ליוני"}
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${
                personalCommitted ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-card-border bg-[#f4f6f9] text-muted"
              }`}
            >
              {personalCommitted ? "נכתב לדאטה" : "לא נכתב דבר"}
            </span>
          </h2>
          <p className="mb-3 text-xs text-muted">נרשמות על שם: {personalReport.createdBy}</p>

          <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
            <Stat label="פעילות" value={personalReport.plan.active} />
            <Stat label="היסטוריות" value={personalReport.plan.completed} />
            <Stat label="דחופות" value={personalReport.plan.urgent} />
            <Stat label="הערות" value={personalReport.plan.comments} />
            <Stat label="עם טלפון" value={personalReport.plan.withPhone} />
            <Stat label="אוחדו במקור" value={personalReport.plan.mergedAtSource} />
          </div>

          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="ייווצרו" value={personalReport.created} />
            <Stat label="יעודכנו" value={personalReport.updated} />
            <Stat label="יאוחדו לקיימות" value={personalReport.mergedIntoExisting.length} />
            <Stat label="לא נגענו" value={personalReport.untouched} />
          </div>

          {personalReport.mergedIntoExisting.length > 0 && (
            <div className="mb-3 rounded-[11px] border border-teal bg-teal-bg/50 p-3">
              <div className="mb-2 text-xs font-bold text-teal-dark">אוחדו לתוך משימות שכבר היו בטאב</div>
              <ul className="list-disc space-y-1 pr-5 text-xs text-ink">
                {personalReport.mergedIntoExisting.map((m) => (
                  <li key={m.title}>
                    <b>{m.title}</b> — זוהתה לפי {m.matchedBy}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {personalReport.review.length > 0 && (
            <div className="rounded-[11px] border border-amber-300 bg-amber-50/60 p-3">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5" />
                סומנו לבדיקה ({personalReport.review.length})
              </div>
              <ul className="list-disc space-y-1 pr-5 text-xs text-amber-900">
                {personalReport.review.map((r) => (
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
