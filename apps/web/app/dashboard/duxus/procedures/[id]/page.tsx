import Link from "next/link";
import { ArrowRight, Paperclip, FilePlus2 } from "lucide-react";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/perms";
import { getProcedure, listProcedures, archiveProcedureAction, deleteProcedureAction } from "../../actions";
import { PROCEDURE_STATUS_LABEL } from "../procedure-form";
import DeleteButton from "./delete-button";
import PrintButton from "./print-button";

const STATUS_CLASS: Record<string, string> = {
  draft: "border-card-border bg-[#f4f6f9] text-muted",
  active: "border-emerald-300 bg-emerald-50 text-emerald-700",
  superseded: "border-amber-300 bg-amber-50 text-amber-700",
  archived: "border-card-border bg-[#f4f6f9] text-muted",
};

export default async function ProcedureDetailPage({ params }: { params: { id: string } }) {
  await requireModuleAccess("duxus");
  const [procedure, all] = await Promise.all([getProcedure(params.id), listProcedures()]);
  if (!procedure) notFound();

  // שרשרת הגרסאות: מה הנוהל הזה החליף, ומה החליף אותו. אף גרסה לא נמחקת.
  const previous = procedure.supersedesId ? all.find((p) => p.id === procedure.supersedesId) : null;
  const next = all.find((p) => p.supersedesId === procedure.id);
  const boundArchive = archiveProcedureAction.bind(null, procedure.id);
  const boundDelete = deleteProcedureAction.bind(null, procedure.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/dashboard/duxus/procedures" className="flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline">
          <ArrowRight className="h-4 w-4" />
          {"חזרה לנהלים"}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <PrintButton />
          <Link
            href={`/dashboard/duxus/procedures/new?from=${procedure.id}`}
            className="flex items-center gap-1 rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9]"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            {"גרסה חדשה"}
          </Link>
          <Link
            href={`/dashboard/duxus/procedures/${procedure.id}/edit`}
            className="rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9]"
          >
            {"עריכה"}
          </Link>
          {procedure.status !== "archived" && (
            <form action={boundArchive}>
              <button type="submit" className="rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9]">
                {"ארכוב"}
              </button>
            </form>
          )}
          <form action={boundDelete}>
            <DeleteButton />
          </form>
        </div>
      </div>

      <div className="card flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {procedure.category ? (
            <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">{procedure.category}</span>
          ) : null}
          <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[procedure.status ?? "draft"]}`}>
            {PROCEDURE_STATUS_LABEL[procedure.status ?? "draft"]}
          </span>
          <span className="text-[11px] text-muted">
            גרסה {procedure.version}
            {procedure.ownerName ? ` · ${procedure.ownerName}` : ""}
            {procedure.updatedAt ? ` · עודכן ${new Date(procedure.updatedAt).toLocaleDateString("he-IL")}` : ""}
          </span>
        </div>

        <h1 className="text-xl font-bold text-ink">{procedure.title}</h1>
        {procedure.summary ? <p className="text-sm text-muted">{procedure.summary}</p> : null}

        {(previous || next) && (
          <div className="flex flex-wrap gap-3 rounded-lg border border-card-border bg-[#f9fafb] px-3 py-2 text-xs print:hidden">
            {previous ? (
              <Link href={`/dashboard/duxus/procedures/${previous.id}`} className="text-teal hover:underline">
                {`מחליף את גרסה ${previous.version}`}
              </Link>
            ) : null}
            {next ? (
              <Link href={`/dashboard/duxus/procedures/${next.id}`} className="text-amber-700 hover:underline">
                {`הוחלף על ידי גרסה ${next.version}`}
              </Link>
            ) : null}
          </div>
        )}

        {procedure.attachmentDataUrl ? (
          <a
            href={procedure.attachmentDataUrl}
            download={procedure.attachmentName || "procedure"}
            className="flex w-fit items-center gap-1.5 rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9] print:hidden"
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
