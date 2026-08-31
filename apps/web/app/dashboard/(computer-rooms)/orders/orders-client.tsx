"use client";

import { Package, Circle, CheckCircle2 } from "lucide-react";
import type { OrdersSnapshot } from "./actions";

function StatCard({
  value,
  label,
  icon: Icon,
  iconClassName,
  color,
  accent,
}: {
  value: string | number;
  label: string;
  icon: typeof Package;
  iconClassName?: string;
  color: string;
  accent: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-card border border-card-border bg-white p-4 text-center shadow-card">
      <span className={`absolute right-0 top-0 h-full w-1 ${accent}`} />
      <p className={`text-2xl font-black ${color}`}>{value}</p>
      <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-muted">
        <Icon className={iconClassName ?? "h-3.5 w-3.5"} />
        {label}
      </p>
    </div>
  );
}

export function OrdersClient({ snapshot }: { snapshot: OrdersSnapshot }) {
  const { reorder, stats } = snapshot;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard value={stats.lowStockCount} label="פריטים להזמנה" icon={Package} color="text-red-600" accent="bg-red-500" />
        <StatCard
          value={stats.progressTickets}
          label="פניות בטיפול"
          icon={Circle}
          iconClassName="h-3.5 w-3.5 fill-current text-amber-500"
          color="text-amber-600"
          accent="bg-amber-500"
        />
        <StatCard
          value={stats.openTickets}
          label="פניות פתוחות"
          icon={Circle}
          iconClassName="h-3.5 w-3.5 fill-current text-red-500"
          color="text-red-500"
          accent="bg-red-400"
        />
        <StatCard
          value={`${stats.tasksDoneThisWeek}/${stats.tasksTotal}`}
          label="משימות בוצעו השבוע"
          icon={CheckCircle2}
          color="text-emerald-600"
          accent="bg-emerald-500"
        />
      </div>

      <div className="rounded-card border border-card-border bg-white p-4 shadow-card">
        <h2 className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted">
          <Package className="h-4 w-4" />
          פריטים להזמנה
        </h2>
        {reorder.length === 0 && (
          <div className="rounded-lg border border-dashed border-card-border py-8 text-center text-sm text-muted">
            אין צורך בהזמנות כרגע!
          </div>
        )}
        {reorder.length > 0 && (
          <div className="space-y-2">
            {reorder.map((r, i) => (
              <div
                key={`${r.branchKey}-${r.product}-${i}`}
                className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm"
              >
                <span className="font-bold text-ink">{r.product}</span>
                <span className="text-muted">{r.branchLabel}</span>
                <span className="font-semibold text-red-600">כמות: {r.qty} (מינימום {r.min})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
