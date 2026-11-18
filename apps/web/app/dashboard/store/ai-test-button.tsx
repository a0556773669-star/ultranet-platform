"use client";

import { useState, useTransition } from "react";
import { testAiConnectionAction } from "./actions";

export function AiTestButton() {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="btn-outline text-xs disabled:opacity-40"
        onClick={() => startTransition(async () => setResult(await testAiConnectionAction()))}
      >
        {pending ? "בודק..." : "בדיקת חיבור AI"}
      </button>
      {result ? <span className={`text-xs font-semibold ${result.ok ? "text-teal-dark" : "text-red-700"}`}>{result.message}</span> : null}
    </div>
  );
}
