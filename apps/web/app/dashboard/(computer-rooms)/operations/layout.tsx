import { getServerSession } from "next-auth";
import { requireModuleAccess } from "@/lib/perms";
import { authOptions } from "@/lib/auth";
import { OperationsTabs } from "./operations-tabs";

export default async function OperationsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("computers");
  const session = await getServerSession(authOptions);
  const isOwner = session?.user?.role === "owner";

  return (
    <div className="space-y-4">
      <OperationsTabs isOwner={isOwner} />
      {children}
    </div>
  );
}
