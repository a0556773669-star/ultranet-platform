import { Laptop } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch } from "@ultranet/shared-types";
import { LaptopForm } from "../laptop-form";
import { createLaptopAction } from "../actions";

export default async function NewLaptopPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const session = await requireModuleAccess("rentals");
  const isOwner = session.user?.role === "owner";
  const db = getAdminFirestore();
  const branchesSnap = isOwner
    ? await db.collection("n_branches").where("branchType", "==", "rentals").get()
    : null;
  const branches = branchesSnap ? branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch) : [];

  return (
    <div className="max-w-xl">
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        {"מחשב חדש"}
        <Laptop className="h-4 w-4" />
      </h1>
      {searchParams?.error === "missing" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          חובה לבחור סניף ולמלא שם מחשב לפני השמירה.
        </div>
      )}
      {searchParams?.error === "no-branch" && (
        <div className="mb-4 rounded-card border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
          לחשבון שלך לא משוייך סניף. פנה לבעלים כדי שישייך לך סניף בעמוד המשתמשים.
        </div>
      )}
      <LaptopForm action={createLaptopAction} branches={branches} isOwner={isOwner} />
    </div>
  );
}
