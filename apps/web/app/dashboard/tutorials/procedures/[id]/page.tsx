import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Paperclip } from "lucide-react";
import { getVisibleProcedure } from "../../../duxus/actions";

/**
 * צפייה בנוהל מתוך "נהלים והדרכות" — קריאה בלבד, לכל מי ש-`canViewProcedure` מתיר לו (גם בלי
 * מודול המשימות). נוהל שאין הרשאה אליו מחזיר 404 גם בקישור ישיר. העריכה נשארת במסך הנהלים.
 */
export default async function ProcedureViewPage({ params }: { params: { id: string } }) {
  const procedure = await getVisibleProcedure(params.id);
  if (!procedure) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/dashboard/tutorials" className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline">
        <ArrowRight className="h-4 w-4" />
        {"חזרה לנהלים והדרכות"}
      </Link>
      <div className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {procedure.category ? (
            <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">{procedure.category}</span>
          ) : null}
          <span className="text-[11px] text-muted">
            גרסה {procedure.version}
            {procedure.updatedAt ? ` · עודכן ${new Date(procedure.updatedAt).toLocaleDateString("he-IL")}` : ""}
          </span>
        </div>
        <h1 className="text-xl font-bold text-ink">{procedure.title}</h1>
        {procedure.summary ? <p className="text-sm text-muted">{procedure.summary}</p> : null}
        {procedure.attachmentDataUrl ? (
          <a
            href={procedure.attachmentDataUrl}
            download={procedure.attachmentName || "procedure"}
            className="flex w-fit items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9]"
          >
            <Paperclip className="h-3.5 w-3.5" />
            {procedure.attachmentName || "הורדת הקובץ"}
          </a>
        ) : null}
        <div
          className="text-[15px] leading-[1.9] text-ink [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5"
          dangerouslySetInnerHTML={{ __html: procedure.content }}
        />
      </div>
    </div>
  );
}
