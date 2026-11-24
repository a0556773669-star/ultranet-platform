import { NextResponse } from "next/server";
import { anthropicConfigured } from "@/lib/anthropic-client";
import { draftPriceGuide } from "@/lib/store-ai";
import { loadPriceGuide, mergeGuide, savePriceGuide } from "@/lib/store-price-guide";

/**
 * Cron יומי (`apps/web/vercel.json`): רענון מחירון השוק של חנות הסניפים - Haiku 5.5 + חיפוש ברשת, פעם אחת ביום.
 * כך ההצעות בצ'אט מחושבות מיד מהמחירון (בלי המתנה לחיפוש), והמחיר מתעדכן לבד.
 *
 * הגנות (`mergeGuide`): מחיר מחוץ לטווח סביר או שינוי של מעל 40% מהערך הקודם נדחים, כדי שנתון חריג לא ישבש את
 * ההצעות. Vercel שולח `Authorization: Bearer $CRON_SECRET`; בלי הסוד ה-route לא רץ.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "ANTHROPIC_API_KEY לא מוגדר" });
  try {
    const draft = await draftPriceGuide();
    const { guide, notes } = mergeGuide(await loadPriceGuide(), draft);
    await savePriceGuide(guide);
    return NextResponse.json({ ok: true, rejected: notes });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "שגיאה" });
  }
}
