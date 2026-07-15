import { Laptop } from "lucide-react";
import { requireModuleAccess } from "@/lib/perms";
import { RentalsTabs } from "./rentals-tabs";

export default async function RentalsLayout({ children }: { children: React.ReactNode }) {
  const session = await requireModuleAccess("rentals");
  const isOwner = session.user?.role === "owner";

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-1.5 text-[21px] font-extrabold text-ink">
          <Laptop className="h-4 w-4" />
          {"השכרות"}
        </h1>
        <p className="text-sm text-muted">סניפים, מחשבים, לקוחות, השכרות והנה\"ח</p>
      </div>
      <RentalsTabs isOwner={isOwner} />
      {children}
    </div>
  );
}
