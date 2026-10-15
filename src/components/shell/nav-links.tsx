"use client";

import {
  BarChart3,
  Calendar,
  ClipboardCheck,
  ClipboardList,
  GraduationCap,
  History,
  LayoutDashboard,
  Library,
  Map,
  Search,
  Settings,
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
  /** Shorter label for the phone tab bar, where a full one would wrap. */
  short?: string;
  icon: LucideIcon;
}

interface NavGroup {
  /** null renders the items with no heading above them. */
  label: string | null;
  items: NavItem[];
}

/** Keyed rather than positional: the tab bar used to pick its five
 *  destinations by array index, so reordering the sidebar silently changed
 *  what phones showed. */
const NAV = {
  dashboard: { href: "/dashboard", base: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  test: {
    href: "/test/new",
    base: "/test",
    label: "Take a test",
    short: "Test",
    icon: ClipboardList,
  },
  pyq: { href: "/pyq", base: "/pyq", label: "PYQ papers", short: "PYQ", icon: Calendar },
  assigned: { href: "/assignments", base: "/assignments", label: "Assigned", icon: ClipboardCheck },
  library: { href: "/sets", base: "/sets", label: "Library", icon: Library },
  questions: { href: "/questions", base: "/questions", label: "Questions", icon: Search },
  history: { href: "/history", base: "/history", label: "History", icon: History },
  progress: { href: "/progress", base: "/progress", label: "Progress", icon: TrendingUp },
  ranks: { href: "/leaderboard", base: "/leaderboard", label: "Ranks", icon: Trophy },
  plan: { href: "/study-plan", base: "/study-plan", label: "Study plan", short: "Plan", icon: Map },
  settings: { href: "/settings", base: "/settings", label: "Settings", icon: Settings },
  exams: { href: "/exams", base: "/exams", label: "Exams", icon: GraduationCap },
  analytics: { href: "/analytics", base: "/analytics", label: "Analytics", icon: BarChart3 },
  import: { href: "/import", base: "/import", label: "Import", icon: Upload },
  batches: { href: "/batches", base: "/batches", label: "Batches", icon: GraduationCap },
  users: { href: "/users", base: "/users", label: "Users", icon: Users },
} satisfies Record<string, NavItem>;

const learnerGroups: NavGroup[] = [
  { label: null, items: [NAV.dashboard] },
  { label: "Practice", items: [NAV.test, NAV.pyq, NAV.assigned] },
  { label: "Library", items: [NAV.library, NAV.questions] },
  { label: "Progress", items: [NAV.history, NAV.progress, NAV.ranks, NAV.plan] },
];

const adminGroup: NavGroup = {
  label: "Admin",
  items: [NAV.exams, NAV.analytics, NAV.import, NAV.batches, NAV.users],
};

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
        active ? "bg-accent-soft text-accent-soft-ink font-semibold nav-active-bar" : "text-muted hover:bg-accent-soft/50 hover:text-ink",
      )}
    >
      <item.icon className="size-4" aria-hidden />
      {item.label}
    </Link>
  );
}

export function SidebarNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const groups = isAdmin ? [...learnerGroups, adminGroup] : learnerGroups;
  return (
    // Headings make the list taller than the old flat one, so it scrolls
    // rather than pushing the profile card off a short viewport.
    <nav className="flex-1 overflow-y-auto px-3" aria-label="Main">
      {groups.map((group, groupIndex) => (
        <div
          key={group.label ?? "primary"}
          className={cn("space-y-1", groupIndex > 0 && "mt-5")}
        >
          {group.label && (
            <p className="px-3.5 pb-1 text-[10px] font-semibold tracking-[0.18em] text-faint uppercase">
              {group.label}
            </p>
          )}
          {group.items.map((item) => (
            <SidebarLink key={item.href} item={item} pathname={pathname} />
          ))}
        </div>
      ))}
      <div className="mt-5 border-t border-line pt-3">
        <SidebarLink item={NAV.settings} pathname={pathname} />
      </div>
    </nav>
  );
}

export function MobileTabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  // Phones get the five most-used destinations; the rest live in the sidebar
  // on larger screens.
  const tabs: NavItem[] = [
    NAV.dashboard,
    NAV.library,
    NAV.questions,
    NAV.test,
    isAdmin ? NAV.analytics : NAV.assigned,
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
                active ? "text-accent font-semibold" : "text-muted hover:text-ink",
              )}
            >
              <span className={cn(
                "flex size-8 items-center justify-center rounded-lg transition-colors",
                active && "bg-accent-soft",
              )}>
                <item.icon className="size-5" aria-hidden />
              </span>
              {item.short ?? item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
