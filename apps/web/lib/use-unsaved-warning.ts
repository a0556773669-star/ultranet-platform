"use client";

import { useEffect } from "react";

/**
 * התרעה לפני יציאה מטופס עם שינויים שלא נשמרו (אפיון שדרוג v2, סעיף 13). מכסה סגירת לשונית,
 * רענון ומעבר לכתובת אחרת בדפדפן. אין כאן שמירה אוטומטית — רק אזהרה.
 */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
