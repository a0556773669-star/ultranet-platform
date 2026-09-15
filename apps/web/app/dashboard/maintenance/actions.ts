"use server";

import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { LEFTOVER_COLLECTIONS, type LeftoverCollection } from "@/lib/leftovers";

/**
 * מחיקת רשומה בודדת שאין לה מסך.
 *
 * הפעולה קיימת מפני שהחלופה גרועה יותר: רשומה שאף מסך לא מציג גם אי אפשר למחוק דרך שום
 * מסך, ולכן הדרך היחידה לנקות אותה הייתה להיכנס ל-Firestore ידנית. **הרשימה סגורה**
 * (`LEFTOVER_COLLECTIONS`) ולא פרמטר חופשי, כדי שהמסך הזה לא יהפוך למחיקה כללית של כל
 * מסמך במערכת לפי מזהה.
 *
 * מוגבל לבעלים, והאישור במסך מציין במפורש כמה כסף יורד מההנה"ח הראשית — מחיקה כאן היא
 * החלטה חשבונאית, לא ניקיון.
 */
export async function deleteLeftoverAction(collection: LeftoverCollection, id: string) {
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "owner") {
    throw new Error("מחיקה כאן מוגבלת לבעלים בלבד");
  }
  if (!LEFTOVER_COLLECTIONS.includes(collection)) {
    throw new Error("קולקשן לא מורשה למחיקה");
  }
  if (!id) throw new Error("חסר מזהה רשומה");

  await getAdminFirestore().collection(collection).doc(id).delete();

  // כל מסך שיכול היה להיות מושפע מהרשומה שנמחקה: ההתראות בבית, הספר הראשי והמודולים.
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/maintenance");
  revalidatePath("/dashboard/accounting");
  revalidatePath("/dashboard/accounting/extra-expenses");
  revalidatePath("/dashboard/coworking");
  revalidatePath("/dashboard/coworking/accounting");
  revalidatePath("/dashboard/expenses");
  revalidatePath("/dashboard/rentals/expenses");
}
