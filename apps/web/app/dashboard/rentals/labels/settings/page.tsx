import Link from "next/link";
import { requireOwner } from "@/lib/perms";
import { getLabelSettingsAction, updateLabelSettingsAction } from "../actions";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

export default async function LabelSettingsPage() {
  await requireOwner();
  const settings = await getLabelSettingsAction();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold text-ink">{"הגדרות מדבקות"}</h1>
        <Link href="/dashboard/rentals/labels" className="text-sm font-semibold text-teal-dark hover:underline">
          {"→ להדפסת מדבקות"}
        </Link>
      </div>
      <form action={updateLabelSettingsAction} className="card flex max-w-md flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {"רוחב מדבקה (מ\"מ)"}
          <input type="number" name="widthMm" min={10} defaultValue={settings.widthMm} required className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {"גובה מדבקה (מ\"מ)"}
          <input type="number" name="heightMm" min={10} defaultValue={settings.heightMm} required className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {"טקסט WIFI (מדבקת סטיק)"}
          <input name="wifiName" defaultValue={settings.wifiName} className={FIELD} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {"קוד (מדבקת סטיק)"}
          <input name="wifiCode" defaultValue={settings.wifiCode} className={FIELD} />
        </label>
        <button
          type="submit"
          className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
        >
          {"שמירה"}
        </button>
      </form>
    </div>
  );
}
