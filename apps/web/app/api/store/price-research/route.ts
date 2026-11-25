import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { buildGuidePrompt, scanMarket } from "@/lib/store-ai";
import { inspectPage } from "@/lib/store-listings";
import { liveQuote, priceOptions } from "@/lib/store-live-price";
import { sanitizeSpec, specToText } from "@/lib/store-wizard";
import {
  EMPTY_GUIDE,
  estimateMarketLow,
  loadPriceGuide,
  mergeGuide,
  researchTargets,
  savePriceGuide,
  specDescription,
  type GuideDraftLike,
} from "@/lib/store-price-guide";

/**
 * מסלול חלופי לרענון המחירון **בלי עלות API**: סשן מתוזמן של Claude (על המנוי של הבעלים) קורא כאן את מה שצריך לסרוק,
 * מחפש ברשת, ושולח חזרה את התוצאה. אותו מיזוג מוגן כמו ב-cron של Vercel (`mergeGuide`: טווח סביר ושינוי עד 40%).
 *
 * - GET: הנחיית הסריקה (`prompt`) + רשימת התצורות לסריקה (`targets`). עם `?run=1` - מריץ את הסריקה המלאה בשרת ושומר.
 * - POST: גוף JSON באותו מבנה שההנחיה מבקשת; מוזג למחירון.
 *
 * מוגן ב-`Authorization: Bearer $STORE_INGEST_TOKEN`; בלי המשתנה המסלול כבוי לגמרי.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.STORE_INGEST_TOKEN?.trim();
  if (!secret || secret.length < 16) return false;
  const given = (req.headers.get("authorization") ?? "")
    .replace(/^Bearer\s+/i, "")
    .trim();
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

const unauthorized = () =>
  NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

export async function GET(req: Request) {
  if (!authorized(req)) return unauthorized();
  // ?quote=1&kind=desktop&cpu=i5&ram=32&storage=512&monitor=27&wireless=1&bag=15.6 - בדיקת תמחור חי (כמו בצ'אט) בלי להתחבר כסניף
  if (new URL(req.url).searchParams.get("quote") === "1") {
    try {
      const q = new URL(req.url).searchParams;
      const kind = q.get("kind") === "desktop" ? "desktop" : "laptop";
      const extras: string[] = [];
      if (q.get("monitor")) extras.push("מסך");
      if (q.get("wireless") !== null) extras.push("מקלדת", "עכבר");
      if (q.get("bag")) extras.push("תיק");
      const spec = sanitizeSpec({
        kind,
        cpu: (q.get("cpu") ?? "i5") as "i3" | "i5" | "i7",
        ramGb: Number(q.get("ram") ?? 8),
        storageGb: Number(q.get("storage") ?? 256),
        screenInches: q.get("screen") ? Number(q.get("screen")) : undefined,
        touch:
          q.get("touch") === "1" ? true : kind === "laptop" ? false : undefined,
        extras,
        monitorInches: q.get("monitor") ? Number(q.get("monitor")) : undefined,
        wireless:
          q.get("wireless") === null ? undefined : q.get("wireless") === "1",
        bagInches: q.get("bag") ? Number(q.get("bag")) : undefined,
      });
      const guide = await loadPriceGuide();
      const t0 = Date.now();
      const quote = await liveQuote(spec);
      const priced = await priceOptions([spec], guide);
      return NextResponse.json({
        ok: true,
        spec,
        specText: specToText(spec),
        ms: Date.now() - t0,
        guideLow: estimateMarketLow(spec, guide),
        live: quote,
        source: priced.source,
        uncertain: priced.uncertain,
        estimate: priced.estimates[0],
      });
    } catch (e) {
      return NextResponse.json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }
  // ?inspect=<url> - מה מופיע בפועל בדף מוצר (לאבחון אימות המחירים)
  const inspectUrl = new URL(req.url).searchParams.get("inspect");
  if (inspectUrl && /^https:\/\//.test(inspectUrl))
    return NextResponse.json({ ...(await inspectPage(inspectUrl)) });
  // ?run=1 - מריץ את הסריקה המלאה בשרת (עם מפתח ה-API של האתר) ושומר, ומחזיר תוצאה מפורטת כולל שגיאה. לבדיקה והפעלה ידנית.
  if (new URL(req.url).searchParams.get("run") === "1") {
    try {
      const t = (await researchTargets()).map((x) => ({
        key: x.key,
        description: specDescription(x.spec),
        requested: x.requested,
      }));
      const draft = await scanMarket(t);
      // ?reset=1 - מתחילים מהתחלה (בלי להתחשב במחירון הקיים), למשל אחרי שנשמרו ערכים משובשים
      const before =
        new URL(req.url).searchParams.get("reset") === "1"
          ? EMPTY_GUIDE
          : await loadPriceGuide();
      const { guide, notes } = mergeGuide(before, draft);
      await savePriceGuide(guide);
      return NextResponse.json({
        ok: true,
        scanned: t.length,
        specPricesFound: Object.keys(draft.specPrices ?? {}).length,
        laptopBase: guide.laptopBase,
        desktopBase: guide.desktopBase,
        rejected: notes,
      });
    } catch (e) {
      return NextResponse.json({
        ok: false,
        error: e instanceof Error ? e.message : String(e),
        stack:
          e instanceof Error ? (e.stack ?? "").split("\n").slice(0, 6) : [],
      });
    }
  }
  const targets = (await researchTargets()).map((t) => ({
    key: t.key,
    description: specDescription(t.spec),
    requested: t.requested,
  }));
  return NextResponse.json({
    ok: true,
    prompt: buildGuidePrompt(targets),
    targets,
  });
}

export async function POST(req: Request) {
  if (!authorized(req)) return unauthorized();
  let body: GuideDraftLike;
  try {
    body = (await req.json()) as GuideDraftLike;
  } catch {
    return NextResponse.json(
      { ok: false, error: "גוף הבקשה אינו JSON תקין" },
      { status: 400 },
    );
  }
  const { guide, notes } = mergeGuide(await loadPriceGuide(), body ?? {});
  await savePriceGuide(guide);
  return NextResponse.json({ ok: true, rejected: notes });
}
