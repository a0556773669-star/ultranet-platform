/**
 * שמות המחשבים ומצב החיים שלהם — מודול טהור (בלי firebase-admin), נצרך גם ע"י טפסי לקוח.
 *
 * **כלל השם:** כל מחשב נקרא "מחשב" + המספר שלו, ומחשב גרפיקה מקבל גם "גרפיקה" בסוף:
 * "מחשב 145", "מחשב 56 גרפיקה". בטופס מזינים רק מספר ומסמנים גרפיקה — השם נגזר, כך שאי אפשר
 * לקבל שני סגנונות שמות באותה רשימה.
 *
 * **מחשב לא נמחק כשהוא יוצא מהסניף.** מכירה או הוצאה משנות `status` ורושמות `endedAt`: ההשכרות
 * שלו, העלות שנזקפה לסניף וספירת המחשבים של חודשים שעברו תלויות בו, ומחיקה הייתה משכתבת את כולן.
 */
import type { Laptop, LaptopStatus } from "@ultranet/shared-types";

export const GRAPHICS_SUFFIX = "גרפיקה";

export function laptopDisplayName(number: number, isGraphics: boolean): string {
  return `מחשב ${number}${isGraphics ? ` ${GRAPHICS_SUFFIX}` : ""}`;
}

/**
 * מפרק שם קיים (טקסט חופשי מלפני הכלל) למספר + גרפיקה. המספר הוא הרצף הראשון של ספרות בשם;
 * "גרפיקה" (או "גרפי") בכל מקום בשם מסמן מחשב גרפיקה. שם בלי אף ספרה מחזיר `number: null` —
 * אותו אי אפשר לנרמל אוטומטית, והוא מוצג לבעלים לתיקון ידני.
 */
export function parseLaptopName(name: string): { number: number | null; isGraphics: boolean } {
  const match = name.match(/\d+/);
  const number = match ? Number(match[0]) : null;
  return { number: number !== null && Number.isFinite(number) ? number : null, isGraphics: /גרפי/.test(name) };
}

export function laptopStatus(l: Pick<Laptop, "status">): LaptopStatus {
  return l.status ?? "active";
}

/** מחשב שעדיין בסניף — כל רשימה פעילה (לוח, השכרה חדשה, מלאי, ספירה חיה) מסננת לפי זה. */
export function isLaptopActive(l: Pick<Laptop, "status">): boolean {
  return laptopStatus(l) === "active";
}

export const LAPTOP_STATUS_LABELS: Record<LaptopStatus, string> = {
  active: "פעיל",
  sold: "נמכר",
  removed: "הוצא מהסניף",
};

/**
 * האם המחשב נספר בסניף בחודש `month` (YYYY-MM): נוסף עד סוף החודש, ולא יצא לפני תחילתו.
 * מחשב שיצא באמצע ספטמבר עוד נספר בספטמבר (הוא היה שם חלק מהחודש, וגם ההוצאות הקבועות שנעצרות
 * איתו נספרות עד סוף החודש) — ומאוקטובר כבר לא.
 */
export function laptopActiveInMonth(l: Pick<Laptop, "addedDate" | "endedAt">, month: string): boolean {
  if (l.addedDate && l.addedDate.slice(0, 7) > month) return false;
  if (l.endedAt && l.endedAt.slice(0, 7) < month) return false;
  return true;
}

/** "סטיק 20" למחשב "מחשב 20" — אותו כלל כמו בסנכרון הסטיק המקושר. */
export function stickNameForLaptop(laptopName: string): string {
  const match = laptopName.match(/\d+/);
  return match ? `סטיק ${match[0]}` : `סטיק - ${laptopName}`;
}
