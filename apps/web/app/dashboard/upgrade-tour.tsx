"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, X } from "lucide-react";

/**
 * סיור קצר אחרי השדרוג (מסמך המשך סעיף 39): כרטיס חד־פעמי בדף הבית, שניתן לדלג עליו.
 * הצעדים נבנים בשרת לפי מה שהמשתמש באמת רואה. הסגירה נשמרת **בדפדפן בלבד** (לפי מייל +
 * גרסת הסיור) — אין כתיבה למסד הנתונים. אם האחסון חסום, הכרטיס פשוט ייסגר לסשן הנוכחי.
 */
const TOUR_VERSION = "v2-2026-10";

export type TourStep = { title: string; body: string; href?: string; linkLabel?: string };

export function UpgradeTour({ email, steps }: { email: string; steps: TourStep[] }) {
  const key = `ultranet.tour.${TOUR_VERSION}:${email.toLowerCase()}`;
  const [visible, setVisible] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    try {
      setVisible(localStorage.getItem(key) !== "done");
    } catch {
      setVisible(false);
    }
  }, [key]);

  function dismiss() {
    setVisible(false);
    try {
      localStorage.setItem(key, "done");
    } catch {
      /* אחסון חסום — נסגר לסשן הזה בלבד */
    }
  }

  const step = steps[Math.min(index, steps.length - 1)];
  if (!visible || !step) return null;
  const last = index >= steps.length - 1;

  return (
    <div className="card border-teal/40">
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[12px] font-bold text-teal-dark">
          <Sparkles className="h-4 w-4" />
          {`מה חדש במערכת · ${index + 1}/${steps.length}`}
        </div>
        <button type="button" onClick={dismiss} className="rounded p-1 text-muted hover:bg-gray-100" aria-label="סגירת הסיור">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="text-[15px] font-extrabold text-ink">{step.title}</div>
      <p className="mt-0.5 text-[13px] leading-relaxed text-muted">{step.body}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {last ? (
          <button type="button" onClick={dismiss} className="pill-active">
            {"סיום"}
          </button>
        ) : (
          <button type="button" onClick={() => setIndex(index + 1)} className="pill-active">
            {"הבא"}
          </button>
        )}
        {index > 0 && (
          <button type="button" onClick={() => setIndex(index - 1)} className="pill-inactive">
            {"הקודם"}
          </button>
        )}
        {!last && (
          <button type="button" onClick={dismiss} className="pill-inactive">
            {"דילוג"}
          </button>
        )}
        {step.href && (
          <Link href={step.href} className="mr-auto text-[12px] font-bold text-teal hover:underline">
            {step.linkLabel ?? "לפתיחה"}
          </Link>
        )}
      </div>
    </div>
  );
}
