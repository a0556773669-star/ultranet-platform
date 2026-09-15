/**
 * ייבוא הכנסות חודשיות לסניף חדר מחשבים מקובץ אקסל.
 *
 * הקובץ פשוט בכוונה - שתי עמודות בלבד: חודש וסכום, שורה אחת לכל חודש. זהו מילוי היסטוריה
 * חד-פעמי של המעקב הפנימי ("כמה הסניף הזה מחזיר לי"), ולכן - בדיוק כמו הטופס הידני שלצידו -
 * הוא כותב רק ל-`n_branch_income` ולעולם לא ל-`n_ah_income`: אף שקל שנכנס מכאן לא נספר
 * בהנה"ח הראשית ולא בדשבורד.
 *
 * הפער היחיד שבאמת מפיל ייבוא כזה הוא אקסל עצמו: תא שנכתב בו `10/24` עלול להפוך אוטומטית
 * לתאריך (24 באוקטובר של השנה הנוכחית) ואז השנה 2024 אבודה. לכן עמודת החודש בתבנית נכתבת
 * כטקסט מראש, והפרסר מקבל גם תא-תאריך אמיתי אבל מחזיר עליו אזהרה שמוצגת למשתמש - עדיף
 * שיראה "פירשתי 10/2026, בדוק" מאשר שיגלה את זה בעוד חצי שנה בגרף.
 */
import * as XLSX from "xlsx";

/** כמה שורות ריקות בעמודת החודש נכתבות מראש כטקסט בתבנית, כדי שאקסל לא יהפוך אותן לתאריך */
const TEMPLATE_TEXT_ROWS = 240;

export const BRANCH_INCOME_SHEET = "הכנסות חודשיות";
export const BRANCH_INCOME_HEADERS = {
  month: "חודש (לדוגמה 10/24)",
  amount: "סכום",
} as const;

/**
 * מתג הייבוא. זו תוספת זמנית למילוי היסטוריה - ברגע שהמילוי נגמר מכבים אותה בלי לגעת בקוד,
 * ע"י `BRANCH_INCOME_IMPORT=off` בסביבה. כשהיא כבויה גם הכפתורים, גם ה-API של התבנית וגם
 * ה-Server Action מסרבים, כדי שלא יישאר נתיב פתוח אחרי שהכפתור נעלם מהמסך.
 */
export function isBranchIncomeImportEnabled(): boolean {
  return (process.env.BRANCH_INCOME_IMPORT ?? "on").toLowerCase() !== "off";
}

/** "2024-10" -> "10/2024" - איך שהחודש נקרא בעברית ובקובץ שהמשתמש ממלא */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return y && m ? `${m}/${y}` : month;
}

function twoDigits(n: number): string {
  return String(n).padStart(2, "0");
}

/** התוצאה של פענוח תא חודש: החודש עצמו, ואם הוא הגיע מתא תאריך אמיתי (שאולי אקסל המיר) */
interface MonthParse {
  month: string;
  fromDateCell: boolean;
}

function fromParts(rawMonth: number, rawYear: number): MonthParse | null {
  let month = rawMonth;
  let year = rawYear;
  // 10/24 מול 24/10: המוסכמה היא חודש-ואז-שנה, אבל מי שהפך אותן בטעות עדיין מזוהה - יש רק
  // צירוף אחד הגיוני כששני המספרים קטנים ורק אחד מהם יכול להיות חודש.
  if (month > 12 && year <= 12) [month, year] = [year, month];
  if (month < 1 || month > 12) return null;
  if (year < 100) year += 2000;
  if (year < 2000 || year > 2100) return null;
  return { month: `${year}-${twoDigits(month)}`, fromDateCell: false };
}

/**
 * מספר סידורי של אקסל -> תאריך. אקסל סופר ימים מ-1900-01-01 ומחשיב בטעות את 1900 כשנה
 * מעוברת, ולכן נקודת האפס המקובלת היא 1899-12-30.
 */
function excelSerialToDate(serial: number): Date {
  return new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000);
}

/** מקבל תא חודש בכל צורה סבירה ומחזיר "YYYY-MM", או null אם אי אפשר להבין אותו */
export function parseMonthCell(value: unknown): MonthParse | null {
  if (value instanceof Date) {
    return { month: `${value.getFullYear()}-${twoDigits(value.getMonth() + 1)}`, fromDateCell: true };
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    // מספר סידורי של אקסל (תא שהומר לתאריך). ההמרה נעשית כאן ולא דרך XLSX.SSF כי אותו
    // מודול לא מיוצא בכל בילד של החבילה, ו-SSF שלא קיים היה מפיל את כל הייבוא.
    // מתחת לסף הזה (בערך שנת 1902) זה לא תאריך אלא מספר שנכתב בטעות בעמודת החודש.
    if (value < 1000) return null;
    const d = excelSerialToDate(value);
    const parsed = fromParts(d.getUTCMonth() + 1, d.getUTCFullYear());
    return parsed ? { ...parsed, fromDateCell: true } : null;
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,4})\s*[/.\-\\]\s*(\d{1,4})$/);
  if (m) {
    const a = Number(m[1]);
    const b = Number(m[2]);
    // "2024-10" / "2024/10" - ארבע ספרות בהתחלה זו תמיד השנה.
    if (m[1]!.length === 4) return fromParts(b, a);
    if (m[2]!.length === 4) return fromParts(a, b);
    return fromParts(a, b);
  }
  return null;
}

/** מקבל תא סכום ("1,250", "1250 ₪", 1250) ומחזיר מספר, או null */
export function parseAmountCell(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const raw = String(value ?? "")
    .replace(/[₪,\s]/g, "")
    .trim();
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function buildBranchIncomeTemplateWorkbook(branchName?: string): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([[BRANCH_INCOME_HEADERS.month, BRANCH_INCOME_HEADERS.amount]]);

  // עמודת החודש נשמרת כטקסט מראש: תא ריק עם פורמט "@" שומר על הפורמט גם אחרי שממלאים
  // אותו, ולכן `10/24` שנכתב בו נשאר `10/24` ולא הופך ל-24 באוקטובר של השנה הנוכחית.
  for (let r = 1; r <= TEMPLATE_TEXT_ROWS; r++) {
    ws[XLSX.utils.encode_cell({ c: 0, r })] = { t: "s", v: "", z: "@" };
  }
  ws["!ref"] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 1, r: TEMPLATE_TEXT_ROWS } });
  ws["!cols"] = [{ wch: 22 }, { wch: 16 }];

  const wb = XLSX.utils.book_new();
  // הקובץ נפתח מימין לשמאל, ולכן עמודה A - החודש - היא באמת העמודה הימנית שעליה מדובר
  // בהוראות. ההגדרה הזו היא ברמת החוברת; `ws["!views"]` המקביל פשוט לא נכתב לקובץ.
  wb.Workbook = { ...wb.Workbook, Views: [{ RTL: true }] };
  XLSX.utils.book_append_sheet(wb, ws, BRANCH_INCOME_SHEET);

  const wsInfo = XLSX.utils.aoa_to_sheet([
    [`מילוי הכנסות חודשיות${branchName ? ` — סניף ${branchName}` : ""}`],
    [""],
    [`בגיליון "${BRANCH_INCOME_SHEET}": בעמודה הימנית החודש, בעמודה שלצידה הסכום. שורה אחת לכל חודש.`],
    [""],
    ["דוגמה:"],
    ["חודש", "סכום"],
    ["10/24", 3200],
    ["11/24", 2850],
    ["12/24", 4100],
    [""],
    ["פורמט החודש: חודש/שנה. גם 10/2024 וגם 2024-10 מתקבלים."],
    ["אל תשנה את עיצוב עמודת החודש - היא מוגדרת כטקסט כדי שאקסל לא יהפוך את 10/24 לתאריך."],
    ["הסכום יכול להיכתב עם פסיקים או עם ₪ - שניהם מזוהים."],
    ["שורות ריקות מדולגות. שתי שורות לאותו חודש מתחברות לשורה אחת."],
    [""],
    ["הנתונים נכנסים למעקב הפנימי של הסניף בלבד ולא להנה\"ח הראשית."],
    ["ייבוא חוזר של אותו חודש מחליף את השורה שיובאה קודם - הוא לא מוסיף אותה פעמיים,"],
    ["ולעולם לא נוגע בשורות שהוקלדו ידנית באתר."],
  ]);
  wsInfo["!cols"] = [{ wch: 92 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, wsInfo, "הוראות");

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export interface ParsedMonthIncome {
  /** "YYYY-MM" */
  month: string;
  amount: number;
}

export interface BranchIncomeParseResult {
  rows: ParsedMonthIncome[];
  errors: string[];
  /** שורות שנקראו אבל כדאי שהמשתמש יאמת אותן - בעיקר תא שאקסל הפך לתאריך */
  warnings: string[];
}

function isBlankRow(row: unknown[]): boolean {
  return !row || row.every((c) => String(c ?? "").trim() === "");
}

/**
 * מזהה איזו עמודה היא החודש ואיזו הסכום. קודם לפי הכותרות, ואם אין כותרות - לפי התוכן:
 * העמודה שרוב הערכים בה נקראים כחודש היא עמודת החודש. כך גם קובץ שהמשתמש בנה בעצמו,
 * בלי הכותרות שלנו ובסדר עמודות הפוך, עדיין נקרא נכון.
 */
function locateColumns(data: unknown[][]): { monthCol: number; amountCol: number; dataStart: number } | null {
  const headerRow = (data[0] ?? []).map((c) => String(c ?? "").trim());
  const headerMonth = headerRow.findIndex((h) => h.includes("חודש") || h.includes("תאריך"));
  const headerAmount = headerRow.findIndex((h) => h.includes("סכום") || h.includes("הכנסה"));
  if (headerMonth !== -1 && headerAmount !== -1 && headerMonth !== headerAmount) {
    return { monthCol: headerMonth, amountCol: headerAmount, dataStart: 1 };
  }

  const width = Math.max(...data.map((r) => (r ? r.length : 0)), 0);
  if (width < 2) return null;
  const monthHits: number[] = [];
  for (let c = 0; c < width; c++) {
    let hits = 0;
    for (const row of data) {
      if (isBlankRow(row)) continue;
      if (parseMonthCell(row[c]) !== null) hits++;
    }
    monthHits.push(hits);
  }
  let monthCol = 0;
  for (let c = 1; c < width; c++) if (monthHits[c]! > monthHits[monthCol]!) monthCol = c;
  if (monthHits[monthCol]! === 0) return null;

  // עמודת הסכום היא העמודה השכנה שיש בה מספרים - בקובץ של שתי עמודות זו פשוט השנייה.
  let amountCol = -1;
  for (let c = 0; c < width; c++) {
    if (c === monthCol) continue;
    const hits = data.filter((row) => !isBlankRow(row) && parseAmountCell(row[c]) !== null).length;
    if (hits > 0) {
      amountCol = c;
      break;
    }
  }
  if (amountCol === -1) return null;

  // אם השורה הראשונה לא נקראת כחודש היא כותרת, גם אם לא זיהינו את הטקסט שלה.
  const dataStart = parseMonthCell((data[0] ?? [])[monthCol]) === null ? 1 : 0;
  return { monthCol, amountCol, dataStart };
}

/** קורא קובץ אקסל של הכנסות חודשיות ומחזיר שורה אחת מאוחדת לכל חודש, ממוינות לפי החודש */
export function parseBranchIncomeWorkbook(buf: Buffer): BranchIncomeParseResult {
  let wb: XLSX.WorkBook;
  try {
    wb = XLSX.read(buf, { type: "buffer", cellDates: true });
  } catch {
    return { rows: [], errors: ["לא ניתן לקרוא את הקובץ - ודא שזהו קובץ אקסל תקין (xlsx)"], warnings: [] };
  }
  const sheetName =
    wb.SheetNames.find((n) => n === BRANCH_INCOME_SHEET) ??
    wb.SheetNames.find((n) => n.includes("הכנס")) ??
    wb.SheetNames.find((n) => !n.includes("הוראות")) ??
    wb.SheetNames[0];
  const ws = sheetName ? wb.Sheets[sheetName] : undefined;
  if (!ws) return { rows: [], errors: ["לא נמצא גיליון נתונים בקובץ"], warnings: [] };

  const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", blankrows: false });
  if (!data.length) return { rows: [], errors: ["הקובץ ריק"], warnings: [] };

  const cols = locateColumns(data);
  if (!cols) {
    return {
      rows: [],
      errors: [
        `לא זוהו עמודות החודש והסכום. הורד את התבנית ומלא אותה: עמודה אחת עם החודש (לדוגמה 10/24) ולצידה הסכום.`,
      ],
      warnings: [],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];
  // חודש שמופיע פעמיים בקובץ מתחבר לסכום אחד - השורה בסוף היא "כמה נכנס בחודש הזה".
  const byMonth = new Map<string, number>();

  for (let r = cols.dataStart; r < data.length; r++) {
    const row = data[r] as unknown[];
    if (isBlankRow(row)) continue;
    const rowNum = r + 1;
    const parsed = parseMonthCell(row[cols.monthCol]);
    const amount = parseAmountCell(row[cols.amountCol]);
    if (!parsed) {
      errors.push(`שורה ${rowNum}: לא הובן החודש "${String(row[cols.monthCol] ?? "").trim()}" - השורה דולגה`);
      continue;
    }
    if (amount === null) {
      errors.push(`שורה ${rowNum} (${monthLabel(parsed.month)}): חסר סכום - השורה דולגה`);
      continue;
    }
    if (amount < 0) {
      errors.push(`שורה ${rowNum} (${monthLabel(parsed.month)}): סכום שלילי אינו נתמך - השורה דולגה`);
      continue;
    }
    if (parsed.fromDateCell) {
      warnings.push(
        `שורה ${rowNum}: התא היה מעוצב כתאריך ולא כטקסט, ולכן נקרא כ-${monthLabel(parsed.month)} - ודא שזה החודש הנכון`,
      );
    }
    byMonth.set(parsed.month, (byMonth.get(parsed.month) ?? 0) + amount);
  }

  const rows = [...byMonth.entries()]
    .map(([month, amount]) => ({ month, amount }))
    .sort((a, b) => a.month.localeCompare(b.month));

  if (rows.length === 0 && errors.length === 0) errors.push("לא נמצאו שורות נתונים בקובץ");
  return { rows, errors, warnings };
}
