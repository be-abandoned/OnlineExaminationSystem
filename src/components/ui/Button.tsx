import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "danger" | "ghost";

export default function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center rounded-md text-sm font-medium transition disabled:pointer-events-none disabled:opacity-50",
        size === "sm" && "px-2 py-1 text-xs",
        size === "md" && "px-3 py-2",
        variant === "primary" && "bg-blue-600 text-white hover:bg-blue-700",
        variant === "secondary" && "border border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50",
        variant === "danger" && "bg-red-600 text-white hover:bg-red-700",
        variant === "ghost" && "text-zinc-700 hover:bg-zinc-100",
        className,
      )}
      {...props}
    />
  );
}

