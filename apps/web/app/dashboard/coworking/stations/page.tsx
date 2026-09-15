import Link from "next/link";
import { Armchair, CheckCircle2, AlertTriangle } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import {
  loadCoworkingData,
  buildStationOccupancy,
  paymentForMonth,
  currentMonth,
  STATION_NUMBERS,
  type StationOccupancy,
} from "@/lib/coworking";
import { CoworkingTabs } from "../coworking-tabs";
import { rentStationAction, endStationRentalAction, markStationPaidAction } from "./actions";

function money(n: number) {
  return `${Math.round(n).toLocaleString("he-IL")} ₪`;
}

const FIELD = "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-2.5 py-1.5 text-[13px] focus:border-teal focus:bg-white focus:outline-none";
const LABEL = "mb-1 block text-[11px] font-semibold text-muted";

/**
 * העמדות — ארבע, וזהו.
 *
 * במשרד יש ארבע עמדות פיזיות, ולכן המסך לא מנהל רשימה שאפשר להוסיף לה: הוא מראה את
 * ארבע המשבצות תמיד, וכל אחת אומרת דבר אחד - מושכרת או פנויה. מתחת לריבועים יושבת
 * ההשכרה עצמה, בדיוק במבנה של נייד מושכר: תאריך התחלה, תאריך סיום, ומצב התשלום של
 * החודש הנוכחי.
 */
export default async function StationsPage() {
  const session = await requireModuleAccess("coworking");
  const role = session.user?.role;
  const myBranchId = session.user?.branchId;

  const data = await loadCoworkingData(role === "owner" ? undefined : { branchId: myBranchId });
  const branch = data.branches[0];
  const month = currentMonth();
  const stations = [...data.stationsById.values()].filter((s) => !branch || s.branchId === branch.id);
  const occupancy = buildStationOccupancy(STATION_NUMBERS, stations, data.statuses);

  if (!branch) {
    return (
      <div>
        <CoworkingTabs active="/dashboard/coworking/stations" />
        <div className="rounded-card border border-dashed border-card-border bg-white py-14 text-center text-muted">
          <p>אין סניף משרד שיתופי — אין עמדות להציג.</p>
          <Link
            href="/dashboard/coworking/branches/new"
            className="mt-3 inline-block rounded-lg bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
          >
            + סניף משרד שיתופי
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div>
      <CoworkingTabs active="/dashboard/coworking/stations" />

      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Armchair className="h-5 w-5" />
        עמדות — {branch.name}
      </h1>

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
    </div>
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
        <details className="mt-3 border-t border-card-border pt-2">
          <summary className="cursor-pointer text-[11.5px] font-bold text-muted">
            השכרות קודמות בעמדה ({o.past.length})
          </summary>
          <ul className="mt-1.5 space-y-1 text-[11.5px] text-muted">
            {o.past.map((p) => (
              <li key={p.client.id}>
                {p.client.name} · {p.client.startDate} — {p.client.endDate ?? "—"}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function RentedStation({
  status,
  month,
}: {
  status: NonNullable<StationOccupancy["current"]>;
  month: string;
}) {
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
      <div
        className={`rounded-lg border p-3 ${
          paid ? "border-emerald-200 bg-emerald-50" : "border-amber-300 bg-amber-50"
        }`}
      >
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
              <input name="amount" type="number" step="0.01" defaultValue={cost || undefined} required className={`${FIELD} w-32 bg-white`} />
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
        <p className="text-[11.5px] font-bold text-red-600">
          חודשים שלא שולמו: {unpaidMonths.join(", ")}
        </p>
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
