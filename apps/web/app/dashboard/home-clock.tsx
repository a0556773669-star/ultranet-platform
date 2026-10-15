"use client";

import { useEffect, useState } from "react";
import { Calendar } from "lucide-react";

const DAY_NAMES = [
  "ראשון",
  "שני",
  "שלישי",
  "רביעי",
  "חמישי",
  "שישי",
  "שבת",
];

function greetWord(hour: number) {
  if (hour < 12) return "בוקר טוב";
  if (hour < 17) return "צהריים טובים";
  if (hour < 21) return "ערב טוב";
  return "לילה טוב";
}

/**
 * ברכה ותאריך — שורה קטנה בראש דף הבית (אפיון שדרוג v2, סעיף 1: "ברכה ותאריך קטנים, בלי כרטיס
 * שעון ענק"). התאריך מתעדכן פעם בדקה; אין שעון שניות.
 */
export default function HomeClock({ name }: { name: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const firstName = (name || "").split(" ")[0];

  const heDate = now
    ? new Intl.DateTimeFormat("he-IL-u-ca-hebrew", { day: "numeric", month: "long", year: "numeric" }).format(now)
    : "";

  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <div className="text-[19px] font-extrabold text-ink">
        {now ? greetWord(now.getHours()) : "שלום"}, <span className="text-teal">{firstName}</span>
      </div>
      {now && (
        <div className="flex items-center gap-1.5 text-xs text-muted">
          <Calendar className="h-3.5 w-3.5" />
          {`יום ${DAY_NAMES[now.getDay()]} · ${heDate} · ${now.toLocaleDateString("he-IL")}`}
        </div>
      )}
    </div>
  );
}
