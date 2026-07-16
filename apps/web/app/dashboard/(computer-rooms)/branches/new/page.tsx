import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Building2 } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { createBranchAction } from "../actions";
import { BranchForm } from "../branch-form";

export default async function NewBranchPage() {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== "owner") {
    redirect("/dashboard/branches");
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink"><Building2 className="h-5 w-5" />סניף חדש</h1>
      <BranchForm action={createBranchAction} />
    </div>
  );
}
