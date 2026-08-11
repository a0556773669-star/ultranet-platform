"use server";

import { revalidatePath } from "next/cache";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { requireOwner } from "@/lib/perms";
import type { MilestoneStage } from "@ultranet/shared-types";
import { currentQuarterKey, currentMonthKey, currentWeekKey } from "./rocks/date-utils";

/**
 * ייבוא ראשוני חד-פעמי (owner-only, אידמפוטנטי - כל סלע/אבן-דרך/נוהל שכבר קיים
 * מדולג ולא נכפל) של הסלעים/אבני-הדרך/הנהלים האמיתיים של אולטרנט לרבעון/חודש/
 * שבוע הנוכחיים. אותו דגם backfill כמו "יצירת סטיקים לכל המחשבים" ב-
 * /dashboard/rentals/laptops.
 */

type SeedMilestone = { title: string; stage: MilestoneStage; done: boolean; ownerName?: string };
type SeedRock = { title: string; description?: string; ownerName?: string; milestones?: SeedMilestone[]; subRocks?: SeedRock[] };
type SeedProcedure = { title: string; category?: string; content: string };

const ROCKS: SeedRock[] = [
  {
    title: "חברה מסודרת",
    milestones: [
      { title: "כל הסניפים פעילים בצורה מושלמת", ownerName: "מזכירה", stage: "week", done: false },
      { title: "מתעדים את כל הפעילות באתר", stage: "month", done: false },
      { title: "מפרסמים בצורה מסודרת", stage: "month", done: false },
      {
        title: "נהלים ברורים מול הסניפים - העברות גבייה, ניהול השכרות, מחירים (האם לאפשר גמישות ופרסום)",
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

const PROCEDURES: SeedProcedure[] = [
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

export type SeedSummary = {
  rocksCreated: number;
  rocksSkipped: number;
  milestonesCreated: number;
  milestonesSkipped: number;
  proceduresCreated: number;
  proceduresSkipped: number;
};

export async function seedInitialTasksAndProceduresAction(): Promise<
  { ok: true; summary: SeedSummary } | { ok: false; message: string }
> {
  await requireOwner();

  const db = getAdminFirestore();
  const quarterKey = currentQuarterKey();
  const monthKey = currentMonthKey();
  const weekKey = currentWeekKey();
  let orderCounter = Date.now();

  const summary: SeedSummary = {
    rocksCreated: 0,
    rocksSkipped: 0,
    milestonesCreated: 0,
    milestonesSkipped: 0,
    proceduresCreated: 0,
    proceduresSkipped: 0,
  };

  async function findExistingRock(qKey: string, title: string, parentRockId: string | null): Promise<string | null> {
    const snap = await db.collection("n_rocks").where("quarterKey", "==", qKey).get();
    const match = snap.docs.find((d) => {
      const data = d.data();
      return data.title === title && (data.parentRockId ?? null) === parentRockId;
    });
    return match?.id ?? null;
  }

  async function ensureRock(rock: SeedRock, qKey: string, parentRockId: string | null): Promise<string> {
    const existingId = await findExistingRock(qKey, rock.title, parentRockId);
    if (existingId) {
      summary.rocksSkipped++;
      return existingId;
    }
    const ref = await db.collection("n_rocks").add({
      title: rock.title,
      description: rock.description ?? "",
      quarterKey: qKey,
      parentRockId,
      ownerUserId: "",
      ownerName: rock.ownerName ?? "",
      status: "active",
      order: orderCounter++,
      createdAt: Date.now(),
      createdBy: "seed",
    });
    summary.rocksCreated++;
    return ref.id;
  }

  async function findExistingMilestone(rockId: string, title: string): Promise<boolean> {
    const snap = await db.collection("n_milestones").where("rockId", "==", rockId).get();
    return snap.docs.some((d) => d.data().title === title);
  }

  async function ensureMilestone(rockId: string, qKey: string, m: SeedMilestone): Promise<void> {
    if (await findExistingMilestone(rockId, m.title)) {
      summary.milestonesSkipped++;
      return;
    }
    const data: Record<string, unknown> = {
      rockId,
      quarterKey: qKey,
      title: m.title,
      ownerUserId: "",
      ownerName: m.ownerName ?? "",
      stage: m.stage,
      done: m.done,
      doneAt: m.done ? Date.now() : null,
      carryOverCount: 0,
      order: orderCounter++,
      createdAt: Date.now(),
      createdBy: "seed",
    };
    if (m.stage === "month" || m.stage === "week") data.monthKey = monthKey;
    if (m.stage === "week") data.weekKey = weekKey;
    await db.collection("n_milestones").add(data);
    summary.milestonesCreated++;
  }

  async function seedRockTree(rock: SeedRock, qKey: string, parentRockId: string | null): Promise<void> {
    const rockId = await ensureRock(rock, qKey, parentRockId);
    for (const m of rock.milestones ?? []) {
      await ensureMilestone(rockId, qKey, m);
    }
    for (const sub of rock.subRocks ?? []) {
      await seedRockTree(sub, qKey, rockId);
    }
  }

  async function ensureProcedure(p: SeedProcedure): Promise<void> {
    const snap = await db.collection("n_procedures").where("title", "==", p.title).get();
    if (!snap.empty) {
      summary.proceduresSkipped++;
      return;
    }
    const now = Date.now();
    await db.collection("n_procedures").add({
      title: p.title,
      content: p.content,
      category: p.category ?? "",
      createdAt: now,
      updatedAt: now,
      createdBy: "seed",
    });
    summary.proceduresCreated++;
  }

  for (const rock of ROCKS) {
    await seedRockTree(rock, quarterKey, null);
  }
  for (const proc of PROCEDURES) {
    await ensureProcedure(proc);
  }

  revalidatePath("/dashboard/duxus");
  revalidatePath("/dashboard/duxus/rocks");

  return { ok: true, summary };
}
