import { createHash } from "node:crypto";
import { getAdminFirestore } from "@/lib/firebase-admin";

/**
 * The business logo, read once and served as a real image instead of inlined bytes.
 *
 * The logo lives in n_label_settings/default.logoUrl as a base64 `data:` URI - that's what the
 * upload field in /dashboard/accounting produces (FileReader.readAsDataURL). Every
 * screen that showed it used to embed that whole string straight into its HTML: the root layout
 * as a favicon href, the dashboard header, the login page and the shop page. Base64 adds a third
 * again to the byte count, HTML is never cached, and the dashboard paid for it twice per
 * navigation (metadata + header), so a modest logo could add hundreds of kilobytes to *every*
 * page load - and each one also cost a Firestore document read.
 *
 * Pages now emit a short URL to /api/branding/logo instead, which the browser fetches once and
 * caches. The URL carries a hash of the logo's contents, so a new logo is a new URL and the
 * immutable caching on that route can never serve a stale image.
 */

/** Matches `data:image/png;base64,AAAA...` and captures the mime type and the payload. */
const DATA_URI = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s;

export interface StoredLogo {
  /** the raw stored value - a `data:` URI, or an https:// URL if one was configured instead */
  value: string;
  /** short content hash, used to cache-bust the served URL */
  version: string;
}

const TTL_MS = 60 * 1000;
let cached: { at: number; logo: StoredLogo | null } | null = null;

/** The stored logo, at most one Firestore read per minute across the whole process. */
export async function getStoredLogo(): Promise<StoredLogo | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.logo;
  try {
    const doc = await getAdminFirestore().collection("n_label_settings").doc("default").get();
    const value = String((doc.data() as { logoUrl?: string } | undefined)?.logoUrl ?? "").trim();
    const logo = value ? { value, version: createHash("sha1").update(value).digest("hex").slice(0, 12) } : null;
    cached = { at: Date.now(), logo };
    return logo;
  } catch {
    // Branding must never break a page: reuse the last known value, or render the wordmark.
    return cached?.logo ?? null;
  }
}

/** Called when the logo is changed so the new one appears immediately. */
export function invalidateLogoCache() {
  cached = null;
}

/** The `src` a page should render, or null when no logo is configured. */
export async function getLogoSrc(): Promise<string | null> {
  const logo = await getStoredLogo();
  if (!logo) return null;
  // An https:// logo is already a cacheable URL of its own - no point proxying it.
  if (/^https?:\/\//i.test(logo.value)) return logo.value;
  return `/api/branding/logo?v=${logo.version}`;
}

/** Decodes a stored `data:` URI into the bytes the route handler serves. An ArrayBuffer rather
 *  than a Uint8Array because that is what Response accepts as a BodyInit. */
export function decodeStoredLogo(logo: StoredLogo): { contentType: string; body: ArrayBuffer } | null {
  const match = DATA_URI.exec(logo.value);
  if (!match) return null;
  // Buffer.from() can return a view into a larger pooled allocation, so slice out exactly this
  // image's bytes instead of handing over the whole pool.
  const buf = Buffer.from(match[2] as string, "base64");
  const body = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
  return { contentType: match[1] as string, body };
}
