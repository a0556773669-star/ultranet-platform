"use client";

import { useEffect, useRef, useState } from "react";
import { confirmStorePaymentAction, startStorePaymentAction } from "../../actions";

const IFRAME_SRC = "https://www.matara.pro/nedarimplus/iframe/";

/**
 * תשלום באשראי דרך נדרים פלוס - אותו iframe ואותו פרוטוקול כמו מסך החיוב הקיים בהשכרות. פרטי הכרטיס מוקלדים רק בתוך ה-iframe של
 * נדרים (לא עוברים אצלנו). הסכום ומסלול הסליקה נקבעים בשרת.
 */
export function StorePayment({ id, amountILS, isOwner, onClosed }: { id: string; amountILS: number; isOwner: boolean; onClosed: () => void }) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const [stage, setStage] = useState<"start" | "creating" | "iframe" | "sending" | "saving" | "done">("start");
  const [error, setError] = useState("");
  const [txId, setTxId] = useState("");
  const [test, setTest] = useState(false);
  const [routeName, setRouteName] = useState("");
  const txRef = useRef("");
  const testRef = useRef(false);

  useEffect(() => {
    async function onMessage(event: MessageEvent) {
      const data = event.data as { Name?: string; Value?: unknown } | undefined;
      if (!data || typeof data !== "object" || !data.Name) return;
      if (data.Name === "Height") {
        const px = parseInt(String(data.Value), 10);
        if (!Number.isNaN(px)) setHeight(px + 15);
      } else if (data.Name === "TransactionResponse") {
        const value = data.Value as { Status?: string; Message?: string };
        if (value?.Status === "OK") {
          setStage("saving");
          const res = await confirmStorePaymentAction(id, txRef.current, { test: testRef.current });
          if (res.ok) {
            setStage("done");
            onClosed();
          } else {
            setStage("iframe");
            setError(`התשלום עבר אבל רישום העסקה נכשל: ${res.error}. אל תחייבו שוב - פנו אלינו עם מזהה העסקה ${txRef.current}.`);
          }
        } else {
          setStage("iframe");
          setError(value?.Message || "החיוב נכשל");
        }
      }
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [id, onClosed]);

  const post = (payload: unknown) => frameRef.current?.contentWindow?.postMessage(payload, "*");

  async function start() {
    setError("");
    setStage("creating");
    const res = await startStorePaymentAction(id, { test });
    if (!res.ok) {
      setStage("start");
      setError(res.error);
      return;
    }
    txRef.current = res.data.transactionId;
    testRef.current = res.data.test;
    setTxId(res.data.transactionId);
    setRouteName(res.data.routeName);
    setStage("iframe");
  }

  if (stage === "done") return <p className="text-sm font-bold text-teal-700">התשלום התקבל והעסקה נסגרה.</p>;

  if (stage === "start" || stage === "creating") {
    return (
      <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-[#f4f6f9] p-3">
        <p className="text-sm text-ink">הלקוח משלם <b>{amountILS.toLocaleString("he-IL")} ₪</b> באשראי, באותה סליקה של נדרים פלוס שקיימת היום באתר. הקבלה נוצרת אוטומטית.</p>
        {isOwner ? (
          <label className="flex items-center gap-1 text-xs text-muted">
            <input type="checkbox" checked={test} onChange={(e) => setTest(e.target.checked)} />
            מצב בדיקה (Sandbox - בלי חיוב אמיתי, לא משפיע על ההתחשבנות)
          </label>
        ) : null}
        {error ? <p className="text-xs font-bold text-red-600">{error}</p> : null}
        <button type="button" disabled={stage === "creating"} onClick={start} className="btn-primary w-fit disabled:opacity-40">
          {stage === "creating" ? "פותח תשלום..." : "המשך לתשלום"}
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-card-border bg-white p-3">
      {testRef.current ? <p className="mb-2 text-xs font-bold text-amber-600">מצב בדיקה - לא יבוצע חיוב אמיתי.</p> : null}
      <p className="mb-2 text-xs text-muted">סליקה: {routeName} · עסקה {txId}</p>
      <iframe
        ref={frameRef}
        src={IFRAME_SRC}
        onLoad={() => post({ Name: "GetHeight" })}
        scrolling="no"
        style={{ width: "100%", border: "none", height: height || 420 }}
        title="נדרים פלוס - תשלום"
      />
      {error ? <p className="mt-2 text-xs font-bold text-red-600">{error}</p> : null}
      <button
        type="button"
        disabled={stage === "sending" || stage === "saving"}
        onClick={() => {
          setError("");
          setStage("sending");
          post({ Name: "FinishTransaction", Value: { ID: txRef.current } });
        }}
        className="btn-primary mt-3 disabled:opacity-40"
      >
        {stage === "sending" ? "מבצע חיוב..." : stage === "saving" ? "רושם את העסקה..." : "אשר וחייב"}
      </button>
    </div>
  );
}
