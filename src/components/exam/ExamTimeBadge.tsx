import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Loader2, CheckCircle2, AlertCircle, Clock, CheckCheck, PlayCircle } from "lucide-react";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-all shadow-sm border select-none",
  {
    variants: {
      tone: {
        amber: "bg-amber-50 text-amber-700 border-amber-200",
        blue: "bg-blue-50 text-blue-700 border-blue-200",
        green: "bg-green-50 text-green-700 border-green-200",
        zinc: "bg-zinc-50 text-zinc-600 border-zinc-200",
        red: "bg-red-50 text-red-700 border-red-200 animate-pulse",
      },
    },
    defaultVariants: {
      tone: "zinc",
    },
  }
);

type Props = React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants> & {
  label: string;
  icon?: "loading" | "check" | "alert" | "clock" | "double-check" | "play";
};

export function ExamTimeBadge({ className, tone, label, icon, ...props }: Props) {
  const Icon = icon === "loading" ? Loader2 : 
               icon === "check" ? CheckCircle2 : 
               icon === "double-check" ? CheckCheck :
               icon === "alert" ? AlertCircle : 
               icon === "play" ? PlayCircle :
               icon === "clock" ? Clock : null;

  return (
    <div className={cn(badgeVariants({ tone }), className)} {...props}>
      {Icon && <Icon className={cn("h-3.5 w-3.5", icon === "loading" && "animate-spin")} />}
      <span>{label}</span>
    </div>
  );
}
