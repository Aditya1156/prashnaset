import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { MobileTabBar, SidebarNav } from "@/components/shell/nav-links";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";

interface AppShellProps {
  displayName: string;
  email: string;
  children: ReactNode;
}

export function AppShell({ displayName, email, children }: AppShellProps) {
  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 py-5">
          <Logo href="/dashboard" size="sm" />
        </div>
        <SidebarNav />
        <div className="border-t border-line px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-ink">{displayName}</p>
              <p className="truncate text-xs text-muted">{email}</p>
            </div>
            <div className="flex shrink-0 items-center">
              <ThemeToggle />
              <SignOutButton />
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur md:hidden">
        <Logo href="/dashboard" size="sm" />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SignOutButton />
        </div>
      </header>

      <div className="md:pl-60">
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:pt-10 md:pb-16">
          {children}
        </main>
      </div>

      <MobileTabBar />
    </div>
  );
}
