"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { currentModuleScope, isOwnerSession } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { BranchIncome } from "@ultranet/shared-types";
import {
  isBranchIncomeImportEnabled,
  monthLabel,
  parseBranchIncomeWorkbook,
} from "@/lib/branch-income-excel";

async function requireBranchAccess(branchId: string) {
  const scope = await currentModuleScope("computers");
  if (!scope) throw new Error("לא מחובר");
  if (scope.isOwner) return scope;
  if (scope.isManager && scope.allows(branchId)) return scope;
  throw new Error("אין הרשאה");
}

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || !isOwnerSession(session)) {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
  return session;
}

/** שם השדה של הסכום בטופס החודשי. המזהה של הסניף הוא מה שאחריו. */
const AMOUNT_PREFIX = "amount:";

/** לאן חוזרים אחרי השמירה. מגיע מהטופס ולכן נבדק: רק מסכי המודול הזה, אף פעם לא URL חיצוני. */
function safeBack(raw: string): string {
  const base = "/dashboard/computer-rooms-accounting";
  return raw.startsWith(base) && !raw.includes("//") ? raw : base;
}

async function requireComputerRoomBranch(branchId: string) {
  const doc = await getAdminFirestore().collection("n_branches").doc(branchId).get();
  const data = doc.data() as { branchType?: string; deleted?: boolean } | undefined;
  if (!doc.exists || data?.deleted || data?.branchType !== "computers") {
    throw new Error("סניף לא קיים או שאינו חדר מחשבים");
  }
}

/**
 * "כמה נכנס בחודש X" — שורה אחת לכל סניף, בהזנה אחת.
 *
 * זו הצורה שבה המספרים האלה באמת מגיעים: פעם בחודש, לכל הסניפים יחד, ולא שורה בודדת לסניף
 * אחד בכל פעם. לכן השמירה **אידמפוטנטית לפי סניף+חודש**: לפני הכתיבה נמחקות שורות המעקב
 * הקיימות של אותו סניף באותו חודש (גם שורות ייבוא), ונכתבת שורה אחת עם המספר שהוקלד. שדה
 * ריק = לא נגעו בסניף הזה בכלל, 0 = החודש הזה נמחק. כך הקלדה חוזרת של אותו חודש מתקנת ולא
 * מכפילה, והמסך תמיד מראה מספר אחד לחודש לכל סניף.
 *
 * כמו הטופס שקדם לו - `n_branch_income` בלבד, אף פעם לא `n_ah_income`: מעקב פנימי שלא מגיע
 * להנה"ח הראשית. מזומן שנמשך מהקופה נשאר שלם במקומו - הוא חי בספר הראשי ולא נספר כאן.
 */
export async function saveMonthlyBranchIncomeAction(formData: FormData) {
  const month = String(formData.get("month") ?? "").trim();
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("יש לבחור חודש");
  const back = safeBack(String(formData.get("back") ?? ""));

  const entries: { branchId: string; amount: number }[] = [];
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith(AMOUNT_PREFIX)) continue;
    const raw = String(value).trim();
    if (!raw) continue;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0) throw new Error("סכום לא תקין");
    entries.push({ branchId: key.slice(AMOUNT_PREFIX.length), amount });
  }

  const db = getAdminFirestore();
  let saved = 0;
  let cleared = 0;
  for (const { branchId, amount } of entries) {
    await requireBranchAccess(branchId);
    await requireComputerRoomBranch(branchId);
    // שאילתת שוויון אחת על הסניף, והסינון לפי חודש בזיכרון: מספר השורות של סניף אחד קטן,
    // ואין צורך באינדקס מורכב (אותו שיקול בדיוק כמו בייבוא).
    const snap = await db.collection("n_branch_income").where("branchId", "==", branchId).get();
    const doomed = snap.docs.filter((d) => {
      const data = d.data() as Omit<BranchIncome, "id">;
      return (data.month || String(data.date ?? "").slice(0, 7)) === month;
    });
    const batch = db.batch();
    for (const doc of doomed) batch.delete(doc.ref);
    if (amount > 0) {
      const data: Omit<BranchIncome, "id"> = {
        branchId,
        amount,
        // תאריך אחיד בתחילת החודש: השורה מתארת חודש שלם, לא יום מסוים בתוכו.
        date: `${month}-01`,
        month,
        desc: `הכנסת חודש ${monthLabel(month)}`,
      };
      batch.set(db.collection("n_branch_income").doc(), data);
      saved++;
    } else if (doomed.length > 0) {
      cleared++;
    }
    await batch.commit();
    revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  }

  revalidatePath("/dashboard/computer-rooms-accounting");
  const params = new URLSearchParams({ month, monthSaved: String(saved), monthCleared: String(cleared) });
  redirect(`${back.split("?")[0]}?${params.toString()}`);
}

export async function deleteBranchIncomeAction(id: string, branchId: string) {
  await requireOwner();
  await getAdminFirestore().collection("n_branch_income").doc(id).delete();
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard/computer-rooms-accounting");
  redirect(`/dashboard/computer-rooms-accounting/${branchId}`);
}

/** כמה הודעות דילוג/אזהרה נשלחות חזרה למסך. מעבר לזה ה-URL מתארך בלי להוסיף מידע. */
const MAX_MESSAGES = 8;

/**
 * ייבוא היסטוריית הכנסות חודשיות לסניף אחד מקובץ אקסל.
 *
 * כמו הטופס הידני שלצידו - `n_branch_income` בלבד, אף פעם לא `n_ah_income`: אלה שורות מעקב
 * פנימי לסניף ולא כסף שנספר בהנה"ח הראשית.
 *
 * הייבוא אידמפוטנטי לפי חודש: לפני כתיבת חודש נמחקות שורות הייבוא **הקודמות** של אותו חודש
 * (source === "import" בלבד). כך העלאה חוזרת של אותו קובץ מתקנת ולא מכפילה, ושורה שהוקלדה
 * ידנית לאותו חודש שורדת - מי שהקליד אותה התכוון אליה.
 */
export async function importBranchIncomeAction(branchId: string, formData: FormData) {
  await requireBranchAccess(branchId);
  const back = `/dashboard/computer-rooms-accounting/${branchId}`;
  if (!isBranchIncomeImportEnabled()) {
    redirect(`${back}?importError=disabled`);
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`${back}?importError=missing`);
  }

  const buf = Buffer.from(await (file as File).arrayBuffer());
  const { rows, errors, warnings } = parseBranchIncomeWorkbook(buf);

  const db = getAdminFirestore();
  let imported = 0;
  let replaced = 0;

  if (rows.length > 0) {
    // שאילתת שוויון אחת על branchId, והסינון לפי חודש/מקור בזיכרון: מספר השורות של סניף
    // אחד קטן, ואין צורך באינדקס מורכב.
    const existingSnap = await db.collection("n_branch_income").where("branchId", "==", branchId).get();
    const previousImports = new Map<string, string[]>();
    for (const doc of existingSnap.docs) {
      const data = doc.data() as Omit<BranchIncome, "id">;
      if (data.source !== "import") continue;
      const month = data.month || String(data.date ?? "").slice(0, 7);
      if (!month) continue;
      previousImports.set(month, [...(previousImports.get(month) ?? []), doc.id]);
    }

    const batch = db.batch();
    for (const row of rows) {
      for (const id of previousImports.get(row.month) ?? []) {
        batch.delete(db.collection("n_branch_income").doc(id));
        replaced++;
      }
      const data: Omit<BranchIncome, "id"> = {
        branchId,
        amount: row.amount,
        // תאריך אחיד בתחילת החודש: השורה מתארת חודש שלם, לא יום מסוים בתוכו.
        date: `${row.month}-01`,
        month: row.month,
        desc: `הכנסת חודש ${monthLabel(row.month)}`,
        source: "import",
      };
      batch.set(db.collection("n_branch_income").doc(), data);
      imported++;
    }
    await batch.commit();
  }

  revalidatePath(back);
  revalidatePath("/dashboard/computer-rooms-accounting");

  const params = new URLSearchParams();
  params.set("imported", String(imported));
  params.set("replaced", String(replaced));
  params.set("skipped", String(errors.length));
  for (const msg of [...errors, ...warnings].slice(0, MAX_MESSAGES)) params.append("note", msg);
  const extra = errors.length + warnings.length - MAX_MESSAGES;
  if (extra > 0) params.set("noteMore", String(extra));
  redirect(`${back}?${params.toString()}`);
}

/**
 * מוחק בבת אחת את כל שורות הייבוא של הסניף. קיים כדי שאפשר יהיה לנקות ייבוא שגוי - או את
 * כל הייבוא בסוף מילוי ההיסטוריה - בלי למחוק שורה-שורה, ובלי לגעת בשורות שהוקלדו ידנית.
 */
export async function clearImportedBranchIncomeAction(branchId: string) {
  await requireOwner();
  const db = getAdminFirestore();
  const snap = await db.collection("n_branch_income").where("branchId", "==", branchId).get();
  const doomed = snap.docs.filter((d) => (d.data() as Omit<BranchIncome, "id">).source === "import");
  // Firestore מגביל ל-500 פעולות ב-batch; בפועל מדובר בעשרות שורות, אבל החלוקה זולה.
  for (let i = 0; i < doomed.length; i += 450) {
    const batch = db.batch();
    for (const doc of doomed.slice(i, i + 450)) batch.delete(doc.ref);
    await batch.commit();
  }
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard/computer-rooms-accounting");
  redirect(`/dashboard/computer-rooms-accounting/${branchId}?cleared=${doomed.length}`);
}
