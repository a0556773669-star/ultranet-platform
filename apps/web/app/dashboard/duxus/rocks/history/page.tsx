import { Target } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { DuxusTabs } from "../../duxus-tabs";
import { RocksTabs } from "../rocks-tabs";
import { getDoneMilestones, getAllRocks, listReviews } from "../actions";
import { quarterLabel } from "../date-utils";
import { buildRocksById, rockBreadcrumb } from "../rock-lookup";
import type { RockStatus } from "@ultranet/shared-types";

const STATUS_LABEL: Record<RockStatus, string> = { active: "פעיל", done: "הושלם", dropped: "בוטל" };
const STATUS_CLASS: Record<RockStatus, string> = {
  active: "border-teal bg-teal-bg text-teal-dark",
  done: "border-emerald-300 bg-emerald-50 text-emerald-700",
  dropped: "border-card-border bg-[#f4f6f9] text-muted",
};

const PERIOD_LABEL = { quarterly: "רבעון", monthly: "חודש", weekly: "שבוע" } as const;

function formatDate(ts?: number): string {
  if (!ts) return "";
  return new Date(ts).toLocaleDateString("he-IL");
}

export default async function RocksHistoryPage() {
  await requireModuleAccess("duxus");

  const [doneMilestones, rocks, quarterlyReviews, monthlyReviews, weeklyReviews] = await Promise.all([
    getDoneMilestones(),
    getAllRocks(),
    listReviews("quarterly"),
    listReviews("monthly"),
    listReviews("weekly"),
  ]);

  const rocksById = buildRocksById(rocks);
  const rocksByQuarter = new Map<string, typeof rocks>();
  rocks
    .filter((r) => !r.parentRockId)
    .forEach((r) => {
      const list = rocksByQuarter.get(r.quarterKey) ?? [];
      list.push(r);
      rocksByQuarter.set(r.quarterKey, list);
    });
  const quarters = Array.from(rocksByQuarter.keys()).sort().reverse();

  return (
    <div>
      <h1 className="mb-4 flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
        <Target className="h-5 w-5" />
        משימות ונהלים
      </h1>
      <DuxusTabs />
      <RocksTabs />

      <div className="card mb-4">
        <h2 className="mb-3 text-sm font-bold text-ink">אבני דרך שהושלמו ({doneMilestones.length})</h2>
        {doneMilestones.length === 0 ? (
          <div className="text-sm text-muted">עדיין אין אבני דרך שהושלמו.</div>
        ) : (
          <div className="flex flex-col gap-2">
            {doneMilestones.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm"
              >
                <div>
                  <div className="font-semibold text-emerald-800">{m.title}</div>
                  <div className="text-[11px] text-emerald-700/80">
                    {rockBreadcrumb(m.rockId, rocksById)}
                    {m.ownerName ? ` · ${m.ownerName}` : ""}
                  </div>
                </div>
                <span className="shrink-0 rounded-full border border-emerald-300 bg-white px-2 py-0.5 text-[11px] font-bold text-emerald-700">
                  {formatDate(m.doneAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card mb-4">
        <h2 className="mb-3 text-sm font-bold text-ink">סלעים לפי רבעון</h2>
        {quarters.length === 0 ? (
          <div className="text-sm text-muted">עדיין אין סלעים.</div>
        ) : (
          <div className="flex flex-col gap-4">
            {quarters.map((q) => (
              <div key={q}>
                <div className="mb-2 text-xs font-bold text-muted">{quarterLabel(q)}</div>
                <div className="flex flex-col gap-2">
                  {(rocksByQuarter.get(q) ?? []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-card-border bg-white px-3 py-2 text-sm">
                      <span className="text-ink">{r.title}</span>
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-bold ${STATUS_CLASS[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <h2 className="mb-3 text-sm font-bold text-ink">סיכומי פגישות</h2>
        <div className="flex flex-col gap-3">
          {([
            ["quarterly", quarterlyReviews],
            ["monthly", monthlyReviews],
            ["weekly", weeklyReviews],
          ] as const).map(([period, reviews]) => (
            <details key={period} className="rounded-lg border border-card-border bg-[#f9fafb] p-3">
              <summary className="cursor-pointer text-xs font-bold text-ink">
                {PERIOD_LABEL[period]} ({reviews.length})
              </summary>
              {reviews.length === 0 ? (
                <div className="mt-2 text-xs text-muted">אין עדיין סיכומים.</div>
              ) : (
                <div className="mt-2 flex flex-col gap-2">
                  {reviews.map((r) => (
                    <div key={r.id} className="rounded-lg border border-card-border bg-white p-2 text-xs text-ink">
                      <div className="mb-1 flex items-center justify-between font-bold text-muted">
                        <span>{r.periodKey}</span>
                        {r.createdBy ? <span className="font-normal">{r.createdBy}</span> : null}
                      </div>
                      <div className="whitespace-pre-wrap">{r.notes}</div>
                    </div>
                  ))}
                </div>
              )}
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
