"use client";

import { useState } from "react";

type Props = {
  currentName?: string;
};

const MAX_BYTES = 700_000; // stay safely under Firestore's 1MB per-document limit

export function AttachmentField({ currentName }: Props) {
  const [dataUrl, setDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`הקובץ גדול מדי (מעל א-${Math.round(MAX_BYTES / 1000)}KB). אפשר להקטין או להמיר את הקובץ.`);
      e.target.value = "";
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setDataUrl(String(reader.result));
      setFileName(file.name);
      setRemove(false);
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-2">
      <input type="hidden" name="attachmentDataUrl" value={dataUrl} />
      <input type="hidden" name="attachmentName" value={fileName} />
      {remove && <input type="hidden" name="removeAttachment" value="1" />}
      {currentName && !fileName && !remove && (
        <div className="flex items-center justify-between rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-xs">
          <span>קובץ מצורף כרגע: {currentName}</span>
          <button type="button" onClick={() => setRemove(true)} className="text-red-600 hover:underline">
            הסר
          </button>
        </div>
      )}
      {fileName && <p className="text-xs text-teal">נבחר: {fileName}</p>}
      <input
        type="file"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFile}
        className="w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-xs"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <p className="text-[11px] text-muted">PDF או Word עד כ-{Math.round(MAX_BYTES / 1000)}KB — יוצג בהדרכה עם אפשרות הורדה/הדפסה.</p>
    </div>
  );
}
