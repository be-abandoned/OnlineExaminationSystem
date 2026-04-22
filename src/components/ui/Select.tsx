import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export default function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm outline-none transition focus:border-blue-500",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

