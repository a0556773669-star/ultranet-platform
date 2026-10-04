// ====================================================================
// נתוני המקור של רבעון 1 - תרגום מובנה של רשימת המשימות הידנית.
//
// זהו **מקור האמת של הייבוא**: קובץ אחד, קריא, שניתן לבדוק מול המסמך המקורי
// שורה-שורה. מנוע הייבוא (`import-plan.ts`) לא מכיר את התוכן - הוא רק הופך את
// המבנה הזה לרשומות, ולכן תיקון כאן הוא תיקון של הייבוא כולו.
//
// כללי התרגום (לפי מסמך ההוראות):
// - לא כל שורה היא משימה. נתוני רקע, טלפונים, קישורים ועדכוני ביצוע ("שלחתי
//   מייל", "לא ענה", "מחכים לתשובה") נשמרים ב-`notes`/`description` של המשימה.
// - "התיבה סומנה"/"לא סומנה" הוסרו מהכותרות ומשמשים **רק** לקביעת התוצאה בתקופה.
// - שגיאות כתיב ברורות תוקנו; המשמעות לא שונתה ולא הומצא מידע.
// - כותרת שהיא סלע או תת-סלע אינה נוצרת שוב כאבן דרך.
// ====================================================================

/** תקופות המקור, כפי שהן מופיעות במסמך. המיפוי למפתחות אמיתיים נעשה בתוכנית. */
export type PeriodTag = "Q" | "M1" | "M1W1" | "M1W2" | "M1W3" | "M1W4" | "M2" | "M2W1";

export const CLOSED_PERIODS: PeriodTag[] = ["M1", "M1W1", "M1W2", "M1W3", "M1W4"];
export const ACTIVE_PERIODS: PeriodTag[] = ["M2", "M2W1"];

export type Mark = "done" | "open";

export type SourceRock = {
  key: string;
  title: string;
  description?: string;
  /** ריק = סלע; מוגדר = תת-סלע */
  parent?: string;
  /** אחראי שמופה בוודאות למזהה קיים (`ROCK_OWNERS`) */
  owner?: string;
  /** אחראי שלא ניתן למפות בוודאות ("מזכירה", "שתינו") - נשמר כטקסט ולא מומצא */
  ownerNote?: string;
  marks?: Partial<Record<PeriodTag, Mark>>;
};

export type SourceMilestone = {
  key: string;
  sub: string;
  title: string;
  description?: string;
  notes?: string;
  owner?: string;
  ownerNote?: string;
  /** סיבת סימון לבדיקה - שורה שלא הייתה חד-משמעית במקור */
  review?: string;
  marks: Partial<Record<PeriodTag, Mark>>;
};

/** "Q+ M1+ M1W1-" → { Q: "done", M1: "done", M1W1: "open" } */
export function parseMarks(spec: string): Partial<Record<PeriodTag, Mark>> {
  const out: Partial<Record<PeriodTag, Mark>> = {};
  spec
    .split(/\s+/)
    .filter(Boolean)
    .forEach((token) => {
      const mark: Mark = token.endsWith("+") ? "done" : "open";
      out[token.slice(0, -1) as PeriodTag] = mark;
    });
  return out;
}

type Extra = Omit<SourceMilestone, "key" | "sub" | "title" | "marks">;

function m(key: string, sub: string, title: string, marks: string, extra: Extra = {}): SourceMilestone {
  return { key, sub, title, marks: parseMarks(marks), ...extra };
}

// --- סלעים ותתי-סלעים ---------------------------------------------------

export const ROCKS: SourceRock[] = [
  {
    key: "company",
    title: "חברה מסודרת",
    description: "כל הסניפים פעילים, מתועדים ומנוהלים לפי נהלים ברורים, עם הנהלת חשבונות ותקציב מסודרים.",
  },
  { key: "company/branches", parent: "company", title: "כל הסניפים פעילים בצורה מושלמת", ownerNote: "מזכירה", marks: parseMarks("Q- M1+ M1W1+ M2-") },
  { key: "company/pbx", parent: "company", title: "ניהול מזכירה ומרכזייה", marks: parseMarks("Q+ M1+ M1W1+ M1W2-") },
  { key: "company/cr-bs", parent: "company", title: "חדר מחשבים עובד פיקס - בית שמש", owner: "יוני", marks: parseMarks("Q+ M1+ M1W1+ M1W2+ M1W3+ M1W4-") },
  { key: "company/cr-tzfat", parent: "company", title: "חדרי מחשבים - צפת" },
  {
    key: "company/budget",
    parent: "company",
    title: "תקציב מסודר",
    description: "ניהול תקציב מסודר דורש המון זמן והכנה - אבל שווה את זה.",
  },

  {
    key: "site",
    title: "אתר אולטרנט",
    description:
      "ייעול ושיפור של אתר הניהול עד שהוא מחליף לגמרי אקסלים ורשימות: מלאי, גבייה, הנהלת חשבונות ומשימות - הכל באתר.",
  },
  {
    key: "site/improve",
    parent: "site",
    title: "אתר - ייעול, שיפור ושינוי",
    description: "המון עבודה מוקדמת וקצת עבודה מאוחרת.",
    ownerNote: "שתינו",
    marks: parseMarks("Q+ M1W2+"),
  },
  { key: "site/cr", parent: "site", title: "אתר ניהול - חדרי מחשבים", owner: "יוני" },
  { key: "site/rentals", parent: "site", title: "אתר ניהול - השכרת ניידים", owner: "יוני" },
  { key: "site/coworking", parent: "site", title: "אתר ניהול - משרד שיתופי", owner: "יוני" },
  { key: "site/accounting", parent: "site", title: "אתר ניהול - הנהלת חשבונות", owner: "יוני" },
  { key: "site/tasks", parent: "site", title: "אתר ניהול - משימות ונהלים", owner: "יוני" },
  { key: "site/kiosk", parent: "site", title: "אתר אולטרנט קיוסק" },

  {
    key: "income",
    title: "הגדלת הכנסות",
    description: [
      "הרעיון של העסק היה שכל מחשב מכניס לפחות 150 ש\"ח נטו בחודש, כולל הכל.",
      "",
      "הנתונים בתחילת הרבעון:",
      "4 חדרי מחשבים בצפת, ממוצע 223 ש\"ח למחשב = 10,000 (ובסך הכל 25,000)",
      "1 חדר מחשבים בבית שמש = 8,620 ש\"ח לפחות",
      "149 מחשבים של השכרת ניידים, היעד 150 נטו = 22,500",
      "3 משרד שיתופי = 2,000 ש\"ח",
      "סה\"כ 58,120 + 3,200 הכנסות קבועות · חסר 13,380",
      "",
      "מצב בחודש 2: אנחנו ב-36,500 והיעד הוא יותר מפי 2. התוכנית היא שעד ר\"ח כסלו נתקרב",
      "משמעותית לשם או נגיע לשם. בחשבון יש כרגע כ-30,000, צפי כניסה של עוד 20,000 חיצוני",
      "ועוד 7,000 מהידיעון - סה\"כ בעז\"ה כ-60,000. כל חודש אמור להיכנס 35,000, וכ-60,000",
      "אמורים לתת מענה ל-10/10 ול-10/11. עד אז צריך לעשות הכל כדי לא לקחת הלוואה תזרימית.",
      "",
      "איך מפרקים את ה-38,000: חדר המחשבים בבית שמש יביא תוך חודשיים 6,000 ש\"ח.",
      "במחשבים ניידים, לפי החלום שכל מחשב יביא מינימום 150 נטו, ועם כ-150 מחשבים,",
      "150x150 = 22,500 ש\"ח. מתוך ה-2,500 הרשומים היום זה אמור להביא עוד 20,000,",
      "ואז חסרים עוד 12,000.",
      "",
      "אם נחמי תכניס 6,000 ואני מגוטפלוס עוד סכום - זה הגיוני. 12,000 הם החזרי הלוואות",
      "שמקסימום נגלגל, אבל הרצון הגדול הוא לצלוח גם את זה. האופציות: להתחיל למכור מחשבים",
      "(דורש השקעה ראשונית ופרוצדורה), להריץ את התוכנה של סייפר ולשווק אותה בהמשך החורף,",
      "וסימים של סים כשר - 1,000 סימים נמכרים הם הכנסה חודשית של 10,000.",
      "אבל קודם כל נשתמש בזהב שיש לנו, ואחר כך נחשוב מה הלאה.",
    ].join("\n"),
  },
  { key: "income/dreams", parent: "income", title: "שכל החלומות האלה יתגשמו", marks: parseMarks("Q-") },
  { key: "income/options", parent: "income", title: "איך מגדילים הכנסות - אפשרויות", marks: parseMarks("Q-") },
  { key: "income/cr", parent: "income", title: "חדר מחשבים - הגדלת הכנסות" },
  { key: "income/rentals", parent: "income", title: "ניידים - הגדלת הכנסות" },
];

// --- אבני דרך ------------------------------------------------------------
// כל אבן דרך מופיעה **פעם אחת**, עם רשימת התקופות שבהן הופיעה במקור והתוצאה בכל
// אחת. שורה שחזרה ברבעון, בחודש ובשבוע אינה משוכפלת - היא צוברת שיוכים.

// === חברה מסודרת ‹ כל הסניפים פעילים בצורה מושלמת ===
const BRANCHES: SourceMilestone[] = [
  m("branches-document-activity", "company/branches", "מתעדים את כל הפעילות באתר", "Q+ M1+"),
  m("branches-advertise", "company/branches", "מפרסמים בצורה מסודרת", "Q+ M1+"),
  m("branches-procedures", "company/branches", "נהלים ברורים מול הסניפים", "Q+ M1+ M1W1+", {
    description: "העברות גבייה, ניהול השכרות, ומחירים - האם לאפשר גמישות, ופרסום.",
    ownerNote: "שתינו",
  }),
  m("branches-tenant-procedures", "company/branches", "נהלים ברורים מול השוכרים", "Q+ M1+ M1W1+", { ownerNote: "שתינו" }),
  m("branches-filing", "company/branches", "תיוק של כל המחשבים והסימים בצורה מסודרת - לנו ולסניפים", "Q- M1+"),
  m("branches-partnership-contract", "company/branches", "חוזה שותפות של כל הסניפים חתום", "Q- M1+"),
  m("branches-bookkeeping", "company/branches", "ניהול חשבונות בצורה מסודרת", "Q+ M1+"),
  m("branches-close-sub", "company/branches", "ביטול תתי סניפים", "Q+ M1+ M1W1+", {
    notes: "מ\"ח מאיר, אשדוד",
    description: "כולל ביטול תת-הסניף באשדוד.",
  }),
  m("branches-setup-procedure", "company/branches", "נוהל הקמת סניפים - כולל דף הסברים ללקוחות", "Q+ M1+ M1W1+"),
  m("branches-ads-site", "company/branches", "אתר פרסומת בצורה מושלמת", "Q+ M1+ M1W1+"),
  m("branches-single-card", "company/branches", "העברת התשלומים לכרטיס אשראי אחד", "Q- M1+", {
    description: "לשבת על זה ולסדר כמה שיותר מסודר.",
  }),
  m("branches-ashdod-check", "company/branches", "בדיקת סניפים באשדוד שנכנסים לעניינים", "M1W1+ M1W2+ M1W3+ M1W4+"),
  m("branches-ashdod-ads", "company/branches", "לדאוג לפרסום לסניפי אשדוד", "M1W1+ M1W2+"),
  m("branches-joint-procedure-call", "company/branches", "נוהל מסודר לכל הסניפים יחד ושיחת טלפון", "M1W1+"),
  m("branches-ads-site-final", "company/branches", "עדכון סופי לאתר הפרסומות", "M1W1+"),
  m("branches-add-expenses", "company/branches", "הוספת כל ההוצאות שלנו על סניפים, מחשבים, פרסום וסימים", "M1W1+ M1W2+ M1W3+"),
  m("branches-goldschmidt-call", "company/branches", "גולדשמידט סניף אלעד - להתקשר", "M1W1+"),
  m("branches-goldschmidt-followup", "company/branches", "לחזור אל גולדשמידט ביום ראשון - היא תבדוק עם בעלה", "M1W1+ M1W2+ M1W3+", {
    notes: "התקשרתי, לא היה מענה",
    description: "מעקב המשך: להשיג שוב את מספר הטלפון שלה.",
  }),
  m("branches-zoom-all", "company/branches", "זום עם כל הסניפים בהנחיית יוני", "M1W1+", { owner: "יוני" }),
  m("branches-zoom-schedule", "company/branches", "סגירת מועד הזום", "M1W1+"),
  m("branches-zoom-deck", "company/branches", "הכנת מצגת לזום", "M1W1+"),
  m("branches-zoom-run", "company/branches", "זום בפועל", "M1W1+"),
  m("branches-zoom-attendance", "company/branches", "לבדוק שכולם מגיעים לזום", "M1W1+"),
  m("branches-mail-group", "company/branches", "חיבור כולם לקבוצת המייל", "M1W1+"),
  m("branches-close-procedure", "company/branches", "נוהל סגירת סניפים", "M1W1+"),
  m("branches-yudlevitz-out", "company/branches", "יודלביץ החוצה", "M1W1+"),
  m("branches-markovich-yoni", "company/branches", "מרקוביץ - יוני מטפל, כי הוא לא רוצה לדבר איתי", "M1W1+ M1W2+ M1W3+ M1W4+", {
    owner: "יוני",
    notes: "לדחוק ולסיים את הסיפור",
  }),
  m("branches-benharush-transfer", "company/branches", "העברה לבן הרוש - 55,380", "M1W1+"),
  m("branches-benharush-invoices", "company/branches", "חשבוניות בן הרוש חודשים 06-07", "M1W1+ M1W2+ M1W3+", {
    notes: "מחכים לתשובה - לבדוק ביום שלישי",
  }),
  m("branches-benharush-allocation", "company/branches", "בן הרוש - מספר הקצאה", "M1W1+"),
  m("branches-cancel-019-sims", "company/branches", "לבטל את הסימים של 019 שעברו מזלצמן", "M1W1+ M1W4+"),
  m("branches-office-order", "company/branches", "סדר במשרד", "M1W1+"),
  m("branches-migrate-rocks-data", "company/branches", "העברת הנתונים של הסלעים ואבני הדרך לאתר שלנו", "M1W1+ M1W2+ M1W3+ M1W4+", {
    notes: "התחלנו, לא סיימנו",
  }),
  m("branches-owners-call", "company/branches", "טלפון לכלל בעלי הסניפים", "M1W2+", {
    description: [
      "לעבור עם כל בעל סניף על חמש הנקודות:",
      "1. האם הבינו הכל",
      "2. מפרסמים",
      "3. מתעדים הכל - הוצאות והשכרות",
      "4. חסר להם משהו",
      "5. אולי עוד משהו",
      "",
      "סיכום השיחות מהשבוע:",
      "נגר - שלחתי מייל מפורט · מ\"ח מאיר - נדבר בערב שתהיה על המחשב, לשלוח סרטון ·",
      "צ'ציק - לא ענה, לשלוח מייל מפורט · אשתו נפלה, להעביר לשבוע הבא; דיברנו וסידרנו,",
      "מתחילים כבר השבוע בעז\"ה · לנגלב · מרגלית · אור חיים · שלזינגר - מסתדרים מעולה ·",
      "פרקש - מת · לוי · רותם ראובן · מונסונגו · מרקוביץ - שלחתי מייל מסודר, לא עונה ·",
      "אחיסמך אלחנן כהן - אשתו ילדה לקראת סוף השבוע · שטרן אשדוד - שלחתי מייל · נתיבות ·",
      "דורפמן · וייס עפולה - דיברתי, מחכה לפרסומת, יתקשר אליי שיפעיל את נטפרי · רומנו",
    ].join("\n"),
  }),
  m("branches-shapira-sims", "company/branches", "שפירא - חסרים סימים, להעביר אותו לספק אחר", "M1W2+"),
  m("branches-shapira-video", "company/branches", "לשלוח לשפירא את הסרטון לדרייב", "M1W2+"),
  m("branches-graphics-rentals", "company/branches", "לדאוג לגרפיקה ולבדוק שהסניפים מתחילים השכרות", "M1W2+"),
  m("branches-kiryat-yovel", "company/branches", "לבדוק פתיחת סניף בקריית יובל", "M1W2+"),
  m("branches-markovich-moving", "company/branches", "מרקוביץ - כרגע עובר אליי", "M1W2+"),
  m("branches-markovich-site-out", "company/branches", "הוצאת מרקוביץ מהאתר", "M1W2+"),
  m("branches-markovich-ads-out", "company/branches", "הוצאת מרקוביץ מהפרסומת", "M1W2+"),
  m("branches-grossman-site", "company/branches", "חיבור גרוסמן לאתר", "M1W2+"),
  m("branches-grossman-ads", "company/branches", "חיבור גרוסמן לפרסומת", "M1W2+"),
  m("branches-idle-branches", "company/branches", "סניפים שלא עובדים - שיעבדו", "M1W2+"),
  m("branches-markovich-mail", "company/branches", "מרקוביץ - לשלוח מייל ברור לאן זה הולך", "M1W3+"),
  m("branches-stern-miller", "company/branches", "שטרן ומילר - שטרן כן, מילר פחות מצליחה לתקשר איתם", "M1W3+"),
  m("branches-more-computers", "company/branches", "בדיקה מול כל הסניפים - האם רוצים עוד מחשבים והאם חסר משהו", "M1W3+"),
  m("branches-tzfat-renters", "company/branches", "בדיקה מול השוכרים מיוני בצפת - מה איתם", "M1W3+ M1W4+"),
  m("branches-debt-collection", "company/branches", "טיפול בחובות מול מי שעדיין לא שילם", "M1W3+", {
    notes: "קלוגר שולם בנדרים פלוס",
    description:
      "יוטקובסקי - רשום שחייב סכום, אבל זה לא אמיתי. צריך לשאול מתי החזירו ולתקן.",
  }),
  m("branches-kaplan-charge", "company/branches", "קפלן - לגבות על מחשב", "M1W3+ M1W4+"),
  m("branches-markovich-shipment", "company/branches", "מרקוביץ - לתאם משלוח ממנו אליי, סוגר סניף", "M1W4+"),
  m("branches-secretary-salary", "company/branches", "משכורת למזכירה", "M1W4+"),
  m("branches-beitar-audit", "company/branches", "ביתר - בדיקה מקיפה מה קורה עם כל המחשבים", "M1W4+"),
  m("branches-beitar-reports", "company/branches", "ביתר - לבקש דוחות הכנסה, הוצאות מדויקות ופירוט מוצרים", "M1W4+", {
    description: "דוחות הכנסה למרות שזה חודשיים, הוצאות מדויקות כל חודש, ופירוט על המוצרים שקנה שם.",
  }),
  m("branches-sim-kosher-check", "company/branches", "סים כשר - לבדוק מה יוצא", "M1W4+"),
  m("branches-sim-kosher-request", "company/branches", "בקשה לסימים נוספים", "M1W4+", { notes: "שלחתי מייל ובקשה שיביאו עוד סימים" }),
  m("branches-sims-to-account", "company/branches", "להכניס את כל הסימים לחשבון של סים כשר עלינו", "M1W4+"),
  m("branches-sims-netfree", "company/branches", "לחבר את הסימים לנטפרי ולשלוח לכל הסניפים", "M1W4+"),
  m("branches-add-bs-branch", "company/branches", "הכנסת הסניף החדש של בית שמש", "M1W4+", {
    notes: "לפרסומת, לאתר ולקבוצת המייל",
  }),
  m("branches-koenig-payment", "company/branches", "קניג - להסדיר תשלום ב-20 לחודש", "M1W4+", {
    notes: "סגרנו על 4,650 - חצי עכשיו וחצי חודש הבא",
  }),
  m("branches-koenig-sim", "company/branches", "קניג - עד שלא מחזיר את הסים ומסדיר תשלום, כל יום נזקפת לו שכירות", "M1W4+"),
  m("branches-biton", "company/branches", "ביטון - מה איתו, לא עונה", "M1W4+"),
  m("branches-carpenter-invoice", "company/branches", "חשבונית מס מהנגר על השולחנות", "M1W4+"),
  m("branches-computers-registered", "company/branches", "כל המחשבים והסטיקים רשומים באתר במלואם", "M2- M2W1-", {
    description: "רק מחשב ומספר, בלי שמות נוספים. אם יש גרפיקה - לציין בסוגריים.",
  }),
  m("branches-push-computers-out", "company/branches", "הוצאת כל המחשבים שיש כיום הלאה", "M2- M2W1-"),
  m("branches-rebalance-computers", "company/branches", "סניף עם יותר מדי מחשבים - להעביר לסניפים חדשים בלי להסס", "M2- M2W1-"),
  m("branches-sims-registered", "company/branches", "כל סים רשום באופן מלא באתר", "M2- M2W1-"),
  m("branches-sim-kosher-groups", "company/branches", "לבדוק אופציה בסים כשר של קבוצת לקוחות בממשק", "M2- M2W1-", {
    description: "כדי לסדר טוב יותר ולתת שמות לסימים.",
  }),
  m("branches-sims-my-card", "company/branches", "העברת כל הסימים לסים כשר על האשראי שלי, וגם הנטפרי על שמי", "M2- M2W1-", {
    notes: "יש החזר מע\"מ",
  }),
  m("branches-new-branch-ads-ready", "company/branches", "כל סניף חדש מקבל פרסומת מוכנה יחד עם המחשבים", "M2- M2W1-", {
    description: "סוגרים פרסום מראש, כך שהם מתחילים ביום קבלת המחשבים ללא המתנה כלל.",
  }),
];

// === חברה מסודרת ‹ ניהול מזכירה ומרכזייה ===
const PBX: SourceMilestone[] = [
  m("pbx-secretary-hours", "company/pbx", "המזכירה נכנסת לגבולות העבודה מבחינת שעות", "Q+ M1+", { ownerNote: "מזכירה" }),
  m("pbx-secretary-tasks", "company/pbx", "המזכירה יודעת לבצע היטב את כל המשימות שלה", "Q+ M1+", { owner: "יוני" }),
  m("pbx-strategy", "company/pbx", "הכנת אסטרטגיה - מה אנחנו רוצים מהמרכזייה", "Q+ M1+ M1W1+ M1W2+", { ownerNote: "שתינו" }),
  m("pbx-working", "company/pbx", "מרכזייה מסודרת ועובדת בצורה מושלמת", "Q+ M1+ M1W1+ M1W2+", { ownerNote: "מזכירה" }),
  m("pbx-open", "company/pbx", "מרכזייה - פתיחה", "M1W1+ M1W2+"),
  m("pbx-voice", "company/pbx", "מרכזייה - אפיוני קול", "M1W1+ M1W2+"),
  m("pbx-transcripts", "company/pbx", "תמלולים למרכזייה", "M1W1+ M1W2+"),
  m("pbx-phone-sim", "company/pbx", "טלפון + סים - להשיג מספר קרוב ככל האפשר", "M1W1+ M1W2+", {
    notes: "0583231392 / 0583235927",
    description: "לנסות להשיג מספר קרוב ככל האפשר ל-0583231392.",
  }),
  m("pbx-phone-secretary", "company/pbx", "טלפון למזכירה", "M1W1+ M1W2+"),
  m("pbx-phone-yoni", "company/pbx", "טלפון חדש ליוני", "M1W1+ M1W2+"),
  m("pbx-meeting", "company/pbx", "פגישה מסודרת על המרכזייה", "M1W2+"),
];

// === חברה מסודרת ‹ חדר מחשבים בית שמש ===
const CR_BS: SourceMilestone[] = [
  m("bs-order-equipment", "company/cr-bs", "הזמנת ציוד", "Q+ M1+ M1W1+ M1W2+"),
  m("bs-cameras", "company/cr-bs", "מצלמות", "Q+ M1+ M1W1+ M1W2+"),
  m("bs-network", "company/cr-bs", "רשת", "Q+ M1+ M1W1+ M1W2+"),
  m("bs-chairs", "company/cr-bs", "כיסאות", "Q+ M1+ M1W1+ M1W2+", {
    notes: "יש 15 זמין במלאי",
    description:
      "לבדוק בקישור מה צריך. אם קונים - זה יגיע בכמה נגלות.\nhttps://www.ikea.com/il/he/p/huvudspelare-gaming-chair-black-90507603",
  }),
  m("bs-desks", "company/cr-bs", "שולחנות - הזמנת נגרות", "Q+ M1+ M1W1+ M1W2+"),
  m("bs-computers", "company/cr-bs", "מחשבים", "Q+ M1+ M1W1+ M1W2+"),
  m("bs-graphics", "company/cr-bs", "גרפיקה", "Q+ M1+ M1W1+ M1W2+ M1W3+", { notes: "דחוף" }),
  m("bs-ads", "company/cr-bs", "פרסום", "Q+ M1+ M1W1+ M1W2+ M1W3+"),
  m("bs-stations", "company/cr-bs", "בניית עמדות", "Q+ M1+ M1W1+ M1W2+"),
  m("bs-pen-holders", "company/cr-bs", "מתקנים לעטים", "Q+ M1+ M1W1+ M1W2+"),
  m("bs-mousepad", "company/cr-bs", "משטח לעכבר", "Q+ M1+ M1W1+ M1W2+"),
  m("bs-printer", "company/cr-bs", "מדפסת", "Q+ M1+"),
  m("bs-cleaning", "company/cr-bs", "ניקיון", "Q+ M1+"),
  m("bs-order-network", "company/cr-bs", "הזמנת רשת", "Q+ M1+ M1W1+ M1W2+"),
  m("bs-carpenter-contract", "company/cr-bs", "חוזה מסודר מול הנגר", "Q+ M1+ M1W1+ M1W2+ M1W3+", {
    notes: "דחוף",
    description: "הוא לא עושה את העבודה. להסביר למה, להוריד במחיר כמה שאפשר, וקבלה - חשוב מאוד.",
  }),
  m("bs-bins", "company/cr-bs", "פחים", "Q+ M1+ M1W1+ M1W2+ M1W3+ M1W4+"),
  m("bs-paper", "company/cr-bs", "נייר - מול הנגר", "Q- M1+ M1W1+ M1W2+ M1W3+"),
  m("bs-sign", "company/cr-bs", "שלט פרסומת", "Q- M1+ M1W1+ M1W2+"),
  m("bs-check-carpentry", "company/cr-bs", "לבדוק מה עם הנגרות", "M1W1+ M1W2+"),
  m("bs-cypher-check", "company/cr-bs", "סייפר צ'ק", "M1W1+ M1W2+ M1W3+"),
  m("bs-carpenter-progress", "company/cr-bs", "לבדוק האם הנגר מתקדם", "M1W1+ M1W2+"),
  m("bs-rosenblum-start", "company/cr-bs", "מתי רוזנבלום מתחיל", "M1W1+ M1W2+"),
  m("bs-work-done", "company/cr-bs", "סיום העבודה", "M1W2+"),
  m("bs-install-day", "company/cr-bs", "לקבוע יום שבו אני מגיע לבית שמש להתקין את המחשבים", "M1W2+"),
  m("bs-internet", "company/cr-bs", "תשתית אינטרנט 112", "M1W2+"),
  m("bs-chairs-install", "company/cr-bs", "כיסאות - התקנה", "M1W3+"),
  m("bs-rosenblum-finish", "company/cr-bs", "סיום רוזנבלום - מצלמות, חשמל ודלת", "M1W3+ M1W4+"),
  m("bs-rosenblum-money", "company/cr-bs", "לבדוק מה עם הכסף של נחמן רוזנבלום - האם כבר גבה", "M1W3+"),
  m("bs-printer-cabinet", "company/cr-bs", "לוודא שהנגר התקין את הארונית למדפסת", "M1W3+", {
    notes: "רק אחרי שהוא מקבל את הכסף שלו",
  }),
  m("bs-ac", "company/cr-bs", "מזגן", "M1W3+ M1W4+"),
  m("bs-pens", "company/cr-bs", "עטים - להביא", "M1W3+"),
  m("bs-push-nachman", "company/cr-bs", "לדחוק בנחמן לסיים חשמל היום", "M1W3+"),
  m("bs-desks-payment", "company/cr-bs", "העברה לנגר עבור השולחנות", "M1W4+"),
  m("bs-signs-finish", "company/cr-bs", "סיום שלטים", "M2- M2W1-"),
  m("bs-perfect-cleaning", "company/cr-bs", "ניקיון מושלם", "M2- M2W1-"),
  m("bs-remote-procedures", "company/cr-bs", "נהלים ברורים לסניף מרחוק", "M2- M2W1-"),
  m("bs-cash-register", "company/cr-bs", "קופה למזומן", "M2- M2W1-"),
  m("bs-fridge", "company/cr-bs", "מקרר פחיות", "M2-", {
    review: "במקור מופיע כשאלה (\"מקרר פחיות?\") - לאשר אם זו משימה או רעיון בלבד",
  }),
];

// === חברה מסודרת ‹ חדרי מחשבים צפת ===
const CR_TZFAT: SourceMilestone[] = [
  m("tzfat-find-manager", "company/cr-tzfat", "למצוא מנהל סניפים", "M2-"),
  m("tzfat-task-list", "company/cr-tzfat", "לדאוג לרשימת מטלות מסודרת", "M2-"),
  m("tzfat-upgrade", "company/cr-tzfat", "לחשוב על שדרוג מחשב ועמדות", "M2-", {
    notes: "למרות שאין כסף - המצב קטסטרופלי",
  }),
  m("tzfat-smart-ac", "company/cr-tzfat", "לבדוק מזגנים חכמים", "M2-"),
];

// === חברה מסודרת ‹ תקציב מסודר ===
const BUDGET: SourceMilestone[] = [
  m("budget-move-expenses", "company/budget", "העברת ההוצאות לחשבון הבנק החדש", "M1W2+ M1W3+ M1W4+", {
    review: "במקור מופיע גם כ\"העברת הוצאות לסניף החדש\" (שבועות 2-3) וגם כ\"לבנק החדש\" (שבוע 4) - אוחד לחשבון הבנק",
  }),
  m("budget-debts-control", "company/budget", "שליטה מחדש בכל החובות", "M1W2+ M1W3+ M1W4+"),
  m("budget-verify-new-account", "company/budget", "לבדוק שכל ההוצאות וההכנסות עברו לחשבון החדש", "M2- M2W1-"),
  m("budget-account-move", "company/budget", "לעשות ניוד חשבון", "M2- M2W1-"),
  m("budget-cashflow-prep", "company/budget", "להתכונן נכון לחודשים הבאים מבחינה תזרימית", "M2- M2W1-"),
  m("budget-tenth-prep", "company/budget", "להתכונן לעשירי הקרוב", "M2- M2W1-"),
  m("budget-better-management", "company/budget", "לראות מה אפשר לנהל טוב יותר", "M2- M2W1-"),
];

// === אתר אולטרנט ===
const SITE: SourceMilestone[] = [
  m("site-meetings", "site/improve", "כמה פגישות מסודרות על האתר בלבד", "Q+ M1W2+", {
    description: "איך לשפר ולקדם אותו מבחינת ויזואליות ונוחות שימוש, תיעוד כל משימה כאן וטיפול שלי.",
    ownerNote: "שתינו",
  }),
  m("site-inventory", "site/improve", "כל המלאי וההתנהלות מול אחראי הסניפים באתר בצורה מסודרת", "Q+ M1W2+"),
  m("site-no-excel", "site/improve", "אין יותר אקסלים ורשימות - הכל באתר", "Q+ M1W2+"),
  m("site-collection-accounting", "site/improve", "גבייה מסודרת וראיית הנהלת חשבונות בצורה מושלמת", "Q+ M1W2+"),
  m("site-income-expenses", "site/improve", "אתר - הוצאות וגם הכנסות", "M1W1+"),
  m("site-procedures-continue", "site/improve", "אתר - מה שכתוב בנהלים, להמשיך עד הסוף", "M1W2+"),
  m("site-accounting-build", "site/improve", "הנהלת חשבונות - בניית האתר", "M1W2+"),
  m("site-history-data", "site/improve", "הכנסת כל הנתונים מההיסטוריה בצורה מסודרת ומאורגנת", "M1W2+"),
  m("site-verify-branch-data", "site/improve", "לבדוק שהכל דופק נכון ושיש מידע מסודר על כל הסניפים", "M1W2+", {
    description: "כולל כמה הוצאנו עד היום על כל סניף.",
  }),
  m("site-finish-accounting", "site/improve", "לסיים את בניית האתר בהנהלת החשבונות בצורה מלאה", "M1W3+ M1W4+"),
  m("site-collection-sunday", "site/improve", "הנהלת חשבונות - גבייה מלאה ביום ראשון", "M1W3+"),
  m("site-verify-rewrites", "site/improve", "לבדוק שכל השכתובים קיימים", "M1W3+ M1W4+"),

  m("site-cr-infra", "site/cr", "הקמת תשתית עבודה מסודרת עם תוכנית עבודה", "M1W4+"),
  m("site-cr-employees", "site/cr", "סגירה סופית עם העובדים", "M1W4+"),
  m("site-cr-visuals", "site/cr", "ויזואליות - לשפר בהכל", "M2- M2W1-"),
  m("site-cr-inventory-model", "site/cr", "מלאי - לבנות מודל נכון מא' עד ת'", "M2- M2W1-"),

  m("site-rentals-close-branch", "site/rentals", "סגירת סניף", "M2- M2W1-"),
  m("site-rentals-remove-computer", "site/rentals", "הוצאת מחשב כולל חישוב", "M2- M2W1-"),
  m("site-rentals-sell-computer", "site/rentals", "מכירת מחשב", "M2- M2W1-"),
  m("site-rentals-internal-accounting", "site/rentals", "הנהלת חשבונות פנימית - ויזואליות ונקיות", "M2- M2W1-"),
  m("site-rentals-auto-purchase", "site/rentals", "הוספת רכש באופן אוטומטי בכל הוספת מחשב", "M2- M2W1-"),
  m("site-rentals-delete-sims", "site/rentals", "מחיקת סימים", "M2- M2W1-"),
  m("site-rentals-rename", "site/rentals", "שינוי שם כל המחשבים למבנה אחיד", "M2- M2W1-"),
  m("site-rentals-graphs", "site/rentals", "גרפים - כמה כל מחשב מכניס", "M2- M2W1-"),

  m("site-coworking-visuals", "site/coworking", "ויזואליות", "M2- M2W1-"),

  m("site-acc-benharush-purchases", "site/accounting", "הוספת כל הרכש מבן הרוש", "M2- M2W1+"),
  m("site-acc-bags-purchase", "site/accounting", "רכש תיקים", "M2- M2W1+"),
  m("site-acc-branch-mail", "site/accounting", "מייל לסניפים ולסניפים נבחרים", "M2- M2W1-"),
  m("site-acc-sell-koenig", "site/accounting", "מכירת מחשבים - קניג", "M2W1-"),
  m("site-acc-sell-kaplan", "site/accounting", "מכירת מחשבים - קפלן, קניג, קליין ומדפסת", "M2W1+"),

  m("site-tasks-import-quarter", "site/tasks", "להכניס את הרבעון לשם בצורה מלאה", "M2- M2W1-"),
  m("site-tasks-spec", "site/tasks", "אפיון יפה ב-GPT", "M2- M2W1-"),
  m("site-tasks-yoni-inside", "site/tasks", "משימות ליוני גם כן בפנים", "M2- M2W1-"),

  m("site-kiosk-dev-meeting", "site/kiosk", "ישיבה מול המפתחת לתוכנית עבודה מסודרת", "M2- M2W1-"),
  m("site-kiosk-trust", "site/kiosk", "לתת בה אמון שהיא מסוגלת להכל", "M2- M2W1-"),
  m("site-kiosk-run-plan", "site/kiosk", "להריץ תוכנית עבודה ולעקוב על זה", "M2- M2W1-"),
  m("site-kiosk-daily-check", "site/kiosk", "לבחון כל יום מה התקדמה ואיפה היא אוחזת", "M2- M2W1-"),
];

// === הגדלת הכנסות ===
const INCOME: SourceMilestone[] = [
  m("income-cr-result", "income/dreams", "חדר מחשבים עובד ומביא את התוצאה", "Q-", { notes: "לא תלוי בנו" }),
  m("income-rentals-all-branches", "income/dreams", "השכרת ניידים - כל הסניפים עובדים פיקס", "Q-"),
  m("income-20-computers", "income/dreams", "20 מחשבים אצלי יוצאים להשכרה", "Q-"),

  m("income-opt-more-branches", "income/options", "פתיחת עוד סניפים", "Q-"),
  m("income-opt-addons", "income/options", "מוצרים נלווים", "Q-"),
  m("income-opt-sell-computers", "income/options", "מכירת מחשבים", "Q-"),
  m("income-opt-sell-memory", "income/options", "מכירת זיכרונות ניידים", "Q-"),
  m("income-opt-importer", "income/options", "להיות יבואן", "Q-"),
  m("income-opt-phones", "income/options", "מכירת פלאפונים", "Q-"),
  m("income-opt-zoom-managers", "income/options", "זום עם מנהלי סניפים", "Q-"),
  m("income-opt-keyboards", "income/options", "מקלדות ועכברים חדשים לכל הסניפים הישנים", "Q-", {
    notes: "מתוך \"משימות ליום של שלג\"",
    description: "ואולי אפילו עמדות חדשות.",
    review: "הופיע במקור ברשימת \"משימות ליום של שלג\" בלי שיוך לתקופה - שובץ לרבעון בלבד",
  }),

  m("income-cr-maintained", "income/cr", "חדר מחשבים נקי, מתוחזק ומתפקד באופן מלא", "M2- M2W1-"),
  m("income-cr-signs", "income/cr", "שלטים ברורים", "M2- M2W1-"),
  m("income-cr-ads", "income/cr", "פרסום טוב ואיכותי", "M2- M2W1-"),

  m("income-rentals-push", "income/rentals", "לבדוק עם כל הסניפים מה קורה איתם ולדחוף אותם קדימה", "M2- M2W1-", {
    description:
      "עד ר\"ח חשוון כולם על הגל בכל הכוח. להסביר להם שאנחנו מאוד רוצים להתקדם לשלבים הבאים של תוספת הכנסה - אבל אנחנו חייבים אותם על הגל.",
  }),
  m("income-rentals-yoni-mail", "income/rentals", "מייל מיוני לכל בעלי הסניפים", "M2- M2W1-", { owner: "יוני" }),
  m("income-rentals-spread", "income/rentals", "כל המחשבים הקיימים - להעביר לעוד סניפים כמה שיותר מהר", "M2- M2W1-", {
    description: "לא חסרים מקומות שצריכים אותנו.",
  }),
];

export const MILESTONES: SourceMilestone[] = [...BRANCHES, ...PBX, ...CR_BS, ...CR_TZFAT, ...BUDGET, ...SITE, ...INCOME];
