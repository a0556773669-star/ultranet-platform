import { redirect } from "next/navigation";

/**
 * "הוצאות נוספות" נבלע ב"ראשי" (2026-09) — הכתובת הישנה נשארת בחיים כהפניה.
 *
 * כל מה שהמסך הזה החזיק — רכישות חד-פעמיות, הוצאות קבועות של העסק, הוצאות קבועות משתנות
 * וסיכום הרכישות החוזרות — נמצא היום בסרגל הטבלאות של `/dashboard/accounting` ובחלון
 * "הוספת הוצאה" שלו. הקובץ נשאר רק כדי שסימנייה ישנה לא תיפול ל-404.
 */
export default function ExtraExpensesRedirectPage() {
  redirect("/dashboard/accounting");
}
