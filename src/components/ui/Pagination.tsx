import { ChevronLeft, ChevronRight } from "lucide-react";
import Button from "@/components/ui/Button";

type PaginationProps = {
  total: number;
  pageSize: number;
  current: number;
  onChange: (page: number) => void;
};

export default function Pagination({ total, pageSize, current, onChange }: PaginationProps) {
  const totalPages = Math.ceil(total / pageSize);
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        disabled={current <= 1}
        onClick={() => onChange(current - 1)}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <span className="text-sm text-zinc-600">
        {current} / {totalPages}
      </span>
      <Button
        variant="secondary"
        size="sm"
        disabled={current >= totalPages}
        onClick={() => onChange(current + 1)}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
