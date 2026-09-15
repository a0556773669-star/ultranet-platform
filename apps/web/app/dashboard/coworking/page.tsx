import Link from "next/link";
import { Armchair, Building2, CheckCircle2, AlertTriangle, Pencil, Plus, Unlink } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import {
  loadCoworkingData,
  buildStationOccupancy,
  orphanReason,
  paymentForMonth,
  currentMonth,
  STATION_NUMBERS,
  type CoworkingClientStatus,
  type StationOccupancy,
} from "@/lib/coworking";
import { setupCostCountsToMain } from "@/lib/counts-to-main";
import { CountsToMainBadge } from "@/components/counts-to-main-field";
import type { Branch } from "@ultranet/shared-types";
import { CoworkingTabs } from "./coworking-tabs";
import { RentalHistory } from "./rental-history";
import {
  rentStationAction,
  endStationRentalAction,
  markStationPaidAction,
  assignRentalToBranchAction,
} from "./station-actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-[13px] focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-[11px] font-semibold text-muted";

/**
 * סניפים ועמדות — המסך היחיד של המשרד השיתופי.
 *
 * קודם היו כאן שלוש לשוניות שכולן תיארו את אותו דבר: "לקוחות ותשלומים" ניהלה מנויים,
 * "עמדות" ניהלה את אותם מנויים לפי מקום הישיבה, ו"סניפים" החזיקה סניף בודד. במשרד עם
 * ארבע עמדות אין שלושה מסכים של מידע - יש אחד: **הסניף, ארבע העמדות, ומי יושב בכל אחת**.
 * כל השאר (כולל כל התשלומים) נגזר מההשכרה של העמדה.
 */
export default async function CoworkingPage({ searchParams }: { searchParams?: { branchId?: string } }) {
  const session = await requireModuleAccess("coworking");
  const role = session.user?.role;
  const isOwner = role === "owner";
  const myBranchId = session.user?.branchId;

  const data = await loadCoworkingData(isOwner ? undefined : { branchId: myBranchId });
  const branches = isOwner ? data.branches : data.branches.filter((b) => b.id === myBranchId);
  const month = currentMonth();

  // השכרות שאף סניף חי לא מכיל אותן. הן נשלפות לפני הבדיקה אם יש סניף בכלל, כי הן קיימות
  // דווקא במצב שבו אין: רשומה מ-`app.html` שנשארה מצביעה על סניף שכבר לא קיים במערכת.
  const orphans = data.statuses.filter((st) => st.orphan);
  const orphanSection = (
    <OrphanRentals orphans={orphans} branches={branches} branchesById={data.branchesById} month={month} isOwner={isOwner} />
  );

  // בדרך כלל יש סניף אחד, ולכן אין בורר. הפרמטר קיים כדי שסניף שני לא ישבור את המסך.
  const branch = branches.find((b) => b.id === searchParams?.branchId) ?? branches[0];

  if (!branch) {
    return (
      <div>
        <CoworkingTabs active="/dashboard/coworking" />
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          <p>אין עדיין סניף משרד שיתופי.</p>
          {isOwner && (
            <Link
              href="/dashboard/coworking/branches/new"
              className="mt-3 inline-block rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              + סניף משרד שיתופי
            </Link>
          )}
        </div>
        {/* גם כאן, ובמיוחד כאן: בלי זה ההשכרות היתומות היו נשארות בלי שום מסך, ורק התראת
            התשלומים בדף הבית הייתה מעידה שהן קיימות. */}
        <div className="mt-4">{orphanSection}</div>
      </div>
    );
  }

  const stations = [...data.stationsById.values()].filter((s) => s.branchId === branch.id);
  const statuses = data.statuses.filter((st) => st.client.branchId === branch.id);
  const occupancy = buildStationOccupancy(STATION_NUMBERS, stations, statuses);

  return (
    <div>
      <CoworkingTabs active="/dashboard/coworking" />

      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Armchair className="h-5 w-5" />
        סניפים ועמדות
      </h1>

      <BranchCard branch={branch} others={branches} isOwner={isOwner} />

      {/* ארבע המשבצות. קטנות בכוונה: הן מדד מצב, לא תוכן. */}
      <div className="mb-5 flex flex-wrap gap-2.5">
        {occupancy.map((o) => {
          const taken = Boolean(o.current);
          const paid = o.current ? Boolean(paymentForMonth(o.current.client, month)) : false;
          return (
            <a
              key={o.stationNumber}
              href={`#station-${o.stationNumber}`}
              className={`flex h-24 w-24 flex-col items-center justify-center rounded-card border-2 text-center transition ${
                taken ? "border-teal bg-teal-bg" : "border-card-border bg-white hover:border-teal"
              }`}
            >
              <span className={`text-[28px] font-black leading-none ${taken ? "text-teal-dark" : "text-muted"}`}>
                {o.stationNumber}
              </span>
              <span className={`mt-1 text-[11px] font-extrabold ${taken ? "text-teal-dark" : "text-muted"}`}>
                {taken ? "מושכרת" : "פנויה"}
              </span>
              {taken && (
                <span className={`mt-0.5 text-[10px] font-bold ${paid ? "text-emerald-600" : "text-red-600"}`}>
                  {paid ? "שולם החודש" : "טרם שולם"}
                </span>
              )}
            </a>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        {occupancy.map((o) => (
          <StationCard key={o.stationNumber} o={o} branchId={branch.id} month={month} />
        ))}
      </div>

      <div className="mt-4">{orphanSection}</div>

      <div className="mt-4">
        <RentalHistory statuses={statuses} month={month} canDelete={isOwner} />
      </div>
    </div>
  );
}

/**
 * השכרות שאינן משויכות לסניף משרד שיתופי פעיל.
 *
 * כל מסכי המודול מסננים לפי הסניף הנבחר, אבל התראת התשלומים בדף הבית סופרת את **כל**
 * רשומות `n_cw_clients` — ולכן השכרה שה-`branchId` שלה מצביע על סניף מחוק, על סניף מסוג
 * אחר, או על מסמך שלא קיים (בדרך כלל שריד מ-`app.html` הישן) ייצרה התראה על תשלום בלי
 * שום מקום שבו אפשר לראות אותה או לטפל בה. זה המקום הזה.
 *
 * הסעיף מוצג רק כשיש כאלה: במצב התקין הוא לא קיים, ולכן הוא לא הופך לרעש קבוע.
 */
function OrphanRentals({
  orphans,
  branches,
  branchesById,
  month,
  isOwner,
}: {
  orphans: CoworkingClientStatus[];
  branches: Branch[];
  branchesById: Map<string, Branch>;
  month: string;
  isOwner: boolean;
}) {
  if (orphans.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-start gap-2 rounded-card border border-amber-300 bg-amber-50 p-3">
        <Unlink className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
        <div className="text-[12.5px] text-amber-900">
          <p className="font-extrabold">
            {orphans.length === 1
              ? "יש השכרה אחת שאינה משויכת לסניף משרד שיתופי פעיל"
              : `יש ${orphans.length} השכרות שאינן משויכות לסניף משרד שיתופי פעיל`}
          </p>
          <p className="mt-0.5">
            הן ממשיכות להיספר בהתראת התשלומים שבדף הבית, אבל אינן מופיעות בעמדות ולא בהנה&quot;ח של
            המודול, כי כל אלה מסוננים לפי סניף.{" "}
            {isOwner
              ? "שיוך לסניף ולעמדה מחזיר אותן לתמונה; מחיקה (בפתיחת השורה) מסירה אותן ואת התשלומים שנרשמו להן."
              : "שיוך או מחיקה הם פעולות של הבעלים."}
          </p>
        </div>
      </div>

      <RentalHistory
        statuses={orphans}
        month={month}
        canDelete={isOwner}
        tone="warn"
        hideWhenEmpty
        title="השכרות ללא סניף פעיל"
        intro="לחיצה על שורה פותחת את לוח החודשים של אותה השכרה — אפשר לסמן ולבטל תשלומים גם לפני השיוך."
        extra={(s) => (
          <AssignRentalForm status={s} branches={branches} branchesById={branchesById} canAssign={isOwner} />
        )}
      />
    </div>
  );
}

function AssignRentalForm({
  status,
  branches,
  branchesById,
  canAssign,
}: {
  status: CoworkingClientStatus;
  branches: Branch[];
  branchesById: Map<string, Branch>;
  canAssign: boolean;
}) {
  const reason = orphanReason(status.client, branchesById);

  return (
    <div className="mb-3 rounded-lg border border-amber-300 bg-amber-50 p-3">
      <p className="text-[12px] font-extrabold text-amber-900">למה ההשכרה הזו לא מופיעה במסך: {reason}</p>

      {!canAssign ? (
        <p className="mt-1 text-[11.5px] text-amber-900">שיוך ההשכרה לסניף הוא פעולה של הבעלים.</p>
      ) : branches.length === 0 ? (
        <p className="mt-1 text-[11.5px] text-amber-900">
          אין עדיין סניף משרד שיתופי פעיל לשייך אליו —{" "}
          <Link href="/dashboard/coworking/branches/new" className="font-bold underline">
            צריך להקים אותו קודם
          </Link>
          .
        </p>
      ) : (
        <form
          action={assignRentalToBranchAction.bind(null, status.client.id)}
          className="mt-2 flex flex-wrap items-end gap-2"
        >
          <div>
            <label className={LABEL}>סניף</label>
            <select name="branchId" defaultValue={branches[0]?.id} className={`${FIELD} w-44 bg-white`}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>עמדה</label>
            <select
              name="stationNumber"
              defaultValue={
                STATION_NUMBERS.find((n) => String(n) === status.client.stationNumber?.trim()) ?? STATION_NUMBERS[0]
              }
              className={`${FIELD} w-20 bg-white`}
            >
              {STATION_NUMBERS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={LABEL}>מחיר חודשי</label>
            <input
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={status.cost || undefined}
              placeholder="ללא שינוי"
              className={`${FIELD} w-28 bg-white`}
            />
          </div>
          <button
            type="submit"
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
          >
            שיוך לסניף ולעמדה
          </button>
          <span className="text-[11px] text-amber-900">התשלומים שנרשמו נשארים כמו שהם.</span>
        </form>
      )}
    </div>
  );
}

/** הסניף עצמו — שורה אחת של עובדות, כי במשרד שיתופי הוא כמעט אף פעם לא משתנה. */
function BranchCard({ branch, others, isOwner }: { branch: Branch; others: Branch[]; isOwner: boolean }) {
  return (
    <section className="mb-4 rounded-card border border-card-border bg-white p-4 shadow-card">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-sm font-extrabold text-ink">
          <Building2 className="h-4 w-4" />
          {branch.name}
        </h2>
        {isOwner && (
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/dashboard/coworking/branches/${branch.id}`}
              className="flex items-center gap-1 rounded-lg border border-card-border px-2.5 py-1 text-[11.5px] font-bold text-teal transition hover:border-teal"
            >
              <Pencil className="h-3.5 w-3.5" />
              עריכת הסניף ועלויות ההקמה
            </Link>
            <Link
              href="/dashboard/coworking/branches/new"
              className="flex items-center gap-1 rounded-lg border border-card-border px-2.5 py-1 text-[11.5px] font-bold text-muted transition hover:border-teal hover:text-teal"
            >
              <Plus className="h-3.5 w-3.5" />
              סניף נוסף
            </Link>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Fact label="מיקום" value={branch.location || "-"} />
        <Fact label="טלפון" value={branch.phone || "-"} />
        <Fact label="תאריך פתיחה" value={(branch.openedAt || branch.founded)?.slice(0, 10) || "טרם נקבע"} />
        <div className="rounded-lg bg-[#f9fafb] px-2.5 py-1.5">
          <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">עלות הקמה</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] font-bold text-ink">
            {money(branch.setupCost ?? 0)}
            {(branch.setupCost ?? 0) > 0 && <CountsToMainBadge on={setupCostCountsToMain(branch)} />}
          </p>
        </div>
      </div>

      {others.length > 1 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-card-border pt-2">
          <span className="text-[11px] font-bold text-muted">סניפים:</span>
          {others.map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/coworking?branchId=${b.id}`}
              className={b.id === branch.id ? "pill-active" : "pill-inactive"}
            >
              {b.name}
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function StationCard({ o, branchId, month }: { o: StationOccupancy; branchId: string; month: string }) {
  const s = o.current;

  return (
    <section
      id={`station-${o.stationNumber}`}
      className="scroll-mt-4 rounded-card border border-card-border bg-white p-4 shadow-card"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-extrabold text-ink">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f4f6f9] text-[13px] font-black text-ink">
            {o.stationNumber}
          </span>
          עמדה {o.stationNumber}
        </h2>
        <span
          className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold ${
            s ? "bg-teal-bg text-teal-dark" : "bg-[#f4f6f9] text-muted"
          }`}
        >
          {s ? "מושכרת" : "פנויה"}
        </span>
      </div>

      {s ? <RentedStation status={s} month={month} /> : <RentForm branchId={branchId} stationNumber={o.stationNumber} />}

      {o.past.length > 0 && (
        <p className="mt-3 border-t border-card-border pt-2 text-[11.5px] text-muted">
          {o.past.length} השכרות קודמות בעמדה הזו ({o.past.map((p) => p.client.name).join(", ")}) —
          מצב התשלומים שלהן בהיסטוריה בתחתית המסך.
        </p>
      )}
    </section>
  );
}

function RentedStation({ status, month }: { status: NonNullable<StationOccupancy["current"]>; month: string }) {
  const { client, cost, payDay, unpaidMonths } = status;
  const paid = paymentForMonth(client, month);
  const markPaid = markStationPaidAction.bind(null, client.id, month);
  const endRental = endStationRentalAction.bind(null, client.id);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Fact label="שוכר" value={client.name} />
        <Fact label="התחלה" value={client.startDate} />
        <Fact label="סיום" value={client.endDate ?? "ללא תאריך סיום"} />
        <Fact label="מחיר חודשי" value={money(cost)} />
      </div>

      {/* מצב התשלום של החודש הנוכחי. יום התשלום הוא היום שבו התחילה השכירות. */}
      <div className={`rounded-lg border p-3 ${paid ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"}`}>
        <p className={`flex items-center gap-1.5 text-[13px] font-extrabold ${paid ? "text-emerald-700" : "text-amber-900"}`}>
          {paid ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {paid ? `שולם עבור ${month} — ${money(paid.amount)}` : `טרם שולם עבור ${month}`}
        </p>
        <p className={`mt-0.5 text-[11.5px] ${paid ? "text-emerald-700" : "text-amber-900"}`}>
          יום התשלום: {payDay} בכל חודש
          {paid ? ` · נרשם ב-${paid.date}` : ""}
        </p>

        {!paid && (
          <form action={markPaid} className="mt-2 flex flex-wrap items-end gap-2">
            <div>
              <label className={LABEL}>סכום ששולם</label>
              <input
                name="amount"
                type="number"
                step="0.01"
                defaultValue={cost || undefined}
                required
                className={`${FIELD} w-32 bg-white`}
              />
            </div>
            <button
              type="submit"
              className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
            >
              סמן כשולם
            </button>
            <span className="text-[11px] text-muted">הסימון מוסיף את הסכום להנה&quot;ח הראשית.</span>
          </form>
        )}
      </div>

      {unpaidMonths.length > 0 && (
        <p className="text-[11.5px] font-bold text-red-600">חודשים שלא שולמו: {unpaidMonths.join(", ")}</p>
      )}

      <form action={endRental} className="flex flex-wrap items-end gap-2 border-t border-card-border pt-3">
        <div>
          <label className={LABEL}>תאריך סיום השכירות</label>
          <input name="endDate" type="date" className={`${FIELD} w-40`} />
        </div>
        <button
          type="submit"
          className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-bold text-muted transition hover:border-red-200 hover:text-red-600"
        >
          סיום השכרה
        </button>
        <span className="text-[11px] text-muted">בלי תאריך — היום.</span>
      </form>
    </div>
  );
}

function RentForm({ branchId, stationNumber }: { branchId: string; stationNumber: number }) {
  const action = rentStationAction.bind(null, branchId, stationNumber);
  return (
    <form action={action} className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
      <div>
        <label className={LABEL}>שם השוכר</label>
        <input name="name" required className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>טלפון</label>
        <input name="phone" type="tel" className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>תאריך התחלה</label>
        <input name="startDate" type="date" required className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>תאריך סיום</label>
        <input name="endDate" type="date" className={FIELD} />
      </div>
      <div>
        <label className={LABEL}>מחיר חודשי</label>
        <input name="price" type="number" min={0} step="0.01" className={FIELD} />
      </div>
      <div className="col-span-2 sm:col-span-5">
        <button
          type="submit"
          className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90"
        >
          השכרת העמדה
        </button>
        <span className="mr-2 text-[11px] text-muted">
          יום התשלום החודשי נקבע לפי היום שבו מתחילה השכירות.
        </span>
      </div>
    </form>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-[#f9fafb] px-2.5 py-1.5">
      <p className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-0.5 text-[13px] font-bold text-ink">{value}</p>
    </div>
  );
}
