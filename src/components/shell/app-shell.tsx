import { ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";
import { ExamSwitcher } from "@/components/shell/exam-switcher";
import { MobileTabBar, SidebarNav } from "@/components/shell/nav-links";
import { SignOutButton } from "@/components/shell/sign-out-button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { PageTransition } from "@/components/ui/page-transition";
import type { ExamOption } from "@/lib/exam";

interface AppShellProps {
  displayName: string;
  email: string;
  isAdmin: boolean;
  examOptions: ExamOption[];
  currentExam: ExamOption | null;
  children: ReactNode;
}

export function AppShell({
  displayName,
  email,
  isAdmin,
  examOptions,
  currentExam,
  children,
}: AppShellProps) {
  return (
    <div className="min-h-dvh">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface md:flex">
        <div className="px-5 py-6">
          <Logo href="/dashboard" size="sm" />
        </div>
        {/* Above the nav on purpose: it changes what every link below leads
            to, so it reads as the context the rest of the nav sits inside. */}
        <div className="mb-3 px-3">
          <ExamSwitcher options={examOptions} current={currentExam} />
        </div>
        <SidebarNav isAdmin={isAdmin} />
        <div className="px-3 pb-4">
          <div className="rounded-xl bg-raised p-3">
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
        {/* Phones have no sidebar, so the switcher gets its own row rather
            than being squeezed next to the logo. Renders nothing when there
            is only one track, so single-exam users lose no height. */}
        {examOptions.length > 1 && (
          <div className="border-t border-line px-4 py-2">
            <ExamSwitcher options={examOptions} current={currentExam} />
          </div>
        )}
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
