"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  GraduationCap,
  MoreVertical,
  Search,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Modal } from "@/components/ui/modal";
import { setRole } from "@/lib/actions/users";
import { cn, formatDate, plural } from "@/lib/utils";

export interface DirectoryUser {
  id: string;
  name: string;
  email: string;
  isAdmin: boolean;
  joinedAt: string;
}

const PAGE_SIZE = 10;
type RoleFilter = "all" | "admins" | "learners";

export function InviteUserButton() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const signupUrl = typeof window === "undefined" ? "/signup" : `${window.location.origin}/signup`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(signupUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Selection fallback: the input below is selectable either way.
    }
  }

  return (
    <>
      <Button variant="navy" onClick={() => setOpen(true)}>
        <UserPlus className="size-4" aria-hidden /> Invite user
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Invite someone">
        <p className="text-sm leading-relaxed text-muted">
          Anyone who signs up gets the full test portal instantly. Share the sign-up link:
        </p>
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={signupUrl}
            onFocus={(e) => e.target.select()}
            aria-label="Sign-up link"
            className="h-10 w-full rounded-full border border-line-strong bg-raised px-4 text-base text-ink outline-none sm:text-sm"
          />
          <Button variant="secondary" onClick={() => void copy()} className="shrink-0">
            {copied ? (
              <>
                <Check className="size-4 text-success" aria-hidden /> Copied
              </>
            ) : (
              <>
                <Copy className="size-4" aria-hidden /> Copy
              </>
            )}
          </Button>
        </div>
      </Modal>
    </>
  );
}

function RoleMenu({
  user,
  selfId,
  designatedEmail,
}: {
  user: DirectoryUser;
  selfId: string;
  designatedEmail: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isSelf = user.id === selfId;
  const isDesignated = user.email.toLowerCase() === designatedEmail;
  const canChange = !(user.isAdmin && (isSelf || isDesignated));

  async function onConfirm() {
    setBusy(true);
    setError(null);
    const result = await setRole(user.id, !user.isAdmin);
    setBusy(false);
    if (!result.ok) {
      setError(result.error ?? "Couldn't update the role.");
      return;
    }
    setConfirmOpen(false);
    setOpen(false);
    router.refresh();
  }

  if (!canChange) {
    return <span className="w-10" aria-hidden />;
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={`Actions for ${user.name}`}
        aria-expanded={open}
        className="flex size-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-raised hover:text-ink"
      >
        <MoreVertical className="size-4" aria-hidden />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 z-20 mt-1 w-44 rounded-xl border border-line bg-surface p-1 shadow-lg">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirmOpen(true);
              }}
              className="w-full rounded-lg px-3 py-2 text-left text-sm text-ink transition-colors hover:bg-raised"
            >
              {user.isAdmin ? "Remove admin role" : "Make admin"}
            </button>
          </div>
        </>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={user.isAdmin ? "Remove admin role?" : "Make admin?"}
      >
        <p className="text-sm leading-relaxed text-muted">
          {user.isAdmin ? (
            <>
              <span className="font-medium text-ink">{user.name}</span> will keep the full test
              portal but lose Import, Users and library management.
            </>
          ) : (
            <>
              <span className="font-medium text-ink">{user.name}</span> will be able to import
              questions, manage the whole library, and manage users — including you.
            </>
          )}
        </p>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
            Cancel
          </Button>
          <Button
            variant={user.isAdmin ? "danger" : "primary"}
            loading={busy}
            onClick={() => void onConfirm()}
          >
            {user.isAdmin ? "Remove admin" : "Make admin"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}

export function UsersDirectory({
  users,
  selfId,
  designatedEmail,
}: {
  users: DirectoryUser[];
  selfId: string;
  designatedEmail: string;
}) {
  const [query, setQuery] = useState("");
  const [role, setRoleFilter] = useState<RoleFilter>("all");
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return users.filter((user) => {
      if (role === "admins" && !user.isAdmin) return false;
      if (role === "learners" && user.isAdmin) return false;
      if (!needle) return true;
      return (
        user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle)
      );
    });
  }, [users, query, role]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount);
  const start = (safePage - 1) * PAGE_SIZE;
  const visible = filtered.slice(start, start + PAGE_SIZE);

  return (
    <div className="space-y-4">
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <label className="flex h-11 flex-1 items-center gap-2.5 rounded-full border border-line-strong bg-background px-4 focus-within:border-accent-fill/50 focus-within:ring-2 focus-within:ring-accent-fill/40">
          <Search className="size-4 shrink-0 text-faint" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search by name or email…"
            aria-label="Search users"
            className="w-full bg-transparent text-base text-ink outline-none placeholder:text-faint sm:text-sm"
          />
        </label>
        <div className="flex shrink-0 gap-1.5" role="radiogroup" aria-label="Role filter">
          {(
            [
              { value: "all", label: "All" },
              { value: "admins", label: "Admins" },
              { value: "learners", label: "Learners" },
            ] as const
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={role === option.value}
              onClick={() => {
                setRoleFilter(option.value);
                setPage(1);
              }}
              className={cn(
                "h-9 rounded-full border px-4 text-sm font-medium transition-colors",
                role === option.value
                  ? "border-navy bg-navy text-on-navy"
                  : "border-line-strong text-muted hover:bg-raised hover:text-ink",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      </Card>

      <Card data-testid="users-list">
        <div className="hidden grid-cols-[1fr_8rem_8rem_3rem] gap-3 border-b border-line bg-raised/30 px-5 py-3 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase sm:grid">
          <span>User profile</span>
          <span>Role</span>
          <span>Joined</span>
          <span className="text-right">Actions</span>
        </div>
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">
            No accounts match those filters.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {visible.map((user) => (
              <div
                key={user.id}
                className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-3.5 sm:grid-cols-[1fr_8rem_8rem_3rem] sm:px-5"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Avatar name={user.name} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{user.name}</p>
                    <p className="truncate text-xs text-muted">{user.email}</p>
                    {/* The role and join columns are desktop-only, so without
                        this a phone admin cannot tell who is an admin on the
                        very page for managing admins. */}
                    <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted sm:hidden">
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 font-medium",
                          user.isAdmin ? "text-accent" : "text-muted",
                        )}
                      >
                        {user.isAdmin ? (
                          <ShieldCheck className="size-3" aria-hidden />
                        ) : (
                          <GraduationCap className="size-3" aria-hidden />
                        )}
                        {user.isAdmin ? "Admin" : "Learner"}
                      </span>
                      <span aria-hidden>·</span>
                      {formatDate(user.joinedAt)}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:block">
                  {user.isAdmin ? (
                    <Badge tone="accent">
                      <ShieldCheck className="size-3" aria-hidden /> Admin
                    </Badge>
                  ) : (
                    <Badge>
                      <GraduationCap className="size-3" aria-hidden /> Learner
                    </Badge>
                  )}
                </div>
                <span className="hidden text-sm text-muted sm:block">
                  {formatDate(user.joinedAt)}
                </span>
                <div className="flex justify-end">
                  <RoleMenu user={user} selfId={selfId} designatedEmail={designatedEmail} />
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
          <p className="text-xs text-muted tabular-nums">
            Showing {filtered.length === 0 ? 0 : start + 1} to{" "}
            {Math.min(start + PAGE_SIZE, filtered.length)} of {filtered.length}{" "}
            {plural(filtered.length, "account")}
          </p>
          {pageCount > 1 && (
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={safePage === 1}
                onClick={() => setPage(safePage - 1)}
                aria-label="Previous page"
                className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-raised disabled:opacity-40"
              >
                <ChevronLeft className="size-4" aria-hidden />
              </button>
              <span className="px-1 text-sm text-ink tabular-nums">
                {safePage} / {pageCount}
              </span>
              <button
                type="button"
                disabled={safePage === pageCount}
                onClick={() => setPage(safePage + 1)}
                aria-label="Next page"
                className="flex size-10 items-center justify-center rounded-full text-muted hover:bg-raised disabled:opacity-40"
              >
                <ChevronRight className="size-4" aria-hidden />
              </button>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
