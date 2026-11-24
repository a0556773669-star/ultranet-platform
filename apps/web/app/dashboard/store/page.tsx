import Link from "next/link";
import { ShoppingBag, BookOpen, ArrowLeft, ChevronDown } from "lucide-react";
import { isOwnerSession, requireModuleAccess } from "@/lib/perms";
import { listVisibleProcedures } from "../duxus/actions";
import { StoreTabs } from "./store-tabs";
import { ensureStoreProcedures } from "@/lib/store-procedures-seed";

const INSTRUCTIONS: { title: string; summary: string; body: string }[] = [
  {
    title: "הוראה 1: הלקוח מגיע לסניף",
    summary: "בוחרים איך להתאים לו מחשב",
    body: "בלשונית ״התאמת מחשב ללקוח״ בוחרים: <b>לפי רצון הלקוח</b> (הוא יודע בדיוק מה הוא רוצה) או <b>לפי שאלות</b> (הוא לא יודע - המערכת שואלת ומתאימה).",
  },
  {
    title: "הוראה 2: מה שהלקוח קבע - לא משתנה",
    summary: "רק בשדות פתוחים תקבלו גם אפשרות ״טיפה יותר טוב״",
    body: "מה שהלקוח קבע בוודאות - לא משתנה. רק בשדות שהוא לא קבע תקבלו גם אפשרות ״טיפה יותר טוב״, עם הסבר במה היא טובה יותר - כדי שתוכלו להסביר ללקוח.",
  },
  {
    title: "הוראה 3: הבקשה נשלחת אלינו",
    summary: "אנחנו בודקים מלאי ומחזירים תשובה",
    body: "אנחנו בודקים מחירי שוק והתאמה אמיתית, ומחזירים לכם בלשונית ״הבקשות שלי״ טווח מחיר (הערכה) ל-1 עד 3 אפשרויות.",
  },
  {
    title: "הוראה 4: המחיר הוא טווח הערכה",
    summary: "לא מחיר סופי",
    body: "המחיר בשלב הזה הוא טווח הערכה, לא מחיר סופי. אין לנו מלאי; ההזמנה מתבצעת מיבואן, מגיעה לסניף, ואתם מכינים את המחשב ללקוח לפי הנהלים שלמטה. בהמשך, כשיהיה מלאי, יופיעו מחירים קבועים.",
  },
];

export default async function StoreHomePage() {
  const session = await requireModuleAccess("store");
  const isOwner = isOwnerSession(session);
  // נהלי החנות נטענים אוטומטית בפעם הראשונה; נערכים אחר כך במסך הנהלים (הרשאת צפייה "סניפים עם חנות סניפים").
  await ensureStoreProcedures().catch(() => {});
  const all = await listVisibleProcedures();
  const procedures = all
    .filter(
      (p) =>
        p.audience?.mode === "store" &&
        p.status !== "archived" &&
        p.status !== "draft",
    )
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        a.title.localeCompare(b.title, "he", { numeric: true }),
    );

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <ShoppingBag className="h-5 w-5" />
        חנות סניפים
      </h1>
      <StoreTabs isOwner={isOwner} />

      <Link
        href="/dashboard/store/new"
        className="mb-5 inline-flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        התחלת התאמה ללקוח
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <div className="mb-2 flex items-center gap-1.5 text-base font-bold text-ink">
        <BookOpen className="h-4 w-4" />
        נהלים והוראות
      </div>
      <p className="mb-3 text-sm text-muted">
        לחצו על שורה כדי לפתוח אותה, ולחיצה נוספת סוגרת.
      </p>
      <div className="flex flex-col gap-3">
        {INSTRUCTIONS.map((i) => (
          <details key={i.title} className="group card !p-0 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-bold text-ink hover:bg-[#f4f6f9]">
              <span>
                {i.title}
                <span className="mt-0.5 block text-sm font-normal text-muted">
                  {i.summary}
                </span>
              </span>
              <ChevronDown className="h-5 w-5 shrink-0 text-muted transition group-open:rotate-180" />
            </summary>
            <div
              className="border-t border-card-border px-5 py-5 text-base leading-loose text-ink"
              dangerouslySetInnerHTML={{ __html: i.body }}
            />
          </details>
        ))}
        {!procedures.length ? (
          <div className="card text-sm text-muted">עדיין לא פורסמו נהלים.</div>
        ) : null}
        {procedures.map((p) => (
          <details key={p.id} className="group card !p-0 overflow-hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-base font-bold text-ink hover:bg-[#f4f6f9]">
              <span>
                {p.title}
                {p.summary ? (
                  <span className="mt-0.5 block text-sm font-normal text-muted">
                    {p.summary}
                  </span>
                ) : null}
              </span>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
            </summary>
            <div
              className="border-t border-card-border px-5 py-5 text-base leading-loose text-ink [&_h4]:mb-1 [&_h4]:mt-3 [&_h4]:font-bold [&_li]:mb-1 [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5"
              dangerouslySetInnerHTML={{ __html: p.content }}
            />
          </details>
        ))}
      </div>
    </div>
  );
}
