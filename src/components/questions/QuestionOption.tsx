import { cn } from "@/lib/utils";
import React from "react";

interface QuestionOptionProps {
  label: string;
  content?: string;
  isSelected?: boolean;
  isCorrect?: boolean;
  isIncorrect?: boolean;
  isDisabled?: boolean;
  onSelect?: () => void;
  type?: "radio" | "checkbox";
}

export default function QuestionOption({
  label,
  content,
  isSelected,
  isCorrect,
  isIncorrect,
  isDisabled,
  onSelect,
  type = "radio",
}: QuestionOptionProps) {
  const [isAnimating, setIsAnimating] = React.useState(false);

  React.useEffect(() => {
    if (isSelected) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 200);
      return () => clearTimeout(timer);
    }
  }, [isSelected]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isDisabled || !onSelect) return;
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onSelect();
    }
  };

  const statusClasses = cn(
    // Base style
    "flex w-full cursor-pointer items-start gap-3 rounded-lg border px-4 py-3 transition-all duration-150 outline-none select-none",
    // Default state
    "border-zinc-200 bg-white hover:border-zinc-300 hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-blue-500",
    // Selected state
    isSelected && !isCorrect && !isIncorrect && "border-[#1890ff] bg-[#f6ffed] border-2",
    // Animation
    isAnimating && "scale-105",
    // Correct state
    isCorrect && "border-green-500 bg-green-50 ring-1 ring-green-500",
    // Incorrect state
    isIncorrect && "border-red-500 bg-red-50 ring-1 ring-red-500",
    // Disabled state
    isDisabled && "cursor-not-allowed opacity-60 grayscale-[0.5] hover:bg-white hover:border-zinc-200"
  );

  const labelClasses = cn(
    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors",
    // Default label
    "border-zinc-300 bg-white text-zinc-600",
    // Selected label
    isSelected && !isCorrect && !isIncorrect && "border-[#1890ff] bg-[#1890ff] text-white",
    // Correct label
    isCorrect && "border-green-600 bg-green-600 text-white",
    // Incorrect label
    isIncorrect && "border-red-600 bg-red-600 text-white"
  );

  return (
    <div
      role={type}
      aria-checked={isSelected}
      aria-disabled={isDisabled}
      aria-label={isSelected ? `已选中选项 ${label}` : `选项 ${label}`}
      tabIndex={isDisabled ? -1 : 0}
      onClick={!isDisabled ? onSelect : undefined}
      onKeyDown={handleKeyDown}
      className={statusClasses}
    >
      <div className={labelClasses}>
        {isSelected && !isCorrect && !isIncorrect ? (
          <svg className="h-4 w-4 animate-[fadeIn_150ms_ease-in]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          label
        )}
      </div>
      <div className="flex-1 text-sm text-zinc-800 leading-6">
        {content}
      </div>
      {(isCorrect || isIncorrect) && (
        <div className="flex h-6 items-center">
          {isCorrect && (
            <svg className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {isIncorrect && (
            <svg className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
}
