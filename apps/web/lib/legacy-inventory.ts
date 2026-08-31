export const BRANCH_KEYS = ["lohamim", "rasko", "hanasi", "weizmann"] as const;
export type BranchKey = (typeof BRANCH_KEYS)[number];

export const BRANCH_LABELS: Record<BranchKey, string> = {
  lohamim: "לוחמי הגטאות",
  rasko: "רסקו",
  hanasi: "הנשיא",
  weizmann: "ויצמן",
};

export const DEFAULT_PRODUCTS = [
  "עטים", "דפי ממו", "חבילות נייר A4", "טונר שחור", "טונר כחול",
  "טונר ורוד", "טונר צהוב", "שקיות אשפה", "קולה", "זירו",
  "מנגו", "תות בננה", "אפרסק", "בלו דיי", "בלו לא סוכר", "בלו רגיל",
];

export type InventoryItem = { qty: number; min: number };
export type BranchInventory = Record<string, InventoryItem>;
export type VisibilityMap = Record<string, Record<string, boolean>>;
