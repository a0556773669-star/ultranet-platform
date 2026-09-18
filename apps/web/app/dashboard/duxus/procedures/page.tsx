import Link from "next/link";
import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { listProcedures } from "../actions";
import { DuxusTabs } from "../duxus-tabs";
import { ProceduresClient } from "./procedures-client";

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
          href="/dashboard/duxus/procedures/new"
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          {"+ נוהל חדש"}
        </Link>
      </div>

      <DuxusTabs />
      <ProceduresClient procedures={procedures} />
    </div>
  );
}
