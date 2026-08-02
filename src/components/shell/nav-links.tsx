"use client";

import {
  ClipboardList,
  History,
  LayoutDashboard,
  Library,
  Upload,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  base: string;
  label: string;
  icon: LucideIcon;
}

const items: NavItem[] = [
  { href: "/dashboard", base: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/import", base: "/import", label: "Import", icon: Upload },
  { href: "/sets", base: "/sets", label: "Sets", icon: Library },
  { href: "/test/new", base: "/test", label: "Test", icon: ClipboardList },
  { href: "/history", base: "/history", label: "History", icon: History },
];

function isActive(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function SidebarNav() {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 px-3" aria-label="Main">
      {items.map((item) => {
        const active = isActive(pathname, item.base);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-accent-soft text-accent-soft-ink"
                : "text-muted hover:bg-raised hover:text-ink",
            )}
          >
            <item.icon className="size-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {items.map((item) => {
          const active = isActive(pathname, item.base);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                active ? "text-accent" : "text-muted hover:text-ink",
              )}
            >
              <item.icon className="size-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
