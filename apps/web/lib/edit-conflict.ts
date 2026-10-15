import type { DocumentSnapshot } from "firebase-admin/firestore";

/**
 * מניעת דריסה בעריכה מקבילה (אפיון שדרוג v2, פריט 37).
 *
 * אין שדה חדש במסד הנתונים: הגרסה היא `updateTime` — מטא-דאטה ש-Firestore שומר לכל מסמך
 * ומתעדכן בכל כתיבה. הדף מעביר לטופס את `updateTime.toMillis()` של המסמך כשדה נסתר
 * `loadedAt`, והפעולה בשרת קוראת את המסמך מחדש לפני הכתיבה. לעולם לא ממזג — רק חוסם.
 */
export const LOADED_AT_FIELD = "loadedAt";

/** הודעת ההתנגשות — זהה בכל הטפסים (הקובץ בטוח לייבוא גם מקומפוננטת לקוח: יש בו רק import type). */
export const EDIT_CONFLICT_MESSAGE =
  "הרשומה שונתה על ידי מישהו אחר מאז שנפתחה — הנתונים שלך לא נשמרו. רענון יציג את הגרסה העדכנית; הטיוטה שלך נשמרה בדפדפן";

/** תוצאה שפעולת שרת מחזירה (במקום לזרוק) כשהרשומה השתנתה — הודעות שגיאה נזרקות מוסתרות בפרודקשן. */
export type EditConflictResult = { conflict: true };

/** גרסת המסמך כפי שנטען בדף — להעברה לטופס. undefined כשאין מטא-דאטה (מסמך שלא קיים). */
export function docVersion(snap: DocumentSnapshot): number | undefined {
  return snap.updateTime?.toMillis();
}

/**
 * האם המסמך השמור חדש *ממש* מהגרסה שנפתחה בטופס. בלי `loadedAt` (דף ישן מהמטמון, טופס
 * שלא מעביר אותו) — false, כלומר ההתנהגות הקודמת נשמרת.
 */
export function changedSinceLoaded(snap: DocumentSnapshot, formData: FormData): boolean {
  const raw = formData.get(LOADED_AT_FIELD);
  if (typeof raw !== "string" || !raw.trim()) return false;
  const loadedAt = Number(raw);
  if (!Number.isFinite(loadedAt) || loadedAt <= 0) return false;
  const current = docVersion(snap);
  return current !== undefined && current > loadedAt;
}
