"use client";

import {
  ClipboardList,
  History,
  LayoutDashboard,
  Library,
  ShieldCheck,
  Upload,
  Users,
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
  adminOnly?: boolean;
}

const items: NavItem[] = [
  { href: "/dashboard", base: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sets", base: "/sets", label: "Library", icon: Library },
  { href: "/test/new", base: "/test", label: "Test", icon: ClipboardList },
  { href: "/history", base: "/history", label: "History", icon: History },
  { href: "/import", base: "/import", label: "Import", icon: Upload, adminOnly: true },
  { href: "/users", base: "/users", label: "Users", icon: Users, adminOnly: true },
];

function visibleItems(isAdmin: boolean): NavItem[] {
  return items.filter((item) => !item.adminOnly || isAdmin);
}

function isActive(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 px-3" aria-label="Main">
      {visibleItems(isAdmin).map((item) => {
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
            {item.adminOnly && (
              <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide text-faint uppercase">
                <ShieldCheck className="size-3" aria-hidden /> Admin
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileTabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const tabs = visibleItems(isAdmin);
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div
        className={cn(
          "mx-auto grid max-w-md",
          { 4: "grid-cols-4", 5: "grid-cols-5", 6: "grid-cols-6" }[tabs.length] ??
            "grid-cols-4",
        )}
      >
        {tabs.map((item) => {
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
