"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ChevronsLeft, ChevronsRight, Menu, X } from "lucide-react";

export type SideNavItem = { href: string; label: string; icon: ReactNode; group: "main" | "tools" };

const COLLAPSE_KEY = "ultranet-sidenav-collapsed";

/**
 * תפריט צד מימין (אפיון שדרוג v2, סעיף 2): אזורי העבודה למעלה, "כלים וניהול" למטה.
 * במסך רחב אפשר לצמצם לאייקונים (נשמר בדפדפן); במסך צר הוא הופך לכפתור "תפריט" שנפתח.
 * הסינון לפי הרשאות נעשה בשרת (`layout.tsx`) — כאן רק התצוגה.
 */
export function SideNav({
  items,
  logo,
  variant,
}: {
  items: SideNavItem[];
  logo?: ReactNode;
  /** "desktop" = הסרגל עצמו (מוסתר במסך צר); "mobile" = כפתור "תפריט" לכותרת (מוסתר במסך רחב). */
  variant: "desktop" | "mobile";
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(COLLAPSE_KEY) === "1");
    } catch {
      /* אין גישה לאחסון — נשאר פתוח */
    }
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function toggleCollapsed() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch {
        /* לא קריטי */
      }
      return !c;
    });
  }

  const isActive = (href: string) => (href === "/dashboard" ? pathname === "/dashboard" : pathname?.startsWith(href));

  const renderItem = (item: SideNavItem, compact: boolean) => {
    const active = isActive(item.href);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={compact ? item.label : undefined}
        aria-current={active ? "page" : undefined}
        // אותם כפתורים בדיוק כמו בשורת הלשוניות הקודמת (`pill-active` / `pill-inactive`), רק בטור.
        className={`${active ? "pill-active" : "pill-inactive"} flex items-center gap-1.5 ${compact ? "justify-center" : ""}`}
      >
        <span className="flex shrink-0 items-center">{item.icon}</span>
        {!compact && <span className="truncate">{item.label}</span>}
      </Link>
    );
  };

  const main = items.filter((i) => i.group === "main");
  const tools = items.filter((i) => i.group === "tools");

  const list = (compact: boolean) => (
    <>
      <div className="flex flex-col gap-0.5">{main.map((i) => renderItem(i, compact))}</div>
      {tools.length > 0 && (
        <div className="mt-4 flex flex-col gap-0.5 border-t border-card-border pt-3">
          {!compact && (
            <div className="px-2.5 pb-1 text-[11px] font-bold tracking-wide text-muted">{"כלים וניהול"}</div>
          )}
          {tools.map((i) => renderItem(i, compact))}
        </div>
      )}
    </>
  );

  if (variant === "desktop") {
    return (
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-l border-card-border bg-white px-2.5 py-3 md:flex ${
          collapsed ? "w-[64px]" : "w-[200px]"
        }`}
      >
        <div className="mb-4 flex flex-col items-center gap-2 px-1">
          <div className={collapsed ? "[&_img]:h-7 [&_img]:max-w-[44px]" : ""}>{logo}</div>
          <button
            type="button"
            onClick={toggleCollapsed}
            className="self-start rounded-lg p-1 text-muted transition hover:bg-gray-100"
            aria-label={collapsed ? "הרחבת התפריט" : "צמצום התפריט"}
            title={collapsed ? "הרחבת התפריט" : "צמצום התפריט"}
          >
            {collapsed ? <ChevronsLeft className="h-4 w-4" /> : <ChevronsRight className="h-4 w-4" />}
          </button>
        </div>
        <nav aria-label="תפריט ראשי" className="flex flex-1 flex-col overflow-y-auto">
          {list(collapsed)}
        </nav>
      </aside>
    );
  }

  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setMobileOpen((o) => !o)}
        className="btn-outline flex items-center gap-1.5"
        aria-expanded={mobileOpen}
      >
        {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        {"תפריט"}
      </button>
      {mobileOpen && (
        <nav
          aria-label="תפריט ראשי"
          className="absolute inset-x-0 top-full z-40 border-b border-card-border bg-white px-4 py-3 shadow-card"
        >
          {list(false)}
        </nav>
      )}
    </div>
  );
}
