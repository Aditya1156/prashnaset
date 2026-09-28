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
        <div className="mx-auto mt-3 h-0.5 w-12 rounded-full bg-gradient-to-r from-accent to-accent/40 lg:mx-0" aria-hidden />
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>
      </div>
      <Card className="p-6 shadow-[0_4px_24px_rgb(232,161,0,0.06)] sm:p-7">{children}</Card>
      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}
