// מנוע ההמלצות של "חנות ה-AI" - לא מחובר למודל שפה חיצוני (אין עלות/מפתח API).
// זהו מנוע חוקים חכם: זיהוי תחום שימוש מטקסט חופשי + שאלות המשך ממוקדות + ניקוד רמת עומס,
// שממופה למפרט מחשב גנרי (כשאין קטלוג תואם) או לתצורה אמיתית מ-n_shop_catalog (כשיש).
// אפשר לחדד/לשפר את הלוגיקה כאן בכל שלב בלי לגעת ב-UI של הצ'אט.

import type { ShopAddon, ShopComputerConfig, ShopRecommendedOption, ShopTier, ShopUseCase } from "@ultranet/shared-types";

export const USE_CASE_LABELS: Record<ShopUseCase, string> = {
  torah: "לימוד וחידושי תורה",
  office: "שימוש משרדי וגלישה",
  graphics: "עיצוב גרפי",
  video: "עריכת וידאו",
  gaming: "גיימינג",
  programming: "תכנות ופיתוח",
  general: "שימוש כללי",
};

export const USE_CASE_ORDER: ShopUseCase[] = ["torah", "office", "graphics", "video", "gaming", "programming", "general"];

const CATEGORY_KEYWORDS: Partial<Record<ShopUseCase, string[]>> = {
  torah: ["תורה", "חידוש", "חידושי", "גמרא", "ישיבה", "כולל", "אוצר החכמה", "אוצר החוכמה", "בר אילן", "בר-אילן", "שו\"ת", "שות", "פירוש", "הלכה", "דף היומי", "לימוד תורה"],
  video: ["וידאו", "עריכת וידאו", "פרימיר", "premiere", "davinci", "דיוינצי", "יוטיובר", "יוטיוב", "צילום סרטונים", "קליפים", "עריכה של סרטונים"],
  graphics: ["גרפיקה", "עיצוב גרפי", "פוטושופ", "photoshop", "illustrator", "אילוסטרייטור", "קנבה", "canva", "עיצוב לוגו", "עריכת תמונות"],
  gaming: ["גיימינג", "משחקים", "gaming", "פורטנייט", "fortnite", "valorant", "וולורנט", "gta", "פאבג", "pubg", "שיחקים"],
  programming: ["תכנות", "פיתוח תוכנה", "פיתוח אתרים", "קוד", "python", "פייתון", "javascript", "visual studio", "מתכנת", "פרוגרמינג", "דוקר", "docker"],
  office: ["אופיס", "גלישה", "מיילים", "וורד", "word", "אקסל", "excel", "פשוט", "בסיסי", "משרדי"],
};

// סדר בדיקה: קודם תחומים ספציפיים (וידאו/גרפיקה/גיימינג/תכנות/תורה), ורק אז "משרדי" הכללי יותר.
const DETECT_PRIORITY: ShopUseCase[] = ["video", "graphics", "gaming", "programming", "torah", "office"];

/** מזהה תחום שימוש מתוך תיאור חופשי של הלקוח. מחזיר null כשלא זוהתה התאמה ברורה - ואז ה-UI מציג בחירה ידנית. */
export function detectUseCase(description: string): ShopUseCase | null {
  const text = description.toLowerCase();
  let best: ShopUseCase | null = null;
  let bestScore = 0;
  for (const useCase of DETECT_PRIORITY) {
    const keywords = CATEGORY_KEYWORDS[useCase] ?? [];
    const score = keywords.reduce((acc, kw) => acc + (text.includes(kw.toLowerCase()) ? 1 : 0), 0);
    if (score > bestScore) {
      bestScore = score;
      best = useCase;
    }
  }
  return bestScore > 0 ? best : null;
}

export interface ShopFollowUpOption {
  label: string;
  value: string;
  loadDelta: number;
}

export interface ShopFollowUpQuestion {
  id: string;
  text: string;
  options: ShopFollowUpOption[];
}

const FOLLOW_UPS: Record<ShopUseCase, ShopFollowUpQuestion[]> = {
  torah: [
    {
      id: "torah_software",
      text: 'האם אתה משתמש (או מתכנן להשתמש) בתוכנות תורניות כבדות כמו "אוצר החכמה", פרויקט השו"ת של בר אילן, או ספריות דיגיטליות גדולות בדומה?',
      options: [
        { label: "לא, בעיקר הקלדה, גלישה וצפייה בשיעורים", value: "no", loadDelta: 0 },
        { label: "כן, אבל בדרך כלל ספר/חלון אחד בכל פעם", value: "light", loadDelta: 1 },
        { label: "כן, ובדרך כלל כמה ספרים/חלונות פתוחים במקביל", value: "heavy", loadDelta: 2 },
      ],
    },
    {
      id: "torah_writing",
      text: "בנוסף ללימוד - האם אתה גם כותב ומעצב חידושים (וורד, הקלדה עם מקורות, לפעמים גם הדפסה של קבצים גדולים)?",
      options: [
        { label: "לא ממש, בעיקר לומד וגולש", value: "no", loadDelta: 0 },
        { label: "כן, כותב ומעצב מסמכים באופן קבוע", value: "yes", loadDelta: 1 },
      ],
    },
  ],
  office: [
    {
      id: "office_multitask",
      text: "כמה תוכנות/כרטיסיות אתה נוהג לפתוח יחד (מייל, אופיס, כמה טאבים בדפדפן)?",
      options: [
        { label: "מעט - שימוש בסיסי, דבר אחד בכל פעם", value: "low", loadDelta: 0 },
        { label: "בינוני - כמה דברים יחד, לא כבד במיוחד", value: "mid", loadDelta: 1 },
        { label: "הרבה - עשרות טאבים וכמה תוכנות פתוחות כל הזמן", value: "high", loadDelta: 2 },
      ],
    },
    {
      id: "office_video_calls",
      text: "האם המחשב ישמש גם לשיחות וידאו (זום/טימס) באופן קבוע?",
      options: [
        { label: "לא", value: "no", loadDelta: 0 },
        { label: "כן, כמעט כל יום", value: "yes", loadDelta: 1 },
      ],
    },
  ],
  graphics: [
    {
      id: "graphics_apps",
      text: "באיזה תוכנות תעבוד בעיקר?",
      options: [
        { label: "עיצוב פשוט - Canva, עריכת תמונות קלה", value: "light", loadDelta: 0 },
        { label: "פוטושופ / אילוסטרייטור ברמה רגילה", value: "mid", loadDelta: 2 },
        { label: "כמה תוכנות אדובי יחד, קבצים כבדים, תלת מימד", value: "heavy", loadDelta: 3 },
      ],
    },
    {
      id: "graphics_multi",
      text: "כמה קבצים/תוכנות פתוחים יחד בדרך כלל בזמן העבודה?",
      options: [
        { label: "קובץ אחד, תוכנה אחת", value: "one", loadDelta: 0 },
        { label: "כמה קבצים/תוכנות במקביל", value: "few", loadDelta: 1 },
      ],
    },
  ],
  video: [
    {
      id: "video_res",
      text: "באיזו רזולוציה בעיקר תערוך?",
      options: [
        { label: "HD / לרשתות חברתיות, קליפים קצרים", value: "hd", loadDelta: 1 },
        { label: "Full HD קבוע", value: "fullhd", loadDelta: 2 },
        { label: "4K ומעלה", value: "4k", loadDelta: 3 },
      ],
    },
    {
      id: "video_effects",
      text: "כמה שכבות/אפקטים/תיקוני צבע יש בדרך כלל בפרויקט?",
      options: [
        { label: "עריכה בסיסית - חיתוך והדבקה", value: "basic", loadDelta: 0 },
        { label: "הרבה שכבות, אפקטים, תיקון צבע", value: "heavy", loadDelta: 2 },
      ],
    },
  ],
  gaming: [
    {
      id: "gaming_titles",
      text: "אילו משחקים בעיקר תשחק?",
      options: [
        { label: "משחקים קלילים / משפחתיים / דפדפן", value: "light", loadDelta: 0 },
        { label: "משחקים פופולריים ברמה בינונית (כמו פורטנייט, וולורנט)", value: "mid", loadDelta: 2 },
        { label: "משחקי AAA כבדים בגרפיקה גבוהה", value: "heavy", loadDelta: 3 },
      ],
    },
    {
      id: "gaming_stream",
      text: "האם תרצה גם להקליט או לשדר (סטרימינג) תוך כדי משחק?",
      options: [
        { label: "לא", value: "no", loadDelta: 0 },
        { label: "כן", value: "yes", loadDelta: 1 },
      ],
    },
  ],
  programming: [
    {
      id: "prog_type",
      text: "באיזה סוג פיתוח מדובר בעיקר?",
      options: [
        { label: "פיתוח אתרים / קוד כללי", value: "web", loadDelta: 1 },
        { label: "פיתוח אפליקציות עם כלים כבדים (Android Studio / Xcode / Docker)", value: "heavy_tools", loadDelta: 2 },
        { label: "מסדי נתונים גדולים, וירטואליזציה, או עבודה עם מודלים/AI", value: "data", loadDelta: 3 },
      ],
    },
    {
      id: "prog_multitask",
      text: "כמה סביבות/כלים פתוחים יחד בדרך כלל (עורך קוד, דפדפן, שרת מקומי, טרמינל...)?",
      options: [
        { label: "אחד או שניים", value: "low", loadDelta: 0 },
        { label: "כמה יחד כל הזמן", value: "high", loadDelta: 1 },
      ],
    },
  ],
  general: [
    {
      id: "general_intensity",
      text: "איך היית מתאר את העומס הצפוי על המחשב?",
      options: [
        { label: "קליל - גלישה, מיילים, צפייה בסרטונים", value: "light", loadDelta: 0 },
        { label: "בינוני - כמה תוכנות יחד, שימוש יומיומי", value: "mid", loadDelta: 1 },
        { label: "כבד - הרבה תוכנות כבדות יחד", value: "heavy", loadDelta: 3 },
      ],
    },
  ],
};

export function getFollowUpQuestions(useCase: ShopUseCase): ShopFollowUpQuestion[] {
  return FOLLOW_UPS[useCase];
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/** רמת עומס 1 (קליל מאוד) עד 5 (כבד מאוד), לפי בסיס + סכום ה-loadDelta של התשובות שנבחרו */
export function computeLoadLevel(useCase: ShopUseCase, selectedDeltas: number[]): number {
  const base = 2;
  const total = base + selectedDeltas.reduce((a, b) => a + b, 0);
  return clamp(total, 1, 5);
}

interface SpecRung {
  cpu: string;
  ram: string;
  storage: string;
  gpu?: string;
  extras?: string;
}

const OFFICE_LADDER: SpecRung[] = [
  { cpu: "Intel Core i3 (דור 12 ומעלה) / AMD Ryzen 3", ram: "8GB", storage: "SSD 256GB" },
  { cpu: "Intel Core i5 (דור 12 ומעלה)", ram: "8GB", storage: "SSD 256GB" },
  { cpu: "Intel Core i5 (דור 12 ומעלה)", ram: "16GB", storage: "SSD 512GB" },
  { cpu: "Intel Core i5 (דור 13 ומעלה)", ram: "16GB", storage: "SSD 512GB" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "32GB", storage: "SSD 1TB" },
  { cpu: "Intel Core i7 / i9 (דור 13 ומעלה)", ram: "32GB", storage: "SSD 1TB NVMe" },
];

const PROGRAMMING_LADDER: SpecRung[] = [
  { cpu: "Intel Core i5 (דור 12 ומעלה)", ram: "8GB", storage: "SSD 256GB" },
  { cpu: "Intel Core i5 (דור 12 ומעלה)", ram: "16GB", storage: "SSD 512GB" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "16GB", storage: "SSD 512GB NVMe" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "32GB", storage: "SSD 512GB NVMe" },
  { cpu: "Intel Core i7 (דור 13 ומעלה), מומלץ הרבה ליבות", ram: "32GB", storage: "SSD 1TB NVMe", extras: "חשוב לעבודה נוחה עם Docker/מכונות וירטואליות" },
  { cpu: "Intel Core i9 (דור 13 ומעלה)", ram: "64GB", storage: "SSD 1TB NVMe" },
];

const GRAPHICS_LADDER: SpecRung[] = [
  { cpu: "Intel Core i5 (דור 12 ומעלה)", ram: "16GB", storage: "SSD 512GB", gpu: "מובנה (ללא כרטיס מסך נפרד)" },
  { cpu: "Intel Core i5 (דור 12 ומעלה)", ram: "16GB", storage: "SSD 512GB", gpu: "כרטיס מסך נפרד קל (4GB VRAM)" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "16GB", storage: "SSD 512GB NVMe", gpu: "כרטיס מסך נפרד 6-8GB VRAM" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "32GB", storage: "SSD 1TB NVMe", gpu: "כרטיס מסך נפרד 8GB VRAM ומעלה" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "32GB", storage: "SSD 1TB NVMe", gpu: "כרטיס מסך חזק 12GB VRAM ומעלה", extras: "מומלץ מסך עם כיסוי צבעים גבוה" },
  { cpu: "Intel Core i9 (דור 13 ומעלה)", ram: "64GB", storage: "SSD 2TB NVMe", gpu: "כרטיס מסך Top-tier, 16GB VRAM ומעלה", extras: "מומלץ מסך כיול צבע + זיכרון מהיר" },
];

const VIDEO_LADDER: SpecRung[] = [
  { cpu: "Intel Core i5 (דור 12 ומעלה)", ram: "16GB", storage: "SSD 512GB", gpu: "מובנה (ללא כרטיס מסך נפרד)" },
  { cpu: "Intel Core i5 (דור 13 ומעלה)", ram: "16GB", storage: "SSD 1TB NVMe", gpu: "כרטיס מסך נפרד קל" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "32GB", storage: "SSD 1TB NVMe", gpu: "כרטיס מסך נפרד 6-8GB VRAM" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "32GB", storage: "SSD 1TB NVMe", gpu: "כרטיס מסך נפרד 8-12GB VRAM", extras: "מומלץ דיסק נוסף לגיבוי חומר גלם" },
  { cpu: "Intel Core i9 (דור 13 ומעלה)", ram: "64GB", storage: "SSD 2TB NVMe", gpu: "כרטיס מסך חזק 12-16GB VRAM", extras: "מומלץ דיסק נוסף + כרטיס לכידה במידת הצורך" },
  { cpu: "Intel Core i9 (דור 13 ומעלה)", ram: "64GB", storage: "SSD 2TB NVMe", gpu: "כרטיס מסך Top-tier, 16GB VRAM ומעלה", extras: "דיסק חיצוני נוסף מומלץ בחום" },
];

const GAMING_LADDER: SpecRung[] = [
  { cpu: "Intel Core i5 (דור 12 ומעלה)", ram: "16GB", storage: "SSD 512GB", gpu: "כרטיס גיימינג התחלתי (6GB VRAM)" },
  { cpu: "Intel Core i5 (דור 13 ומעלה)", ram: "16GB", storage: "SSD 512GB", gpu: "כרטיס גיימינג בינוני (8GB VRAM)" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "16GB", storage: "SSD 1TB NVMe", gpu: "כרטיס גיימינג חזק (8-12GB VRAM)" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "32GB", storage: "SSD 1TB NVMe", gpu: "כרטיס גיימינג חזק מאוד (12GB VRAM ומעלה)" },
  { cpu: "Intel Core i7 (דור 13 ומעלה)", ram: "32GB", storage: "SSD 1TB NVMe", gpu: "כרטיס גיימינג Top-tier (16GB VRAM ומעלה)", extras: "מומלץ גם קירור משודרג" },
  { cpu: "Intel Core i9 (דור 13 ומעלה)", ram: "64GB", storage: "SSD 2TB NVMe", gpu: "כרטיס גיימינג Top-tier (16GB VRAM ומעלה)", extras: "קירור נוזלי + מסך גיימינג מומלצים" },
];

function getLadder(useCase: ShopUseCase): SpecRung[] {
  switch (useCase) {
    case "programming":
      return PROGRAMMING_LADDER;
    case "graphics":
      return GRAPHICS_LADDER;
    case "video":
      return VIDEO_LADDER;
    case "gaming":
      return GAMING_LADDER;
    default:
      return OFFICE_LADDER;
  }
}

const TIER_TITLES: Record<ShopTier, string> = {
  minimal: "תצורה מינימלית",
  recommended: "תצורה מומלצת",
  extreme: "תצורה מוגברת",
};

const TIER_REASONS: Record<ShopTier, string> = {
  minimal: "עונה בדיוק על מה שתיארת, בלי תוספות מיותרות - האופציה החסכונית ביותר.",
  recommended: "נותנת מרווח נשימה נוח ועמידה גם כשהשימוש קצת גדל עם הזמן - זו הבחירה שרוב הלקוחות בפרופיל דומה בוחרים.",
  extreme: "ביצועים גבוהים משמעותית מהנדרש כרגע, לטובת מי שרוצה שקט נפשי לטווח ארוך ולא לחשוב שוב על שדרוג.",
};

function specSummary(rung: SpecRung): string {
  const parts = [rung.cpu, `זיכרון ${rung.ram}`, `אחסון ${rung.storage}`];
  if (rung.gpu) parts.push(rung.gpu);
  return parts.join(" · ");
}

function genericReason(tier: ShopTier, useCaseLabel: string): string {
  return `${TIER_REASONS[tier]} מותאם לשימוש שתיארת: ${useCaseLabel}.`;
}

function buildGenericOption(useCase: ShopUseCase, tier: ShopTier, loadLevel: number): ShopRecommendedOption {
  const ladder = getLadder(useCase);
  const startIdx = clamp(loadLevel - 1, 0, ladder.length - 1);
  const idxByTier: Record<ShopTier, number> = {
    minimal: startIdx,
    recommended: clamp(startIdx + 1, 0, ladder.length - 1),
    extreme: clamp(startIdx + 3, 0, ladder.length - 1),
  };
  const rung = ladder[idxByTier[tier]]!;
  const extrasSuffix = rung.extras ? ` (${rung.extras})` : "";
  return {
    tier,
    title: TIER_TITLES[tier],
    specsSummary: specSummary(rung) + extrasSuffix,
    reason: genericReason(tier, USE_CASE_LABELS[useCase]),
  };
}

/** מחפש בקטלוג (n_shop_catalog) תצורה פעילה שמתאימה לתחום+דרגה, ומעדיפה את זו עם minLoadLevel הגבוה ביותר שעדיין <= loadLevel */
export function matchCatalog(
  catalog: ShopComputerConfig[],
  useCase: ShopUseCase,
  tier: ShopTier,
  loadLevel: number
): ShopComputerConfig | undefined {
  const candidates = catalog.filter((c) => c.active && c.tier === tier && c.useCases.includes(useCase));
  if (!candidates.length) return undefined;
  const fitting = candidates.filter((c) => c.minLoadLevel <= loadLevel).sort((a, b) => b.minLoadLevel - a.minLoadLevel);
  if (fitting.length) return fitting[0];
  return [...candidates].sort((a, b) => a.minLoadLevel - b.minLoadLevel)[0];
}

/** בונה את שלוש האופציות (מינימלי/מומלץ/מוגזם) - מהקטלוג האמיתי כשיש התאמה, אחרת ממפרט גנרי לפי תחום+עומס */
export function buildRecommendedOptions(useCase: ShopUseCase, loadLevel: number, catalog: ShopComputerConfig[]): ShopRecommendedOption[] {
  const tiers: ShopTier[] = ["minimal", "recommended", "extreme"];
  return tiers.map((tier) => {
    const match = matchCatalog(catalog, useCase, tier, loadLevel);
    if (match) {
      const extrasSuffix = match.extras ? ` · ${match.extras}` : "";
      return {
        tier,
        title: match.name,
        specsSummary: `${match.cpu} · זיכרון ${match.ram} · אחסון ${match.storage}${match.gpu ? ` · ${match.gpu}` : ""}${extrasSuffix}`,
        reason: match.notes || genericReason(tier, USE_CASE_LABELS[useCase]),
        priceILS: match.priceILS,
        catalogId: match.id,
      };
    }
    return buildGenericOption(useCase, tier, loadLevel);
  });
}

export function activeAddons(addons: ShopAddon[]): ShopAddon[] {
  return addons.filter((a) => a.active);
}
