import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-mono uppercase tracking-wide",
  {
    variants: {
      variant: {
        neutral: "bg-white/[0.06] text-ink-muted",
        outline: "border border-line/15 text-ink-muted",
        accent: "bg-accent/15 text-accent",
        active: "bg-tm-complete/15 text-tm-complete",
        done: "bg-white/[0.06] text-ink-faint",
        blocker: "bg-tm-blocker/15 text-tm-blocker",
      },
      size: {
        xs: "px-1.5 py-0.5 text-[9px]",
        sm: "px-2 py-0.5 text-[10px]",
      },
    },
    defaultVariants: { variant: "neutral", size: "sm" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge: React.FC<BadgeProps> = ({
  className,
  variant,
  size,
  ...props
}) => (
  <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
);
