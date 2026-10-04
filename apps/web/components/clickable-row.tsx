"use client";

import { useRouter } from "next/navigation";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

/**
 * שורת טבלה שכולה קישור.
 *
 * הקישור בתוך תא אחד ("פתיחה" בקצה, או שם הסניף) נראה מובן מאליו למי שכתב אותו, אבל
 * בפועל לוחצים על השורה — על המספר, על הרווח שבין העמודות — ולא קורה כלום. השורה היא
 * היחידה שהעין רואה, ולכן היא צריכה להיות מה שמגיב.
 *
 * הקישורים שבתוך התאים נשארים במקומם: הם מה שמאפשר פתיחה בלשונית חדשה, גלילה למטרה עם
 * מקלדת, והם גם מה שמסמן לעין שיש לאן ללחוץ. לחיצה עליהם מנווטת בעצמה, ולכן כאן מדלגים
 * על היעד כדי לא לנווט פעמיים.
 */
export function ClickableRow({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();

  function insideOwnControl(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest("a, button, input, select, textarea, label"));
  }

  return (
    <tr
      role="link"
      tabIndex={0}
      onClick={(e: MouseEvent<HTMLTableRowElement>) => {
        if (insideOwnControl(e.target)) return;
        router.push(href);
      }}
      onKeyDown={(e: KeyboardEvent<HTMLTableRowElement>) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (insideOwnControl(e.target)) return;
        e.preventDefault();
        router.push(href);
      }}
      className={`cursor-pointer transition hover:bg-teal-bg/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-teal ${className ?? ""}`}
    >
      {children}
    </tr>
  );
}
