import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { MobileTabBar, SidebarNav } from "@/components/shell/nav-links";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { PageTransition } from "@/components/ui/page-transition";

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
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-surface md:flex">
        <div aria-hidden className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-accent/20 to-transparent" />
        <div className="px-5 py-6">
          <Logo href="/dashboard" size="sm" />
          <div className="mt-4 h-px bg-gradient-to-r from-accent/30 via-accent/10 to-transparent" aria-hidden />
        </div>
        <SidebarNav isAdmin={isAdmin} />
        <div className="px-3 pb-4">
          <div className="rounded-2xl bg-raised p-3 ring-1 ring-accent/10">
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

      {/* Mobile top bar. viewportFit is "cover" and the manifest is standalone,
          so on a notched phone the bar would sit under the status bar without
          the inset padding. The inner row keeps the 3.5rem height that the
          runner's sticky offset is measured against. */}
      <header
        className="sticky top-0 z-40 border-b border-line bg-surface/95 backdrop-blur md:hidden"
        style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex h-14 items-center justify-between px-4">
          <Logo href="/dashboard" size="sm" />
          <div className="flex items-center gap-1">
            <ThemeToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="md:pl-64">
        <main className="mx-auto w-full max-w-5xl px-4 pt-6 pb-28 sm:px-6 md:pt-10 md:pb-16">
          <PageTransition>{children}</PageTransition>
        </main>
      </div>

      <MobileTabBar isAdmin={isAdmin} />
    </div>
  );
}
