import type { StoreCpuTier, StoreRequest, StoreSpec } from "@ultranet/shared-types";

/**
 * מנוע ההתאמה של "חנות סניפים" - **חוקים דטרמיניסטיים, בלי מודל שפה ובלי עלות טוקנים**.
 *
 * עיקרון מהבעלים: מה שהלקוח ביקש בוודאות - לא משנים. רק שדות שהלקוח לא קבע (`lockedFields`)
 * מותר להציע בהם שדרוג, ולכל שדרוג יש הסבר למנהל הסניף במה הוא טוב יותר.
 */

export type UsageKey = "basic" | "office" | "heavy";

export const USAGE_OPTIONS: { key: UsageKey; label: string; hint: string }[] = [
  { key: "basic", label: "בסיסי", hint: "חידושי תורה, מיילים, Word, גלישה ב-Chrome" },
  { key: "office", label: "משרדי", hint: "Office מלא, Excel כבד, כמה תוכנות פתוחות במקביל, הנה\"ח" },
  { key: "heavy", label: "כבד", hint: "עריכת תמונות/וידאו, תכנות, תוכנות מקצועיות" },
];

/** ברירת המחדל של העסק: מעבד מדור 12 ומעלה (אלא אם הלקוח/הבעלים קבעו אחרת). */
export const DEFAULT_MIN_GENERATION = 12;

export const CPU_ORDER: StoreCpuTier[] = ["i3", "i5", "i7"];
const RAM_STEPS = [8, 16, 32];
const STORAGE_STEPS = [256, 512, 1000, 2000];

/** ברירות המחדל לפי שימוש - הבסיס שמהן בונים את ה"מה מומלץ" כשהלקוח לא קבע. */
const USAGE_DEFAULTS: Record<UsageKey, { cpu: StoreCpuTier; ramGb: number; storageGb: number }> = {
  basic: { cpu: "i3", ramGb: 8, storageGb: 256 },
  office: { cpu: "i5", ramGb: 16, storageGb: 512 },
  heavy: { cpu: "i7", ramGb: 16, storageGb: 1000 },
};

export function storageLabel(gb: number): string {
  return gb >= 1000 ? `${gb / 1000} טרה` : `${gb}GB`;
}

export function specToText(spec: StoreSpec): string {
  const parts: string[] = [spec.kind === "laptop" ? "נייד" : "נייח"];
  if (spec.cpu) parts.push(`מעבד ${spec.cpu}`);
  parts.push(`דור ${spec.minGeneration ?? DEFAULT_MIN_GENERATION}+`);
  if (spec.ramGb) parts.push(`${spec.ramGb}GB RAM`);
  if (spec.storageGb) parts.push(`${storageLabel(spec.storageGb)} SSD`);
  if (spec.kind === "laptop" && spec.screenInches) parts.push(`${spec.screenInches}"`);
  if (spec.kind === "laptop") parts.push(spec.touch ? "עם מסך מגע" : "בלי מסך מגע");
  if (spec.extras?.length) parts.push(`+ ${spec.extras.join(", ")}`);
  return parts.join(" · ");
}

/** משלים לפי שימוש רק שדות שהלקוח לא קבע ("לא יודע"). */
export function applyUsageDefaults(spec: StoreSpec, usage: UsageKey, locked: (keyof StoreSpec)[]): StoreSpec {
  const d = USAGE_DEFAULTS[usage];
  const out: StoreSpec = { ...spec };
  if (!locked.includes("cpu")) out.cpu = d.cpu;
  if (!locked.includes("ramGb")) out.ramGb = d.ramGb;
  if (!locked.includes("storageGb")) out.storageGb = d.storageGb;
  return out;
}

/** משלים רק שדות חסרים לפי שימוש (בשונה מ-`applyUsageDefaults` שדורס כל שדה לא נעול) - לתשובות היועץ. */
export function fillMissingFromUsage(spec: StoreSpec, usage: UsageKey): StoreSpec {
  const d = USAGE_DEFAULTS[usage];
  return { ...spec, cpu: spec.cpu ?? d.cpu, ramGb: spec.ramGb ?? d.ramGb, storageGb: spec.storageGb ?? d.storageGb };
}

export type UpgradeSuggestion = { spec: StoreSpec; reasons: string[] };

const WHY: Record<string, string> = {
  cpu: "מעבד חזק יותר - עובד מהר יותר עם כמה תוכנות וחלונות פתוחים יחד, ולא מרגיש איטי אחרי שנתיים-שלוש",
  ramGb: "זיכרון גדול יותר - פחות תקיעות כשפותחים הרבה לשוניות וקבצים, וחשוב לכל מי שעובד בכמה תוכנות במקביל",
  storageGb: "נפח אחסון גדול יותר - מקום לספרים, קבצים ותמונות בלי להתחיל למחוק, ופחות צורך בדיסק חיצוני",
};

function bump<T>(steps: T[], current: T): T | undefined {
  const i = steps.indexOf(current);
  return i >= 0 && i < steps.length - 1 ? steps[i + 1] : undefined;
}

/**
 * אפשרות "טיפה יותר טוב": מעלה דרגה אחת בעד שני שדות **שהלקוח לא קבע**, לפי סדר חשיבות
 * (מעבד, זיכרון, אחסון). אם הכול נעול - אין הצעת שדרוג.
 */
export function suggestUpgrade(spec: StoreSpec, locked: (keyof StoreSpec)[]): UpgradeSuggestion | null {
  const next: StoreSpec = { ...spec };
  const reasons: string[] = [];

  if (!locked.includes("cpu") && spec.cpu) {
    const up = bump(CPU_ORDER, spec.cpu);
    if (up) {
      next.cpu = up;
      reasons.push(`${spec.cpu} ← ${up}: ${WHY.cpu}`);
    }
  }
  if (!locked.includes("ramGb") && spec.ramGb && reasons.length < 2) {
    const up = bump(RAM_STEPS, spec.ramGb);
    if (up) {
      next.ramGb = up;
      reasons.push(`${spec.ramGb}GB ← ${up}GB: ${WHY.ramGb}`);
    }
  }
  if (!locked.includes("storageGb") && spec.storageGb && reasons.length < 2) {
    const up = bump(STORAGE_STEPS, spec.storageGb);
    if (up) {
      next.storageGb = up;
      reasons.push(`${storageLabel(spec.storageGb)} ← ${storageLabel(up)}: ${WHY.storageGb}`);
    }
  }
  return reasons.length ? { spec: next, reasons } : null;
}

/** נירמול קלט שמגיע מהדפדפן - השרת לעולם לא סומך על מפרט שנבנה בצד הלקוח. */
export function sanitizeSpec(raw: Partial<StoreSpec> | undefined): StoreSpec {
  const kind = raw?.kind === "desktop" ? "desktop" : "laptop";
  const spec: StoreSpec = { kind };
  if (raw?.cpu && CPU_ORDER.includes(raw.cpu)) spec.cpu = raw.cpu;
  if (typeof raw?.ramGb === "number" && raw.ramGb >= 2 && raw.ramGb <= 128) spec.ramGb = raw.ramGb;
  if (typeof raw?.storageGb === "number" && raw.storageGb >= 64 && raw.storageGb <= 8000) spec.storageGb = raw.storageGb;
  if (kind === "laptop") {
    if (typeof raw?.screenInches === "number" && raw.screenInches >= 10 && raw.screenInches <= 20) spec.screenInches = raw.screenInches;
    if (typeof raw?.touch === "boolean") spec.touch = raw.touch;
  }
  if (typeof raw?.minGeneration === "number" && raw.minGeneration >= 1 && raw.minGeneration <= 30) spec.minGeneration = raw.minGeneration;
  if (kind === "desktop" && Array.isArray(raw?.extras)) {
    spec.extras = raw.extras.map((e) => String(e).trim().slice(0, 40)).filter(Boolean).slice(0, 8);
  }
  return spec;
}

/**
 * הנחיה מוכנה להדבקה בחשבון ה-Claude של הבעלים (claude.ai) - סקירת מחירי שוק בלי עלות API.
 * התשובה מוזנת בחזרה ידנית בטופס התשובה. כשיהיה מלאי - החישוב הזה יוחלף במחיר קבוע.
 */
export function buildMarketPrompt(r: StoreRequest): string {
  const lines = [
    "אני מוכר מחשבים בישראל. בדוק לי מחירי שוק עדכניים (חנויות ישראליות מוכרות, מחשב חדש) למחשב הבא:",
    "",
    `מפרט שהלקוח ביקש: ${specToText(r.spec)}`,
    r.budgetILS ? `תקציב שהלקוח הזכיר: ${r.budgetILS} ₪` : "",
    `דור מעבד: ${r.spec.minGeneration ?? DEFAULT_MIN_GENERATION} ומעלה בלבד.`,
    "",
    "הנחיות:",
    "1. תן 5 מחירים מחנויות שונות עם שם החנות ודגם.",
    "2. התעלם ממחירים חריגים (נמוכים או גבוהים בצורה חשודה לעומת הרוב).",
    "3. תן לי את ממוצע המחירים הנמוך (למשל אם רוב החנויות ב-1,600 - זה המספר).",
    "4. אם יש אפשרות טיפה יותר טובה במחיר קרוב - ציין אותה, ופרט בעברית פשוטה במה היא טובה יותר.",
    "5. את המפרט שהלקוח קבע בוודאות אל תשנה.",
  ];
  return lines.filter((l, i) => l !== "" || lines[i - 1] !== "").join("\n");
}
