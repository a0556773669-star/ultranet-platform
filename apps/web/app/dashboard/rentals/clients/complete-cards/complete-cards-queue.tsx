"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";
import { NedarimCardCapture } from "../nedarim-card-capture";
import { saveClientCardTokenAction } from "../../actions";

export interface QueueItem {
  id: string;
  name: string;
  phone?: string;
  branchName: string;
  mosadId: string;
  apiValid: string;
  routeId: string;
  routeName: string;
}

export function CompleteCardsQueue({ items }: { items: QueueItem[] }) {
  const [remaining, setRemaining] = useState(items);
  const [done, setDone] = useState(0);
  const [saving, setSaving] = useState(false);
  const total = items.length;

  const current = remaining[0];

  function advance() {
    setRemaining((r) => r.slice(1));
    setDone((d) => d + 1);
    setSaving(false);
  }

  if (!items.length) {
    return (
      <div className="rounded-card border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-700">
        אין כרגע לקוחות בלי כרטיס שמור - הכל מעודכן.
      </div>
    );
  }

  if (!current) {
    return (
      <div className="flex items-center gap-2 rounded-card border border-teal-200 bg-teal-50 p-4 text-sm font-semibold text-teal-700">
        <CircleCheck className="h-5 w-5" />
        סיימת! הושלמו {done} מתוך {total} לקוחות.
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between text-xs font-semibold text-muted">
        <span>
          לקוח {done + 1} מתוך {total}
        </span>
        <button
          type="button"
          onClick={advance}
          className="text-teal hover:underline"
          disabled={saving}
        >
          דלג ללקוח הבא
        </button>
      </div>
      <div className="mb-3 rounded-card border border-card-border bg-white p-3">
        <div className="text-sm font-bold text-ink">{current.name}</div>
        <div className="text-xs text-muted">
          {current.branchName}
          {current.phone ? ` · ${current.phone}` : ""}
        </div>
        <div className="mt-1 text-xs font-semibold text-ink">הכרטיס ישויך לעסק: {current.routeName}</div>
      </div>
      <NedarimCardCapture
        key={current.id}
        mosadId={current.mosadId}
        apiValid={current.apiValid}
        clientName={current.name}
        clientPhone={current.phone}
        onSaved={async (token, last4, cardExpiry) => {
          setSaving(true);
          await saveClientCardTokenAction(current.id, token, last4, cardExpiry, current.routeId);
          advance();
        }}
      />
    </div>
  );
}
