"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  defaultValue?: string;
};

export function RichEditor({ name, defaultValue }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [html, setHtml] = useState(defaultValue ?? "");

  useEffect(() => {
    if (editorRef.current && defaultValue) {
      editorRef.current.innerHTML = defaultValue;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function sync() {
    setHtml(editorRef.current?.innerHTML ?? "");
  }

  function exec(cmd: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    sync();
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      editorRef.current?.focus();
      document.execCommand(
        "insertHTML",
        false,
        `<img src="${dataUrl}" style="max-width:100%;border-radius:8px;margin:10px 0;display:block;" />`
      );
      sync();
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-card-border bg-[#f4f6f9] p-2 text-xs">
        <button
          type="button"
          onClick={() => exec("bold")}
          className="rounded-md border border-card-border bg-white px-2 py-1 font-bold hover:bg-teal-bg"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          className="rounded-md border border-card-border bg-white px-2 py-1 hover:bg-teal-bg"
        >
          1. רשימה ממוספרת
        </button>
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="rounded-md border border-card-border bg-white px-2 py-1 hover:bg-teal-bg"
        >
          • רשימה
        </button>
        <label className="cursor-pointer rounded-md border border-card-border bg-white px-2 py-1 font-semibold text-teal-dark hover:bg-teal-bg">
          🖼️ הוספת תמונה בתוך הטקסט
          <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
        </label>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dir="rtl"
        onInput={sync}
        className="min-h-[260px] w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm leading-relaxed focus:border-teal focus:bg-white focus:outline-none [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5"
      />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
