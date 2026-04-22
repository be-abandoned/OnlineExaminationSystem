import { useMemo, useState, useEffect } from "react";
import { Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Tag from "@/components/ui/Tag";
import { type Question, type QuestionType, QUESTION_TYPE_LABELS, GRADE_LEVELS, SUBJECTS } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";
import { cn } from "@/lib/utils";
import { teacherListQuestionsRemote } from "@/utils/remoteApi";

interface QuestionSelectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (selectedQuestions: Question[]) => void;
  excludeIds?: string[]; // 已经在试卷里的题目ID
}

export default function QuestionSelectorModal({
  isOpen,
  onClose,
  onConfirm,
  excludeIds = [],
}: QuestionSelectorModalProps) {
  const me = useAuthStore((s) => s.getMe());
  const [questions, setQuestions] = useState<Question[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeType, setActiveType] = useState<"all" | QuestionType>("all");
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen && me) {
      loadQuestions();
      setSelectedIds(new Set());
      setQuery("");
      setActiveType("all");
    }
  }, [isOpen, me]);

  const loadQuestions = async () => {
    if (!me) return;
    setIsLoading(true);
    try {
      const data = await teacherListQuestionsRemote(me.id);
      setQuestions(data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredQuestions = useMemo(() => {
    const s = query.trim().toLowerCase();
    return questions.filter((q) => {
      // 1. 过滤掉已经在试卷里的（可选：也可以置灰显示）
      if (excludeIds.includes(q.id)) return false;

      // 2. 类型过滤
      if (activeType !== "all" && q.type !== activeType) return false;

      // 3. 关键词搜索
      if (!s) return true;
      const stemText = q.stem
        .filter((x) => x.type === "text")
        .map((x) => x.text)
        .join(" ")
        .toLowerCase();
      return stemText.includes(s) || q.id.toLowerCase().includes(s);
    });
  }, [questions, activeType, query, excludeIds]);

  const handleConfirm = () => {
    const selected = questions.filter((q) => selectedIds.has(q.id));
    onConfirm(selected);
    onClose();
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredQuestions.length) {
      setSelectedIds(new Set());
    } else {
      const next = new Set(selectedIds);
      filteredQuestions.forEach((q) => next.add(q.id));
      setSelectedIds(next);
    }
  };

  const isAllSelected = filteredQuestions.length > 0 && filteredQuestions.every((q) => selectedIds.has(q.id));
  const isIndeterminate = !isAllSelected && filteredQuestions.some((q) => selectedIds.has(q.id));

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="添加题目"
      width="max-w-4xl"
      footer={
        <div className="flex justify-between items-center w-full">
          <div className="text-sm text-zinc-500">
            已选中 {selectedIds.size} 题
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              取消
            </Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
              确认添加
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col h-[60vh]">
        {/* 顶部工具栏 */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              placeholder="搜索题干或ID..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden border rounded-lg">
          {/* 左侧题型导航 */}
          <div className="w-32 sm:w-40 border-r bg-zinc-50 overflow-y-auto p-2 space-y-1">
            <button
              className={cn(
                "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors",
                activeType === "all"
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200"
                  : "text-zinc-600 hover:bg-zinc-100"
              )}
              onClick={() => setActiveType("all")}
            >
              全部题型
            </button>
            {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
              <button
                key={key}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-sm font-medium transition-colors",
                  activeType === key
                    ? "bg-white text-blue-600 shadow-sm ring-1 ring-zinc-200"
                    : "text-zinc-600 hover:bg-zinc-100"
                )}
                onClick={() => setActiveType(key as QuestionType)}
              >
                {label}
              </button>
            ))}
          </div>

          {/* 右侧题目列表 */}
          <div className="flex-1 overflow-y-auto bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 text-zinc-500 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 font-medium w-10">
                    <input
                      type="checkbox"
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      checked={isAllSelected}
                      ref={(input) => {
                        if (input) input.indeterminate = isIndeterminate;
                      }}
                      onChange={toggleAll}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">题目内容</th>
                  <th className="px-4 py-3 font-medium w-24">属性</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                      加载中...
                    </td>
                  </tr>
                ) : filteredQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-zinc-500">
                      没有找到符合条件的题目
                    </td>
                  </tr>
                ) : (
                  filteredQuestions.map((q) => (
                    <tr
                      key={q.id}
                      className={cn(
                        "hover:bg-zinc-50/50 transition-colors cursor-pointer",
                        selectedIds.has(q.id) ? "bg-blue-50/30" : ""
                      )}
                      onClick={() => toggleSelection(q.id)}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedIds.has(q.id)}
                          onChange={() => toggleSelection(q.id)}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-zinc-900 line-clamp-2 mb-1">
                          {q.stem[0]?.type === "text" ? q.stem[0].text : "[非文本内容]"}
                        </div>
                        <div className="text-xs text-zinc-500 font-mono">ID: {q.id.slice(0, 8)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <Tag tone="blue" className="w-fit">
                            {QUESTION_TYPE_LABELS[q.type]}
                          </Tag>
                          <span className="text-xs text-zinc-500">
                            {GRADE_LEVELS.find((g) => g.value === q.gradeLevel)?.label}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {SUBJECTS.find((s) => s.id === q.subjectId)?.name}
                          </span>
                          <span className="text-xs text-zinc-500 font-medium">难度: {q.difficulty}</span>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Modal>
  );
}
