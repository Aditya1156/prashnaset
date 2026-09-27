"use client";

import {
  Calendar,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  Library,
  Search,
  TrendingUp,
  Trophy,
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
}

const mainItems: NavItem[] = [
  { href: "/dashboard", base: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sets", base: "/sets", label: "Library", icon: Library },
  { href: "/questions", base: "/questions", label: "Questions", icon: Search },
  { href: "/test/new", base: "/test", label: "Test", icon: ClipboardList },
  { href: "/pyq", base: "/pyq", label: "PYQ Papers", icon: Calendar },
  { href: "/assignments", base: "/assignments", label: "Assigned", icon: ClipboardCheck },
  { href: "/leaderboard", base: "/leaderboard", label: "Ranks", icon: Trophy },
  { href: "/history", base: "/history", label: "History", icon: History },
  { href: "/progress", base: "/progress", label: "Progress", icon: TrendingUp },
];

const adminItems: NavItem[] = [
  { href: "/import", base: "/import", label: "Import", icon: Upload },
  { href: "/batches", base: "/batches", label: "Batches", icon: GraduationCap },
  { href: "/users", base: "/users", label: "Users", icon: Users },
];

function isActive(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`);
}

function SidebarLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.base);
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-navy text-on-navy shadow-sm" : "text-muted hover:bg-raised hover:text-ink",
      )}
    >
      <item.icon className="size-4" aria-hidden />
      {item.label}
    </Link>
  );
}

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 space-y-1 px-3" aria-label="Main">
      {mainItems.map((item) => (
        <SidebarLink key={item.href} item={item} pathname={pathname} />
      ))}
      {isAdmin && (
        <>
          <p className="px-3.5 pt-5 pb-1 text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
            Admin
          </p>
          {adminItems.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
        </>
      )}
    </nav>
  );
}

export function MobileTabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  // Phones get the five most-used destinations; the rest live in the sidebar
  // on larger screens.
  const tabs = [
    mainItems[0],
    mainItems[1],
    mainItems[2],
    mainItems[3],
    isAdmin ? adminItems[0] : mainItems[5],
  ];
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="mx-auto grid max-w-md grid-cols-5">
        {tabs.map((item) => {
          const active = isActive(pathname, item.base);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center gap-0.5 py-3 text-[11px] font-medium transition-colors",
                active ? "text-accent" : "text-muted hover:text-ink",
              )}
            >
              <span className={cn(
                "flex size-8 items-center justify-center rounded-xl transition-colors",
                active && "bg-accent-soft",
              )}>
                <item.icon className="size-5" aria-hidden />
              </span>
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
