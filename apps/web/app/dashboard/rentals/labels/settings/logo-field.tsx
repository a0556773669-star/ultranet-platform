"use client";

import { useState } from "react";

type Props = { initialLogoUrl?: string };

export default function LogoField({ initialLogoUrl }: Props) {
  const [preview, setPreview] = useState<string | undefined>(initialLogoUrl);
  const [removeLogo, setRemoveLogo] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setRemoveLogo(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-ink">
      {"לוגו (תמונה)"}
      {preview && !removeLogo && (
        <div className="flex items-center gap-3">
          <img
            src={preview}
            alt="לוגו"
            className="h-16 w-16 rounded border border-card-border bg-white object-contain"
          />
          <button
            type="button"
            onClick={() => setRemoveLogo(true)}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            {"הסרת לוגו"}
          </button>
        </div>
      )}
      <input type="file" accept="image/*" onChange={handleFile} className="text-xs" />
      <input type="hidden" name="logoDataUrl" value={removeLogo ? "" : preview ?? ""} />
      <input type="hidden" name="removeLogo" value={removeLogo ? "1" : "0"} />
      <p className="text-xs text-muted">{"אם לא תעלה תמונה חדשה, הלוגו הקיים יישמר."}</p>
    </div>
  );
}
