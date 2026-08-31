"use client";

import { useMemo, useState } from "react";
import type { RentalClient } from "@ultranet/shared-types";

const FIELD =
  "w-full rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none disabled:opacity-60";

function matches(client: RentalClient, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return client.name.toLowerCase().includes(q) || (client.phone ?? "").includes(q);
}

/** תיבת חיפוש-ובחירה מהירה של לקוח, לפי שם או טלפון. */
export function CustomerCombobox({
  clients,
  value,
  onChange,
  placeholder = "הקלד שם או טלפון לחיפוש לקוח...",
}: {
  clients: RentalClient[];
  value: string;
  onChange: (clientId: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);

  const selected = clients.find((c) => c.id === value) ?? null;

  const results = useMemo(() => clients.filter((c) => matches(c, query)).slice(0, 8), [clients, query]);

  function selectClient(c: RentalClient) {
    onChange(c.id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input type="hidden" name="clientId" value={value} />
      {selected ? (
        <div className="flex items-center justify-between rounded-lg border border-teal bg-teal-bg px-3 py-2 text-sm">
          <span className="font-semibold text-ink">
            {selected.name}
            {selected.phone ? ` · ${selected.phone}` : ""}
          </span>
          <button
            type="button"
            onClick={() => onChange("")}
            className="text-xs font-bold text-teal-dark hover:underline"
          >
            החלף לקוח
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={placeholder}
          autoComplete="off"
          className={FIELD}
        />
      )}
      {open && !selected && (
        <div className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-card-border bg-white shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted">לא נמצאו לקוחות תואמים</div>
          ) : (
            results.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => selectClient(c)}
                className="flex w-full items-center justify-between px-3 py-2 text-right text-sm transition hover:bg-[#f4f6f9]"
              >
                <span className="font-semibold text-ink">{c.name}</span>
                <span className="text-xs text-muted" dir="ltr">
                  {c.phone ?? ""}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
