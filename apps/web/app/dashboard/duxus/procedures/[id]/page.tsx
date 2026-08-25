import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/perms";
import { getProcedure, deleteProcedureAction } from "../../actions";
import DeleteButton from "./delete-button";
import PrintButton from "./print-button";

export default async function ProcedureDetailPage({ params }: { params: { id: string } }) {
  await requireModuleAccess("duxus");
  const procedure = await getProcedure(params.id);
  if (!procedure) notFound();

  const boundDelete = deleteProcedureAction.bind(null, procedure.id);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print:hidden">
        <Link href="/dashboard/duxus/procedures" className="flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline">
          <ArrowRight className="h-4 w-4" />
          {"חזרה לנהלים"}
        </Link>
        <div className="flex items-center gap-2">
          <PrintButton />
          <Link
            href={`/dashboard/duxus/procedures/${procedure.id}/edit`}
            className="rounded-lg border border-card-border px-3 py-2 text-xs font-semibold text-ink hover:bg-[#f4f6f9]"
          >
            {"עריכה"}
          </Link>
          <form action={boundDelete}>
            <DeleteButton />
          </form>
        </div>
      </div>

      <div className="card flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {procedure.category ? (
            <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">{procedure.category}</span>
          ) : null}
        </div>
        <h1 className="text-xl font-bold text-ink">{procedure.title}</h1>
        <div
          className="text-[15px] leading-[1.9] text-ink [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5"
          dangerouslySetInnerHTML={{ __html: procedure.content }}
        />
      </div>
    </div>
  );
}
