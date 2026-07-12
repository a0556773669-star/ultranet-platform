import { notFound } from "next/navigation";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, Laptop } from "@ultranet/shared-types";
import { LaptopForm } from "../laptop-form";
import { updateLaptopAction, deleteLaptopAction } from "../actions";
import { DeleteLaptopButton } from "../delete-button";

export default async function EditLaptopPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams?: { error?: string };
}) {
  const session = await requireModuleAccess("rentals");
  const isOwner = session.user?.role === "owner";
  const db = getAdminFirestore();
  const doc = await db.collection("n_laptops").doc(params.id).get();
  if (!doc.exists) notFound();
  const laptop = { id: doc.id, ...(doc.data() as Omit<Laptop, "id">) } as Laptop;

  if (!isOwner && laptop.branchId !== session.user?.branchId) {
    notFound();
  }

  const branchesSnap = isOwner
    ? await db.collection("n_branches").where("branchType", "==", "rentals").get()
    : null;
  const branches = branchesSnap ? branchesSnap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Branch, "id">) }) as Branch) : [];

  return (
    <div className="max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[21px] font-extrabold text-ink">💻 עריכת מחשב – {laptop.name}</h1>
        {isOwner && <DeleteLaptopButton action={deleteLaptopAction.bind(null, laptop.id)} />}
      </div>
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
      <LaptopForm action={updateLaptopAction.bind(null, laptop.id)} branches={branches} isOwner={isOwner} initial={laptop} />
    </div>
  );
}
