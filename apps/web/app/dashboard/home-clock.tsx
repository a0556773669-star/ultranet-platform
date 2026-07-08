"use client";

import { useEffect, useState } from "react";

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

export default function HomeClock({ name }: { name: string }) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const firstName = (name || "").split(" ")[0];

  if (!now) {
    return (
      <div className="flex items-center justify-between rounded-card border border-card-border bg-white p-5 shadow-card">
        <div>
          <div className="text-[19px] font-extrabold text-ink">
            {"שלום"}, <span className="text-teal">{firstName}</span>
          </div>
        </div>
        <div className="text-left text-[30px] font-black tabular-nums text-teal-dark">--:--:--</div>
      </div>
    );
  }

  const heDate = new Intl.DateTimeFormat("he-IL-u-ca-hebrew", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-card-border bg-white p-5 shadow-card">
      <div>
        <div className="text-[19px] font-extrabold text-ink">
          {greetWord(now.getHours())}, <span className="text-teal">{firstName}</span>
        </div>
        <div className="mt-1 flex gap-2 text-xs text-muted">
          <span>
            {"📅 יום "}
            {DAY_NAMES[now.getDay()]}
            {", "}
            {now.toLocaleDateString("he-IL")}
          </span>
          <span>·</span>
          <span>{heDate}</span>
        </div>
      </div>
      <div className="text-left">
        <div className="text-[30px] font-black tabular-nums text-teal-dark">{now.toLocaleTimeString("he-IL")}</div>
        <div className="text-[11px] text-muted">{"שעון מקומי"}</div>
      </div>
    </div>
  );
}
