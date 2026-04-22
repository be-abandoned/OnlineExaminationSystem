import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type Tone = "zinc" | "blue" | "green" | "amber" | "red";

export default function Tag({ className, tone = "zinc", ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        tone === "zinc" && "bg-zinc-100 text-zinc-700",
        tone === "blue" && "bg-blue-50 text-blue-700",
        tone === "green" && "bg-green-50 text-green-700",
        tone === "amber" && "bg-amber-50 text-amber-800",
        tone === "red" && "bg-red-50 text-red-700",
        className,
      )}
      {...props}
    />
  );
}

