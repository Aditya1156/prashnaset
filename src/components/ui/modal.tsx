"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, wide = false }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Close dialog"
        className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
        onClick={onClose}
        tabIndex={-1}
      />
      <div
        className={cn(
          // On phones this is a bottom sheet flush with the viewport edge, so
          // its actions would sit under the gesture bar without the inset.
          "relative z-10 max-h-[90dvh] w-full overflow-hidden overflow-y-auto rounded-t-2xl border border-line bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-xl sm:rounded-2xl sm:p-6 sm:pb-6",
          wide ? "sm:max-w-2xl" : "sm:max-w-md",
        )}
      >
        <div className="h-1 bg-accent-fill" aria-hidden />
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-lg text-ink">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-m-2 grid size-10 shrink-0 place-items-center rounded-lg text-muted transition-colors hover:bg-raised hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
