import { NextResponse } from "next/server";
import { currentMonth } from "@/lib/branch-accounting-data";
import { previousMonth } from "@/lib/fixed-expense-revision";
import { sendMissingIncomeReminder } from "@/lib/cr-income-reminder";

/**
 * Cron ב-1 לחודש (`apps/web/vercel.json`): אם חסרות הכנסות חדרי מחשבים לחודש שנסגר, נשלח
 * לבעלים מייל עם קישור להזנה. ראו `lib/cr-income-reminder.ts`.
 *
 * Vercel שולח `Authorization: Bearer $CRON_SECRET`; בלי הסוד המוגדר ה-route לא רץ בכלל, כדי
 * שקריאה מבחוץ לא תוכל להציף את תיבת המייל.
 */
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const month = previousMonth(currentMonth());
  const { missing, sent } = await sendMissingIncomeReminder(month);
  return NextResponse.json({ ok: sent?.ok ?? true, month, missing, message: sent?.message ?? "הכול מולא" });
}
