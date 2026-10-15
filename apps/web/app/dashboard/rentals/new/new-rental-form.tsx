"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { itemsForPackage } from "@/lib/equipment-checklist";
import { useUnsavedWarning } from "@/lib/use-unsaved-warning";
import type { Branch, RentalClient, Laptop, Stick, CollectionRoute } from "@ultranet/shared-types";
import { createRentalAction } from "../actions";
import { CustomerCombobox } from "../customer-combobox";
import { hasWithoutStickPricing, laptopRatesFor } from "@/lib/rental-pricing";

type Props = {
  branches: Branch[];
  clients: RentalClient[];
  laptops: Laptop[];
  sticks: Stick[];
  routes: CollectionRoute[];
  defaultBranchId: string;
  lockBranch: boolean;
  rentedLaptopIds: string[];
  rentedStickIds: string[];
  /** מחשבים עם תקופת תיקון פתוחה — מוצגים "— בתיקון" ולא ניתנים לבחירה */
  repairLaptopIds?: string[];
  onlyMine?: boolean;
};

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none disabled:opacity-60";
const LABEL = "mb-1 block text-xs font-semibold text-muted";

export function NewRentalForm({
  branches,
  clients,
  laptops,
  sticks,
  routes,
  defaultBranchId,
  lockBranch,
  rentedLaptopIds,
  rentedStickIds,
  repairLaptopIds,
  onlyMine,
}: Props) {
  const [branchId, setBranchId] = useState(defaultBranchId);
  const [clientId, setClientId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [kind, setKind] = useState<"laptop" | "stick">("laptop");
  const [itemId, setItemId] = useState("");
  const [pricingVariant, setPricingVariant] = useState<"normal" | "noInternet">("normal");
  const notesRef = useRef<HTMLTextAreaElement>(null);
  // תאריך החזרה משוער — רשות, לתכנון בלבד (מסמך המשך 1, סעיף 43).
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [handoverItems, setHandoverItems] = useState<string[]>([]);
  // פריטים נוספים באותה מסירה (מסמך המשך 1, סעיף 42). כל אחד נשמר כהשכרה נפרדת.
  type Extra = { kind: "laptop" | "stick"; itemId: string; pricingVariant: "normal" | "noInternet" };
  const [extras, setExtras] = useState<Extra[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // אזהרה ביציאה כשכבר נבחר משהו ועוד לא נשמר (בזמן שמירה — לא מזהירים).
  useUnsavedWarning(!pending && Boolean(clientId || itemId || startDate || extras.length));

  const rentedLaptopSet = useMemo(() => new Set(rentedLaptopIds), [rentedLaptopIds]);
  const rentedStickSet = useMemo(() => new Set(rentedStickIds), [rentedStickIds]);

  const branchClients = clients.filter((c) => c.branchId === branchId);
  const selectedClient = clientId ? clients.find((c) => c.id === clientId) : undefined;
  const branchLaptops = laptops
    .filter((l) => l.branchId === branchId)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));
  const branchSticks = sticks
    .filter((s) => s.branchId === branchId)
    .sort((a, b) => a.name.localeCompare(b.name, "he", { numeric: true }));

  const selectedLaptop = branchLaptops.find((l) => l.id === itemId);
  const selectedStick = branchSticks.find((s) => s.id === itemId);
  const selectedItemAlreadyRented =
    (kind === "laptop" && itemId ? rentedLaptopSet.has(itemId) : false) ||
    (kind === "stick" && itemId ? rentedStickSet.has(itemId) : false);

  /** שורות המחירון של הפריט שנבחר, להצגה לפני פתיחת ההשכרה. */
  const priceRows = useMemo<{ label: string; value: number }[] | null>(() => {
    if (kind === "laptop" && selectedLaptop) {
      const r = laptopRatesFor(selectedLaptop, pricingVariant);
      return [
        { label: "ליום", value: r.dayPrice },
        { label: "לשבוע", value: r.weekPrice },
        { label: "לחודש", value: r.monthPrice },
      ].filter((row) => row.value > 0);
    }
    if (kind === "stick" && selectedStick) {
      const ongoing = selectedStick.day3plus || selectedStick.day2 || selectedStick.day1;
      return [
        { label: "יום ראשון", value: selectedStick.day1 },
        { label: "לכל יום נוסף", value: ongoing },
        { label: "לשבוע", value: selectedStick.weekPrice ?? 0 },
        { label: "לחודש", value: selectedStick.monthPrice ?? 0 },
      ].filter((row) => row.value > 0);
    }
    return null;
  }, [kind, selectedLaptop, selectedStick, pricingVariant]);

  function handleKindChange(next: "laptop" | "stick") {
    setKind(next);
    setItemId("");
    setPricingVariant("normal");
  }

  /**
   * Builds the FormData from the component's own state instead of letting the browser collect it
   * from the DOM on a native <form action={...}> submit. That native path was the source of the
   * long-standing "חובה לבחור לקוח..." on the very first click even after picking a customer:
   * whatever the exact cause (the hidden clientId input, focus/blur ordering in the combobox,
   * etc.), reading straight from React state can never go stale relative to what the user sees on
   * screen. Missing fields are now reported inline immediately, without a full-page redirect that
   * used to wipe every field the user had already filled in and forced them to start over.
   */
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending || selectedItemAlreadyRented) return;

    const missing = [!clientId && "לקוח", !itemId && "מחשב/סטיק", !startDate && "תאריך התחלה"]
      .filter(Boolean)
      .join(", ");
    if (missing) {
      setFormError(`חובה למלא: ${missing} לפני השמירה.`);
      return;
    }
    const ids = [itemId, ...extras.map((x) => x.itemId).filter(Boolean)];
    if (new Set(ids).size !== ids.length) {
      setFormError("אותו פריט נבחר פעמיים במסירה.");
      return;
    }
    setFormError(null);

    const fd = new FormData();
    fd.set("branchId", branchId);
    fd.set("clientId", clientId);
    fd.set("kind", kind);
    fd.set("itemId", itemId);
    fd.set("pricingVariant", pricingVariant);
    fd.set("startDate", startDate);
    fd.set("notes", notesRef.current?.value ?? "");
    fd.set("expectedReturnDate", expectedReturnDate);
    for (const k of handoverItems) fd.append("handoverItems", k);
    const chosenExtras = extras.filter((x) => x.itemId);
    if (chosenExtras.length) fd.set("extraItems", JSON.stringify(chosenExtras));
    if (onlyMine) fd.set("mine", "1");
    startTransition(() => {
      createRentalAction(fd);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-card border border-card-border bg-white p-5 shadow-card">
      <div>
        <label className={LABEL}>סניף</label>
        <select
          name="branchId"
          value={branchId}
          disabled={lockBranch}
          onChange={(e: ChangeEvent<HTMLSelectElement>) => {
            setBranchId(e.target.value);
            setClientId("");
          }}
          className={FIELD}
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className={LABEL}>לקוח</label>
        <CustomerCombobox clients={branchClients} value={clientId} onChange={setClientId} />
        {selectedClient && (
          // מצב קצר של הלקוח שנבחר: תקנון ופיקדון (לפי השדות הקיימים, בלי חובה חדשה), והערה בולטת.
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
            <span
              className={`rounded-full px-2 py-0.5 ${
                selectedClient.signedTerms ? "bg-teal-bg text-teal-dark" : "bg-red-50 text-red-600"
              }`}
            >
              {selectedClient.signedTerms ? "חתם על תקנון" : "לא חתם על תקנון"}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 ${
                !selectedClient.depositType || selectedClient.depositType === "none"
                  ? "bg-red-50 text-red-600"
                  : "bg-teal-bg text-teal-dark"
              }`}
            >
              {selectedClient.depositType === "check"
                ? "פיקדון: צ׳ק"
                : selectedClient.depositType === "credit"
                  ? "פיקדון: אשראי"
                  : "ללא פיקדון"}
            </span>
            {selectedClient.pinnedNote && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-800">{selectedClient.pinnedNote}</span>
            )}
          </div>
        )}
      </div>

      <div>
        <label className={LABEL}>סוג השכרה</label>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="kind"
              value="laptop"
              checked={kind === "laptop"}
              onChange={() => handleKindChange("laptop")}
            />
            מחשב נייד
          </label>
          <label className="flex items-center gap-1.5">
            <input
              type="radio"
              name="kind"
              value="stick"
              checked={kind === "stick"}
              onChange={() => handleKindChange("stick")}
            />
            סטיק
          </label>
        </div>
      </div>

      {kind === "laptop" ? (
        <div>
          <label className={LABEL}>מחשב</label>
          <select
            name="itemId"
            value={itemId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setItemId(e.target.value)}
            className={FIELD}
          >
            <option value="">בחר מחשב</option>
            {branchLaptops.map((l) => {
              const rented = rentedLaptopSet.has(l.id);
              const inRepair = !rented && !!repairLaptopIds?.includes(l.id);
              return (
                <option key={l.id} value={l.id} disabled={rented || inRepair}>
                  {l.name} ({l.dayPrice} ₪/יום){rented ? " — מושכר כרגע" : inRepair ? " — בתיקון" : ""}
                </option>
              );
            })}
          </select>
        </div>
      ) : (
        <div>
          <label className={LABEL}>סטיק</label>
          <select
            name="itemId"
            value={itemId}
            onChange={(e: ChangeEvent<HTMLSelectElement>) => setItemId(e.target.value)}
            className={FIELD}
          >
            <option value="">בחר סטיק</option>
            {branchSticks.map((s) => {
              const rented = rentedStickSet.has(s.id);
              // סטיק של מחשב שבתיקון לא מושכר בנפרד עד שהמחשב חוזר.
              const laptopInRepair = !rented && !!s.linkedLaptopId && !!repairLaptopIds?.includes(s.linkedLaptopId);
              return (
                <option key={s.id} value={s.id} disabled={rented || laptopInRepair}>
                  {s.name} ({s.day1} ₪/יום ראשון){rented ? " — מושכר כרגע" : laptopInRepair ? " — המחשב שלו בתיקון" : ""}
                </option>
              );
            })}
          </select>
        </div>
      )}

      {selectedItemAlreadyRented && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          מחשב/סטיק זה כבר מושכר כרגע ולא ניתן לפתוח עבורו השכרה נוספת עד להחזרתו.
        </div>
      )}

      {kind === "laptop" && selectedLaptop && (selectedLaptop.hasStick || hasWithoutStickPricing(selectedLaptop)) && (
        <div>
          <label className={LABEL}>סטיק (אינטרנט)</label>
          <div className="flex gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pricingVariant"
                value="normal"
                checked={pricingVariant === "normal"}
                onChange={() => setPricingVariant("normal")}
              />
              עם סטיק
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="radio"
                name="pricingVariant"
                value="noInternet"
                checked={pricingVariant === "noInternet"}
                onChange={() => setPricingVariant("noInternet")}
              />
              בלי סטיק
            </label>
          </div>
          <p className="mt-1 text-[11px] text-muted">
            &quot;בלי סטיק&quot; מתמחר לפי עמודת &quot;בלי סטיק&quot; של המחשב, ומשאיר את הסטיק פנוי
            להשכרה נפרדת.
          </p>
        </div>
      )}

      <div>
        <label className={LABEL}>תאריך התחלה</label>
        <input
          type="date"
          name="startDate"
          value={startDate}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
          className={FIELD}
        />
      </div>

      {priceRows && priceRows.length > 0 && (
        <div className="rounded-xl border border-teal bg-gradient-to-br from-teal-bg to-emerald-50 px-4 py-3 text-sm">
          <div className="mb-1 text-xs font-bold text-muted">מחירון הפריט</div>
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {priceRows.map((row) => (
              <span key={row.label}>
                <span className="text-muted">{row.label}: </span>
                <span className="text-base font-black text-teal-dark">{row.value.toLocaleString()} ₪</span>
              </span>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">
            המחיר הסופי יחושב בסגירת ההשכרה לפי התאריכים בפועל (חודש קלנדרי, שישי+שבת = יום אחד),
            ותמיד ייבחר החישוב הזול ביותר ללקוח.
          </p>
        </div>
      )}

      <div>
        <label className={LABEL}>החזרה משוערת (רשות — לתכנון בלבד, לא משנה מחיר)</label>
        <input
          type="date"
          value={expectedReturnDate}
          min={startDate || undefined}
          onChange={(e: ChangeEvent<HTMLInputElement>) => setExpectedReturnDate(e.target.value)}
          className={FIELD}
        />
      </div>

      {itemId && (
        <div className="rounded-lg border border-card-border p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold text-muted">פריטים נוספים באותה מסירה (רשות)</span>
            <button
              type="button"
              onClick={() => setExtras((prev) => [...prev, { kind: "laptop", itemId: "", pricingVariant: "normal" }])}
              className="text-xs font-bold text-teal hover:underline"
            >
              + פריט נוסף
            </button>
          </div>
          {extras.length === 0 ? (
            <p className="text-[11px] text-muted">
              למשל עוד מחשב לאותו לקוח. כל פריט נשמר כהשכרה נפרדת — עם מחירון משלו, ומוחזר ומשולם בנפרד.
            </p>
          ) : (
            <div className="flex flex-col gap-2">
              {extras.map((x, i) => {
                const taken = new Set([itemId, ...extras.filter((_, j) => j !== i).map((e) => e.itemId)]);
                const options =
                  x.kind === "laptop"
                    ? branchLaptops.filter(
                        (l) => !rentedLaptopSet.has(l.id) && !repairLaptopIds?.includes(l.id) && !taken.has(l.id),
                      )
                    : branchSticks.filter(
                        (st) =>
                          !rentedStickSet.has(st.id) &&
                          !taken.has(st.id) &&
                          !(st.linkedLaptopId && repairLaptopIds?.includes(st.linkedLaptopId)),
                      );
                const update = (patch: Partial<Extra>) =>
                  setExtras((prev) => prev.map((e, j) => (j === i ? { ...e, ...patch } : e)));
                return (
                  <div key={i} className="flex flex-wrap items-center gap-2">
                    <select
                      value={x.kind}
                      onChange={(e) => update({ kind: e.target.value as Extra["kind"], itemId: "", pricingVariant: "normal" })}
                      className="rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-sm"
                    >
                      <option value="laptop">מחשב</option>
                      <option value="stick">סטיק</option>
                    </select>
                    <select
                      value={x.itemId}
                      onChange={(e) => update({ itemId: e.target.value })}
                      className="min-w-[160px] flex-1 rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-sm"
                    >
                      <option value="">בחירת פריט…</option>
                      {options.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                    {x.kind === "laptop" && (
                      <select
                        value={x.pricingVariant}
                        onChange={(e) => update({ pricingVariant: e.target.value as Extra["pricingVariant"] })}
                        className="rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1.5 text-sm"
                      >
                        <option value="normal">עם סטיק</option>
                        <option value="noInternet">בלי סטיק</option>
                      </select>
                    )}
                    <button
                      type="button"
                      onClick={() => setExtras((prev) => prev.filter((_, j) => j !== i))}
                      className="text-xs font-bold text-red-600 hover:underline"
                    >
                      הסרה
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {itemId && (
        <div>
          <label className={LABEL}>בדיקת ציוד במסירה (רשות)</label>
          <div className="flex flex-wrap gap-3 text-sm">
            {itemsForPackage(kind, pricingVariant).map((it) => (
              <label key={it.key} className="flex items-center gap-1.5">
                <input
                  type="checkbox"
                  checked={handoverItems.includes(it.key)}
                  onChange={(e) =>
                    setHandoverItems((prev) => (e.target.checked ? [...prev, it.key] : prev.filter((k) => k !== it.key)))
                  }
                />
                {it.label}
              </label>
            ))}
          </div>
        </div>
      )}

      <div>
        <label className={LABEL}>הערה על ההשכרה</label>
        <textarea name="notes" ref={notesRef} rows={2} className={FIELD} />
      </div>

      {formError && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          {formError}
        </div>
      )}

      <button
        type="submit"
        disabled={pending || selectedItemAlreadyRented}
        className="mt-1 self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-6 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending ? "שומר..." : "התחל השכרה"}
      </button>
    </form>
  );
}
