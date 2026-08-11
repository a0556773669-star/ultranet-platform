import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/perms";
import { getProcedure, updateProcedureAction } from "../../actions";
import { RichEditor } from "../../rich-editor";

export default async function EditProcedurePage({ params }: { params: { id: string } }) {
  await requireModuleAccess("duxus");
  const procedure = await getProcedure(params.id);
  if (!procedure) notFound();

  const boundUpdate = updateProcedureAction.bind(null, procedure.id);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">{"עריכת נוהל"}</h1>
      <form action={boundUpdate} className="card flex max-w-xl flex-col gap-4">
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{"כותרת"}</label>
          <input
            type="text"
            name="title"
            required
            defaultValue={procedure.title}
            className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{"קטגוריה (רשות)"}</label>
          <input
            type="text"
            name="category"
            defaultValue={procedure.category}
            placeholder="למשל: גבייה, השכרות, סניפים"
            className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold text-muted">{"תוכן הנוהל"}</label>
          <RichEditor name="content" defaultValue={procedure.content} />
        </div>
        <button
          type="submit"
          className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          {"עדכון"}
        </button>
      </form>
    </div>
  );
}
