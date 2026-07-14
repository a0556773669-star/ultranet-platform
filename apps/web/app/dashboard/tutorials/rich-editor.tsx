"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  name: string;
  defaultValue?: string;
};

function exec(command: string, value?: string) {
  document.execCommand(command, false, value);
}

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
    if (editorRef.current) setHtml(editorRef.current.innerHTML);
  }

  function handleImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    insertImageFile(file);
    e.target.value = "";
  }

  function insertImageFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      editorRef.current?.focus();
      exec("insertHTML", `<img src="${reader.result}" />`);
      sync();
    };
    reader.readAsDataURL(file);
  }

  function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    const items = e.clipboardData?.items;
    if (!items) return;

    // If the clipboard has real image files (e.g. copied from Word/an image), embed them.
    const imageItem = [...items].find((it) => it.kind === "file" && it.type.startsWith("image/"));
    const html2 = e.clipboardData.getData("text/html");

    if (imageItem && !html2) {
      e.preventDefault();
      const file = imageItem.getAsFile();
      if (file) insertImageFile(file);
      return;
    }

    if (html2) {
      // Word/Office paste: sanitize the pasted HTML (strip scripts/styles-only cruft) but keep
      // basic formatting, lists and inline images (Word usually embeds images as data: URIs already
      // when pasted into a contentEditable area).
      e.preventDefault();
      const cleaned = sanitizePastedHtml(html2);
      exec("insertHTML", cleaned);
      sync();
      return;
    }
    // Otherwise let the browser paste plain text normally.
    setTimeout(sync, 0);
  }

  function sanitizePastedHtml(dirty: string): string {
    const container = document.createElement("div");
    container.innerHTML = dirty;
    container.querySelectorAll("script,style,meta,link,o:p").forEach((el) => el.remove());
    // Strip Word's inline mso- styles/classes and empty class attrs but keep bold/italic/lists/images.
    container.querySelectorAll("*").forEach((el) => {
      el.removeAttribute("class");
      el.removeAttribute("lang");
      const style = el.getAttribute("style");
      if (style) {
        const kept = style
          .split(";")
          .filter((rule) => /font-weight|font-style|text-decoration/i.test(rule))
          .join(";");
        if (kept) el.setAttribute("style", kept);
        else el.removeAttribute("style");
      }
    });
    return container.innerHTML;
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
          onClick={() => exec("italic")}
          className="rounded-md border border-card-border bg-white px-2 py-1 italic hover:bg-teal-bg"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          className="rounded-md border border-card-border bg-white px-2 py-1 hover:bg-teal-bg"
        >
          1.
        </button>
        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="rounded-md border border-card-border bg-white px-2 py-1 hover:bg-teal-bg"
        >
          •
        </button>
        <label className="cursor-pointer rounded-md border border-card-border bg-white px-2 py-1 hover:bg-teal-bg">
          הוסף תמונה
          <input type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
        </label>
        <span className="text-[11px] text-muted">אפשר גם להדביק טקסט ותמונות ישירות מוורד</span>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        dir="rtl"
        onInput={sync}
        onPaste={handlePaste}
        className="font-editor min-h-[260px] w-full rounded-lg border border-card-border bg-[#f4f6f9] px-4 py-3 text-[15px] leading-[1.9] focus:border-teal focus:bg-white focus:outline-none [&_img]:max-w-full [&_img]:rounded-lg [&_ol]:list-decimal [&_ol]:pr-5 [&_ul]:list-disc [&_ul]:pr-5"
      />
      <input type="hidden" name={name} value={html} />
    </div>
  );
}
