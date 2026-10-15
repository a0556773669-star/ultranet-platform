"use client";

import { useEffect, useState } from "react";
import { Rows3 } from "lucide-react";

const KEY = "ultranet-density";

/** קומפקטית / מרווחת — העדפה אישית בדפדפן הזה בלבד (מסמך המשך 1, סעיף 34). */
export function DensityToggle() {
  const [compact, setCompact] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) === "compact";
      setCompact(saved);
      document.documentElement.dataset.density = saved ? "compact" : "comfortable";
    } catch {
      /* אין גישה לאחסון */
    }
  }, []);

  function toggle() {
    const next = !compact;
    setCompact(next);
    document.documentElement.dataset.density = next ? "compact" : "comfortable";
    try {
      localStorage.setItem(KEY, next ? "compact" : "comfortable");
    } catch {
      /* לא קריטי */
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={compact ? "תצוגה מרווחת" : "תצוגה קומפקטית"}
      aria-label={compact ? "תצוגה מרווחת" : "תצוגה קומפקטית"}
      aria-pressed={compact}
      className={`rounded-lg border px-2 py-1.5 transition ${
        compact ? "border-teal bg-teal-bg text-teal-dark" : "border-card-border text-muted hover:bg-gray-50"
      }`}
    >
      <Rows3 className="h-4 w-4" />
    </button>
  );
}
