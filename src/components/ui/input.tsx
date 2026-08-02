import type {
  InputHTMLAttributes,
  LabelHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

const fieldBase =
  "w-full rounded-lg border border-line-strong bg-surface text-sm text-ink placeholder:text-faint " +
  "focus:outline-none focus:ring-2 focus:ring-accent-fill/50 focus:border-accent-fill/50 " +
  "disabled:opacity-50 disabled:pointer-events-none";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, "h-10 px-3", className)} {...props} />;
}

export function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "px-3 py-2 leading-relaxed", className)} {...props} />;
}

export function Select({
  className,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(fieldBase, "h-10 px-3", className)} {...props}>
      {children}
    </select>
  );
}

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cn("block text-sm font-medium text-ink", className)} {...props} />
  );
}

interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}

export function Field({ label, htmlFor, hint, error, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
