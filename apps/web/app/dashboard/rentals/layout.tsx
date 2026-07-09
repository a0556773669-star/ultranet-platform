import { requireModuleAccess } from "@/lib/perms";
import { RentalsTabs } from "./rentals-tabs";

export default async function RentalsLayout({ children }: { children: React.ReactNode }) {
  await requireModuleAccess("rentals");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-[21px] font-extrabold text-ink">💻 השכרות</h1>
        <p className="text-sm text-muted">סניפים, מחשבים, לקוחות, השכרות והנה\"ח</p>
      </div>
      <RentalsTabs />
      {children}
    </div>
  );
}
