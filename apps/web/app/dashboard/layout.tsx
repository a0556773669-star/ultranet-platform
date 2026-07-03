import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { SignOutButton } from "./sign-out-button";

const NAV_ITEMS = [
  { href: "/dashboard", label: "סקירה כללית" },
  { href: "/dashboard/branches", label: "סניפים" },
  { href: "/dashboard/rentals", label: "השכרות" },
  { href: "/dashboard/coworking", label: "קוורקינג" },
  { href: "/dashboard/accounting", label: "הנהלת חשבונות" },
];

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect("/login");
  }

  const role = session.user?.role ?? "";
  const name = session.user?.name ?? session.user?.email ?? "";

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="hidden w-60 flex-col border-l border-gray-200 bg-white p-4 md:flex">
        <div className="mb-6 text-xl font-bold text-teal-dark">אולטרנט</div>
        <nav className="flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
          <div className="text-sm text-gray-500">
            שלום, <span className="font-medium text-gray-800">{name}</span>
            {role && (
              <span className="mr-2 rounded-full border border-teal px-2 py-0.5 text-xs text-teal-dark">
                {role}
              </span>
            )}
          </div>
          <SignOutButton />
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
