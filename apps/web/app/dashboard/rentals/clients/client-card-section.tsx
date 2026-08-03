"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Lock } from "lucide-react";
import { NedarimCardCapture } from "./nedarim-card-capture";
import { saveClientCardTokenAction } from "../actions";

export type RouteOption = {
  id: string;
  name: string;
  mosadId: string;
  apiValid: string;
  defaultForNewCards: boolean;
};

export function ClientCardSection({
  clientId,
  routes,
  clientName,
  clientPhone,
  currentLast4,
  currentRouteId,
  currentRouteName,
  autoOpen,
}: {
  clientId: string;
  routes: RouteOption[];
  clientName: string;
  clientPhone?: string;
  currentLast4?: string;
  currentRouteId?: string | null;
  currentRouteName?: string | null;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!autoOpen);
  const defaultRoute = routes.find((r) => r.defaultForNewCards) ?? routes[0];
  const [selectedRouteId, setSelectedRouteId] = useState(defaultRoute?.id ?? "");
  const selectedRoute = routes.find((r) => r.id === selectedRouteId) ?? defaultRoute;

  const needsMigration =
    !!currentLast4 && !!defaultRoute && (currentRouteId ?? null) !== defaultRoute.id;

  if (!selectedRoute) {
    return (
      <div className="mt-6 rounded-card border border-card-border bg-white p-5 text-sm text-muted shadow-card">
        אין מסלול סליקה מחובר של נדרים פלוס - יש להגדיר אחד תחת הנהלת חשבונות ← מסלולי גביה.
      </div>
    );
  }

  return (
    <div className="mt-6 rounded-card border border-card-border bg-white p-5 shadow-card">
      <h2 className="mb-1 flex items-center gap-1.5 text-sm font-bold text-ink">
        <Lock className="h-4 w-4" />
        פרטי אשראי מאובטחים
      </h2>
      <p className="mb-3 text-[11px] leading-relaxed text-muted">
        שמירת הכרטיס יוצרת אסמכתא/הרשאה בלבד (מספר כרטיס בלבד, ללא CVV ותוקף - כך בנוי חלון נדרים פלוס לשלב זה). חיוב עתידי מהכרטיס השמור טרם הופעל וממתין לאישור נדרים פלוס. כדי לגבות תשלום עכשיו יש להשתמש בכפתור &quot;חיוב מיידי&quot; במסך ההשכרה, שם מוזן הכרטיס במלואו כולל CVV וניתן לחייב בפועל.
      </p>
      {autoOpen && !currentLast4 && (
        <p className="mb-3 text-xs text-muted">
          פרטי הלקוח נשמרו בהצלחה. כעת יש למלא את פרטי כרטיס האשראי בחלון המאובטח מטה.
        </p>
      )}
      {currentLast4 && (
        <p className="mb-1 text-sm text-muted" dir="ltr">
          כרטיס שמור: •••• {currentLast4}
        </p>
      )}
      {currentLast4 && (
        <p className="mb-3 text-xs font-semibold text-ink">
          משויך לעסק: {currentRouteName ?? "לא ידוע (מסלול שלא נמצא/הושבת)"}
        </p>
      )}
      {needsMigration && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">
          שימו לב: הכרטיס השמור עדיין מחויב דרך העסק &quot;{currentRouteName ?? "המסלול הקודם"}&quot;, בעוד
          שברירת המחדל הנוכחית לכרטיסים חדשים היא &quot;{defaultRoute.name}&quot;. כדי להעביר את הלקוח יש
          לבקש ממנו להזין מחדש את פרטי הכרטיס למטה - לא ניתן להעביר טוקן קיים בין עסקים, רק ליצור טוקן
          חדש תחת העסק הרצוי.
        </div>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#f4f6f9]"
        >
          {currentLast4 ? "עדכון כרטיס אשראי" : "הזנת כרטיס אשראי"}
        </button>
      )}
      {open && (
        <div className="rounded-lg border border-card-border bg-[#f8fafc] p-3">
          {routes.length > 1 && (
            <div className="mb-3">
              <label className="mb-1 block text-xs font-semibold text-muted">
                הכרטיס ישויך לעסק
              </label>
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
          <NedarimCardCapture
            key={selectedRoute.id}
            mosadId={selectedRoute.mosadId}
            apiValid={selectedRoute.apiValid}
            clientName={clientName}
            clientPhone={clientPhone}
            onSaved={async (token, last4, cardExpiry) => {
              await saveClientCardTokenAction(clientId, token, last4, cardExpiry, selectedRoute.id);
              router.refresh();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
