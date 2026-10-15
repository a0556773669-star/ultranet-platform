import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/perms";
import { getProcedure, listProcedures, updateProcedureAction } from "../../../actions";
import { ProcedureForm } from "../../procedure-form";
import { loadUsersForAudience } from "@/lib/procedure-users";

export default async function EditProcedurePage({ params }: { params: { id: string } }) {
  await requireModuleAccess("duxus");
  const [procedure, all] = await Promise.all([getProcedure(params.id), listProcedures()]);
  if (!procedure) notFound();
  const users = await loadUsersForAudience();
  const categories = Array.from(new Set(all.map((p) => p.category ?? "").filter(Boolean)));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">עריכת נוהל</h1>
      <ProcedureForm
        action={updateProcedureAction.bind(null, procedure.id)}
        procedure={procedure}
        submitLabel="עדכון"
        categories={categories}
        users={users}
      />
    </div>
  );
}
