import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div>
      <div className="mb-6 text-center">
        <h1 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">{title}</h1>
        <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
      </div>
      <Card className="p-5 sm:p-6">{children}</Card>
      {footer && <div className="mt-4 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
