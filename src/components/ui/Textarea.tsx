import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export default function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-28 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-500",
        className,
      )}
      {...props}
    />
  );
}

