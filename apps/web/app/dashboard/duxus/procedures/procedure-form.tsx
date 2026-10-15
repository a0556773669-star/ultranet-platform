"use client";

import { useState } from "react";
import type { Procedure, ProcedureStatus } from "@ultranet/shared-types";
import { RichEditor } from "../rich-editor";
import { ROCK_OWNERS } from "../rocks/owners";
import { AUDIENCE_LABEL } from "@/lib/procedure-audience";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

const MAX_BYTES = 700_000; // מתחת למגבלת 1MB של מסמך Firestore

export const PROCEDURE_STATUS_LABEL: Record<ProcedureStatus, string> = {
  draft: "טיוטה",
  active: "בתוקף",
  superseded: "הוחלף",
  archived: "בארכיון",
};

/** קובץ הנוהל נשמר כ-data URL בתוך המסמך - אותו דגם שכבר עובד בקבצי ההדרכות. */
function AttachmentField({ currentName }: { currentName?: string }) {
  const [dataUrl, setDataUrl] = useState("");
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setError(null);
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setError(`הקובץ גדול מדי (מעל ${Math.round(MAX_BYTES / 1000)}KB). אפשר להקטין או להמיר אותו.`);
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
      <p className="text-[11px] text-muted">PDF או Word עד כ-{Math.round(MAX_BYTES / 1000)}KB.</p>
    </div>
  );
}

/**
 * טופס הנוהל - משותף ליצירה, לעריכה ול"העלאת גרסה חדשה" (סעיף 12).
 * `supersedesId` מסמן שזו גרסה חדשה של נוהל קיים; הגרסה הקודמת תסומן "הוחלף"
 * ולא תימחק.
 */
export function ProcedureForm({
  action,
  procedure,
  supersedes,
  submitLabel,
  categories,
  users,
}: {
  action: (formData: FormData) => void;
  procedure?: Procedure;
  supersedes?: Procedure;
  submitLabel: string;
  categories: string[];
  /** לבחירת "משתמשים נבחרים" ב"מי רשאי לצפות". */
  users: { email: string; name: string }[];
}) {
  const base = supersedes ?? procedure;
  // נוהל קיים בלי `audience` = ההרשאה הוותיקה ("duxus"), ולכן זו ברירת המחדל בעריכה שלו; נוהל
  // חדש — הנהלה בלבד (סעיף 12).
  const [audienceMode, setAudienceMode] = useState<string>(base ? (base.audience?.mode ?? "duxus") : "owner");
  const [audienceEmails, setAudienceEmails] = useState<string[]>(base?.audience?.userEmails ?? []);

  return (
    <form action={action} className="card flex max-w-2xl flex-col gap-4">
      {supersedes ? <input type="hidden" name="supersedesId" value={supersedes.id} /> : null}

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted">כותרת</label>
        <input type="text" name="title" required defaultValue={base?.title} className={FIELD} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted">תיאור קצר (רשות)</label>
        <input type="text" name="summary" defaultValue={base?.summary} placeholder="מה הנוהל הזה פותר, במשפט" className={FIELD} />
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-semibold text-muted">קטגוריה</label>
          <input
            type="text"
            name="category"
            list="procedure-categories"
            defaultValue={base?.category}
            placeholder="סניפים, השכרות, גבייה, שירות, מלאי, מרכזייה"
            className={FIELD}
          />
          <datalist id="procedure-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div className="w-[110px]">
          <label className="mb-1 block text-xs font-semibold text-muted">גרסה</label>
          <input
            type="text"
            name="version"
            defaultValue={supersedes ? "" : base?.version}
            placeholder={supersedes ? `אחרי ${supersedes.version}` : "1"}
            className={FIELD}
          />
        </div>
        <div className="w-[130px]">
          <label className="mb-1 block text-xs font-semibold text-muted">מצב</label>
          <select name="status" defaultValue={supersedes ? "draft" : (base?.status ?? "draft")} className={FIELD}>
            {(Object.keys(PROCEDURE_STATUS_LABEL) as ProcedureStatus[]).map((s) => (
              <option key={s} value={s}>
                {PROCEDURE_STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-[130px]">
          <label className="mb-1 block text-xs font-semibold text-muted">אחראי</label>
          <select name="ownerName" defaultValue={base?.ownerName ?? ""} className={FIELD}>
            <option value="">ללא</option>
            {ROCK_OWNERS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
            {base?.ownerName && !ROCK_OWNERS.includes(base.ownerName as (typeof ROCK_OWNERS)[number]) && (
              <option value={base.ownerName}>{base.ownerName}</option>
            )}
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted">מי רשאי לצפות</label>
        <select
          name="audienceMode"
          value={audienceMode}
          onChange={(e) => setAudienceMode(e.target.value)}
          className={FIELD}
        >
          {(Object.keys(AUDIENCE_LABEL) as (keyof typeof AUDIENCE_LABEL)[]).map((m) => (
            <option key={m} value={m}>
              {AUDIENCE_LABEL[m]}
            </option>
          ))}
        </select>
        {audienceMode === "users" && (
          <div className="mt-2 grid max-h-48 grid-cols-1 gap-1 overflow-y-auto rounded-lg border border-card-border p-2 sm:grid-cols-2">
            {users.map((u) => (
              <label key={u.email} className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  name="audienceEmails"
                  value={u.email}
                  checked={audienceEmails.includes(u.email)}
                  onChange={(e) =>
                    setAudienceEmails((prev) => (e.target.checked ? [...prev, u.email] : prev.filter((x) => x !== u.email)))
                  }
                />
                {u.name || u.email}
              </label>
            ))}
          </div>
        )}
        <p className="mt-1 text-[11px] text-muted">נוהל נפתח לאנשים נוספים רק כשמשנים כאן במפורש.</p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted">קובץ הנוהל (רשות)</label>
        <AttachmentField currentName={procedure?.attachmentName} />
      </div>

      <div>
        <label className="mb-1 block text-xs font-semibold text-muted">תוכן הנוהל</label>
        <RichEditor name="content" defaultValue={base?.content} />
      </div>

      <button
        type="submit"
        className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        {submitLabel}
      </button>
    </form>
  );
}
