import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { CoworkingTabs } from "../../coworking-tabs";
import { CoworkingBranchForm } from "../coworking-branch-form";
import { createCoworkingBranchAction } from "../actions";

export default async function NewCoworkingBranchPage() {
  const session = await requireModuleAccess("coworking");
  if (session.user?.role !== "owner") redirect("/dashboard/coworking");

  return (
    <div className="max-w-2xl">
      <CoworkingTabs active="/dashboard/coworking/branches" />
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Building2 className="h-5 w-5" />
        סניף משרד שיתופי חדש
      </h1>
      <CoworkingBranchForm action={createCoworkingBranchAction} />
    </div>
  );
}
