import Link from "next/link";
import { ShoppingBag, BookOpen, ArrowLeft } from "lucide-react";
import { isOwnerSession, requireModuleAccess } from "@/lib/perms";
import { listVisibleProcedures } from "../duxus/actions";
import { StoreTabs } from "./store-tabs";

export default async function StoreHomePage() {
  const session = await requireModuleAccess("store");
  const isOwner = isOwnerSession(session);
  // נהלים והדרכות של החנות = נהלים עם הרשאת צפייה "סניפים עם חנות סניפים" (נערכים במסך הנהלים).
  const all = await listVisibleProcedures();
  const procedures = all.filter((p) => p.audience?.mode === "store" && p.status !== "archived" && p.status !== "draft");
  const byCategory = new Map<string, typeof procedures>();
  for (const p of procedures) {
    const key = p.category || "כללי";
    byCategory.set(key, [...(byCategory.get(key) ?? []), p]);
  }

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <ShoppingBag className="h-5 w-5" />
        חנות סניפים
      </h1>
      <StoreTabs />

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
            מחיר (מחיר שוק + מרווח) ל-1 עד 3 אפשרויות.
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

      <div className="card">
        <h2 className="mb-2 flex items-center gap-1.5 text-base font-bold text-ink">
          <BookOpen className="h-4 w-4" />
          נהלים והדרכות
        </h2>
        {!procedures.length ? (
          <p className="text-sm text-muted">
            עדיין לא פורסמו נהלים והדרכות לחנות.
            {isOwner ? (
              <>
                {" "}
                להוספה: <Link href="/dashboard/duxus/procedures/new" className="font-semibold text-teal hover:underline">נוהל חדש</Link>, ובשדה
                ״מי רשאי לצפות״ בוחרים <b>״סניפים עם חנות סניפים״</b> (סטטוס ״בתוקף״). נהלי התקנה והדרכות נכנסים לאותו מקום
                (קטגוריה לדוגמה: ״הדרכת התקנה״).
              </>
            ) : null}
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            {Array.from(byCategory.entries()).map(([category, items]) => (
              <div key={category}>
                <div className="mb-1 text-xs font-bold text-muted">{category}</div>
                <ul className="flex flex-col gap-1.5">
                  {items.map((p) => (
                    <li key={p.id}>
                      <Link
                        href={`/dashboard/tutorials/procedures/${p.id}`}
                        className="block rounded-lg border border-card-border bg-white px-3 py-2 text-sm hover:border-teal"
                      >
                        <span className="font-bold text-ink">{p.title}</span>
                        {p.summary ? <span className="mt-0.5 block text-xs text-muted">{p.summary}</span> : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
