import { NextResponse } from "next/server";

/**
 * לשעבר: שליחה אוטומטית של הדו"ח החודשי לכל הסניפים מ-cron ב-1 לחודש.
 *
 * **מושבת בכוונה (2026-10).** ב-1 לחודש, בשעה 9:00, הנתונים של החודש שנסגר עוד לא סגורים -
 * השכרות שהוחזרו ולא סומנו כשולמו, הוצאות שעוד לא הוזנו, העברות שעוד לא נרשמו - והמייל שיצא
 * לשותפים כלל טעויות. הדו"ח נשלח מעכשיו **רק בלחיצת כפתור של הבעלים** במסך "ניידים"
 * (`/dashboard/accounting/mobile`), ובדף הבית מוצגת תזכורת לשלוח אותו. ה-cron הוסר מ-
 * `vercel.json`; ה-route נשאר רק כדי שקריאה ישנה תקבל תשובה ברורה ולא תשלח כלום.
 */
export const dynamic = "force-dynamic";

function disabled() {
  return NextResponse.json(
    { ok: false, error: 'השליחה האוטומטית של הדו"ח החודשי הושבתה - שולחים ידנית ממסך "ניידים"' },
    { status: 410 },
  );
}

export async function GET() {
  return disabled();
}

export async function POST() {
  return disabled();
}
