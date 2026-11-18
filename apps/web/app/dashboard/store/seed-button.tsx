"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { seedStoreProceduresAction } from "./actions";

export function SeedProceduresButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState("");
  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        className="btn-outline text-xs disabled:opacity-40"
        onClick={() =>
          startTransition(async () => {
            try {
              const r = await seedStoreProceduresAction();
              setMsg(r.created ? `נטענו ${r.created} נהלים` : "הנהלים כבר קיימים");
              router.refresh();
            } catch (e) {
              setMsg(e instanceof Error ? e.message : "שגיאה");
            }
          })
        }
      >
        טעינת נהלי ברירת מחדל לחנות
      </button>
      {msg ? <span className="text-xs text-muted">{msg}</span> : null}
    </div>
  );
}
