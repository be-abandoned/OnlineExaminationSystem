import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Tag from "@/components/ui/Tag";
import { type Question, type QuestionType, QUESTION_TYPE_LABELS } from "@/types/domain";

interface QuestionListProps {
  questions: Question[];
  selectedId: string | null;
  onSelect: (id: string | null) => void;
  onStartNew: () => void;
}

export default function QuestionList({ questions, selectedId, onSelect, onStartNew }: QuestionListProps) {
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | QuestionType>("all");

  const filteredItems = useMemo(() => {
    const s = query.trim().toLowerCase();
    return questions.filter((it) => {
      const matchType = typeFilter === "all" || it.type === typeFilter;
      if (!matchType) return false;
      if (!s) return true;
      const stemText = it.stem
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join(" ")
        .toLowerCase();
      return stemText.includes(s) || it.type.includes(s);
    });
  }, [questions, query, typeFilter]);

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>题目列表</CardTitle>
          <Button onClick={onStartNew} variant="primary" className="px-4 font-semibold shadow-sm">
            新建题目
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索题干/类型" />
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as "all" | QuestionType)}>
              <option value="all">全部题型</option>
              {Object.entries(QUESTION_TYPE_LABELS).map(([type, label]) => (
                <option key={type} value={type}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2 max-h-[calc(100vh-200px)] overflow-y-auto pr-1">
            {filteredItems.map((it) => (
              <button
                key={it.id}
                className={
                  selectedId === it.id
                    ? "rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-left transition-colors"
                    : "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left transition-colors hover:bg-zinc-50"
                }
                onClick={() => onSelect(it.id)}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-medium text-zinc-900 capitalize">
                    {QUESTION_TYPE_LABELS[it.type]}
                  </div>
                  <Tag tone="blue">{it.defaultScore} 分</Tag>
                </div>
                <div className="mt-1 line-clamp-2 text-xs text-zinc-500">
                  {it.stem.find((s) => s.type === "text")?.text || "无文本内容"}
                </div>
              </button>
            ))}
            {filteredItems.length === 0 ? (
              <div className="px-3 py-10 text-center text-sm text-zinc-500">暂无题目</div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
