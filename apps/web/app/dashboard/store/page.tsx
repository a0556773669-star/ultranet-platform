import Link from "next/link";
import { ShoppingBag, BookOpen, ArrowLeft, ChevronDown } from "lucide-react";
import { isOwnerSession, requireModuleAccess } from "@/lib/perms";
import { listVisibleProcedures } from "../duxus/actions";
import { StoreTabs } from "./store-tabs";
import { ensureStoreProcedures } from "@/lib/store-procedures-seed";

export default async function StoreHomePage() {
  const session = await requireModuleAccess("store");
  const isOwner = isOwnerSession(session);
  // נהלי החנות נטענים אוטומטית בפעם הראשונה; נערכים אחר כך במסך הנהלים (הרשאת צפייה "סניפים עם חנות סניפים").
  await ensureStoreProcedures().catch(() => {});
  const all = await listVisibleProcedures();
  const procedures = all
    .filter((p) => p.audience?.mode === "store" && p.status !== "archived" && p.status !== "draft")
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || a.title.localeCompare(b.title, "he", { numeric: true }));

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <ShoppingBag className="h-5 w-5" />
        חנות סניפים
      </h1>
      <StoreTabs isOwner={isOwner} />

      <div className="card mb-4">
        <h2 className="mb-2 text-base font-bold text-ink">איך זה עובד (שלב א׳)</h2>
        <ol className="list-decimal space-y-1.5 pr-5 text-sm text-ink">
          <li>
            <b>הלקוח מגיע לסניף.</b> בלשונית ״התאמת מחשב ללקוח״ בוחרים: <b>לפי רצון הלקוח</b> (הוא יודע בדיוק מה
            הוא רוצה) או <b>לפי שאלות</b> (הוא לא יודע - המערכת שואלת ומתאימה).
          </li>
          <li>
            <b>מה שהלקוח קבע בוודאות - לא משתנה.</b> רק בשדות שהוא לא קבע תקבלו גם אפשרות ״טיפה יותר טוב״, עם הסבר
            במה היא טובה יותר - כדי שתוכלו להסביר ללקוח.
          </li>
          <li>
            <b>הבקשה נשלחת אלינו.</b> אנחנו בודקים מחירי שוק והתאמה אמיתית, ומחזירים לכם בלשונית ״הבקשות שלי״ טווח
            מחיר (הערכה) ל-1 עד 3 אפשרויות.
          </li>
          <li>
            <b>המחיר בשלב הזה הוא טווח הערכה, לא מחיר סופי.</b> אין לנו מלאי; ההזמנה מתבצעת מיבואן, מגיעה לסניף,
            ואתם מכינים את המחשב ללקוח לפי ההדרכות למטה. בהמשך, כשיהיה מלאי, יופיעו מחירים קבועים.
          </li>
        </ol>
        <div className="mt-3">
          <Link
            href="/dashboard/store/new"
            className="inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
          >
            התחלת התאמה ללקוח
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="mb-2 flex items-center gap-1.5 text-base font-bold text-ink">
        <BookOpen className="h-4 w-4" />
        נהלים
      </div>
      {!procedures.length ? (
        <div className="card text-sm text-muted">עדיין לא פורסמו נהלים.</div>
      ) : (
        <div className="flex flex-col gap-2">
          {procedures.map((p) => (
            <details key={p.id} className="group card !p-0 overflow-hidden">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-bold text-ink hover:bg-[#f4f6f9]">
                <span>
                  {p.title}
                  {p.summary ? <span className="mt-0.5 block text-xs font-normal text-muted">{p.summary}</span> : null}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
              </summary>
              <div
                className="border-t border-card-border px-4 py-3 text-sm leading-relaxed text-ink [&_h4]:mb-1 [&_h4]:mt-3 [&_h4]:font-bold [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5"
                dangerouslySetInnerHTML={{ __html: p.content }}
              />
            </details>
          ))}
        </div>
      )}
    </div>
  );
}
