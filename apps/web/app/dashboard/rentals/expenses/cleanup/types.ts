/**
 * מסך ניקוי הוצאות — **זמני**.
 *
 * נפתח כדי לאפשר מחיקה המונית של הוצאות ישנות/שגויות בכל סניפי ההשכרות במכה אחת, במקום
 * להיכנס לכל סניף ולמחוק שורה-שורה. הוא לא מחשב כלום ולא מציג סיכומים חדשים — רק מרכז את
 * אותן שורות עצמן (`n_fixed_expenses`, `n_var_expenses`, `n_multi_branch_expenses`) בטבלה
 * אחת עם צ'קבוקס לכל שורה.
 *
 * **למחוק את התיקייה הזו (ואת הלשונית ב-`rentals-tabs.tsx` ואת הקישור ב-`../page.tsx`)
 * כשהניקוי יסתיים.**
 */

/** הקולקשן שהשורה חיה בו. זה מה שקובע איך מוחקים אותה. */
export type CleanupExpenseKind = "fixed" | "variable" | "multi";

export interface CleanupSelection {
  id: string;
  kind: CleanupExpenseKind;
}

export interface CleanupRow extends CleanupSelection {
  /** שם ההוצאה הקבועה / תיאור ההוצאה החד-פעמית */
  desc: string;
  amount: number;
  /** תאריך ההוצאה, או תאריך ההתחלה בהוצאה קבועה */
  date: string;
  /** רק בהוצאה קבועה שהופסקה */
  endDate?: string;
  category?: string;
  /** שם סוג הרכישה החוזרת (`n_expense_types`), אם ההוצאה סומנה */
  typeName?: string;
  paidBy?: string;
  owedBy?: string;
  countsToMain: boolean;
  /** בהוצאה על כמה סניפים: שמות הסניפים שהיא התחלקה ביניהם */
  scopeNote?: string;
}

export interface CleanupGroup {
  key: string;
  title: string;
  note?: string;
  rows: CleanupRow[];
}

export const KIND_LABEL: Record<CleanupExpenseKind, string> = {
  fixed: "הוצאה קבועה (חודשית)",
  variable: "הוצאה חד-פעמית",
  multi: "הוצאה על כמה סניפים",
};

export const KIND_SHORT: Record<CleanupExpenseKind, string> = {
  fixed: "קבועה",
  variable: "חד-פעמית",
  multi: "כמה סניפים",
};

/** התווית שמופיעה בעמודת "סוג ההוצאה" — מה שלפיו מסננים ומסמנים. */
export function typeLabelOf(row: CleanupRow): string {
  return row.typeName ?? row.category ?? "ללא סוג";
}
