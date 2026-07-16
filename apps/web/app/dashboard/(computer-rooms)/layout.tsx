import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Monitor } from "lucide-react";
import { authOptions } from "@/lib/auth";
import type { PermKey } from "@/lib/perms";
import { ComputerRoomsTabs } from "./computer-rooms-tabs";

export default async function ComputerRoomsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  const role = session.user?.role ?? "employee";
  const isOwner = role === "owner";
  const perms = (session.user as { perms?: Partial<Record<PermKey, boolean>> } | undefined)?.perms;
  const has = (key?: PermKey) => !key || isOwner || Boolean(perms?.[key]);

  if (!(has("branches") || has("computers") || has("tasks"))) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Monitor className="h-5 w-5" />
          {"חדרי מחשבים"}
        </h1>
        <p className="text-sm text-muted">{"סניפים, מלאי, משימות, פניות, עדכונים והזמנות"}</p>
      </div>
      <ComputerRoomsTabs isOwner={isOwner} perms={perms} />
      {children}
    </div>
  );
}
