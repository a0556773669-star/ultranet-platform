"use client";

import { useState } from "react";

type Props = { initialImageUrl?: string };

export default function TutorialImageField({ initialImageUrl }: Props) {
  const [preview, setPreview] = useState<string | undefined>(initialImageUrl);
  const [removeImage, setRemoveImage] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
      setRemoveImage(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-2 text-sm font-medium text-ink">
      {"תמונה להדרכה"}
      {preview && !removeImage && (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="תמונת הדרכה"
            className="h-32 w-auto max-w-full rounded border border-card-border bg-white object-contain"
          />
          <button
            type="button"
            onClick={() => setRemoveImage(true)}
            className="text-xs font-semibold text-red-600 hover:underline"
          >
            {"הסר תמונה"}
          </button>
        </div>
      )}
      <input type="file" accept="image/*" onChange={handleFile} className="text-xs" />
      <input type="hidden" name="imageDataUrl" value={removeImage ? "" : preview ?? ""} />
      <input type="hidden" name="removeImage" value={removeImage ? "1" : "0"} />
    </div>
  );
}
