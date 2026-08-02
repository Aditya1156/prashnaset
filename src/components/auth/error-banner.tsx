import { CircleAlert } from "lucide-react";

export function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="mb-4 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2.5 text-sm text-danger"
    >
      <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  );
}
