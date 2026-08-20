/**
 * Categories offered when logging a manual entry in the owner's own ledger
 * (n_ah_income / n_ah_expenses - the "שלי" book on /dashboard/accounting/overview).
 * Stored as free text on the entry (`category`), so adding/removing an option here never
 * invalidates entries already saved under an older label.
 */

export const ACCOUNTING_INCOME_CATEGORIES = [
  "אשראי מהעסק",
  "מזומן",
  "ניידים",
  "חדרי מחשבים",
  "משרד שיתופי",
  "מכירת ציוד",
  "תיקונים ושירות",
  "החזר / זיכוי",
  "הכנסה אחרת",
] as const;

export const ACCOUNTING_EXPENSE_CATEGORIES = [
  "חשמל",
  "מים",
  "ארנונה",
  "שכירות",
  "תוכנות ומנויים",
  "אחסון אתר בענן",
  "אינטרנט וטלפון",
  "רו\"ח והנהלת חשבונות",
  "ביטוח לאומי",
  "מס הכנסה / מע\"מ",
  "עמלות אשראי",
  "פרסום ושיווק",
  "ציוד ותחזוקה",
  "משכורות",
  "נסיעות ודלק",
  "ביטוח",
  "הוצאה אחרת",
] as const;
