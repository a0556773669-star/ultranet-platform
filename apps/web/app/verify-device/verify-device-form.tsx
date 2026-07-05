"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import emailjs from "@emailjs/browser";
import { requestDeviceCodeAction, verifyDeviceCodeAction } from "./actions";

const EMAILJS_SERVICE_ID = "service_u6n37yv";
const EMAILJS_TEMPLATE_ID = "template_ca93kim";
const EMAILJS_PUBLIC_KEY = "mEEvU9GRHAcCvVCxi";

export function VerifyDeviceForm() {
  const [step, setStep] = useState<"start" | "code">("start");
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSendCode() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await requestDeviceCodeAction();
      if (!result.ok) {
        setError(result.message);
        return;
      }

      try {
        const now = new Date();
        await emailjs.send(
          EMAILJS_SERVICE_ID,
          EMAILJS_TEMPLATE_ID,
          {
            to_email: result.email,
            name: result.email,
            title: "קוד אימות למחשב חדש",
            branch: "-",
            message: `קוד האימות למחשב חדש שלך: ${result.code}\nהקוד תקף ל-10 דקות.`,
            date:
              now.toLocaleDateString("he-IL") +
              " " +
              now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
            email: result.email,
          },
          { publicKey: EMAILJS_PUBLIC_KEY }
        );
        setMessage("קוד נשלח לאימייל שלך");
        setStep("code");
      } catch (err) {
        console.error("emailjs failed to send", err);
        setError("שליחת המייל נכשלה. נסה שוב.");
      }
    });
  }

  function handleVerify() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("code", code);
      if (remember) fd.set("remember", "on");
      const result = await verifyDeviceCodeAction(fd);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push("/dashboard");
    });
  }

  return (
    <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h1 className="mb-1 text-xl font-bold text-teal-dark">אימות מחשב חדש</h1>
      <p className="mb-4 text-sm text-gray-600">
        זיהינו כניסה ממחשב או דפדפן שלא זוהו בעבר. יש לאמת עם קוד שנשלח לאימייל.
      </p>
      {step === "start" ? (
        <button
          type="button"
          onClick={handleSendCode}
          disabled={isPending}
          className="w-full rounded-lg bg-teal px-4 py-2 font-medium text-white transition hover:bg-teal-dark disabled:opacity-60"
        >
          {isPending ? "שולח..." : "שלח קוד לאימייל"}
        </button>
      ) : (
        <>
          {message && <p className="mb-2 text-sm text-gray-600">{message}</p>}
          <label className="block text-sm text-gray-700">קוד בן 6 ספרות</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setCode(e.target.value)}
            dir="ltr"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest focus:border-teal focus:outline-none"
          />
          <label className="mt-3 flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            זכור מחשב זה למשך 180 יום
          </label>
          {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleVerify}
            disabled={isPending || code.length !== 6}
            className="mt-3 w-full rounded-lg bg-teal px-4 py-2 font-medium text-white transition hover:bg-teal-dark disabled:opacity-60"
          >
            {isPending ? "מאמת..." : "אמת והמשך"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("start");
              setCode("");
              setError(null);
              setMessage(null);
            }}
            className="mt-2 w-full text-sm text-gray-500 underline"
          >
            שלח קוד חדש
          </button>
        </>
      )}
    </div>
  );
}
