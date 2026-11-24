import { BookText } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { DEFAULT_GLOSSARY, GLOSSARY_COLLECTION } from "@/lib/store-glossary";
import { advisorConfigured } from "@/lib/store-advisor";
import type { StoreGlossaryTerm } from "@ultranet/shared-types";
import { StoreTabs } from "../store-tabs";
import { AiTestButton } from "../ai-test-button";
import { deleteGlossaryTermAction, saveGlossaryTermAction, seedGlossaryAction } from "../actions";

export const dynamic = "force-dynamic";
/** פעולות ה-AI (שיחה/חיפוש ברשת) יכולות לעבור 10 שניות - ללא זה Vercel חותך אותן. */
export const maxDuration = 60;

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export default async function GlossaryPage() {
  await requireOwner();
  const snap = await getAdminFirestore().collection(GLOSSARY_COLLECTION).get();
  const terms = snap.docs.map((d) => ({ ...(d.data() as Omit<StoreGlossaryTerm, "id">), id: d.id }) as StoreGlossaryTerm);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <BookText className="h-5 w-5" />
        מושגים ליועץ ה-AI
      </h1>
      <StoreTabs isOwner />

      <div className="card mb-4 text-sm text-muted">
        כאן מלמדים את היועץ איך להבין לקוחות: מושג (למשל ״חידושי תורה״) והנחיה (למשל ״Word בסיס בלבד, מחשב פשוט״).
        היועץ קורא את כל המושגים הפעילים בכל שיחה.{" "}
        {advisorConfigured() ? "היועץ פעיל." : "היועץ עדיין לא פעיל - חסר ANTHROPIC_API_KEY, והסניפים משתמשים בשאלון הרגיל."}
        <AiTestButton />
      </div>

      {!terms.length ? (
        <div className="card mb-4 text-sm">
          <p className="mb-2 text-muted">עוד לא הגדרת מושגים - היועץ משתמש כרגע ב-{DEFAULT_GLOSSARY.length} מושגי ברירת מחדל.</p>
          <form action={seedGlossaryAction}>
            <button className="btn-outline text-xs">העתקת ברירות המחדל לעריכה</button>
          </form>
        </div>
      ) : null}

      <div className="flex flex-col gap-3">
        {terms.map((t) => (
          <form key={t.id} action={saveGlossaryTermAction} className="card flex flex-col gap-2">
            <input type="hidden" name="id" value={t.id} />
            <input name="term" defaultValue={t.term} className={FIELD} />
            <textarea name="guidance" defaultValue={t.guidance} rows={3} className={FIELD} />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs text-muted">
                <input type="checkbox" name="active" value="on" defaultChecked={t.active !== false} />
                פעיל
              </label>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-xs">שמירה</button>
                <button formAction={deleteGlossaryTermAction.bind(null, t.id)} className="btn-outline text-xs">מחיקה</button>
              </div>
            </div>
          </form>
        ))}
      </div>

      <form action={saveGlossaryTermAction} className="card mt-4 flex flex-col gap-2">
        <h2 className="text-sm font-bold text-ink">מושג חדש</h2>
        <input name="term" placeholder="מושג, למשל: סטודנט" className={FIELD} />
        <textarea name="guidance" rows={3} placeholder="הנחיה ליועץ: מה זה אומר, מה לשאול, מה להסביר" className={FIELD} />
        <button type="submit" className="btn-primary w-fit text-xs">הוספה</button>
      </form>
    </div>
  );
}
