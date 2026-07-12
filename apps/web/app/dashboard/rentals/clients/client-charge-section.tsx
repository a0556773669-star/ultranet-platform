"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NedarimChargeCapture } from "./nedarim-charge-capture";

export function ClientChargeSection({
  mosadId,
  apiValid,
  clientName,
  clientPhone,
  clientIdNum,
}: {
  mosadId: string;
  apiValid: string;
  clientName: string;
  clientPhone?: string;
  clientIdNum?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

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
          <NedarimChargeCapture
            mosadId={mosadId}
            apiValid={apiValid}
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
