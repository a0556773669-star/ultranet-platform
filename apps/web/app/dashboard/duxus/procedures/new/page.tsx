import { requireModuleAccess } from "@/lib/perms";
import { createProcedureAction, getProcedure, listProcedures } from "../../actions";
import { ProcedureForm } from "../procedure-form";

/**
 * נוהל חדש, או **גרסה חדשה** של נוהל קיים (`?from=<id>`). בגרסה חדשה השדות מגיעים
 * מלאים מהנוהל הקודם, והוא יסומן "הוחלף" בשמירה - בלי שיימחק (סעיף 12).
 */
export default async function NewProcedurePage({ searchParams }: { searchParams: { from?: string } }) {
  await requireModuleAccess("duxus");
  const [supersedes, all] = await Promise.all([
    searchParams.from ? getProcedure(searchParams.from) : Promise.resolve(null),
    listProcedures(),
  ]);
  const categories = Array.from(new Set(all.map((p) => p.category ?? "").filter(Boolean)));

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold text-ink">
        {supersedes ? `גרסה חדשה של "${supersedes.title}"` : "נוהל חדש"}
      </h1>
      <ProcedureForm
        action={createProcedureAction}
        supersedes={supersedes ?? undefined}
        submitLabel="שמירה"
        categories={categories}
      />
    </div>
  );
}
