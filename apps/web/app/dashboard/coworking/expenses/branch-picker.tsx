"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { Branch } from "@ultranet/shared-types";

export function BranchPicker({ branches, branchId }: { branches: Branch[]; branchId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <select
      value={branchId}
      disabled={isPending}
      onChange={(e) => startTransition(() => router.push(`/dashboard/coworking/expenses?branchId=${e.target.value}`))}
      className="rounded-lg border border-card-border bg-white px-3 py-1.5 text-sm font-semibold text-ink focus:border-teal focus:outline-none"
    >
      {branches.map((b) => (
        <option key={b.id} value={b.id}>
          {b.name}
        </option>
      ))}
    </select>
  );
}
