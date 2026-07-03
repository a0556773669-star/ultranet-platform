import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
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
      <h1 className="mb-6 text-2xl font-bold text-gray-800">סניף חדש</h1>
      <BranchForm action={createBranchAction} />
    </div>
  );
}
