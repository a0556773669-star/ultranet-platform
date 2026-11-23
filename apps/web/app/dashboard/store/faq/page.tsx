import { MessageCircleQuestion } from "lucide-react";
import { requireOwner } from "@/lib/perms";
import { BUILTIN_FAQ, loadFaq } from "@/lib/store-faq";
import { StoreTabs } from "../store-tabs";
import { approveFaqAction, deleteFaqAction, saveFaqAction } from "../actions";

export const dynamic = "force-dynamic";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export default async function FaqPage() {
  await requireOwner();
  const all = await loadFaq();
  const stored = all.filter((f) => !f.id.startsWith("builtin-"));
  const pending = stored.filter((f) => !f.approved);
  const approved = stored.filter((f) => f.approved);

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <MessageCircleQuestion className="h-5 w-5" />
        שאלות חוזרות
      </h1>
      <StoreTabs isOwner />
      <div className="card mb-4 text-sm text-muted">
        שאלה שיש לה כאן תשובה מאושרת נענית מיד, <b>בלי שום עלות AI</b>. כשהיועץ עונה על שאלה כללית חדשה, היא נשמרת
        כאן וממתינה לאישורך. {BUILTIN_FAQ.length} שאלות בסיס (אחריות, אנטיווירוס, רישיונות, זמני אספקה) כבר פעילות.
      </div>

      {pending.length ? (
        <div className="mb-4 flex flex-col gap-3">
          <h2 className="text-sm font-bold text-ink">ממתינות לאישור ({pending.length})</h2>
          {pending.map((f) => (
            <form key={f.id} action={saveFaqAction} className="card flex flex-col gap-2">
              <input type="hidden" name="id" value={f.id} />
              <input name="question" defaultValue={f.question} className={FIELD} />
              <textarea name="answer" defaultValue={f.answer} rows={3} className={FIELD} />
              <input name="keywords" defaultValue={f.keywords.join(", ")} placeholder="מילות מפתח, מופרדות בפסיק" className={FIELD} />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-xs">אישור ושמירה</button>
                <button formAction={deleteFaqAction.bind(null, f.id)} className="btn-outline text-xs">מחיקה</button>
              </div>
            </form>
          ))}
        </div>
      ) : null}

      <div className="mb-4 flex flex-col gap-3">
        <h2 className="text-sm font-bold text-ink">מאושרות ({approved.length})</h2>
        {approved.map((f) => (
          <form key={f.id} action={saveFaqAction} className="card flex flex-col gap-2">
            <input type="hidden" name="id" value={f.id} />
            <input name="question" defaultValue={f.question} className={FIELD} />
            <textarea name="answer" defaultValue={f.answer} rows={3} className={FIELD} />
            <input name="keywords" defaultValue={f.keywords.join(", ")} className={FIELD} />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted">נענתה {f.hits} פעמים בלי עלות</span>
              <div className="flex gap-2">
                <button type="submit" className="btn-outline text-xs">שמירה</button>
                <button formAction={deleteFaqAction.bind(null, f.id)} className="btn-outline text-xs">מחיקה</button>
              </div>
            </div>
          </form>
        ))}
      </div>

      <form action={saveFaqAction} className="card flex flex-col gap-2">
        <h2 className="text-sm font-bold text-ink">שאלה חדשה</h2>
        <input name="question" placeholder="השאלה" className={FIELD} />
        <textarea name="answer" rows={3} placeholder="התשובה" className={FIELD} />
        <input name="keywords" placeholder="מילות מפתח, מופרדות בפסיק (למשל: אחריות, שבר)" className={FIELD} />
        <button type="submit" className="btn-primary w-fit text-xs">הוספה</button>
      </form>
    </div>
  );
}
