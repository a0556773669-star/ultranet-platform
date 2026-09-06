import type { CollectionRoute } from "@ultranet/shared-types";

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export function RouteForm({
  action,
  submitLabel,
  initial,
}: {
  action: (formData: FormData) => void;
  submitLabel: string;
  initial?: CollectionRoute;
}) {
  return (
    <form
      action={action}
      className="grid grid-cols-1 gap-4 sm:grid-cols-2"
    >
      <div>
        <label className={LABEL}>שם המסלול</label>
        <input name="name" required defaultValue={initial?.name} className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>ספק</label>
        <select name="provider" defaultValue={initial?.provider ?? "manual"} className={FIELD}>
          <option value="manual">ידני</option>
          <option value="nedarim_plus">Nedarim Plus</option>
          <option value="tranzila">Tranzila</option>
          <option value="cardcom">Cardcom</option>
        </select>
      </div>
      <div>
        <label className={LABEL}>מספר מוסד (Mosad ID / Terminal ID)</label>
        <input name="terminalId" dir="ltr" defaultValue={initial?.terminalId} className={FIELD} />
        <p className="mt-1 text-[11px] text-muted">
          בנדרים פלוס: המספר שמזהה את המוסד שלך אצלם.
        </p>
        <p className="mt-1 text-[11px] text-amber-700">
          &quot;ברירת מחדל לכרטיסים/חיובים חדשים&quot; קובעת לאיזה עסק ישויכו כרטיסים חדשים
          שיישמרו ללקוחות השכרות (ולחיובים חד-פעמיים ללא כרטיס שמור). כרטיסים שכבר נשמרו ממשיכים
          להיגבות דרך המסלול המקורי שלהם - לא ניתן להעביר טוקן קיים בין עסקים.
        </p>
      </div>
      <div>
        <label className={LABEL}>מזהה סניף (ריק למסלול של כל הסניפים)</label>
        <input
          name="branchScope"
          placeholder="ריק לכל הסניפים"
          defaultValue={initial?.branchScope ?? ""}
          className={FIELD}
        />
      </div>
      <div>
        <label className={LABEL}>מטבע</label>
        <input name="currency" defaultValue={initial?.currency ?? "ILS"} dir="ltr" className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>אחוז עמלה (%)</label>
        <input
          name="feePct"
          type="number"
          min={0}
          step="0.01"
          defaultValue={initial?.feePct}
          className={FIELD}
        />
      </div>
      <div>
        <label className={LABEL}>עמלה קבועה לעסקה</label>
        <input
          name="feeFixed"
          type="number"
          min={0}
          step="0.01"
          defaultValue={initial?.feeFixed}
          className={FIELD}
        />
      </div>
      <div>
        <label className={LABEL}>יעד הפקדה</label>
        <select name="depositsTo" defaultValue={initial?.depositsTo ?? "owner"} className={FIELD}>
          <option value="owner">בעלים</option>
          <option value="branch">סניף</option>
        </select>
      </div>
      <div className="flex items-end">
        <label className="flex items-center gap-2 text-xs font-semibold text-muted">
          <input
            type="checkbox"
            name="defaultForNewCards"
            defaultChecked={initial?.defaultForNewCards ?? false}
            className="h-4 w-4 rounded border-card-border"
          />
          ברירת מחדל לכרטיסים/חיובים חדשים
        </label>
      </div>
      <div>
        <label className={LABEL}>API Key / טוקן ApiValid (לא חובה)</label>
        <input name="apiKey" type="password" dir="ltr" autoComplete="off" className={FIELD} />
        <p className="mt-1 text-[11px] text-muted">
          בנדרים פלוס: כאן מכניסים את טוקן ה-ApiValid (מבקשים אותו במפורש משירות הלקוחות שלהם).
          {initial?.apiKey && " יש כבר מפתח שמור - השאירו ריק כדי לא לשנות אותו."}
        </p>
      </div>
      <div>
        <label className={LABEL}>API Secret (לא חובה)</label>
        <input name="apiSecret" type="password" dir="ltr" autoComplete="off" className={FIELD} />
        {initial?.apiSecret && (
          <p className="mt-1 text-[11px] text-muted">יש כבר סוד שמור - השאירו ריק כדי לא לשנות אותו.</p>
        )}
      </div>
      <div className="sm:col-span-2">
        <label className={LABEL}>הפקת קבלות</label>
        <select name="receiptsProvider" className={FIELD} defaultValue={initial?.receiptsProvider ?? "none"}>
          <option value="none">ללא הפקת קבלות</option>
          <option value="ezcount">EZcount</option>
          <option value="icount">iCount</option>
          <option value="green_invoice">חשבונית ירוקה</option>
        </select>
      </div>
      <div>
        <label className={LABEL}>
          מייל החשבון אצל ספק הקבלות <span dir="ltr">(developer_email)</span>
        </label>
        <input
          name="receiptsCompanyId"
          type="email"
          dir="ltr"
          placeholder="you@example.com"
          defaultValue={initial?.receiptsCompanyId}
          className={FIELD}
        />
        <p className="mt-1 text-[11px] text-muted">
          ב-EZcount זו פשוט <b>כתובת המייל שאיתה נכנסים לחשבון</b> — אין שדה נפרד בשם הזה
          במסך ה-API שלהם, הם רק קוראים לה <span dir="ltr">developer_email</span> ב-API.
        </p>
      </div>
      <div>
        <label className={LABEL}>API Key לקבלות (לא חובה)</label>
        <input name="receiptsApiKey" type="password" dir="ltr" autoComplete="off" className={FIELD} />
        <p className="mt-1 text-[11px] text-muted">
          ב-EZcount: מפתח ה-API מהעמוד הגדרות ← API בחשבון שלכם ב-ezcount.co.il.
          {initial?.receiptsApiKey && " יש כבר מפתח שמור - השאירו ריק כדי לא לשנות אותו."}
        </p>
      </div>
      <div>
        <label className={LABEL}>API Secret לקבלות (לא חובה)</label>
        <input name="receiptsApiSecret" type="password" dir="ltr" autoComplete="off" className={FIELD} />
        {initial?.receiptsApiSecret && (
          <p className="mt-1 text-[11px] text-muted">יש כבר סוד שמור - השאירו ריק כדי לא לשנות אותו.</p>
        )}
      </div>
      <button
        type="submit"
        className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 sm:col-span-2"
      >
        {submitLabel}
      </button>
    </form>
  );
}
