import Anthropic from "@anthropic-ai/sdk";

/**
 * המפתח כפי שנשמר במשתני הסביבה, **אחרי ניקוי**: רווחים, שורה חדשה ומרכאות שנדבקים בטעות בהעתקה
 * מ-Console ל-Vercel גורמים ל-`invalid x-api-key` למרות שהמפתח עצמו תקין.
 */
export function anthropicKey(): string {
  return (process.env.ANTHROPIC_API_KEY ?? "").trim().replace(/^["'`]+|["'`]+$/g, "").trim();
}

export function anthropicConfigured(): boolean {
  return anthropicKey().length > 0;
}

export function createAnthropic(): Anthropic {
  return new Anthropic({ apiKey: anthropicKey() });
}

/** אבחון בטוח של המפתח (בלי לחשוף אותו): אורך, תחילית, ובעיות פורמט שכיחות. */
export function describeKey(): string {
  const raw = process.env.ANTHROPIC_API_KEY ?? "";
  if (!raw) return "המשתנה ANTHROPIC_API_KEY לא קיים בשרת";
  const key = anthropicKey();
  const notes: string[] = [];
  if (raw !== raw.trim()) notes.push("היו רווחים/שורה חדשה בקצה (נוקו אוטומטית)");
  if (/^["'`]|["'`]$/.test(raw.trim())) notes.push("היו מרכאות סביב הערך (נוקו אוטומטית)");
  if (!key.startsWith("sk-ant-")) notes.push("המפתח לא מתחיל ב-sk-ant- - כנראה הודבק ערך אחר");
  if (key.startsWith("sk-ant-admin")) notes.push("זה מפתח אדמין - צריך מפתח API רגיל (Create Key)");
  if (key.length < 40) notes.push("המפתח קצר מדי - כנראה הועתק חלקית");
  return `אורך ${key.length}, תחילית ${key.slice(0, 7)}${notes.length ? " | " + notes.join(" | ") : ""}`;
}
