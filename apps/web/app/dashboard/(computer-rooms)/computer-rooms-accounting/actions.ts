"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { BranchIncome } from "@ultranet/shared-types";
import {
  isBranchIncomeImportEnabled,
  monthLabel,
  parseBranchIncomeWorkbook,
} from "@/lib/branch-income-excel";

async function requireBranchAccess(branchId: string) {
  const session = await getServerSession(authOptions);
  if (!session) throw new Error("לא מחובר");
  if (session.user?.role === "owner") return session;
  if (session.user?.role === "partner" && session.user?.branchId === branchId) return session;
  throw new Error("אין הרשאה");
}

async function requireOwner() {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("גישה זו מוגבלת לבעלים בלבד");
  }
  return session;
}

function stripUndefined<T extends Record<string, any>>(obj: T): T {
  const out: any = {};
  for (const k in obj) if (obj[k] !== undefined && obj[k] !== "") out[k] = obj[k];
  return out;
}

/** Adds one manual monthly income row for a computer-room branch. View-only tracking -
 *  intentionally does NOT touch n_ah_income, so it never reconciles into the main ledger. */
export async function addBranchIncomeAction(branchId: string, formData: FormData) {
  await requireBranchAccess(branchId);
  const date = String(formData.get("date") ?? "").trim();
  const amount = Number(formData.get("amount")) || 0;
  const desc = String(formData.get("desc") ?? "").trim();
  if (!date || !amount) {
    throw new Error("חובה למלא תאריך וסכום");
  }
  const data: Omit<BranchIncome, "id"> = stripUndefined({
    branchId,
    amount,
    desc: desc || "הכנסת חודש",
    date,
    month: date.slice(0, 7),
  });
  await getAdminFirestore().collection("n_branch_income").add(data);
  revalidatePath(`/dashboard/computer-rooms-accounting/${branchId}`);
  revalidatePath("/dashboard/computer-rooms-accounting");
  redirect(`/dashboard/computer-rooms-accounting/${branchId}`);
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
