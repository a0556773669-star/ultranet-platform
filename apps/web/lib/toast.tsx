"use client";

import { useCallback, useEffect, useState } from "react";

type ToastState = { kind: "success" | "error"; text: string } | null;

/**
 * Self-contained per-component toast: no provider needed, each caller owns its own
 * transient message. Used after mutations (delete/edit/etc.) to confirm the action
 * actually happened, since these are fire-and-forget server actions with no other
 * feedback once the triggering button/modal closes.
 */
export function useToast() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const showSuccess = useCallback((text: string) => setToast({ kind: "success", text }), []);
  const showError = useCallback((text: string) => setToast({ kind: "error", text }), []);

  const toastNode = toast ? (
    <div
      role="status"
      className={`fixed bottom-5 left-1/2 z-[200] -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-bold text-white shadow-lg ${
        toast.kind === "success" ? "bg-emerald-600" : "bg-red-600"
      }`}
    >
      {toast.text}
    </div>
  ) : null;

  return { showSuccess, showError, toastNode };
}
