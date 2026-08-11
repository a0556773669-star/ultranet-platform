import Link from "next/link";
import { NotebookText, Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { listProcedures } from "./actions";
import { DuxusTabs } from "./duxus-tabs";

export default async function DuxusProceduresPage() {
  await requireModuleAccess("duxus");
  const procedures = await listProcedures();

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Target className="h-5 w-5" />
          משימות ונהלים
        </h1>
        <Link
          href="/dashboard/duxus/new"
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          {"+ נוהל חדש"}
        </Link>
      </div>

      <DuxusTabs />

      {procedures.length === 0 ? (
        <div className="card text-sm text-muted">
          עדיין אין נהלים. לחצו על &quot;נוהל חדש&quot; כדי לכתוב נוהל ברור ראשון - למשל נוהל גבייה, ניהול השכרות או קליטת סניף חדש.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {procedures.map((p) => (
            <Link
              key={p.id}
              href={`/dashboard/duxus/${p.id}`}
              className="card flex flex-col gap-2 transition hover:shadow-lg"
            >
              <div className="flex items-center gap-2 text-teal">
                <NotebookText className="h-5 w-5" />
                {p.category ? (
                  <span className="rounded-full bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">{p.category}</span>
                ) : null}
              </div>
              <div className="text-sm font-bold text-ink">{p.title}</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
