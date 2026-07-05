"use client";

import { useState, useTransition, type ChangeEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import emailjs from "@emailjs/browser";
import { requestLoginCodeAction } from "./actions";

// אותו שירות EmailJS שכבר בשימוש במערכת המלאי (אולטרה-נט) - מפתח ציבורי, לא סודי.
const EMAILJS_SERVICE_ID = "service_u6n37yv";
const EMAILJS_TEMPLATE_ID = "template_ca93kim";
const EMAILJS_PUBLIC_KEY = "mEEvU9GRHAcCvVCxi";

export function EmailCodeForm() {
  const [step, setStep] = useState<"email" | "code">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSendCode() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("email", email);
      const result = await requestLoginCodeAction(undefined, fd);
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
            to_email: email,
            name: result.name,
            title: "קוד התחברות למערכת אולטרנט",
            branch: "-",
            message: `קוד ההתחברות שלך הוא: ${result.code}\nהקוד בתוקף ל-10 דקות.`,
            date:
              now.toLocaleDateString("he-IL") +
              " " +
              now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }),
            email,
          },
          { publicKey: EMAILJS_PUBLIC_KEY }
        );
        setMessage("קוד נשלח לאימייל שלך");
        setStep("code");
      } catch (err) {
        console.error("שליחת מייל הקוד נכשלה", err);
        setError("שליחת המייל נכשלה. נסה שוב.");
      }
    });
  }

  function handleVerify() {
    setError(null);
    startTransition(async () => {
      const res = await signIn("email-code", { email, code, redirect: false });
      if (!res || res.error) {
        setError("קוד שגוי או שפג תוקפו, נסה שוב");
      } else {
        router.push("/dashboard");
        router.refresh();
      }
    });
  }

  return (
    <div className="space-y-3">
      {step === "email" ? (
        <>
          <label className="block text-sm text-gray-700">אימייל</label>
          <input
            type="email"
            value={email}
            onChange={(e: ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
            dir="ltr"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-teal focus:outline-none"
            placeholder="you@example.com"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSendCode}
            disabled={isPending || !email}
            className="w-full rounded-lg bg-teal px-4 py-2 font-medium text-white transition hover:bg-teal-dark disabled:opacity-60"
          >
            {isPending ? "שולח..." : "שלח קוד לאימייל"}
          </button>
        </>
      ) : (
        <>
          {message && <p className="text-sm text-gray-600">{message}</p>}
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleVerify}
            disabled={isPending || code.length !== 6}
            className="w-full rounded-lg bg-teal px-4 py-2 font-medium text-white transition hover:bg-teal-dark disabled:opacity-60"
          >
            {isPending ? "מאמת..." : "התחבר"}
          </button>
          <button
            type="button"
            onClick={() => {
              setStep("email");
              setCode("");
              setError(null);
              setMessage(null);
            }}
            className="w-full text-sm text-gray-500 underline"
          >
            שלח קוד חדש / שנה אימייל
          </button>
        </>
      )}
    </div>
  );
}
