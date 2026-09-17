import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../duxus-tabs";
import { getTaskSettings } from "../rocks/actions";
import { SettingsClient } from "./settings-client";

export default async function DuxusSettingsPage() {
  await requireModuleAccess("duxus");
  const settings = await getTaskSettings();

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <SettingsClient settings={settings} />
    </div>
  );
}
