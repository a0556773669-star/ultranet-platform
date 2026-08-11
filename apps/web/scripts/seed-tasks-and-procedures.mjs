#!/usr/bin/env node
// סקריפט חד-פעמי: מזין את הסלעים/אבני הדרך והנהלים האמיתיים של אולטרנט למודול
// "משימות ונהלים" (collections: n_rocks / n_milestones / n_procedures).
//
// אידמפוטנטי - ניתן להריץ כמה פעמים; כל סלע/אבן-דרך/נוהל שכבר קיים (לפי כותרת
// זהה באותו היקף) יידלג ולא ייכפל.
//
// הרצה (מתוך apps/web, עם .env.local מלא כמו בסביבת הפיתוח הרגילה):
//   node scripts/seed-tasks-and-procedures.mjs
//
// דורש קרדנציאלס Firebase Admin אמיתיים (FIREBASE_SERVICE_ACCOUNT_JSON או שלושת
// המשתנים הנפרדים) - בדיוק כמו lib/firebase-admin.ts. לא רץ בזמן build/CI.

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { getApps, initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- טעינת .env.local ידנית (בלי תלות נוספת כמו dotenv) ---
function loadDotEnvLocal() {
  const envPath = resolve(__dirname, "..", ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadDotEnvLocal();

function loadCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    return { projectId: parsed.project_id, clientEmail: parsed.client_email, privateKey: parsed.private_key };
  }
  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(loadCredential()) });
const db = getFirestore(app);

// --- מפתחות תקופה - זהה ל-apps/web/app/dashboard/duxus/rocks/date-utils.ts ---
function currentQuarterKey(d = new Date()) {
  const q = Math.floor(d.getMonth() / 3) + 1;
  return `${d.getFullYear()}-Q${q}`;
}
function currentMonthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
const WEEK_EPOCH_MS = Date.UTC(2020, 0, 6);
const DAY_MS = 24 * 60 * 60 * 1000;
function currentWeekKey(d = new Date()) {
  const utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return `W${Math.floor((utcMidnight - WEEK_EPOCH_MS) / (7 * DAY_MS))}`;
}

const QUARTER_KEY = currentQuarterKey();
const MONTH_KEY = currentMonthKey();
const WEEK_KEY = currentWeekKey();

let orderCounter = Date.now();
function nextOrder() {
  return orderCounter++;
}

// --- עזרי כתיבה אידמפוטנטיים (שאילתת שוויון יחידה + סינון ב-JS, בלי אינדקס מורכב) ---

async function findExistingRock(quarterKey, title, parentRockId) {
  const snap = await db.collection("n_rocks").where("quarterKey", "==", quarterKey).get();
  return snap.docs.find((d) => {
    const data = d.data();
    return data.title === title && (data.parentRockId ?? null) === (parentRockId ?? null);
  });
}

async function ensureRock({ title, description = "", quarterKey, parentRockId = null, ownerName = "" }) {
  const existing = await findExistingRock(quarterKey, title, parentRockId);
  if (existing) {
    console.log(`↷ סלע קיים כבר, דילוג: ${title}`);
    return existing.id;
  }
  const ref = await db.collection("n_rocks").add({
    title,
    description,
    quarterKey,
    parentRockId,
    ownerUserId: "",
    ownerName,
    status: "active",
    order: nextOrder(),
    createdAt: Date.now(),
    createdBy: "seed-script",
  });
  console.log(`+ נוצר סלע: ${title}`);
  return ref.id;
}

async function findExistingMilestone(rockId, title) {
  const snap = await db.collection("n_milestones").where("rockId", "==", rockId).get();
  return snap.docs.find((d) => d.data().title === title);
}

async function ensureMilestone(rockId, quarterKey, { title, stage = "backlog", done = false, ownerName = "" }) {
  const existing = await findExistingMilestone(rockId, title);
  if (existing) {
    console.log(`  ↷ אבן דרך קיימת כבר, דילוג: ${title}`);
    return existing.id;
  }
  const data = {
    rockId,
    quarterKey,
    title,
    ownerUserId: "",
    ownerName,
    stage,
    done,
    doneAt: done ? Date.now() : null,
    carryOverCount: 0,
    order: nextOrder(),
    createdAt: Date.now(),
    createdBy: "seed-script",
  };
  if (stage === "month" || stage === "week") data.monthKey = MONTH_KEY;
  if (stage === "week") data.weekKey = WEEK_KEY;
  const ref = await db.collection("n_milestones").add(data);
  console.log(`  + נוצרה אבן דרך (${stage}${done ? ", בוצע" : ""}): ${title}`);
  return ref.id;
}

async function findExistingProcedure(title) {
  const snap = await db.collection("n_procedures").where("title", "==", title).get();
  return snap.docs[0];
}

async function ensureProcedure({ title, category = "", content }) {
  const existing = await findExistingProcedure(title);
  if (existing) {
    console.log(`↷ נוהל קיים כבר, דילוג: ${title}`);
    return;
  }
  const now = Date.now();
  await db.collection("n_procedures").add({
    title,
    content,
    category,
    createdAt: now,
    updatedAt: now,
    createdBy: "seed-script",
  });
  console.log(`+ נוצר נוהל: ${title}`);
}

async function seedRock(rockDef, quarterKey, parentRockId) {
  const rockId = await ensureRock({
    title: rockDef.title,
    description: rockDef.description ?? "",
    quarterKey,
    parentRockId,
    ownerName: rockDef.ownerName ?? "",
  });
  for (const m of rockDef.milestones ?? []) {
    await ensureMilestone(rockId, quarterKey, m);
  }
  for (const sub of rockDef.subRocks ?? []) {
    await seedRock(sub, quarterKey, rockId);
  }
}

// ============================================================================
// נתונים: סלעים + אבני דרך לרבעון הנוכחי
//
// stage/done נגזרו מהרשימות שנמסרו בפועל: רשומה שהופיעה ברשימה השבועית מקבלת
// stage="week" (עם done=true אם היא סומנה כמחוקה/מסומנת ~~כבוצעה~~ ברשימה
// המקורית); רשומה שהופיעה רק ברשימה החודשית מקבלת stage="month"; רשומה
// שהופיעה רק ברשימה הרבעונית נשארת ב-stage="backlog" (עדיין לא קודמה).
// ============================================================================

const ROCKS = [
  {
    title: "חברה מסודרת",
    milestones: [
      { title: "כל הסניפים פעילים בצורה מושלמת", ownerName: "מזכירה", stage: "week", done: false },
      { title: "מתעדים את כל הפעילות באתר", stage: "month", done: false },
      { title: "מפרסמים בצורה מסודרת", stage: "month", done: false },
      {
        title: 'נהלים ברורים מול הסניפים - העברות גבייה, ניהול השכרות, מחירים (האם לאפשר גמישות ופרסום)',
        ownerName: "שתינו",
        stage: "week",
        done: true,
      },
      { title: "נהלים ברורים מול השוכרים", ownerName: "שתינו", stage: "week", done: true },
      { title: "תיוק של כל המחשבים והסימים בצורה מסודרת - לנו ולסניפים", stage: "month", done: false },
      { title: "חוזה שותפות של כל הסניפים חתום", stage: "month", done: false },
      { title: "ניהול חשבונות בצורה מסודרת", stage: "month", done: false },
      { title: 'ביטול תתי סניפים - מ"ח מאיר, אשדוד', stage: "week", done: false },
      { title: "נהל הקמת סניפים - כולל דף הסברים ללקוחות", stage: "week", done: true },
      {
        title: "תשלומים מסודרים בכרטיס אשראי אחד (העברת הכל לכרטיס אחד, לשבת על זה)",
        stage: "month",
        done: false,
      },
      { title: "כל הסניפים פעילים ועובדים ומפרסמים ומשכירים", stage: "month", done: false },
      { title: "אתר פרסומת בצורה מושלמת", stage: "week", done: false },
      { title: "עדכון סופי אתר פרסומות", stage: "week", done: true },
      { title: "נהל מסודר לכל הסניפים יחד ושיחת טלפון", stage: "week", done: true },
      { title: 'הוספת כל ההוצאות שלנו על סניפים (מחשבים, פרסום, סימים וכו")', stage: "week", done: false },
      { title: "גולדשמידט סניף אלעד", stage: "week", done: false },
      { title: "זום עם כל הסניפים בהנחיית יוני", ownerName: "יוני", stage: "week", done: true },
      { title: "סגירת זום", stage: "week", done: true },
      { title: "הכנת מצגת לזום", stage: "week", done: true },
      { title: "זום בפועל", stage: "week", done: false },
      { title: "חיבור כולם לקבוצת מייל", stage: "week", done: true },
      { title: "נהל סגירת סניפים", stage: "week", done: true },
      { title: "יודלביץ החוצה", stage: "week", done: false },
      { title: "אתר הוצאות וגם הכנסות", stage: "week", done: true },
      { title: "לבדוק שכולם מגיעים לזום", stage: "week", done: false },
      { title: "מרקוביץ", stage: "week", done: false },
    ],
    subRocks: [
      {
        title: "אתר ייעול ושיפור ושינוי",
        ownerName: "שתינו",
        milestones: [
          {
            title:
              "כמה פגישות מסודרות על האתר בלבד - איך לשפר ולקדם אותו מבחינת ויזואליות ונוחות שימוש, תיעוד כל משימה וטיפול",
            stage: "backlog",
            done: false,
          },
          { title: "כל המלאי והתנהלות מול אחראי סניפים באתר בצורה מסודרת", stage: "backlog", done: false },
          { title: "אין יותר אקסלים ורשימות - הכל חייב להיות באתר", stage: "backlog", done: false },
          { title: 'גבייה מסודרת וראיית הנה"ח בצורה מושלמת', stage: "backlog", done: false },
        ],
      },
      {
        title: "נהל מזכירה - מרכזיה",
        milestones: [
          { title: "המזכירה נכנסת לגבולות העבודה מבחינת שעות", ownerName: "מזכירה", stage: "month", done: false },
          { title: "המזכירה יודעת לבצע בצורה טובה את כל המשימות שלה", ownerName: "יוני", stage: "month", done: false },
          { title: "הכנה של אסטרטגייה מה אנחנו רוצים מהמרכזיה", ownerName: "שתינו", stage: "week", done: true },
          { title: "מרכזיה מסודרת ועובדת בצורה מושלמת", ownerName: "מזכירה", stage: "week", done: false },
          { title: "תמלולים למרכזיה", stage: "week", done: true },
          { title: "השגת מספר טלפון קרוב ל-0583231392 (למרכזיה)", stage: "week", done: false },
          { title: "טלפון למזכירה", stage: "week", done: false },
        ],
      },
      {
        title: "חדר מחשבים עובד פיקס - בית שמש",
        ownerName: "יוני",
        milestones: [
          { title: "הזמנת ציוד", stage: "week", done: false },
          { title: "מצלמות", stage: "week", done: true },
          { title: "רשת", stage: "week", done: true },
          { title: "כיסאות (יש 15 זמין במלאי - לבדוק צורך, ר' קישור באיקאה)", stage: "week", done: false },
          { title: "שולחנות - הזמנת נגרות", stage: "week", done: true },
          { title: "מחשבים", stage: "week", done: true },
          { title: "גרפיקה", stage: "week", done: false },
          { title: "פרסום", stage: "week", done: false },
          { title: "בניה עמדות", stage: "week", done: false },
          { title: "מתקנים לעטים", stage: "week", done: true },
          { title: "משטח לעכבר", stage: "week", done: true },
          { title: "הזמנת רשת", stage: "week", done: true },
          { title: "חוזה מסודר מול נגר", stage: "week", done: false },
          { title: "פחים", stage: "week", done: false },
          { title: "נייר - מול נגר", stage: "week", done: false },
          { title: "שלט פרסומת", stage: "week", done: false },
          { title: "מדפסת", stage: "month", done: false },
          { title: "ניקיון", stage: "month", done: false },
          { title: "לבדוק מה עם הנגרות", stage: "week", done: false },
          { title: 'סייפר צ"ק', stage: "week", done: false },
          { title: "לבדוק האם נגר מתקדם", stage: "week", done: false },
          { title: "מתי רוזנבלום מתחיל", stage: "week", done: false },
        ],
      },
    ],
  },
  {
    title: "הגדלת הכנסות",
    description:
      'היעד: כל מחשב מכניס לפחות 150 ש"ח נטו בחודש כולל הכל.\n\n' +
      '4 חדרי מחשבים בצפת - ממוצע 223 ש"ח למחשב (כ-10 מחשבים) = כ-25,000 ש"ח\n' +
      '1 חדר מחשבים בבית שמש - לפחות 8,620 ש"ח\n' +
      '149 מחשבים להשכרת ניידים - היעד 150 ש"ח נטו למחשב = כ-22,500 ש"ח\n' +
      '3 משרד שיתופי = 2,000 ש"ח\n\n' +
      'סה"כ יעד: כ-58,120 ש"ח. הכנסות קבועות: 3,200 ש"ח. חסר: כ-13,380 ש"ח.',
    milestones: [
      { title: "שכל החלומות שלמעלה יתגשמו", stage: "backlog", done: false },
      { title: "חדר מחשבים עובד ומביא את התוצאה - לא תלוי בנו", stage: "backlog", done: false },
      { title: "השכרת ניידים - כל הסניפים עובדים פיקס", stage: "backlog", done: false },
      { title: "20 מחשבים אצלי יוצאים להשכרה", stage: "backlog", done: false },
    ],
    subRocks: [
      {
        title: "איך מגדילים הכנסות - אפשרויות",
        milestones: [
          { title: "פתיחת עוד סניפים", stage: "backlog", done: false },
          { title: "מוצרים נלווים", stage: "backlog", done: false },
          { title: "מכירת מחשבים", stage: "backlog", done: false },
          { title: "מכירת זכרונות (דיסק און קי) לניידים", stage: "backlog", done: false },
          { title: "להיות יבואן", stage: "backlog", done: false },
          { title: "מכירת פלאפונים", stage: "backlog", done: false },
          { title: "זום עם מנהלי סניפים", stage: "backlog", done: false },
        ],
      },
    ],
  },
];

// ============================================================================
// נתונים: נהלים
// ============================================================================

const PROCEDURES = [
  {
    title: "נוהל עבודה מזכירות",
    category: "מזכירות",
    content: `<p><strong>שעות מענה טלפוני</strong></p>
<ul>
<li>שלוחה 1 - השכרת מחשבים ניידים בצפת: 7:30-12:00, ללא שכר שעתי (עם אופציה ל-30% שינוי). אם מתקשרים לשלוחה 1 בנושא שלא שייך לשלוחה - אין מענה.</li>
<li>שלוחה 2 - תמיכה טכנית: 9:00-15:00. טיפול בתקלות חדרי מחשבים ע"י הכנת משימות לפי סניפים ורמת חשיבות, ותמיכה בלקוחות השכרת ניידים וכד'. אם מתקשרים בנושא של שלוחה אחרת - אין מענה.</li>
<li>שלוחה 3 - כל נושא אחר: 9:00-15:00, מענה ועזרה ותיוק משימות עבור יוני.</li>
<li>שלוחה 8 - לבעלי סניפים בלבד: 9:00-15:00, מענה ותמיכה ויצירת משימות עבור יוני.</li>
<li>שלוחה 9 - שלוחת חירום לבעלי סניפים בלבד: עוברת ליוני בכל שעות היממה, רק במקרה קריטי.</li>
<li>שלוחות 2 ו-3 בשאר שעות היום: בינתיים עוברות ליוני. יש רצון לגייס תוספת שעות; בלעדיה, מחוץ לשעות המענה עובר אוטומטית להקלטת הודעה.</li>
<li>שלוחה 8 בשאר שעות היום: הודעה מוקלטת - "השירות לבעלי הסניפים הטלפוני סגור כרגע. ניתן לקבל שירות במקרי חירום בלבד בשלוחה 9, או להשאיר הודעה."</li>
<li>כל ההודעות מגיעות למייל לפי סיווג השלוחה - רצוי כולל תמלול.</li>
<li>בטלפון האישי - זמין למזכירה 24/7.</li>
</ul>`,
  },
  {
    title: "נהל סניפים חדשים - משרד",
    category: "סניפים",
    content: `<p><strong>שלבי קליטת סניף חדש</strong></p>
<ul>
<li>שיחה על הכל</li>
<li>חוזה חתום</li>
<li>קביעת מספר מחשבים רצוי</li>
<li>הכנת המחשבים</li>
<li>פתיחת סימים</li>
<li>חיבור לנטפרי</li>
<li>משלוח</li>
<li>בדיקה שהסניף ראה הדרכה מלאה, ומכניס הכל לאתר</li>
<li>מעקב צמוד בשבועיים הראשונים ("בדיקת דופק")</li>
<li>פרסומת מול דורפמן</li>
</ul>`,
  },
  {
    title: "נהל יציאה מאולטרנט",
    category: "סניפים",
    content: `<p><strong>שלבי סגירת סניף / יציאה</strong></p>
<ul>
<li>הפסקת השכרה</li>
<li>העברת המחשבים</li>
<li>סגירת חשבון על הכל</li>
<li>איפוס מלא</li>
<li>מחיקה מהקבוצה</li>
<li>מחיקה מהפרסומת</li>
<li>מחיקה מהאתר (ניהול)</li>
</ul>`,
  },
];

async function main() {
  console.log(`רבעון נוכחי: ${QUARTER_KEY} · חודש: ${MONTH_KEY} · שבוע: ${WEEK_KEY}`);
  console.log("--- סלעים ואבני דרך ---");
  for (const rock of ROCKS) {
    await seedRock(rock, QUARTER_KEY, null);
  }
  console.log("--- נהלים ---");
  for (const proc of PROCEDURES) {
    await ensureProcedure(proc);
  }
  console.log("סיום.");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
