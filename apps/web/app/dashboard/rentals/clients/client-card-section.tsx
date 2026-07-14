"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { NedarimCardCapture } from "./nedarim-card-capture";
import { saveClientCardTokenAction } from "../actions";

export function ClientCardSection({
  clientId,
  mosadId,
  apiValid,
  clientName,
  clientPhone,
  currentLast4,
  autoOpen,
}: {
  clientId: string;
  mosadId: string;
  apiValid: string;
  clientName: string;
  clientPhone?: string;
  currentLast4?: string;
  autoOpen?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(!!autoOpen);

  return (
    <div className="mt-6 rounded-card border border-card-border bg-white p-5 shadow-card">
      <h2 className="mb-1 text-sm font-bold text-ink">🔒 פרטי אשראי מאובטחים</h2>
      <p className="mb-3 text-[11px] leading-relaxed text-muted">
        שמירת הכרטיס יוצרת אסמכתא/הרשאה בלבד (מספר כרטיס בלבד, ללא CVV ותוקף - כך בנוי חלון נדרים פלוס לשלב זה). חיוב עתידי מהכרטיס השמור טרם הופעל וממתין לאישור נדרים פלוס. כדי לגבות תשלום עכשיו יש להשתמש בכפתור &quot;חיוב מיידי&quot; במסך ההשכרה, שם מוזן הכרטיס במלואו כולל CVV וניתן לחייב בפועל.
      </p>
      {autoOpen && !currentLast4 && (
        <p className="mb-3 text-xs text-muted">
          פרטי הלקוח נשמרו בהצלחה. כעת יש למלא את פרטי כרטיס האשראי בחלון המאובטח מטה.
        </p>
      )}
      {currentLast4 && (
        <p className="mb-3 text-sm text-muted" dir="ltr">
          כרטיס שמור: •••• {currentLast4}
        </p>
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
          <NedarimCardCapture
            mosadId={mosadId}
            apiValid={apiValid}
            clientName={clientName}
            clientPhone={clientPhone}
            onSaved={async (token, last4, cardExpiry) => {
              await saveClientCardTokenAction(clientId, token, last4, cardExpiry);
              router.refresh();
              setOpen(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
