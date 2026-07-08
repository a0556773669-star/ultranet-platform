import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireModuleAccess } from "@/lib/perms";
import { getLabelSettingsAction } from "./actions";
import LabelPrintClient from "./label-print-client";

export default async function LabelsPage() {
  await requireModuleAccess("rentals");
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.role === "owner";
  const settings = await getLabelSettingsAction();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <Link href="/dashboard/rentals" className="text-sm font-semibold text-teal-dark hover:underline">
          {"→ חזרה להשכרות"}
        </Link>
        {isOwner && (
          <Link href="/dashboard/rentals/labels/settings" className="text-sm font-semibold text-teal-dark hover:underline">
            {"⚙️ הגדרות מדבקות"}
          </Link>
        )}
      </div>
      <LabelPrintClient
        widthMm={settings.widthMm}
        heightMm={settings.heightMm}
        wifiName={settings.wifiName}
        wifiCode={settings.wifiCode}
      />
    </div>
  );
}
