import { ShoppingBag } from "lucide-react";
import { currentModuleScope, requireModuleAccess } from "@/lib/perms";
import { getAdminFirestore } from "@/lib/firebase-admin";
import { StoreTabs } from "../store-tabs";
import { advisorConfigured } from "@/lib/store-advisor";
import { RequestWizard } from "./request-wizard";
import { ChatAdvisor } from "./chat-advisor";

/** פעולות ה-AI (שיחה/חיפוש ברשת) יכולות לעבור 10 שניות - ללא זה Vercel חותך אותן. */
export const maxDuration = 60;

export default async function NewStoreRequestPage({
  searchParams,
}: {
  searchParams: { form?: string };
}) {
  await requireModuleAccess("store");
  const scope = await currentModuleScope("store");
  // הסניף נקבע אוטומטית לפי המשתמש; כאן רק התווית שמוצגת בכותרת הצ'אט
  let branchLabel = "הנהלה";
  if (scope && !scope.isOwner) {
    const id = scope.branchId ?? scope.branchIds[0];
    const doc = id
      ? await getAdminFirestore().collection("n_branches").doc(id).get()
      : null;
    branchLabel = id
      ? String((doc?.data() as { name?: string } | undefined)?.name ?? "") ||
        "סניף"
      : "ללא סניף משויך";
  }

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <ShoppingBag className="h-5 w-5" />
        התאמת מחשב ללקוח
      </h1>
      <StoreTabs isOwner={Boolean(scope?.isOwner)} />
      {advisorConfigured() && searchParams.form !== "1" ? (
        <ChatAdvisor branchLabel={branchLabel} />
      ) : (
        <RequestWizard />
      )}
    </div>
  );
}
