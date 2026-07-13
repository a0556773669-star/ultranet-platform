"use client";

import { useMemo, useState } from "react";

type Props = {
  computerWidthMm: number;
  computerHeightMm: number;
  stickWidthMm: number;
  stickHeightMm: number;
  computerFontSizePt: number;
  stickFontSizePt: number;
  infoFontSizePt: number;
  fontFamily: string;
  textColor: string;
  wifiName: string;
  wifiCode: string;
  logoUrl?: string;
  myComputers?: { id: string; name: string }[];
};

function parseRanges(input: string): number[] {
  const nums = new Set<number>();
  input
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .forEach((part) => {
      const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const start = Number(rangeMatch[1]);
        const end = Number(rangeMatch[2]);
        const [from, to] = start <= end ? [start, end] : [end, start];
        for (let n = from; n <= to; n++) nums.add(n);
      } else if (/^\d+$/.test(part)) {
        nums.add(Number(part));
      }
    });
  return Array.from(nums).sort((a, b) => a - b);
}

export default function LabelPrintClient({
  computerWidthMm,
  computerHeightMm,
  stickWidthMm,
  stickHeightMm,
  computerFontSizePt,
  stickFontSizePt,
  infoFontSizePt,
  fontFamily,
  textColor,
  wifiName,
  wifiCode,
  logoUrl,
  myComputers = [],
}: Props) {
  const [computerInput, setComputerInput] = useState("");
  const [stickInput, setStickInput] = useState("");
  const [selectedComputerIds, setSelectedComputerIds] = useState<Set<string>>(
    () => new Set(myComputers.map((c) => c.id))
  );

  const computerNumbers = useMemo(() => parseRanges(computerInput), [computerInput]);
  const stickNumbers = useMemo(() => parseRanges(stickInput), [stickInput]);

  const hasLabels = computerNumbers.length > 0 || stickNumbers.length > 0 || selectedComputerIds.size > 0;

  function Logo() {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt="אולטרנט"
          style={{ maxWidth: "70%", maxHeight: "32%", objectFit: "contain", display: "block" }}
        />
      );
    }
    return <span style={{ fontSize: "0.7em", fontWeight: 800, lineHeight: 1 }}>{"אולטרנט"}</span>;
  }

  return (
    <div className="flex flex-col gap-4">
      <style>{`
        @media print {
          @page { margin: 10mm; }
          body * { visibility: hidden; }
          #label-print-area, #label-print-area * { visibility: visible; }
          #label-print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 0;
            border: none;
          }
        }
        .label-box { page-break-inside: avoid; break-inside: avoid; }
      `}</style>

      <div className="card flex flex-col gap-3">
        {myComputers.length > 0 && (
          <div className="flex flex-col gap-2 rounded-lg border border-card-border bg-[#f9fafb] p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-ink">{"מחשבי הסניף שלי"}</span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedComputerIds(new Set(myComputers.map((c) => c.id)))}
                  className="text-xs font-semibold text-teal-dark hover:underline"
                >
                  {"בחר הכל"}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedComputerIds(new Set())}
                  className="text-xs font-semibold text-muted hover:underline"
                >
                  {"נקה בחירה"}
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {myComputers.map((c) => (
                <label
                  key={c.id}
                  className="flex items-center gap-1 rounded-full border border-card-border bg-white px-2 py-1 text-xs font-medium text-ink"
                >
                  <input
                    type="checkbox"
                    checked={selectedComputerIds.has(c.id)}
                    onChange={() => {
                      setSelectedComputerIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id);
                        else next.add(c.id);
                        return next;
                      });
                    }}
                  />
                  {c.name}
                </label>
              ))}
            </div>
          </div>
        )}
        <h1 className="text-lg font-extrabold text-ink">{"הדפסת מדבקות"}</h1>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {"מספרי מחשבים (למשל: 15, 16, 17 או 1-20)"}
          <input
            value={computerInput}
            onChange={(e) => setComputerInput(e.target.value)}
            placeholder="15, 16, 17"
            className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-ink">
          {"מספרי סטיקים (למשל: 15, 16, 17 או 1-20)"}
          <input
            value={stickInput}
            onChange={(e) => setStickInput(e.target.value)}
            placeholder="15, 16, 17"
            className="rounded-lg border border-card-border bg-[#f4f6f9] px-3 py-2 text-sm focus:border-teal focus:bg-white focus:outline-none"
          />
        </label>
        <button
          type="button"
          disabled={!hasLabels}
          onClick={() => window.print()}
          className="self-start rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-5 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90 disabled:opacity-40"
        >
          {"הדפסה"}
        </button>
        <p className="text-xs text-muted">{`סה\"כ מדבקות: ${computerNumbers.length + stickNumbers.length + selectedComputerIds.size}`}</p>
      </div>

      <div id="label-print-area" className="flex flex-wrap gap-2 rounded-card border border-dashed border-card-border bg-white p-4">
        {computerNumbers.map((n) => (
          <div
            key={`computer-${n}`}
            className="label-box flex flex-col items-center justify-center border border-black/20 bg-white text-center"
            style={{ width: `${computerWidthMm}mm`, height: `${computerHeightMm}mm`, fontFamily, color: textColor }}
          >
            <Logo />
            <span style={{ fontSize: `${computerFontSizePt}pt`, fontWeight: 700, lineHeight: 1.1 }}>{`מחשב ${n}`}</span>
          </div>
        ))}
        {myComputers
            .filter((c) => selectedComputerIds.has(c.id))
            .map((c) => (
              <div
                key={`mycomputer-${c.id}`}
                className="label-box flex flex-col items-center justify-center border border-black/20 bg-white text-center"
                style={{ width: `${computerWidthMm}mm`, height: `${computerHeightMm}mm`, fontFamily, color: textColor }}
              >
                <Logo />
                <span style={{ fontSize: `${computerFontSizePt}pt`, fontWeight: 700, lineHeight: 1.1 }}>{c.name}</span>
              </div>
            ))}
          {stickNumbers.map((n) => (
          <div
            key={`stick-${n}`}
            className="label-box flex flex-col items-center justify-center border border-black/20 bg-white px-1 text-center"
            style={{ width: `${stickWidthMm}mm`, height: `${stickHeightMm}mm`, fontFamily, color: textColor }}
          >
            <Logo />
            <span style={{ fontSize: `${stickFontSizePt}pt`, fontWeight: 700, lineHeight: 1.1 }}>{`סטיק ${n}`}</span>
            <div className="flex w-full justify-between" style={{ fontSize: `${infoFontSizePt}pt`, lineHeight: 1.1 }}>
              <span>{`WIFI: ${wifiName}`}</span>
              <span>{`קוד: ${wifiCode}`}</span>
            </div>
          </div>
        ))}
        {!hasLabels && (
          <p className="w-full text-center text-sm text-muted">{"הזן מספרים למעלה כדי לראות תצוגה מקדימה"}</p>
        )}
      </div>
    </div>
  );
}
