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
}: {
  clientId: string;
  mosadId: string;
  apiValid: string;
  clientName: string;
  clientPhone?: string;
  currentLast4?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="mt-6">
      <h2 className="mb-2 text-sm font-bold text-ink">כרטיס אשראי לפיקדון (נדרים פלוס)</h2>
      {currentLast4 && (
        <p className="mb-2 text-sm text-muted" dir="ltr">
          כרטיס שמור: •••• {currentLast4}
        </p>
      )}
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="rounded-[10px] border border-card-border bg-white px-4 py-2 text-sm font-bold text-ink transition hover:bg-[#f4f6f9]"
        >
          {currentLast4 ? "עדכן כרטיס שמור" : "שמור כרטיס דרך נדרים פלוס"}
        </button>
      )}
      {open && (
        <NedarimCardCapture
          mosadId={mosadId}
          apiValid={apiValid}
          clientName={clientName}
          clientPhone={clientPhone}
          onSaved={async (token, last4) => {
            await saveClientCardTokenAction(clientId, token, last4);
            router.refresh();
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
