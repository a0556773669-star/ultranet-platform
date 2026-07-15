import Link from "next/link";
import { ArrowRight, Settings } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/perms";
import { getLabelSettingsAction } from "./actions";
import LabelPrintClient from "./label-print-client";
import { getAdminFirestore } from "@/lib/firebase-admin";

export default async function LabelsPage() {
  await requireModuleAccess("rentals");
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.role === "owner";
  const branchId = session?.user?.branchId;
  let myComputers: { id: string; name: string }[] = [];
  if (!isOwner && branchId) {
    const snap = await getAdminFirestore().collection("n_laptops").where("branchId", "==", branchId).get();
    myComputers = snap.docs
      .map((d) => ({ id: d.id, name: String((d.data() as { name?: string }).name ?? "") }))
      .filter((c) => c.name)
      .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  }
  const settings = await getLabelSettingsAction();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/rentals" className="flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:underline">
          <ArrowRight className="h-4 w-4" />
          {"חזרה להשכרות"}
        </Link>
        {isOwner && (
          <Link href="/dashboard/rentals/labels/settings" className="flex items-center gap-1.5 text-sm font-semibold text-teal-dark hover:underline">
            <Settings className="h-4 w-4" />
            {"הגדרות מדבקות"}
          </Link>
        )}
      </div>
      <LabelPrintClient
        computerWidthMm={settings.computerWidthMm}
        computerHeightMm={settings.computerHeightMm}
        stickWidthMm={settings.stickWidthMm}
        stickHeightMm={settings.stickHeightMm}
        computerFontSizePt={settings.computerFontSizePt}
        stickFontSizePt={settings.stickFontSizePt}
        infoFontSizePt={settings.infoFontSizePt}
        fontFamily={settings.fontFamily}
        textColor={settings.textColor}
        wifiName={settings.wifiName}
        wifiCode={settings.wifiCode}
        logoUrl={settings.logoUrl}
        myComputers={myComputers}
      />
    </div>
  );
}
