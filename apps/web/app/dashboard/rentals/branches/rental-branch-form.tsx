"use client";

import { useState } from "react";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

type BranchModel = "classic" | "partnership" | "sub_partnership";

type Option = { id: string; name: string };

type Initial = {
  name?: string;
  location?: string;
  isMine?: boolean;
  partnerName?: string;
  partnerEmail?: string;
  myPct?: number;
  partnerPct?: number;
  parentPct?: number;
  notes?: string;
  parentBranchId?: string | null;
  collectionRouteId?: string | null;
  allowCollection?: boolean;
  allowReceipts?: boolean;
};

type RentalBranchFormProps = {
  action: (formData: FormData) => void;
  initial?: Initial;
  routes: Option[];
  parentOptions: Option[];
};

export function RentalBranchForm({ action, initial, routes, parentOptions }: RentalBranchFormProps) {
  const initialModel: BranchModel = initial?.parentBranchId
    ? "sub_partnership"
    : initial?.isMine === false
      ? "partnership"
      : "classic";

  const [model, setModel] = useState<BranchModel>(initialModel);

  return (
    <form action={action} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      <input type="hidden" name="isMine" value={model === "classic" ? "on" : "off"} />

      <div>
        <label className={LABEL}>{"שם הסניף"}</label>
        <input name="name" required defaultValue={initial?.name} className={FIELD} />
      </div>

      <div>
        <label className={LABEL}>{"סוג הסניף"}</label>
        <select value={model} onChange={(e) => setModel(e.target.value as BranchModel)} className={FIELD}>
          <option value="classic">{"🏢 קלאסי (סניף שלי)"}</option>
          <option value="partnership">{"🤝 שותפות"}</option>
          <option value="sub_partnership">{"🌿 תת שותפות"}</option>
        </select>
      </div>

      {model === "classic" && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={LABEL}>{"מיקום"}</label>
            <input name="location" defaultValue={initial?.location} className={FIELD} />
          </div>
          <div>
            <label className={LABEL}>{"מסלול גביה (אופציונלי)"}</label>
            <select name="collectionRouteId" defaultValue={initial?.collectionRouteId ?? ""} className={FIELD}>
              <option value="">{"ללא"}</option>
              {routes.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {(model === "partnership" || model === "sub_partnership") && (
        <>
          {model === "sub_partnership" && (
            <div>
              <label className={LABEL}>{"סניף אב (מי השותף הראשי)"}</label>
              <select name="parentBranchId" defaultValue={initial?.parentBranchId ?? ""} className={FIELD}>
                <option value="">{"בחר סניף אב"}</option>
                {parentOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className={model === "sub_partnership" ? "grid grid-cols-1 gap-4 sm:grid-cols-3" : "grid grid-cols-1 gap-4 sm:grid-cols-2"}>
            <div>
              <label className={LABEL}>{"שלי (%)"}</label>
              <input type="number" name="myPct" min={0} max={100} defaultValue={initial?.myPct ?? 50} className={FIELD} />
            </div>
            {model === "sub_partnership" && (
              <div>
                <label className={LABEL}>{"סניף האם (%)"}</label>
                <input type="number" name="parentPct" min={0} max={100} defaultValue={initial?.parentPct ?? 25} className={FIELD} />
              </div>
            )}
            <div>
              <label className={LABEL}>{"השותף (%)"}</label>
              <input type="number" name="partnerPct" min={0} max={100} defaultValue={initial?.partnerPct ?? 50} className={FIELD} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>{"שם השותף"}</label>
              <input name="partnerName" defaultValue={initial?.partnerName} className={FIELD} />
            </div>
            <div>
              <label className={LABEL}>{"מייל השותף (התחברות עם Google)"}</label>
              <input type="email" name="partnerEmail" defaultValue={initial?.partnerEmail} className={FIELD} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={LABEL}>{"גישה לסליקה"}</label>
              <select name="allowCollection" defaultValue={initial?.allowCollection ? "on" : "off"} className={FIELD}>
                <option value="off">{"לא"}</option>
                <option value="on">{"כן"}</option>
              </select>
            </div>
            <div>
              <label className={LABEL}>{"גישה לקבלות"}</label>
              <select name="allowReceipts" defaultValue={initial?.allowReceipts ? "on" : "off"} className={FIELD}>
                <option value="off">{"לא"}</option>
                <option value="on">{"כן"}</option>
              </select>
            </div>
          </div>
        </>
      )}

      <div>
        <label className={LABEL}>{"הערות"}</label>
        <textarea name="notes" rows={3} defaultValue={initial?.notes} className={FIELD} />
      </div>

      <button
        type="submit"
        className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
      >
        {"שמירה"}
      </button>
    </form>
  );
}
