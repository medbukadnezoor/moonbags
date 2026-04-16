import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "gain" | "loss" | "muted" | "warning" | "info" | "orange";
}

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const styles: Record<string, string> = {
    default: "bg-primary/15 text-primary border-primary/40",
    gain: "bg-gain/10 text-gain border-gain/40",
    loss: "bg-destructive/15 text-destructive border-destructive/40",
    muted: "bg-secondary text-muted-foreground border-border",
    warning: "bg-yellow-500/10 text-yellow-400 border-yellow-500/40",
    info: "bg-cyan/10 text-cyan border-cyan/40",
    orange: "bg-orange-500/10 text-orange-400 border-orange-500/40",
  };
  return (
    <div
      className={cn(
        "inline-flex items-center border px-2 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest",
        styles[variant],
        className
      )}
      {...props}
    />
  );
}
