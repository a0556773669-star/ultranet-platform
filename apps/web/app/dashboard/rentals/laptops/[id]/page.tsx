import { notFound } from "next/navigation";
import { Laptop as LaptopIcon } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import type { Branch, Laptop, Stick } from "@ultranet/shared-types";
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
  const branches = branchesSnap ? branchesSnap.docs.map((d) => ({ ...(d.data() as Omit<Branch, "id">), id: d.id }) as Branch) : [];

  const linkedStickSnap = laptop.hasStick
    ? await db.collection("n_sticks").where("linkedLaptopId", "==", laptop.id).limit(1).get()
    : null;
  const initialStick = linkedStickSnap && !linkedStickSnap.empty
    ? (linkedStickSnap.docs[0]!.data() as Omit<Stick, "id">)
    : undefined;

  return (
    <div className="max-w-xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <LaptopIcon className="h-4 w-4" />
          {`עריכת מחשב – ${laptop.name}`}
        </h1>
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
      <LaptopForm
        action={updateLaptopAction.bind(null, laptop.id)}
        branches={branches}
        isOwner={isOwner}
        initial={laptop}
        initialStick={initialStick}
      />
    </div>
  );
}
