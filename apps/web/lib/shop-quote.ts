// בונה מסמך HTML עצמאי (בלי תלות חיצונית) עבור הצעת המחיר שהלקוח מוריד בסוף השיחה בצ'אטבוט.
// נשמר כקובץ נפרד מ-shop-recommender.ts כי הוא עוסק בפורמט/תצוגה, לא בלוגיקת ההמלצה עצמה.

import type { ShopRecommendedOption } from "@ultranet/shared-types";

export interface QuoteAddonLine {
  name: string;
  priceILS?: number;
}

export interface BuildQuoteInput {
  logoUrl?: string;
  contactName?: string;
  contactEmail: string;
  contactPhone: string;
  useCaseLabel: string;
  description: string;
  selectedOption: ShopRecommendedOption;
  otherOptions: ShopRecommendedOption[];
  selectedAddons: QuoteAddonLine[];
  createdAtLabel: string;
  leadId?: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatPrice(priceILS: number | undefined): string {
  return typeof priceILS === "number" ? `${priceILS.toLocaleString("he-IL")} ₪` : "יימסר בהצעת מחיר אישית";
}

export function buildQuoteHtmlDocument(input: BuildQuoteInput): string {
  const totalKnown =
    typeof input.selectedOption.priceILS === "number" && input.selectedAddons.every((a) => typeof a.priceILS === "number");
  const total = totalKnown
    ? (input.selectedOption.priceILS ?? 0) + input.selectedAddons.reduce((sum, a) => sum + (a.priceILS ?? 0), 0)
    : undefined;

  const headerLogo = input.logoUrl
    ? `<img src="${escapeHtml(input.logoUrl)}" alt="אולטרנט" style="height:44px;object-fit:contain" />`
    : `<span style="font-size:22px;font-weight:800;color:#1a8a76;letter-spacing:-0.5px">אולטרנט</span>`;

  const addonsRows = input.selectedAddons.length
    ? input.selectedAddons
        .map((a) => `<tr><td style="padding:8px 0;border-bottom:1px solid #eef1f5">${escapeHtml(a.name)}</td><td style="padding:8px 0;border-bottom:1px solid #eef1f5;text-align:left">${formatPrice(a.priceILS)}</td></tr>`)
        .join("")
    : `<tr><td colspan="2" style="padding:8px 0;color:#5a6a7e">לא נבחר ציוד נלווה</td></tr>`;

  const otherOptionsHtml = input.otherOptions
    .map(
      (opt) =>
        `<div style="margin-top:10px;padding:12px 14px;border:1px solid #dde3ec;border-radius:10px;background:#f8fafb">
          <div style="font-weight:700;color:#1a2332">${escapeHtml(opt.title)}</div>
          <div style="margin-top:4px;font-size:13px;color:#5a6a7e">${escapeHtml(opt.specsSummary)}</div>
          <div style="margin-top:4px;font-size:13px;font-weight:700;color:#1a8a76">${formatPrice(opt.priceILS)}</div>
        </div>`
    )
    .join("");

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8" />
<title>הצעת מחיר - אולטרנט</title>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body { margin:0; padding:32px; background:#f0f2f5; color:#1a2332; font-family: Heebo, Arial, sans-serif; direction: rtl; }
  .sheet { max-width: 760px; margin: 0 auto; background:#fff; border-radius:16px; box-shadow:0 2px 10px rgba(0,0,0,0.08); overflow:hidden; }
  .head { display:flex; align-items:center; justify-content:space-between; padding:24px 28px; border-bottom:2px solid #e0f0ed; }
  .badge { display:inline-block; padding:4px 10px; border-radius:999px; background:#e0f0ed; color:#0f6e56; font-size:12px; font-weight:700; }
  .section { padding:22px 28px; border-bottom:1px solid #eef1f5; }
  .section:last-child { border-bottom:none; }
  h2 { font-size:14px; color:#5a6a7e; margin:0 0 10px; }
  .selected { border:2px solid #1a8a76; border-radius:14px; padding:18px 20px; background:#f4fbf9; }
  .selected .title { font-size:19px; font-weight:800; color:#0f6e56; }
  .selected .specs { margin-top:6px; color:#1a2332; font-size:14px; line-height:1.7; }
  .selected .reason { margin-top:10px; color:#5a6a7e; font-size:13px; line-height:1.6; }
  .selected .price { margin-top:14px; font-size:22px; font-weight:800; color:#1a8a76; }
  table { width:100%; border-collapse:collapse; }
  .total { display:flex; justify-content:space-between; align-items:center; padding-top:14px; margin-top:6px; border-top:2px solid #dde3ec; font-weight:800; font-size:17px; }
  .footer { padding:20px 28px; background:#f8fafb; font-size:12px; color:#5a6a7e; line-height:1.7; }
  .kv { display:flex; justify-content:space-between; padding:4px 0; font-size:14px; }
  .kv span:first-child { color:#5a6a7e; }
  @media print { body { background:#fff; padding:0; } .sheet { box-shadow:none; border-radius:0; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="head">
      ${headerLogo}
      <span class="badge">הצעת מחיר ראשונית</span>
    </div>

    <div class="section">
      <h2>פרטי הפנייה</h2>
      <div class="kv"><span>תאריך</span><span>${escapeHtml(input.createdAtLabel)}</span></div>
      ${input.contactName ? `<div class="kv"><span>שם</span><span>${escapeHtml(input.contactName)}</span></div>` : ""}
      <div class="kv"><span>אימייל</span><span>${escapeHtml(input.contactEmail)}</span></div>
      <div class="kv"><span>טלפון</span><span>${escapeHtml(input.contactPhone)}</span></div>
      <div class="kv"><span>עיקר השימוש</span><span>${escapeHtml(input.useCaseLabel)}</span></div>
      ${input.description ? `<div class="kv"><span>תיאור שסופק</span><span>${escapeHtml(input.description)}</span></div>` : ""}
    </div>

    <div class="section">
      <h2>התצורה שנבחרה</h2>
      <div class="selected">
        <div class="title">${escapeHtml(input.selectedOption.title)}</div>
        <div class="specs">${escapeHtml(input.selectedOption.specsSummary)}</div>
        <div class="reason">${escapeHtml(input.selectedOption.reason)}</div>
        <div class="price">${formatPrice(input.selectedOption.priceILS)}</div>
      </div>
    </div>

    <div class="section">
      <h2>ציוד נלווה</h2>
      <table>${addonsRows}</table>
      <div class="total">
        <span>סה"כ הערכה</span>
        <span>${totalKnown ? formatPrice(total) : "יימסר בהצעת מחיר אישית"}</span>
      </div>
    </div>

    ${
      input.otherOptions.length
        ? `<div class="section">
            <h2>אפשרויות נוספות שכדאי להכיר</h2>
            ${otherOptionsHtml}
          </div>`
        : ""
    }

    <div class="footer">
      זוהי הצעת מחיר ראשונית שנוצרה אוטומטית לפי מה ששיתפת בצ'אט, ואינה מהווה הזמנה סופית או התחייבות מחיר.
      נציג מטעם אולטרנט יחזור אליך בהקדם באימייל/בטלפון שהוזנו כדי לאשר את המפרט הסופי, הזמינות והמחיר בפועל.
      ${input.leadId ? `<br />מספר פנייה: ${escapeHtml(input.leadId)}` : ""}
    </div>
  </div>
</body>
</html>`;
}
