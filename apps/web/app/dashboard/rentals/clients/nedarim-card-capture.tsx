"use client";

import { useEffect, useRef, useState } from "react";

const IFRAME_SRC = "https://www.matara.pro/nedarimplus/iframe/?CVV=Hide";
const TEST_MOSAD = "0";
const TEST_API_VALID = "j+iyEFN3bE";

export function NedarimCardCapture({
  mosadId,
  apiValid,
  clientName,
  clientPhone,
  onSaved,
}: {
  mosadId: string;
  apiValid: string;
  clientName: string;
  clientPhone?: string;
  onSaved: (token: string, last4: string) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const [status, setStatus] = useState<"idle" | "sending" | "error" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(false);

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      const data = event.data as { Name?: string; Value?: unknown } | undefined;
      if (!data || typeof data !== "object" || !data.Name) return;
      if (data.Name === "Height") {
        const px = parseInt(String(data.Value), 10);
        if (!Number.isNaN(px)) setHeight(px + 15);
      } else if (data.Name === "TransactionResponse") {
        const value = data.Value as { Status?: string; Message?: string; Token?: string; LastNum?: string };
        if (value?.Status === "Error") {
          setStatus("error");
          setError(value.Message || "שגיאה בשמירת הכרטיס");
        } else if (value?.Token) {
          setStatus("done");
          onSaved(value.Token, value.LastNum || "");
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [onSaved]);

  function postToFrame(payload: unknown) {
    frameRef.current?.contentWindow?.postMessage(payload, "*");
  }

  function handleLoad() {
    postToFrame({ Name: "GetHeight" });
  }

  function handleSubmit() {
    setStatus("sending");
    setError(null);
    postToFrame({
      Name: "FinishTransaction2",
      Value: {
        Mosad: testMode ? TEST_MOSAD : mosadId,
        ApiValid: testMode ? TEST_API_VALID : apiValid,
        PaymentType: "CreateToken",
        FirstName: clientName,
        Phone: clientPhone || "",
      },
    });
  }

  return (
    <div className="rounded-card border border-card-border bg-white p-4">
      <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-muted">
        <input
          type="checkbox"
          checked={testMode}
          onChange={(e) => setTestMode(e.target.checked)}
          className="h-4 w-4 rounded border-card-border"
        />
        מצב בדיקה (לא נוגע בחשבון האמיתי שלך בנדרים פלוס)
      </label>
      <iframe
        ref={frameRef}
        src={IFRAME_SRC}
        onLoad={handleLoad}
        scrolling="no"
        style={{ width: "100%", border: "none", height: height || 300 }}
        title="שמירת כרטיס אשראי - נדרים פלוס"
      />
      {status === "error" && (
        <p className="mt-2 text-sm font-semibold text-red-600">{error}</p>
      )}
      {status === "done" && (
        <p className="mt-2 text-sm font-semibold text-teal">הכרטיס נשמר בהצלחה</p>
      )}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={status === "sending"}
        className="mt-3 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-50"
      >
        {status === "sending" ? "שומר..." : "שמור כרטיס"}
      </button>
    </div>
  );
}
