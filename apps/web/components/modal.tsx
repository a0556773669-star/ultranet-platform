"use client";

import { useEffect, type ComponentType, type ReactNode } from "react";
import { X } from "lucide-react";

/**
 * חלון ההזנה של ההנה"ח הראשית.
 *
 * הטפסים ירדו מהמסך לתוך חלון בכוונה: הספר הראשי הוא מסך שמסתכלים בו, והטופס הוא משהו
 * שעושים בו פעולה אחת ומסיימים. טופס פרוש תמיד על המסך גזל את המקום של מה שבאמת רוצים
 * לראות — הטבלאות — ולכן נשארו למעלה שני כפתורים, וכל השאר נפתח רק כשלוחצים.
 */
export function Modal({
  title,
  icon: Icon,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  onClose: () => void;
  children: ReactNode;
  /** חלון ההוצאה רחב יותר — שלושה סוגים ושדות רבים יותר */
  wide?: boolean;
}) {
  // Escape סוגר: חלון שאפשר לפתוח בלחיצה אחת צריך להיסגר בלחיצה אחת, בלי לחפש את ה-X.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 py-8"
      onClick={onClose}
    >
      <div
        className={`w-full ${wide ? "max-w-2xl" : "max-w-md"} rounded-card bg-white p-5 shadow-card`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-base font-extrabold text-ink">
            {Icon && <Icon className="h-4 w-4" />}
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="סגירה"
            className="text-muted transition hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
