"use client";

import { useEffect, useRef, useState } from "react";
import { EDIT_CONFLICT_MESSAGE, LOADED_AT_FIELD } from "@/lib/edit-conflict";

/**
 * מניעת דריסה בעריכה מקבילה (אפיון שדרוג v2, פריט 37) — החלק שבדפדפן.
 *
 * - מוסיף לטופס שדה נסתר `loadedAt` עם גרסת המסמך (updateTime) כפי שנטען; השרת חוסם שמירה
 *   כשהמסמך השמור חדש ממנה (`changedSinceLoaded`).
 * - בכל שליחה שומר את ערכי הטופס ב-localStorage תחת מפתח לרשומה, כדי שאם השמירה נחסמה הטיוטה
 *   לא תאבד. אין שמירה אוטומטית לשרת ואין מיזוג: השחזור ידני, לבקשת המשתמש, אל תוך הטופס
 *   שמציג כבר את הגרסה העדכנית — והמשתמש בודק ושומר בעצמו.
 * - טיוטה נשמרת רק בדפדפן הזה, ונמחקת בפתיחה הבאה של הטופס אחרי שמירה מוצלחת / אחרי שבוע.
 */

const PREFIX = "ultranet:edit-draft:";
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

type Draft = { savedAt: number; fields: string[]; values: Record<string, string[]> };

function readDraft(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const d = JSON.parse(raw) as Draft;
    if (!d || typeof d.savedAt !== "number" || Date.now() - d.savedAt > TTL_MS) {
      window.localStorage.removeItem(PREFIX + key);
      return null;
    }
    return d;
  } catch {
    return null;
  }
}

export function clearEditDraft(key: string) {
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* אחסון חסום — אין מה למחוק */
  }
}

function saveDraft(key: string, form: HTMLFormElement) {
  const values: Record<string, string[]> = {};
  new FormData(form).forEach((v, name) => {
    if (typeof v !== "string" || name === LOADED_AT_FIELD) return;
    (values[name] ??= []).push(v);
  });
  const fields = Array.from(form.elements)
    .map((el) => (el as HTMLInputElement).name)
    .filter((n): n is string => !!n && n !== LOADED_AT_FIELD);
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: Date.now(), fields, values } satisfies Draft));
  } catch {
    /* אחסון מלא/חסום — השמירה לשרת ממשיכה כרגיל */
  }
}

function setNativeValue(el: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) {
  if (el.value === value) return;
  // שדות מבוקרים של React: עדכון דרך ה-setter המקורי + אירוע, כדי שה-state יתעדכן.
  const setter = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value")?.set;
  if (setter) setter.call(el, value);
  else el.value = value;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

function applyDraft(form: HTMLFormElement, draft: Draft) {
  const known = new Set(draft.fields);
  for (const node of Array.from(form.elements)) {
    const el = node as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
    const name = el.name;
    if (!name || name === LOADED_AT_FIELD || !known.has(name)) continue;
    const vals = draft.values[name] ?? [];
    if (el instanceof HTMLInputElement) {
      if (el.type === "hidden" || el.type === "file" || el.type === "submit" || el.type === "button") continue;
      if (el.type === "checkbox" || el.type === "radio") {
        const want = vals.includes(el.value || "on");
        // click() מפעיל את ה-onChange של React ושינויים תלויים (שדות שנפתחים לפי הסימון).
        if (el.checked !== want && (el.type === "checkbox" || want)) el.click();
        continue;
      }
      setNativeValue(el, vals[0] ?? "");
    } else if (el instanceof HTMLSelectElement) {
      if (el.multiple) {
        for (const opt of Array.from(el.options)) opt.selected = vals.includes(opt.value);
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (vals.length) {
        setNativeValue(el, vals[0]!);
      }
    } else if (el instanceof HTMLTextAreaElement) {
      setNativeValue(el, vals[0] ?? "");
    }
  }
}

export function EditConflictGuard({
  draftKey,
  loadedAt,
  conflict,
  mode,
}: {
  /** מפתח יציב לרשומה, למשל `rental-client:<id>` */
  draftKey: string;
  /** updateTime של המסמך כפי שנטען (מילישניות). בלעדיו אין בדיקה — התנהגות קודמת. */
  loadedAt?: number;
  /** השמירה האחרונה נחסמה כי הרשומה השתנתה */
  conflict: boolean;
  /**
   * "page" — טופס בדף ששמירה מוצלחת בו מנווטת לדף אחר (redirect): טיוטה שנמצאה בפתיחה בלי
   *   התנגשות היא שארית של שמירה שהצליחה ונמחקת; והגרסה עוקבת אחרי הדף, כי פעולות אחרות של
   *   המשתמש באותו דף (שמירת כרטיס, סגירת סניף) מרעננות אותו ואינן עריכה מקבילה.
   * "modal" — חלון עריכה: הגרסה נקבעת ברגע הפתיחה, והטיוטה נמחקת במפורש אחרי הצלחה
   *   (`clearEditDraft`).
   */
  mode: "page" | "modal";
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  // בחלון עריכה הגרסה נקבעת ברגע הפתיחה — רענון ברקע לא "מאשר" בשקט טופס ישן.
  const [openedVersion] = useState(loadedAt);
  const version = mode === "page" ? loadedAt : openedVersion;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    if (!conflict && mode === "page") clearEditDraft(draftKey);
    else setDraft(readDraft(draftKey));
    // בכוונה רק בפתיחה / כשמצב ההתנגשות משתנה
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, conflict]);

  useEffect(() => {
    const form = anchor.current?.closest("form");
    if (!form || version === undefined) return;
    const onSubmit = () => saveDraft(draftKey, form);
    form.addEventListener("submit", onSubmit);
    return () => form.removeEventListener("submit", onSubmit);
  }, [draftKey, version]);

  function restore() {
    const form = anchor.current?.closest("form");
    if (!form || !draft) return;
    // כמה מעברים: סימון/בחירה שפותחים שדות נוספים צריכים רינדור לפני שממלאים אותם.
    applyDraft(form, draft);
    setTimeout(() => applyDraft(form, draft), 0);
    setTimeout(() => applyDraft(form, draft), 60);
    setRestored(true);
  }

  function discard() {
    clearEditDraft(draftKey);
    setDraft(null);
  }

  // בחלון עריכה שנחסם הטופס עדיין מציג את הטיוטה עצמה — השחזור מוצע רק בפתיחה מחדש, מול הגרסה העדכנית.
  const showDraftTools = !!draft && !restored && !(conflict && mode === "modal");

  return (
    <span ref={anchor} className="contents">
      {version !== undefined && <input type="hidden" name={LOADED_AT_FIELD} value={String(version)} />}
      {(conflict || showDraftTools || restored) && (
        <span
          role="alert"
          className={`col-span-full flex flex-col gap-2 rounded-card border p-3 text-sm font-semibold ${
            conflict ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {conflict && <span>{EDIT_CONFLICT_MESSAGE}</span>}
          {conflict && mode === "page" && (
            <span className="text-xs font-normal">
              הטופס מציג עכשיו את הגרסה העדכנית. אפשר לשחזר את הטיוטה, לבדוק מול מה שהשתנה ולשמור שוב.
            </span>
          )}
          {conflict && mode === "modal" && (
            <span className="text-xs font-normal">
              סגור את החלון ופתח אותו שוב כדי לראות את הגרסה העדכנית — שם תוכל לשחזר את הטיוטה.
            </span>
          )}
          {!conflict && showDraftTools && (
            <span>יש כאן טיוטה שלא נשמרה מניסיון קודם (השמירה נחסמה כי הרשומה השתנתה בינתיים).</span>
          )}
          {restored && (
            <span className="text-ink">
              הטיוטה שוחזרה לטופס. בדוק אותה מול הנתונים העדכניים — בייחוד סכומים — ושמור רק אם היא נכונה.
            </span>
          )}
          {showDraftTools && (
            <span className="flex flex-wrap gap-2">
              <button type="button" onClick={restore} className="btn-outline rounded-lg px-3 py-1 text-xs font-bold">
                שחזור הטיוטה
              </button>
              <button
                type="button"
                onClick={discard}
                className="rounded-lg px-3 py-1 text-xs font-bold text-muted hover:text-ink"
              >
                מחיקת הטיוטה
              </button>
            </span>
          )}
        </span>
      )}
    </span>
  );
}
