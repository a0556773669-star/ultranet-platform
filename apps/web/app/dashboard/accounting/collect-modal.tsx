"use client";

import { useState } from "react";
import type { CollectionRoute } from "@ultranet/shared-types";
import { manualChargeAction } from "./actions";

const FIELD =
  "rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none";

const TITLE = "💳 גביה דנית ממסלול";

export default function CollectModal({ routes }: { routes: CollectionRoute[] }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-full min-h-[96px] w-full flex-col items-start justify-center gap-1 rounded-card border border-dashed border-teal bg-teal-bg p-4 text-right shadow-card transition hover:opacity-90"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-teal-dark">{TITLE}</span>
        <span className="text-[13px] text-muted">{"לחץ לפתיחת חלון גביה"}</span>
      </button>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-card bg-white p-5 shadow-card"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-extrabold text-ink">{TITLE}</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-lg text-muted transition hover:text-ink"
              >
                ✕
              </button>
            </div>
            <form
              action={async (formData: FormData) => {
                await manualChargeAction(formData);
                setOpen(false);
              }}
              className="flex flex-col gap-2.5"
            >
              <select name="routeId" required className={FIELD}>
                <option value="">{"בחר מסלול גביה"}</option>
                {routes.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <input type="date" name="date" required className={FIELD} />
              <input name="desc" placeholder={"תיאור"} className={FIELD} />
              <input
                type="number"
                name="amount"
                min={0}
                placeholder={"סכום לחיוב"}
                required
                className={FIELD}
              />
              <select name="business" className={FIELD}>
                <option value="general">{"כללי"}</option>
                <option value="computers">{"מחשבים"}</option>
                <option value="rentals">{"השכרות"}</option>
                <option value="coworking">{"משרד שיתופי"}</option>
              </select>
              <button
                type="submit"
                className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
              >
                {"חיוב עכשיו"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
