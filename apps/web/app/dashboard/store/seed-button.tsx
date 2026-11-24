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
              const res = await seedStoreProceduresAction();
              if (!res.ok) {
                setMsg(res.error);
                return;
              }
              setMsg(res.data.created ? `נטענו ${res.data.created} נהלים` : "הנהלים כבר קיימים");
              router.refresh();
            } catch {
              setMsg("אירעה שגיאה בחיבור לשרת");
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
