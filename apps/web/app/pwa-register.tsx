"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      // Pick up a new service worker (= new deploy) as soon as it's found,
      // instead of waiting for a full close-and-reopen of the app.
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "activated") {
            window.location.reload();
          }
        });
      });
    });
  }, []);

  return null;
}
