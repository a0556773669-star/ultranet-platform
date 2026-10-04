import Link from "next/link";
import { Armchair, CheckCircle2, AlertTriangle, Unlink } from "lucide-react";
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
import type { Branch } from "@ultranet/shared-types";
import { CoworkingTabs } from "./coworking-tabs";
import { RentalHistory } from "./rental-history";
import { BranchTile } from "./branch-tile";
import { RentalEditButton } from "./rental-edit-button";
import { RentStationButton } from "./rent-station-button";
import {
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
 *
 * ## למה המסך נראה כך
 *
 * שורה עליונה אחת: ארבע משבצות המצב בימין, וקוביית הסניף בשמאל. הסניף היה קודם כרטיס
 * על כל הרוחב ובו שש עובדות שכמעט אף פעם לא משתנות, והוא דחף את העמדות - הדבר היחיד
 * שמסתכלים עליו כל יום - מתחת לקפל.
 *
 * מתחת: **שורה אחת לכל עמדה**, כמו שורה בטבלה. הטפסים שהיו פרושים בתוך כל עמדה (השכרה
 * חדשה, עריכת פרטים) ירדו לחלונות: עמדה היא שורה שקוראים, והשכרה היא פעולה שעושים פעם
 * אחת. מה שנשאר בשורה הוא מה שעונים עליו כל חודש - "שילם?" ו"נגמר?".
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

      {/* שורה אחת: משבצות המצב בימין, קוביית הסניף בשמאל. */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap gap-2.5">
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

        <BranchTile branch={branch} others={branches} isOwner={isOwner} />
      </div>

      <section className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        {occupancy.map((o) => (
          <StationRow key={o.stationNumber} o={o} branchId={branch.id} month={month} />
        ))}
      </section>

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
        defaultOpen
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

/** עמדה אחת = שורה אחת. שורת כותרת קצרה, ומתחתיה השוכר, הכסף והפעולות. */
function StationRow({ o, branchId, month }: { o: StationOccupancy; branchId: string; month: string }) {
  const s = o.current;

  return (
    <div id={`station-${o.stationNumber}`} className="scroll-mt-4 border-b border-card-border px-3 py-2.5 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#f4f6f9] text-[12px] font-black text-ink">
          {o.stationNumber}
        </span>
        <span className="text-[13px] font-extrabold text-ink">עמדה {o.stationNumber}</span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
            s ? "bg-teal-bg text-teal-dark" : "bg-[#f4f6f9] text-muted"
          }`}
        >
          {s ? "מושכרת" : "פנויה"}
        </span>
        {o.past.length > 0 && (
          <span className="text-[10.5px] text-muted">{o.past.length} השכרות קודמות — בהיסטוריה למטה</span>
        )}

        {/* הפעולה של השורה יושבת בקצה השמאלי, מיושרת בין כל ארבע העמדות. */}
        <span className="mr-auto flex items-center gap-1.5">
          {s ? (
            <RentalEditButton client={s.client} />
          ) : (
            <RentStationButton branchId={branchId} stationNumber={o.stationNumber} />
          )}
        </span>
      </div>

      {s && <RentedStationLine status={s} month={month} />}
    </div>
  );
}

function RentedStationLine({ status, month }: { status: NonNullable<StationOccupancy["current"]>; month: string }) {
  const { client, cost, payDay, unpaidMonths } = status;
  const paid = paymentForMonth(client, month);
  const markPaid = markStationPaidAction.bind(null, client.id, month);
  const endRental = endStationRentalAction.bind(null, client.id);

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
      <Inline label="שוכר" value={client.name} />
      <Inline label="התחלה" value={client.startDate} />
      {/* תאריך הסיום לא מוצג כאן בכוונה: ברגע שהוא נרשם ההשכרה יורדת להיסטוריה, ולכן
          בשורה של עמדה מושכרת הוא תמיד ריק — שדה שמראה "—" בלבד הוא רעש. */}
      <Inline label="מחיר חודשי" value={money(cost)} />

      {/* מצב התשלום של החודש הנוכחי. יום התשלום הוא היום שבו התחילה השכירות. */}
      {paid ? (
        <span className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11.5px] font-bold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5" />
          שולם {month} — {money(paid.amount)}
          <span className="font-semibold text-emerald-600">· נרשם ב-{paid.date}</span>
        </span>
      ) : (
        <form
          action={markPaid}
          className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1"
        >
          <span className="flex items-center gap-1 text-[11.5px] font-bold text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5" />
            טרם שולם {month}
          </span>
          <input
            name="amount"
            type="number"
            step="0.01"
            defaultValue={cost || undefined}
            required
            aria-label="סכום ששולם"
            className="w-24 rounded-lg border border-card-border bg-white px-2 py-1 text-[12px] focus:border-teal focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg bg-gradient-to-br from-teal to-teal-light px-2.5 py-1 text-[11px] font-bold text-white transition hover:opacity-90"
          >
            סמן כשולם
          </button>
        </form>
      )}

      <span className="text-[11px] text-muted">יום תשלום: {payDay} בחודש</span>

      {unpaidMonths.length > 0 && (
        <span className="text-[11px] font-bold text-red-600">לא שולמו: {unpaidMonths.join(", ")}</span>
      )}

      <form action={endRental} className="mr-auto flex items-center gap-1.5">
        <input
          name="endDate"
          type="date"
          aria-label="תאריך סיום השכירות"
          className="rounded-lg border border-card-border bg-[#f4f6f9] px-2 py-1 text-[12px] focus:border-teal focus:bg-white focus:outline-none"
        />
        <button
          type="submit"
          title="בלי תאריך — היום. ההשכרה עוברת להיסטוריה והעמדה מתפנה."
          className="rounded-lg border border-card-border px-2.5 py-1 text-[11px] font-bold text-muted transition hover:border-red-200 hover:text-red-600"
        >
          סיום השכרה
        </button>
      </form>
    </div>
  );
}

function Inline({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="text-[10.5px] font-bold uppercase tracking-wide text-muted">{label}</span>
      <span className="text-[12.5px] font-bold text-ink">{value}</span>
    </span>
  );
}
