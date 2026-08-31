import { NextResponse } from "next/server";
import { sendMonthlyReports } from "@/lib/branch-report-send";
import { mailerConfigError } from "@/lib/mailer";

/**
 * שליחה אוטומטית של הדו"ח החודשי לכל הסניפים - נועד להיקרא מ-cron ב-1 לחודש.
 *
 * There is no session here, so the only thing standing between the outside world and a mailshot
 * to every partner is the shared secret: without one configured the route refuses outright
 * rather than running unauthenticated. Either REPORTS_CRON_SECRET or Vercel's own CRON_SECRET
 * works, since Vercel Cron sets the latter automatically and sends it as a Bearer token.
 *
 * Exposed on both GET and POST on purpose: POST is the honest verb for "send a batch of email",
 * but Vercel Cron only ever issues GET, so a POST-only route would silently never fire.
 *
 * Defaults to the PREVIOUS month, because that's what "run it on the 1st" means - you report on
 * the month that just closed, not the one that started this morning.
 */
export const dynamic = "force-dynamic";

function previousMonth(): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function handle(request: Request) {
  const secret = process.env.REPORTS_CRON_SECRET || process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "REPORTS_CRON_SECRET לא מוגדר - השליחה האוטומטית מושבתת" },
      { status: 503 }
    );
  }

  const authHeader = request.headers.get("authorization") ?? "";
  const provided = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (provided !== secret) {
    return NextResponse.json({ ok: false, error: "לא מורשה" }, { status: 401 });
  }

  const configError = mailerConfigError();
  if (configError) return NextResponse.json({ ok: false, error: configError }, { status: 503 });

  const url = new URL(request.url);
  const requested = url.searchParams.get("month");
  const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : previousMonth();

  const results = await sendMonthlyReports({ month, skipAlreadySent: true });
  const sent = results.filter((r) => r.ok && !r.message.includes("דולג")).length;
  const skipped = results.filter((r) => r.ok && r.message.includes("דולג")).length;
  const failed = results.filter((r) => !r.ok);

  return NextResponse.json({
    ok: failed.length === 0,
    month,
    sent,
    skipped,
    failed: failed.map((f) => ({ branch: f.branchName, reason: f.message })),
  });
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
