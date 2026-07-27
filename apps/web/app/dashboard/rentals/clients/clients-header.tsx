"use client";

import { useState } from "react";
import { Users, Plus, X } from "lucide-react";
import type { Branch } from "@ultranet/shared-types";
import { ClientForm } from "./client-form";

export function ClientsHeader({
  action,
  branches,
  isOwner,
  myBranchId,
  defaultOpen,
}: {
  action: (formData: FormData) => void;
  branches: Branch[];
  isOwner: boolean;
  myBranchId?: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  const [presetBranchId, setPresetBranchId] = useState<string | undefined>(undefined);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          לקוחות
          <Users className="h-5 w-5" />
        </h1>
        <div className="flex items-center gap-2">
          {open ? (
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
            >
              <X className="h-4 w-4" />
              ביטול
            </button>
          ) : (
            <>
              {isOwner && myBranchId && (
                <button
                  type="button"
                  onClick={() => {
                    setPresetBranchId(myBranchId);
                    setOpen(true);
                  }}
                  className="flex items-center gap-1.5 rounded-[10px] border border-teal bg-white px-4 py-2 text-sm font-bold text-teal-dark transition hover:bg-teal-bg"
                >
                  <Plus className="h-4 w-4" />
                  הוספת לקוח לסניף ראשי
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setPresetBranchId(undefined);
                  setOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-[10px] bg-gradient-to-br from-teal to-teal-light px-4 py-2 text-sm font-bold text-white shadow-primary transition hover:opacity-90"
              >
                <Plus className="h-4 w-4" />
                הוספת לקוח
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <ClientForm
          action={action}
          branches={branches}
          isOwner={isOwner}
          myBranchId={myBranchId}
          presetBranchId={presetBranchId}
        />
      )}
    </div>
  );
}
