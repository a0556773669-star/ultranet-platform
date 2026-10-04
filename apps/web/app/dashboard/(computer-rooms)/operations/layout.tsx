import { requireAnyModuleAccess, resolveModuleScope } from "@/lib/perms";
import { OperationsTabs } from "./operations-tabs";

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  // תפעול נפתח גם ל"מלאי" וגם ל"משימות": שתי ההרשאות מובילות לכאן, וכל טאב בפנים נשמר
  // בנפרד. `computers` ראשון כי הוא זה שקובע את הסניף והתפקיד של ההקשר.
  const session = await requireAnyModuleAccess(["computers", "tasks"]);
  const stockScope = resolveModuleScope(session, "computers");
  const tasksScope = resolveModuleScope(session, "tasks");

  return (
    <div className="space-y-4">
      <OperationsTabs
        isOwner={stockScope.isOwner}
        canStock={stockScope.granted}
        canTasks={stockScope.granted || tasksScope.granted}
      />
      {children}
    </div>
  );
}
