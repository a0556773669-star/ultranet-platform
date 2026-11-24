/**
 * תוצאת Server Action שאינה זורקת. **למה:** ב-production Next.js מסתיר את הודעת כל שגיאה שנזרקת מ-Server Action
 * ("An error occurred in the Server Components render...") - כך שהמשתמש לא רואה מה השתבש. פעולות שהמשתמש לוחץ עליהן
 * מחזירות `{ ok: false, error }` עם הסיבה האמיתית, והדפדפן מציג אותה.
 */
export type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function guard<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    // redirect()/notFound() של Next זורקים שגיאה מיוחדת שחייבת להמשיך הלאה
    const digest = (e as { digest?: unknown } | null)?.digest;
    if (typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_NOT_FOUND"))) throw e;
    const message = e instanceof Error ? e.message : "שגיאה לא ידועה";
    console.error("[server-action]", message);
    return { ok: false, error: message };
  }
}
