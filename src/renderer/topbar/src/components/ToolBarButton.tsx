import React from "react";
import { LucideIcon } from "lucide-react";
import { cn } from "../../../common/lib/utils";

interface ToolBarButtonProps {
    Icon?: LucideIcon;
    active?: boolean;
    toggled?: boolean;
    onClick?: () => void;
    children?: React.ReactNode;
    className?: string;
}

export const ToolBarButton: React.FC<ToolBarButtonProps> = ({
    Icon,
    active = true,
    toggled = false,
    onClick,
    children,
    className,
}) => {
    return (
        <div
            className={cn(
                "size-8 flex items-center justify-center rounded-md",
                "text-[#94a3c2] app-region-no-drag",
                "transition-all duration-200",
                !active ? "opacity-40" : "hover:bg-white/[0.06] hover:text-[#e7ecf6] active:brightness-95 cursor-pointer",
                toggled && "bg-white/[0.06] text-[#e7ecf6]",
                className
            )}
            onClick={active ? onClick : undefined}
            tabIndex={-1}
        >
            {children || (Icon && <Icon className="size-4.5" />)}
        </div>
    );
};
