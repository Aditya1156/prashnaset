import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { MobileTabBar, SidebarNav } from "@/components/shell/nav-links";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";

interface AppShellProps {
  displayName: string;
  email: string;
  isAdmin: boolean;
  children: ReactNode;
}

export function AppShell({ displayName, email, isAdmin, children }: AppShellProps) {
  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 py-6">
          <Logo href="/dashboard" size="sm" />
        </div>
        <SidebarNav isAdmin={isAdmin} />
        <div className="px-3 pb-4">
          <div className="rounded-2xl bg-raised p-3">
            <div className="flex items-center gap-2.5">
              <Avatar name={displayName} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink">
                  {displayName}
                  {isAdmin && (
                    <span
                      className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-accent-soft-ink uppercase"
                      data-testid="admin-badge"
                    >
                      <ShieldCheck className="size-3" aria-hidden /> Admin
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">{email}</p>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-end gap-1 border-t border-line pt-2">
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

      <div className="md:pl-64">
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:pt-10 md:pb-16">
          {children}
        </main>
      </div>

      <MobileTabBar isAdmin={isAdmin} />
    </div>
  );
}
