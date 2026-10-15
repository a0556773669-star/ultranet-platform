/**
 * בדיקת ציוד במסירה ובהחזרה (מסמך המשך 1, סעיף 3) — רשימת סימון **אופציונלית**, לא מודול מלאי.
 * הסימון רק נרשם על ההשכרה (`handoverItems` / `returnItems`); הוא לא מבצע החזרה ולא חיוב.
 */
export const EQUIPMENT_ITEMS = [
  { key: "laptop", label: "מחשב" },
  { key: "charger", label: "מטען" },
  { key: "bag", label: "תיק" },
  { key: "stick", label: "סטיק" },
] as const;

export type EquipmentItemKey = (typeof EQUIPMENT_ITEMS)[number]["key"];

/** הפריטים הרלוונטיים לחבילה: השכרת סטיק לבדו — רק סטיק; מחשב "בלי סטיק" — בלי סטיק. */
export function itemsForPackage(kind: "laptop" | "stick", variant?: "normal" | "noInternet") {
  if (kind === "stick") return EQUIPMENT_ITEMS.filter((i) => i.key === "stick");
  return EQUIPMENT_ITEMS.filter((i) => i.key !== "stick" || variant !== "noInternet");
}

/** ניקוי קלט מהטופס: רק מפתחות מוכרים, בלי כפילויות. */
export function cleanItems(raw: unknown): EquipmentItemKey[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const known = new Set<string>(EQUIPMENT_ITEMS.map((i) => i.key));
  const out = Array.from(new Set(raw.map(String).filter((k) => known.has(k)))) as EquipmentItemKey[];
  return out.length ? out : undefined;
}
