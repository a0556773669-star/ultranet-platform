/**
 * הלוגו בדו"ח שנשלח במייל.
 *
 * The business logo is stored in n_label_settings/default.logoUrl as a base64 `data:` URI
 * (that's what the upload field in /dashboard/rentals/labels/settings produces - it reads the
 * file with FileReader.readAsDataURL). A browser renders that fine, but **Gmail and Outlook
 * strip `data:` image sources**, so an emailed report would silently lose its logo.
 *
 * The fix is a `cid:` inline attachment: the image travels inside the message and the HTML
 * points at it by content id. Resend supports this via Attachment.contentId.
 *
 * An https:// logo (if one is ever configured instead) needs none of this and is used as-is.
 */

export interface EmailInlineImage {
  /** referenced from the HTML as src="cid:<contentId>" */
  contentId: string;
  filename: string;
  contentType: string;
  /** raw base64, no data: prefix */
  base64: string;
}

export interface EmailLogo {
  /** what to put in the <img src>; null when there's no usable logo. */
  src: string | null;
  /** present only when the logo has to travel with the message. */
  attachment?: EmailInlineImage;
}

const LOGO_CID = "ultranet-logo";

/** Matches `data:image/png;base64,AAAA...` and captures the mime type and the payload. */
const DATA_URI = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/s;

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

/**
 * How the logo should be referenced in an email.
 * For the on-screen preview use the stored value directly instead - the browser handles
 * `data:` URIs natively and no attachment machinery is involved.
 */
export function logoForEmail(logoUrl: string | undefined | null): EmailLogo {
  const value = logoUrl?.trim();
  if (!value) return { src: null };

  // Already hosted somewhere reachable - email clients can just fetch it.
  if (/^https?:\/\//i.test(value)) return { src: value };

  const match = DATA_URI.exec(value);
  if (!match) return { src: null };

  const contentType = match[1] as string;
  const base64 = match[2] as string;
  // SVG is widely blocked by email clients; sending it would show a broken image rather than
  // nothing, so drop it and let the report fall back to its text wordmark.
  if (contentType === "image/svg+xml") return { src: null };

  return {
    src: `cid:${LOGO_CID}`,
    attachment: {
      contentId: LOGO_CID,
      filename: `logo.${EXT_BY_MIME[contentType] ?? "png"}`,
      contentType,
      base64,
    },
  };
}
