import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { Monitor } from "lucide-react";
import { authOptions } from "@/lib/auth";
import { getAssignments, resolveModuleScope, unionPerms, type PermKey } from "@/lib/perms";
import { ComputerRoomsTabs } from "./computer-rooms-tabs";

export default async function ComputerRoomsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login");

  // הכובע שחל בחדרי מחשבים — לא בהכרח התפקיד הראשי של המשתמש: מי ששותף בסניף השכרות
  // וגם עובד בחדר מחשבים נכנס לכאן כעובד. ראה `resolveModuleScope`.
  const scope = resolveModuleScope(session, "computers");
  const perms = unionPerms(getAssignments(session));
  const has = (key: PermKey) => scope.isOwner || Boolean(perms[key]);

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
        <p className="text-sm text-muted">{"סניפים, תפעול (מלאי ומשימות), הוצאות והנהלת חשבונות"}</p>
      </div>
      <ComputerRoomsTabs isOwner={scope.isOwner} isManager={scope.isManager} perms={perms} />
      {children}
    </div>
  );
}
