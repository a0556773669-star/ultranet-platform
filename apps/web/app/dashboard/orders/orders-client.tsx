"use client";

import type { OrdersSnapshot } from "./actions";

export function OrdersClient({ snapshot }: { snapshot: OrdersSnapshot }) {
  const { reorder, stats } = snapshot;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{stats.lowStockCount}</p>
          <p className="text-xs text-gray-500">פריטים להזמנה</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{stats.progressTickets}</p>
          <p className="text-xs text-gray-500">פניות בטיפול</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{stats.openTickets}</p>
          <p className="text-xs text-gray-500">פניות פתוחות</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{stats.tasksDoneThisWeek}/{stats.tasksTotal}</p>
          <p className="text-xs text-gray-500">משימות בוצעו השבוע</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-4">
        <h2 className="mb-3 text-lg font-bold text-gray-800">📦 פריטים להזמנה</h2>
        {reorder.length === 0 && (
          <p className="text-sm text-gray-500">אין צורך בהזמנות כרגע!</p>
        )}
        {reorder.length > 0 && (
          <div className="space-y-2">
            {reorder.map((r, i) => (
              <div
                key={`${r.branchKey}-${r.product}-${i}`}
                className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-gray-800">{r.product}</span>
                <span className="text-gray-500">{r.branchLabel}</span>
                <span className="text-red-600">כמות: {r.qty} (מינימום {r.min})</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
