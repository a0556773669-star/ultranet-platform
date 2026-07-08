import Link from "next/link";
import { requireOwner } from "@/lib/perms";
import { getLabelSettingsAction, updateLabelSettingsAction } from "../actions";
import LogoField from "./logo-field";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

const FONT_OPTIONS = [
  { value: "var(--font-heebo), Heebo, sans-serif", label: "ברירת מחדל (Heebo)" },
  { value: "Arial, sans-serif", label: "Arial" },
  { value: "'Times New Roman', serif", label: "Times New Roman" },
  { value: "'Courier New', monospace", label: "Courier New" },
  { value: "Georgia, serif", label: "Georgia" },
];

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
      <form action={updateLabelSettingsAction} className="card flex max-w-md flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-lg border border-card-border p-3">
          <h2 className="text-sm font-extrabold text-ink">{"💻 מדבקת מחשב"}</h2>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"רוחב (מ\"מ)"}
            <input type="number" name="computerWidthMm" min={10} defaultValue={settings.computerWidthMm} required className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"גובה (מ\"מ)"}
            <input type="number" name="computerHeightMm" min={10} defaultValue={settings.computerHeightMm} required className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"גודל מלל (pt)"}
            <input type="number" name="computerFontSizePt" min={6} max={72} defaultValue={settings.computerFontSizePt} required className={FIELD} />
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-card-border p-3">
          <h2 className="text-sm font-extrabold text-ink">{"🔌 מדבקת סטיק"}</h2>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"רוחב (מ\"מ)"}
            <input type="number" name="stickWidthMm" min={10} defaultValue={settings.stickWidthMm} required className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"גובה (מ\"מ)"}
            <input type="number" name="stickHeightMm" min={10} defaultValue={settings.stickHeightMm} required className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"גודל מלל מספר סטיק (pt)"}
            <input type="number" name="stickFontSizePt" min={6} max={72} defaultValue={settings.stickFontSizePt} required className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"גודל מלל שורת WIFI/קוד (pt)"}
            <input type="number" name="infoFontSizePt" min={4} max={40} defaultValue={settings.infoFontSizePt} required className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"טקסט WIFI"}
            <input name="wifiName" defaultValue={settings.wifiName} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"קוד"}
            <input name="wifiCode" defaultValue={settings.wifiCode} className={FIELD} />
          </label>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-card-border p-3">
          <h2 className="text-sm font-extrabold text-ink">{"🎨 עיצוב"}</h2>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"גופן"}
            <select name="fontFamily" defaultValue={settings.fontFamily} className={FIELD}>
              {FONT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-medium text-ink">
            {"צבע טקסט"}
            <input type="color" name="textColor" defaultValue={settings.textColor} className="h-10 w-16 cursor-pointer rounded-lg border border-card-border bg-[#f4f6f9] p-1" />
          </label>
          <LogoField initialLogoUrl={settings.logoUrl} />
        </div>

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
