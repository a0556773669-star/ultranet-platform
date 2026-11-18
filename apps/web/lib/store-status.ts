import type { StoreRequestStatus } from "@ultranet/shared-types";

export const STORE_STATUS_LABEL: Record<StoreRequestStatus, string> = {
  new: "ממתין לבדיקה",
  in_review: "בבדיקה",
  answered: "נענה - מחכה ללקוח",
  stock_check: "בדיקת מלאי",
  stock_confirmed: "מלאי אושר - אפשר לסגור",
  deal_closed: "העסקה נסגרה",
  shipped: "נשלח לסניף",
  delivered: "התקבל בסניף",
  closed: "סגור",
  no_stock: "אין מלאי / לא מתקדם",
};

/** סטטוסים שדורשים טיפול של הבעלים/המזכירה (לסימון בתור). */
export const OWNER_ACTION_STATUSES: StoreRequestStatus[] = ["new", "in_review", "stock_check", "deal_closed"];
