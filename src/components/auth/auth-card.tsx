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
      <div className="mb-8 text-center lg:text-left">
        <h1 className="font-display text-2xl tracking-tight text-ink sm:text-3xl">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
      </div>
      <Card className="p-6 sm:p-7">{children}</Card>
      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
