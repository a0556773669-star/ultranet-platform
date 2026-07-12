"use client";

import { useEffect, useRef, useState } from "react";
import { createNedarimTransactionAction } from "../actions";

const IFRAME_SRC = "https://www.matara.pro/nedarimplus/iframe/";
const TEST_MOSAD = "0";
const TEST_API_VALID = "j+iyEFN3bE";

export function NedarimChargeCapture({
  mosadId,
  apiValid,
  clientName,
  clientPhone,
  onDone,
}: {
  mosadId: string;
  apiValid: string;
  clientName: string;
  clientPhone?: string;
  onDone: (result: { ok: boolean; message?: string }) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const [stage, setStage] = useState<"amount" | "creating" | "iframe" | "sending" | "error" | "done">("amount");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(true);
  const [txId, setTxId] = useState<string | null>(null);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { Name?: string; Value?: unknown } | undefined;
      if (!data || typeof data !== "object" || !data.Name) return;
      if (data.Name === "Height") {
        const px = parseInt(String(data.Value), 10);
        if (!Number.isNaN(px)) setHeight(px + 15);
      } else if (data.Name === "TransactionResponse") {
        const value = data.Value as { Status?: string; Message?: string };
        if (value?.Status === "OK") {
          setStage("done");
          onDone({ ok: true });
        } else {
          setStage("error");
          setError(value?.Message || "החיוב נכשל");
          onDone({ ok: false, message: value?.Message });
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onDone]);

  function postToFrame(payload: unknown) {
    frameRef.current?.contentWindow?.postMessage(payload, "*");
  }

  function handleLoad() {
    postToFrame({ Name: "GetHeight" });
  }

  async function handleCreateTransaction() {
    setError(null);
    const amt = Number(amount);
    if (!amt || amt <= 0) {
      setError("יש להזין סכום תקין");
      return;
    }
    setStage("creating");
    const activeMosad = testMode ? TEST_MOSAD : mosadId;
    const activeApiValid = testMode ? TEST_API_VALID : apiValid;
    const res = await createNedarimTransactionAction(activeMosad, activeApiValid, amt, clientName, clientPhone);
    if (!res.ok) {
      setStage("error");
      setError(res.message);
      return;
    }
    setTxId(res.id);
    setStage("iframe");
  }

  function handleConfirm() {
    setStage("sending");
    postToFrame({ Name: "FinishTransaction", Value: { ID: txId } });
  }

  if (stage === "amount" || stage === "creating") {
    return (
      <div className="rounded-card border border-card-border bg-white p-4">
        {testMode && (
          <p className="mb-2 text-xs font-bold text-amber-600">
            מצב בדיקה (Sandbox) פעיל - לא יבוצע חיוב אמיתי בכרטיס.
          </p>
        )}
        <label className="mb-1 block text-xs font-bold text-muted">סכום לחיוב (₪)</label>
        <input
          type="number"
          min="1"
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          dir="ltr"
          className="mb-2 w-40 rounded-[10px] border border-card-border px-3 py-2 text-sm"
        />
        {error && <p className="mb-2 text-xs font-bold text-red-600">{error}</p>}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCreateTransaction}
            disabled={stage === "creating"}
            className="rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-xs font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
          >
            {stage === "creating" ? "יוצר עסקה..." : "המשך לחיוב"}
          </button>
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
            מצב בדיקה
          </label>
        </div>
      </div>
    );
  }

  if (stage === "error" && !txId) {
    return (
      <div className="rounded-card border border-red-200 bg-red-50 p-4">
        <p className="text-sm font-bold text-red-700">{error}</p>
        <button
          type="button"
          onClick={() => setStage("amount")}
          className="mt-2 text-xs font-bold text-teal hover:underline"
        >
          נסה שוב
        </button>
      </div>
    );
  }

  if (stage === "done") {
    return (
      <div className="rounded-card border border-teal-200 bg-teal-50 p-4">
        <p className="text-sm font-bold text-teal-700">החיוב בוצע בהצלחה.</p>
      </div>
    );
  }

  return (
    <div className="rounded-card border border-card-border bg-white p-4">
      {testMode && (
        <p className="mb-2 text-xs font-bold text-amber-600">מצב בדיקה - לא יבוצע חיוב אמיתי.</p>
      )}
      <iframe
        ref={frameRef}
        src={IFRAME_SRC}
        onLoad={handleLoad}
        scrolling="no"
        style={{ width: "100%", border: "none", height: height || 420 }}
        title="נדרים פלוס - חיוב"
      />
      {stage === "error" && <p className="mt-2 text-xs font-bold text-red-600">{error}</p>}
      <button
        type="button"
        onClick={handleConfirm}
        disabled={stage === "sending"}
        className="mt-3 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
      >
        {stage === "sending" ? "מבצע חיוב..." : "אשר וחייב"}
      </button>
    </div>
  );
}
