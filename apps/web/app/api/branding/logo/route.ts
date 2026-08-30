import { NextResponse } from "next/server";
import { getStoredLogo, decodeStoredLogo } from "@/lib/branding";

/** Public on purpose: the same logo already appears on the login page and the shop, both of
 *  which are reachable without a session. */
export const dynamic = "force-dynamic";

export async function GET() {
  const logo = await getStoredLogo();
  if (!logo) return new NextResponse(null, { status: 404 });

  if (/^https?:\/\//i.test(logo.value)) return NextResponse.redirect(logo.value);

  const decoded = decodeStoredLogo(logo);
  if (!decoded) return new NextResponse(null, { status: 404 });

  return new NextResponse(decoded.body, {
    headers: {
      "Content-Type": decoded.contentType,
      // Safe to cache forever: callers link to ?v=<content hash>, so a changed logo is a
      // different URL rather than a stale hit on this one.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
