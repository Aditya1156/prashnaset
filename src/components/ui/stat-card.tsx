import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: string;
  hint?: string;
}

export function StatCard({ label, value, hint }: StatCardProps) {
  return (
    <Card className="p-4 sm:p-5">
      <p className="text-xs font-medium tracking-wide text-muted uppercase">{label}</p>
      <p className="mt-2 font-display text-3xl text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}
