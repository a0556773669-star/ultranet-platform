"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/**
 * כפתור העתקה קטן ליד טלפון/מייל (אפיון שדרוג v2, מסמך המשך 1 סעיף 6). לא מיועד לפרטי תשלום.
 * כשהדפדפן חוסם גישה ללוח, הערך מסומן כדי שאפשר יהיה להעתיק ידנית.
 */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  if (!value) return null;
  return (
    <button
      type="button"
      title={`העתקת ${label}`}
      aria-label={`העתקת ${label}`}
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          })
          .catch(() => window.prompt?.(`העתקת ${label}`, value));
      }}
      className="inline-flex h-5 w-5 items-center justify-center rounded text-muted transition hover:bg-gray-100 hover:text-teal-dark"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-teal" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}
