import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export default function Checkbox({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500",
        className,
      )}
      {...props}
    />
  );
}
