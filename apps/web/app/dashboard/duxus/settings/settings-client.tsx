"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Save, ShieldCheck } from "lucide-react";
import type { TaskSettings } from "@ultranet/shared-types";
import { saveTaskSettingsAction } from "../rocks/actions";
import { savePersonalAccessAction } from "../personal/actions";
import { useToast } from "@/lib/toast";

const WEEKDAYS = ["ראשון", "שני", "שלישי", "רביעי", "חמישי", "שישי", "שבת"];

const SELECT =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export type PersonalAccessSettings = { ownerEmails: string[]; editorEmails: string[]; viewerEmails: string[] };

/**
 * הגדרות המודול (סעיף 19): שבוע העבודה ומועד האזהרה הם **הגדרה ולא קבוע בקוד**,
 * כדי שאפשר יהיה לשנות אותם בלי לגעת בפיתוח. גם מספר הסלעים המומלץ לרבעון נקבע
 * כאן - הוא מפעיל אזהרה, לא חסימה. מתחתיהן, לבעלים בלבד, יושבת הגדרת הגישה
 * לטאב "משימות ליוני".
 */
export function SettingsClient({
  settings,
  personalAccess,
  canManageAccess,
}: {
  settings: TaskSettings;
  personalAccess: PersonalAccessSettings;
  /** ניהול הגישה לרשימה האישית של מישהו אחר שמור לבעלים בלבד (נאכף גם בשרת). */
  canManageAccess: boolean;
}) {
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [weekStartDay, setWeekStartDay] = useState(settings.weekStartDay);
  const [warningWeekday, setWarningWeekday] = useState(settings.warningWeekday);
  const [recommended, setRecommended] = useState(settings.recommendedRocksPerQuarter);

  function handleSave() {
    startTransition(async () => {
      const result = await saveTaskSettingsAction({
        weekStartDay,
        warningWeekday,
        recommendedRocksPerQuarter: recommended,
      });
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess("ההגדרות נשמרו");
      router.refresh();
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-3">
    <div className="card">
      {toastNode}
      <h2 className="mb-1 text-base font-extrabold text-ink">הגדרות המשימות</h2>
      <p className="mb-4 text-xs text-muted">
        ההגדרות משפיעות על כל המסכים: מתי מתחיל שבוע העבודה, מתי מופיעה האזהרה הכתומה על משימה שטרם התחילה, וכמה סלעים השיטה
        ממליצה לקחת לרבעון.
      </p>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-bold text-muted">
          יום תחילת שבוע העבודה
          <select value={weekStartDay} onChange={(e) => setWeekStartDay(Number(e.target.value))} className={`mt-1 ${SELECT}`}>
            {WEEKDAYS.map((day, i) => (
              <option key={day} value={i}>
                {day}
              </option>
            ))}
          </select>
        </label>

        <label className="text-xs font-bold text-muted">
          יום האזהרה השבועית
          <select value={warningWeekday} onChange={(e) => setWarningWeekday(Number(e.target.value))} className={`mt-1 ${SELECT}`}>
            {WEEKDAYS.map((day, i) => (
              <option key={day} value={i}>
                {day}
              </option>
            ))}
          </select>
          <span className="mt-1 block font-normal text-muted">
            מיום זה בבוקר, משימת שבוע שעדיין לא התחילה מקבלת חיווי כתום עדין - נקודה ותג קטן, בלי לצבוע את כל המסך.
          </span>
        </label>

        <label className="text-xs font-bold text-muted">
          מספר הסלעים המומלץ לרבעון
          <input
            type="number"
            min={1}
            max={10}
            value={recommended}
            onChange={(e) => setRecommended(Number(e.target.value))}
            className={`mt-1 ${SELECT}`}
          />
          <span className="mt-1 block font-normal text-muted">
            חריגה מהמספר הזה אפשרית - היא רק מציגה אזהרה לפני הוספת הסלע.
          </span>
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex w-fit items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isPending ? "שומר..." : "שמירת הגדרות"}
        </button>

        {settings.updatedAt ? (
          <p className="text-[11px] text-muted">
            עודכן לאחרונה {new Date(settings.updatedAt).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" })}
            {settings.updatedBy ? ` · ${settings.updatedBy}` : ""}
          </p>
        ) : null}
      </div>
    </div>

    {canManageAccess ? <PersonalAccessCard access={personalAccess} /> : null}
    </div>
  );
}

const EMAIL_HINT = "כתובת דוא\"ל אחת בכל שורה";

/** רשימת דוא"ל לעריכה - שורה לכל כתובת, כי זו הצורה שהכי קל להדביק אליה. */
function emailsToText(list: string[]): string {
  return list.join("\n");
}

function textToEmails(text: string): string[] {
  return Array.from(new Set(text.split(/[\n,;]+/).map((v) => v.trim().toLowerCase()).filter(Boolean)));
}

/**
 * מי רואה את הטאב "משימות ליוני" (סעיף 4 באפיון המשלים).
 *
 * הגישה נקבעת בשמות משתמש ולא בתפקיד: הטאב הוא רשימת העבודה האישית של אדם אחד,
 * ולכן הוא אינו נפתח אוטומטית לכל מי שיש לו הרשאת "משימות ונהלים". כל עוד שלוש
 * הרשימות ריקות, הטאב מוצג לבעלים בלבד - כדי שאפשר יהיה להגדיר אותו מלכתחילה.
 */
function PersonalAccessCard({ access }: { access: PersonalAccessSettings }) {
  const router = useRouter();
  const { showSuccess, showError, toastNode } = useToast();
  const [isPending, startTransition] = useTransition();
  const [owners, setOwners] = useState(emailsToText(access.ownerEmails));
  const [editors, setEditors] = useState(emailsToText(access.editorEmails));
  const [viewers, setViewers] = useState(emailsToText(access.viewerEmails));

  function handleSave() {
    startTransition(async () => {
      const result = await savePersonalAccessAction({
        ownerEmails: textToEmails(owners),
        editorEmails: textToEmails(editors),
        viewerEmails: textToEmails(viewers),
      });
      if (!result.ok) {
        showError(result.message);
        return;
      }
      showSuccess("ההרשאות נשמרו");
      router.refresh();
    });
  }

  return (
    <div className="card">
      {toastNode}
      <h2 className="mb-1 flex items-center gap-1.5 text-base font-extrabold text-ink">
        <ShieldCheck className="h-4 w-4" />
        גישה לטאב &quot;משימות ליוני&quot;
      </h2>
      <p className="mb-4 text-xs text-muted">
        הטאב הוא רשימת עבודה אישית, ולכן הוא נפתח רק למי שמופיע כאן - גם למי שיש לו הרשאה למודול. כל עוד שלוש הרשימות ריקות,
        הטאב מוצג לבעלים בלבד.
      </p>

      <div className="flex flex-col gap-3">
        <label className="text-xs font-bold text-muted">
          בעל הרשימה — כל הפעולות
          <textarea value={owners} onChange={(e) => setOwners(e.target.value)} rows={2} placeholder={EMAIL_HINT} className={`mt-1 ${SELECT}`} />
        </label>

        <label className="text-xs font-bold text-muted">
          הזנה ועריכה — המזכירה
          <textarea value={editors} onChange={(e) => setEditors(e.target.value)} rows={2} placeholder={EMAIL_HINT} className={`mt-1 ${SELECT}`} />
          <span className="mt-1 block font-normal text-muted">
            יצירה, עריכת משימות פעילות, הערות, דחיפות ותאריך יעד. בלי מחיקה ובלי מחיקת היסטוריה.
          </span>
        </label>

        <label className="text-xs font-bold text-muted">
          צפייה בלבד
          <textarea value={viewers} onChange={(e) => setViewers(e.target.value)} rows={2} placeholder={EMAIL_HINT} className={`mt-1 ${SELECT}`} />
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="flex w-fit items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-60"
        >
          <Save className="h-4 w-4" />
          {isPending ? "שומר..." : "שמירת הרשאות"}
        </button>
      </div>
    </div>
  );
}
