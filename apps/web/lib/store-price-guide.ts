import { getAdminFirestore } from "./firebase-admin";
import type { StoreCpuTier, StorePriceGuide, StoreSpec } from "@ultranet/shared-types";
import { accessoryRange, quotedRange, roundTen } from "./store-pricing";
import { DEFAULT_MIN_GENERATION } from "./store-wizard";

export const PRICE_GUIDE_DOC = { collection: "n_store_settings", id: "price_guide" } as const;

export const EMPTY_GUIDE: StorePriceGuide = { laptopBase: {}, desktopBase: {}, ramAdd: {}, storageAdd: {}, accessoriesLow: {} };

export async function loadPriceGuide(): Promise<StorePriceGuide> {
  const snap = await getAdminFirestore().collection(PRICE_GUIDE_DOC.collection).doc(PRICE_GUIDE_DOC.id).get();
  if (!snap.exists) return EMPTY_GUIDE;
  const d = snap.data() as Partial<StorePriceGuide>;
  return {
    laptopBase: d.laptopBase ?? {},
    desktopBase: d.desktopBase ?? {},
    ramAdd: d.ramAdd ?? {},
    storageAdd: d.storageAdd ?? {},
    touchAdd: d.touchAdd,
    screen17Add: d.screen17Add,
    accessoriesLow: d.accessoriesLow ?? {},
    specPrices: d.specPrices ?? {},
    note: d.note,
    updatedAt: d.updatedAt,
  };
}

/** מפתח תצורה למחשב (בלי אביזרים): סוג, מעבד, זיכרון, אחסון, מסך ומגע. */
export function specKey(spec: StoreSpec): string {
  return [
    spec.kind,
    spec.cpu ?? "i3",
    spec.ramGb ?? 8,
    spec.storageGb ?? 256,
    spec.kind === "laptop" ? (spec.screenInches ?? 15.6) : "-",
    spec.kind === "laptop" ? (spec.touch ? "touch" : "notouch") : "-",
  ].join("|");
}

/** תיאור התצורה בעברית לחיפוש בשוק. */
export function specDescription(spec: StoreSpec): string {
  const parts = [
    spec.kind === "laptop" ? "מחשב נייד" : "מחשב נייח (המחשב בלבד, בלי מסך)",
    `מעבד אינטל ${spec.cpu ?? "i3"} דור ${spec.minGeneration ?? DEFAULT_MIN_GENERATION} ומעלה`,
    `${spec.ramGb ?? 8}GB זיכרון`,
    `${spec.storageGb ?? 256}GB SSD`,
  ];
  if (spec.kind === "laptop") parts.push(`מסך ${spec.screenInches ?? 15.6} אינץ'`, spec.touch ? "עם מגע" : "בלי מגע");
  return parts.join(", ");
}

/** התצורות הקלאסיות שנסרקות בכל לילה (נייד ונייח, i3/i5/i7, 8/16GB, 256/512GB). */
export function classicSpecs(): StoreSpec[] {
  const out: StoreSpec[] = [];
  for (const kind of ["laptop", "desktop"] as const) {
    for (const cpu of ["i3", "i5", "i7"] as const) {
      if (kind === "desktop" && cpu === "i7") continue;
      for (const ramGb of [8, 16]) {
        for (const storageGb of [256, 512]) {
          out.push(kind === "laptop" ? { kind, cpu, ramGb, storageGb, screenInches: 15.6, touch: false } : { kind, cpu, ramGb, storageGb });
        }
      }
    }
  }
  return out;
}

/**
 * מה לסרוק הלילה: התצורות הקלאסיות + התצורות שהסניפים באמת ביקשו ב-60 הימים האחרונים (הנפוצות ביותר).
 * אין כאן שום פרט אישי של לקוח - רק מפרטים ומספר הפעמים.
 */
export async function researchTargets(): Promise<{ spec: StoreSpec; key: string; requested: number }[]> {
  const classic = classicSpecs();
  const counts = new Map<string, { spec: StoreSpec; n: number }>();
  const cutoff = new Date(Date.now() - 60 * 86_400_000).toISOString();
  const snap = await getAdminFirestore().collection("n_store_requests").where("createdAt", ">=", cutoff).get();
  for (const d of snap.docs) {
    const spec = (d.data() as { spec?: StoreSpec }).spec;
    if (!spec) continue;
    const key = specKey(spec);
    const cur = counts.get(key);
    counts.set(key, { spec, n: (cur?.n ?? 0) + 1 });
  }
  const classicKeys = new Set(classic.map(specKey));
  const popular = [...counts.entries()]
    .filter(([k]) => !classicKeys.has(k))
    .sort((a, b) => b[1].n - a[1].n)
    .slice(0, 8)
    .map(([key, v]) => ({ spec: v.spec, key, requested: v.n }));
  return [...classic.map((spec) => ({ spec, key: specKey(spec), requested: counts.get(specKey(spec))?.n ?? 0 })), ...popular];
}
/** מחיר שוק נמוך מוערך למחשב (בלי אביזרים), או null כשאין במחירון בסיס לדגם. תצורה עם מחיר מדויק במחירון גוברת. */
export function estimateMarketLow(spec: StoreSpec, guide: StorePriceGuide): number | null {
  const exact = guide.specPrices?.[specKey(spec)];
  if (typeof exact === "number") return exact;
  const cpu: StoreCpuTier = spec.cpu ?? "i3";
  const base = (spec.kind === "laptop" ? guide.laptopBase : guide.desktopBase)[cpu];
  if (typeof base !== "number") return null;
  let total = base;
  if (spec.ramGb && spec.ramGb > 8) total += guide.ramAdd[String(spec.ramGb >= 32 ? 32 : 16) as "16" | "32"] ?? 0;
  if (spec.storageGb && spec.storageGb > 256) {
    const key = spec.storageGb >= 2000 ? "2000" : spec.storageGb >= 1000 ? "1000" : "512";
    total += guide.storageAdd[key] ?? 0;
  }
  if (spec.kind === "laptop") {
    if (spec.touch) total += guide.touchAdd ?? 0;
    if (spec.screenInches && spec.screenInches >= 17) total += guide.screen17Add ?? 0;
  }
  return total;
}

const ACCESSORY_KEYS: Record<string, string> = {
  מסך: "monitor",
  "מקלדת ועכבר": "keyboardMouse",
  מקלדת: "keyboard",
  עכבר: "mouse",
  סטיק: "stick",
  רמקולים: "speakers",
};

export type PriceEstimate = {
  fromILS: number;
  toILS: number;
  accessories: { name: string; fromILS: number; toILS: number }[];
};

/**
 * טווח הערכה לפי המחירון: מחיר שוק נמוך + מרווח (מחשב 300-500, אביזר לפי סוגו). null כשאין במחירון בסיס
 * לדגם - אז אין הערכה והצ'אט אומר שהמחיר יימסר אחרי בדיקה.
 */
export function estimateRange(spec: StoreSpec, guide: StorePriceGuide): PriceEstimate | null {
  const low = estimateMarketLow(spec, guide);
  if (low === null) return null;
  const r = quotedRange(low);
  const names = spec.extras?.length
    ? spec.extras.includes("מקלדת") && spec.extras.includes("עכבר")
      ? ["מקלדת ועכבר", ...spec.extras.filter((e) => e !== "מקלדת" && e !== "עכבר")]
      : spec.extras
    : [];
  const accessories: PriceEstimate["accessories"] = [];
  for (const name of names) {
    const accLow = guide.accessoriesLow[ACCESSORY_KEYS[name] ?? ""];
    if (typeof accLow !== "number") continue;
    const a = accessoryRange(name, accLow);
    accessories.push({ name, fromILS: roundTen(a.from), toILS: roundTen(a.to) });
  }
  return { fromILS: roundTen(r.from), toILS: roundTen(r.to), accessories };
}

/** תיאור קצר של המחירון למודל (מחירי שוק נמוכים בלבד, בלי מרווח) - כדי שיכבד תקציב לקוח בהצעות. */
export function guideForPrompt(guide: StorePriceGuide): string {
  const fmt = (o: Partial<Record<string, number>>) =>
    Object.entries(o)
      .filter(([, v]) => typeof v === "number")
      .map(([k, v]) => `${k}=${v}`)
      .join(", ") || "לא הוגדר";
  return `נייד (בסיס 8GB/256GB/15.6): ${fmt(guide.laptopBase)}
נייח (מחשב בלבד): ${fmt(guide.desktopBase)}
תוספת זיכרון: ${fmt(guide.ramAdd)} · תוספת אחסון: ${fmt(guide.storageAdd)} · מגע: ${guide.touchAdd ?? "לא הוגדר"}
(מחירי שוק נמוכים בשקלים. הלקוח מקבל טווח הערכה גבוה יותר - אל תציין מחירים בטקסט, המערכת מציגה אותם.)`;
}


export async function savePriceGuide(guide: StorePriceGuide): Promise<void> {
  await getAdminFirestore()
    .collection(PRICE_GUIDE_DOC.collection)
    .doc(PRICE_GUIDE_DOC.id)
    .set(JSON.parse(JSON.stringify({ ...guide, updatedAt: new Date().toISOString() })));
}

/** טווחים סבירים לכל קבוצת מחירים (₪) - מחיר מחוץ לטווח נחשב שגיאת קריאה ונדחה. */
const BOUNDS: Record<string, [number, number]> = {
  base: [600, 12000],
  ramAdd: [30, 2000],
  storageAdd: [30, 3000],
  extra: [30, 2000],
  accessory: [15, 3000],
};
/** סטייה מקסימלית מהמחיר הקודם בעדכון אוטומטי. מעבר לזה - נשמר הישן, כדי שמחיר חריג לא יזהם את ההצעות. */
const MAX_DEVIATION = 0.4;

function pickValue(prev: number | undefined, next: number | undefined, kind: string, label: string, notes: string[]): number | undefined {
  if (typeof next !== "number") return prev;
  const [lo, hi] = BOUNDS[kind]!;
  if (next < lo || next > hi) {
    notes.push(`${label}: ${next} מחוץ לטווח הסביר - נדחה`);
    return prev;
  }
  if (typeof prev === "number" && Math.abs(next - prev) / prev > MAX_DEVIATION) {
    notes.push(`${label}: ${prev}->${next} שינוי גדול מדי - נשמר הקודם`);
    return prev;
  }
  return next;
}

/**
 * מיזוג טיוטת מחירון אוטומטית (מהחיפוש ברשת) למחירון הקיים, עם הגנות: טווח סביר, ושינוי של עד 40% מהערך הקודם.
 * ערך חדש לגמרי (שאין לו קודם) מתקבל אם הוא בטווח הסביר. מחזיר את המחירון ואת ההערות על מה שנדחה.
 */
export type GuideDraftLike = {
  laptopBase?: Partial<Record<string, number>>;
  desktopBase?: Partial<Record<string, number>>;
  ramAdd?: Partial<Record<string, number>>;
  storageAdd?: Partial<Record<string, number>>;
  accessoriesLow?: Partial<Record<string, number>>;
  specPrices?: Partial<Record<string, number>>;
  touchAdd?: number | null;
  screen17Add?: number | null;
  note?: string;
};

export function mergeGuide(existing: StorePriceGuide, draft: GuideDraftLike): { guide: StorePriceGuide; notes: string[] } {
  const notes: string[] = [];
  const mergeMap = (prev: Partial<Record<string, number>>, next: Partial<Record<string, number>> | undefined, kind: string, label: string) => {
    const out: Record<string, number> = {};
    for (const k of new Set([...Object.keys(prev), ...Object.keys(next ?? {})])) {
      const v = pickValue(prev[k], next?.[k], kind, `${label} ${k}`, notes);
      if (typeof v === "number") out[k] = v;
    }
    return out;
  };
  const guide: StorePriceGuide = {
    laptopBase: mergeMap(existing.laptopBase, draft.laptopBase, "base", "נייד"),
    desktopBase: mergeMap(existing.desktopBase, draft.desktopBase, "base", "נייח"),
    ramAdd: mergeMap(existing.ramAdd, draft.ramAdd, "ramAdd", "זיכרון"),
    storageAdd: mergeMap(existing.storageAdd, draft.storageAdd, "storageAdd", "אחסון"),
    accessoriesLow: mergeMap(existing.accessoriesLow, draft.accessoriesLow, "accessory", "אביזר"),
    specPrices: mergeMap(existing.specPrices ?? {}, draft.specPrices, "base", "תצורה"),
    touchAdd: pickValue(existing.touchAdd, draft.touchAdd ?? undefined, "extra", "מגע", notes),
    screen17Add: pickValue(existing.screen17Add, draft.screen17Add ?? undefined, "extra", "17 אינץ'", notes),
    note: [draft.note ?? "", ...notes].filter(Boolean).join(" | ").slice(0, 500),
  };
  return { guide, notes };
}
