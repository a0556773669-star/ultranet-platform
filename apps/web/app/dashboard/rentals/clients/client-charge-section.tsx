"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NedarimChargeCapture } from "./nedarim-charge-capture";
import type { RouteOption } from "./client-card-section";

export function ClientChargeSection({
  routes,
  clientName,
  clientPhone,
  clientIdNum,
}: {
  routes: RouteOption[];
  clientName: string;
  clientPhone?: string;
  clientIdNum?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const defaultRoute = routes.find((r) => r.defaultForNewCards) ?? routes[0];
  const [selectedRouteId, setSelectedRouteId] = useState(defaultRoute?.id ?? "");
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? defaultRoute;

  if (!selectedRoute) return null;

  return (
    <div className="mt-4">
      <h2 className="mb-2 text-sm font-bold text-ink">חיוב מיידי בכרטיס (ללא טוקן)</h2>
      <p className="mb-2 text-xs text-muted">
        לשימוש כשצריך לחייב לקוח בזמן אמת (סיום השכרה, או חיוב פיקדון על אי-החזרת ציוד). פרטי הכרטיס ניתנים בעת החיוב ישירות באייפרם המאובטח של נדרים פלוס — כולל קוד CVV, ואינם נשמרים אצלנו בכלל.
      </p>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#f4f6f9]"
        >
          חייב לקוח עכשיו
        </button>
      )}
      {open && (
        <>
          {routes.length > 1 && (
            <div className="mb-3 max-w-xs">
              <label className="mb-1 block text-xs font-semibold text-muted">החיוב יתבצע לעסק</label>
              <select
                value={selectedRouteId}
                onChange={(e) => setSelectedRouteId(e.target.value)}
                className="w-full rounded-lg border border-card-border bg-white px-3 py-2 text-sm focus:border-teal focus:outline-none"
              >
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                    {r.defaultForNewCards ? " (ברירת מחדל)" : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="mb-2 text-xs font-bold text-ink">
            שים לב: זה גובה לעסק &quot;{selectedRoute.name}&quot;
          </p>
          <NedarimChargeCapture
            key={selectedRoute.id}
            mosadId={selectedRoute.mosadId}
            apiValid={selectedRoute.apiValid}
            clientName={clientName}
            clientPhone={clientPhone}
            clientIdNum={clientIdNum}
            onDone={() => {
              router.refresh();
            }}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="mt-2 text-xs font-bold text-muted hover:underline"
          >
            סגור
          </button>
        </>
      )}
    </div>
  );
}
