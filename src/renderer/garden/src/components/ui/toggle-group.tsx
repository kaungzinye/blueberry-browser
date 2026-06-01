import * as React from "react";
import * as ToggleGroupPrimitive from "@radix-ui/react-toggle-group";
import { cn } from "./cn";

export const ToggleGroup = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Root
    ref={ref}
    className={cn(
      "flex gap-1 rounded-xl border border-line/10 bg-white/[0.02] p-1",
      className
    )}
    {...props}
  />
));
ToggleGroup.displayName = "ToggleGroup";

export const ToggleGroupItem = React.forwardRef<
  React.ElementRef<typeof ToggleGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof ToggleGroupPrimitive.Item>
>(({ className, ...props }, ref) => (
  <ToggleGroupPrimitive.Item
    ref={ref}
    className={cn(
      "flex-1 rounded-lg px-2 py-1 font-mono text-[10px] uppercase tracking-wide text-ink-faint transition-colors hover:text-ink-muted",
      "data-[state=on]:bg-accent/15 data-[state=on]:text-accent",
      className
    )}
    {...props}
  />
));
ToggleGroupItem.displayName = "ToggleGroupItem";
