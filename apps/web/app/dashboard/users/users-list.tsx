"use client";

import Link from "next/link";
import { Fragment, useState } from "react";
import { Search } from "lucide-react";
import { DeleteButton } from "./delete-button";

export type UserRow = {
  id: string;
  name: string;
  email: string;
  roles: string[];
  roleKeys: string[];
  branches: string;
  perms: { label: string; on: boolean }[];
  allOwner: boolean;
};

/**
 * רשימת המשתמשים — שורה קצרה לכל אדם: שם, תפקיד וסניפים, עם חיפוש וסינון תפקיד (אפיון שדרוג
 * v2, סעיף 12). פרטי ההרשאות נפתחים בלחיצה. המחיקה ומסך העריכה ללא שינוי.
 */
export function UsersList({ rows, deleteActions }: { rows: UserRow[]; deleteActions: Record<string, () => void> }) {
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const query = q.trim().toLowerCase();
  const visible = rows.filter(
    (r) =>
      (!role || r.roleKeys.includes(role)) &&
      (!query || r.name.toLowerCase().includes(query) || r.email.toLowerCase().includes(query) || r.branches.toLowerCase().includes(query)),
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="חיפוש לפי שם, מייל או סניף..."
            className="w-full rounded-[10px] border border-card-border bg-white py-1.5 pl-3 pr-9 text-sm focus:border-teal focus:outline-none"
          />
        </div>
        {[
          ["", "כולם"],
          ["owner", "בעלים"],
          ["partner", "שותפים"],
          ["employee", "עובדים"],
        ].map(([key, label]) => (
          <button key={key} type="button" onClick={() => setRole(key!)} className={role === key ? "pill-active" : "pill-inactive"}>
            {label}
          </button>
        ))}
        <span className="text-xs text-muted">{`${visible.length} משתמשים`}</span>
      </div>

      <div className="overflow-hidden rounded-card border border-card-border bg-white shadow-card">
        <table className="w-full text-[13px]">
          <thead className="bg-[#f4f6f9] text-muted">
            <tr>
              <th className="px-3 py-2 text-right text-[11px] font-bold">שם</th>
              <th className="px-3 py-2 text-right text-[11px] font-bold">תפקיד</th>
              <th className="hidden px-3 py-2 text-right text-[11px] font-bold sm:table-cell">סניפים</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => (
              <Fragment key={r.id}>
                <tr className="border-t border-card-border">
                  <td className="px-3 py-2">
                    <div className="font-bold text-ink">{r.name}</div>
                    <div className="text-[11px] text-muted">{r.email}</div>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex flex-wrap gap-1">
                      {r.roles.map((label, i) => (
                        <span key={i} className="rounded-full border border-teal bg-teal-bg px-2 py-0.5 text-[11px] font-bold text-teal-dark">
                          {label}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="hidden px-3 py-2 text-[12px] text-muted sm:table-cell">{r.branches}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-end gap-2">
                      {!r.allOwner && (
                        <button
                          type="button"
                          onClick={() => setOpenId(openId === r.id ? null : r.id)}
                          className="text-xs font-bold text-teal hover:underline"
                        >
                          {openId === r.id ? "הסתרת הרשאות" : "הרשאות"}
                        </button>
                      )}
                      <Link
                        href={`/dashboard/users/${r.id}`}
                        className="rounded-lg border border-card-border px-3 py-1.5 text-xs font-bold text-ink transition hover:border-teal hover:text-teal"
                      >
                        עריכה
                      </Link>
                      <form action={deleteActions[r.id]}>
                        <DeleteButton />
                      </form>
                    </div>
                  </td>
                </tr>
                {openId === r.id && (
                  <tr className="border-t border-card-border bg-[#fafbfc]">
                    <td colSpan={4} className="px-3 py-2">
                      <div className="flex flex-wrap gap-1.5">
                        {r.perms.map((p) => (
                          <span
                            key={p.label}
                            className={
                              p.on
                                ? "rounded-full border border-teal bg-teal-bg px-2.5 py-1 text-[11px] font-bold text-teal-dark"
                                : "rounded-full border border-card-border bg-[#f4f6f9] px-2.5 py-1 text-[11px] font-bold text-muted"
                            }
                          >
                            {p.label}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-sm text-muted">
                  לא נמצאו משתמשים
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
