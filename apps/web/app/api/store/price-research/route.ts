import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { buildGuidePrompt } from "@/lib/store-ai";
import { loadPriceGuide, mergeGuide, researchTargets, savePriceGuide, specDescription, type GuideDraftLike } from "@/lib/store-price-guide";

/**
 * מסלול חלופי לרענון המחירון **בלי עלות API**: סשן מתוזמן של Claude (על המנוי של הבעלים) קורא כאן את מה שצריך לסרוק,
 * מחפש ברשת, ושולח חזרה את התוצאה. אותו מיזוג מוגן כמו ב-cron של Vercel (`mergeGuide`: טווח סביר ושינוי עד 40%).
 *
 * - GET: הנחיית הסריקה (`prompt`) + רשימת התצורות לסריקה (`targets`).
 * - POST: גוף JSON באותו מבנה שההנחיה מבקשת; מוזג למחירון.
 *
 * מוגן ב-`Authorization: Bearer $STORE_INGEST_TOKEN`; בלי המשתנה המסלול כבוי לגמרי.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.STORE_INGEST_TOKEN?.trim();
  if (!secret || secret.length < 16) return false;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const unauthorized = () => NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  const targets = (await researchTargets()).map((t) => ({ key: t.key, description: specDescription(t.spec), requested: t.requested }));
  return NextResponse.json({ ok: true, prompt: buildGuidePrompt(targets), targets });
}

export async function POST(req: Request) {
  if (!authorized(req)) return unauthorized();
  let body: GuideDraftLike;
  try {
    body = (await req.json()) as GuideDraftLike;
  } catch {
    return NextResponse.json({ ok: false, error: "גוף הבקשה אינו JSON תקין" }, { status: 400 });
  }
  const { guide, notes } = mergeGuide(await loadPriceGuide(), body ?? {});
  await savePriceGuide(guide);
  return NextResponse.json({ ok: true, rejected: notes });
}
