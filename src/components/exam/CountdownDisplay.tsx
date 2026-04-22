import { cn } from "@/lib/utils";

type Props = {
  text: string; // e.g., "01:23:45"
  tone: "amber" | "blue" | "green" | "zinc" | "red";
  size?: "sm" | "md" | "lg";
};

export function CountdownDisplay({ text, tone, size = "sm" }: Props) {
  // Split into parts (digits and separators)
  const chars = text.split("");

  const colorClasses = {
    amber: "text-amber-600 bg-amber-50 border-amber-200",
    blue: "text-blue-600 bg-blue-50 border-blue-200",
    green: "text-green-600 bg-green-50 border-green-200",
    zinc: "text-zinc-500 bg-zinc-50 border-zinc-200",
    red: "text-red-600 bg-red-50 border-red-200 animate-pulse",
  };

  const sizeClasses = {
    sm: "text-xs px-1 py-0.5 min-w-[1.2em]",
    md: "text-sm px-1.5 py-0.5 min-w-[1.4em]",
    lg: "text-lg px-2 py-1 min-w-[1.6em]",
  };

  return (
    <div className="flex items-center gap-0.5 font-mono leading-none select-none">
      {chars.map((char, i) => {
        if (char === ":" || char === " " || isNaN(parseInt(char))) {
          return (
            <span key={i} className={cn("text-zinc-400 font-sans mx-0.5", size === "lg" ? "text-sm" : "text-[10px]")}>
              {char}
            </span>
          );
        }
        return (
          <div
            key={i}
            className={cn(
              "rounded border text-center font-bold shadow-sm transition-all",
              colorClasses[tone],
              sizeClasses[size]
            )}
          >
            {char}
          </div>
        );
      })}
    </div>
  );
}
