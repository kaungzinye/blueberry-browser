import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

const buttonVariants = cva(
  "app-region-no-drag inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-xl font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/60 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        /** Single emphasized action — the only place the accent fills. */
        primary:
          "bg-accent text-white hover:bg-accent-strong",
        /** Quiet bordered control. */
        outline:
          "border border-line/15 bg-white/[0.03] text-ink hover:border-line/25 hover:bg-white/[0.06]",
        /** Chromeless until hovered. */
        ghost: "text-ink-muted hover:bg-white/[0.06] hover:text-ink",
        /** Low-contrast filled chip-button. */
        subtle: "bg-white/[0.05] text-ink hover:bg-white/[0.09]",
        /** Positive / completion. */
        success:
          "border border-tm-complete/25 bg-tm-complete/15 text-tm-complete hover:bg-tm-complete/20",
        /** Blocker recovery actions. */
        warning:
          "border border-tm-blocker/30 bg-tm-blocker/15 text-tm-blocker hover:bg-tm-blocker/20",
      },
      size: {
        sm: "h-7 px-2.5 text-xs",
        md: "h-9 px-3.5 text-sm",
        lg: "h-11 px-5 text-sm",
        icon: "size-8",
      },
    },
    defaultVariants: { variant: "outline", size: "md" },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { buttonVariants };
