import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Tag from "@/components/ui/Tag";
import Modal from "@/components/ui/Modal";
import { Card } from "@/components/ui/Card";
import { GRADE_LEVELS, SUBJECTS, QUESTION_TYPE_LABELS, type QuestionType, type StemBlock } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";
import * as XLSX from "xlsx";
import {
  teacherDeleteQuestionRemote,
  teacherDeleteQuestionsRemote,
  teacherListQuestionsRemote,
  teacherUpsertQuestionsRemote,
} from "@/utils/remoteApi";
import { useTeacherQuestionsQuery } from "@/hooks/domain/useTeacherQuestionsQuery";
import { invalidateByPrefix, removeByResource } from "@/lib/query/invalidate";
import { queryClient } from "@/lib/query/queryClient";
import { createQueryKey } from "@/lib/query/queryKey";
import TableSkeleton from "@/components/feedback/TableSkeleton";

const TEMPLATE_HEADERS = [
  "行号",
  "年级",
  "学科",
  "默认分值",
  "难度（1-5）",
  "题型",
  "题干",
  "选项 A",
  "选项 B",
  "选项 C",
  "选项 D",
  "标准答案",
  "解析",
  "图片",
];

const EMPTY_IMPORT_STATS: Record<QuestionType, number> = {
  single: 0,
  multiple: 0,
  true_false: 0,
  blank: 0,
  short: 0,
};

function toQuestionType(raw: string): QuestionType | null {
  const normalized = raw.trim();
  if (!normalized) return null;
  if (normalized === "single" || normalized === "单选题") return "single";
  if (normalized === "multiple" || normalized === "多选题") return "multiple";
  if (normalized === "true_false" || normalized === "判断题") return "true_false";
  if (normalized === "blank" || normalized === "填空题") return "blank";
  if (normalized === "short" || normalized === "简答题") return "short";
  return null;
}

function normalizeForDuplicate(value: unknown): unknown {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) return value.map(normalizeForDuplicate);
  if (value && typeof value === "object") {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeForDuplicate((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }
  return value ?? null;
}

function createQuestionDuplicateKey(question: {
  type: QuestionType;
  stem: StemBlock[];
  options?: { id: string; text: string }[];
  answerKey: unknown;
  defaultScore: number;
  gradeLevel?: number;
  subjectId?: string;
  analysis?: string;
  difficulty?: number;
}) {
  return JSON.stringify(
    normalizeForDuplicate({
      type: question.type,
      stem: question.stem,
      options: question.options || [],
      answerKey: question.answerKey,
      defaultScore: question.defaultScore,
      gradeLevel: question.gradeLevel ?? null,
      subjectId: question.subjectId ?? null,
      analysis: question.analysis || "",
      difficulty: question.difficulty ?? null,
    }),
  );
}

export default function QuestionBankList() {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.getMe());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filterId, setFilterId] = useState("");
  const [filterType, setFilterType] = useState<"all" | QuestionType>("all");
  const [filterGrade, setFilterGrade] = useState<number | "all">("all");
  const [importing, setImporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<string>("");
  const [importError, setImportError] = useState<string>("");
  const [importProcessedCount, setImportProcessedCount] = useState(0);
  const [importTotalCount, setImportTotalCount] = useState(0);
  const [importSuccessCount, setImportSuccessCount] = useState(0);
  const [importFailureCount, setImportFailureCount] = useState(0);
  const [importExistingCount, setImportExistingCount] = useState(0);
  const [importExistingReasons, setImportExistingReasons] = useState<string[]>([]);
  const [importStats, setImportStats] = useState<Record<QuestionType, number>>(EMPTY_IMPORT_STATS);
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [visibleQuestions, setVisibleQuestions] = useState<typeof questions>([]);
  const [refreshingList, setRefreshingList] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ mode: "single" | "batch"; ids: string[] } | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const { data: questions = [], isLoading, isRefreshing, error } = useTeacherQuestionsQuery(me?.id);

  useEffect(() => {
    setVisibleQuestions(questions);
  }, [questions]);

  const refreshQuestions = async () => {
    if (!me) return;
    setRefreshingList(true);
    try {
      removeByResource("teacher", me.id, "questions");
      const latestQuestions = await teacherListQuestionsRemote(me.id);
      queryClient.setQueryData(createQueryKey("teacher", me.id, "questions", {}), latestQuestions);
      invalidateByPrefix("teacher", me.id, ["questions"]);
      setVisibleQuestions(latestQuestions);
    } finally {
      setRefreshingList(false);
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    setDeleteError(null);
    setDeleteConfirm({ mode: "batch", ids: Array.from(selectedIds) });
  };

  const confirmDelete = async () => {
    if (!me || !deleteConfirm || deleting) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      if (deleteConfirm.mode === "single") {
        await teacherDeleteQuestionRemote(me.id, deleteConfirm.ids[0]);
      } else {
        await teacherDeleteQuestionsRemote(me.id, deleteConfirm.ids);
      }
      await refreshQuestions();
      setSelectedIds((prev) => {
        const next = new Set(prev);
        deleteConfirm.ids.forEach((id) => next.delete(id));
        return next;
      });
      setDeleteConfirm(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "删除失败");
    } finally {
      setDeleting(false);
    }
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
      setSelectedIds(new Set(filteredQuestions.map((q) => q.id)));
    }
  };

  const handleDelete = (id: string) => {
    setDeleteError(null);
    setDeleteConfirm({ mode: "single", ids: [id] });
  };

  const handleDownloadTemplate = () => {
    const exampleRow: string[] = [
      "1",
      me?.gradeLevel ? String(me.gradeLevel) : "",
      me?.subjectId ? (SUBJECTS.find(s => s.id === me.subjectId)?.name || me.subjectId) : "",
      "5",
      "3",
      "单选题",
      "示例题干",
      "选项A",
      "选项B",
      "选项C",
      "选项D",
      "A",
      "示例解析",
      "https://example.com/image.png",
    ];
    const worksheet = XLSX.utils.aoa_to_sheet([TEMPLATE_HEADERS, exampleRow]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "题目模板");
    XLSX.writeFile(workbook, "题目导入模板.xlsx");
  };

  const handleImportFile = async (file: File) => {
    if (!me) return;
    setImporting(true);
    setImportDialogOpen(true);
    setImportResult("");
    setImportError("");
    setImportProcessedCount(0);
    setImportTotalCount(0);
    setImportSuccessCount(0);
    setImportFailureCount(0);
    setImportExistingCount(0);
    setImportExistingReasons([]);
    setImportStats({ ...EMPTY_IMPORT_STATS });
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) throw new Error("导入文件中没有工作表");
      const sheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, { header: 1, raw: false });
      if (rows.length <= 1) throw new Error("导入文件为空或仅包含表头");
      const headers = (rows[0] || []).map((x) => String(x ?? "").trim());
      const headerIndex = new Map(headers.map((h, i) => [h, i]));
      const requiredHeaders = ["年级", "学科", "默认分值", "难度（1-5）", "题型", "题干", "标准答案"];
      const missing = requiredHeaders.filter((h) => !headerIndex.has(h));
      if (missing.length > 0) throw new Error(`模板表头不完整: ${missing.join("、")}`);

      let successCount = 0;
      let existingCount = 0;
      const pendingQuestions: Parameters<typeof teacherUpsertQuestionsRemote>[1] = [];
      const errors: string[] = [];
      const existingReasons: string[] = [];
      const duplicateKeys = new Set(questions.map(createQuestionDuplicateKey));
      const stats: Record<QuestionType, number> = { ...EMPTY_IMPORT_STATS };
      const importRows = rows.slice(1);
      setImportTotalCount(importRows.length);

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i] || [];
        const cells = row.map((x) => String(x ?? "").trim());
        const getCell = (name: string) => {
          const idx = headerIndex.get(name);
          return idx === undefined ? "" : (cells[idx] ?? "").trim();
        };

        const lineNo = getCell("行号") || String(i);
        const gradeRaw = getCell("年级");
        const subjectRaw = getCell("学科");
        const scoreRaw = getCell("默认分值");
        const difficultyRaw = getCell("难度（1-5）");
        const typeRaw = getCell("题型");
        const stemRaw = getCell("题干");
        const optionA = getCell("选项 A");
        const optionB = getCell("选项 B");
        const optionC = getCell("选项 C");
        const optionD = getCell("选项 D");
        const answerRaw = getCell("标准答案");
        const analysisRaw = getCell("解析");
        const imageRaw = getCell("图片");

        try {
          const gradeLevel = me.gradeLevel;

          const type = toQuestionType(typeRaw);
          if (!type) throw new Error("题型无效");
          if (!stemRaw) throw new Error("题干不能为空");

          const defaultScore = Math.max(1, Math.floor(Number(scoreRaw || 0) || 5));
          const difficulty = Math.max(1, Math.min(5, Math.floor(Number(difficultyRaw || 0) || 3)));

          let options: { id: string; text: string }[] | undefined = undefined;
          let answerKey: unknown = null;

          if (type === "single" || type === "multiple") {
            options = [
              { id: "A", text: optionA },
              { id: "B", text: optionB },
              { id: "C", text: optionC },
              { id: "D", text: optionD },
            ].filter((x) => x.text);
            if (options.length < 2) throw new Error("选择题至少需要两个选项");
            if (!answerRaw) throw new Error("标准答案不能为空");
            if (type === "single") {
              answerKey = answerRaw.trim().toUpperCase();
            } else {
              // 尝试分割，兼容 "A,B,C"、"A B C"、"ABC" 等格式
              let parts: string[] = [];
              if (/^[A-D]+$/i.test(answerRaw.trim())) {
                // 如果是像 "ABC" 这样的连续字符
                parts = answerRaw.trim().split("");
              } else {
                // 否则尝试用分隔符分割
                parts = answerRaw.split(/[,，、\s]+/);
              }
              answerKey = parts
                .map((x) => x.trim().toUpperCase())
                .filter(Boolean);
            }
          } else if (type === "true_false") {
            const v = answerRaw.trim().toLowerCase();
            answerKey = v === "true" || v === "对" || v === "是" || v === "正确";
          } else if (type === "blank" || type === "short") {
            answerKey = answerRaw;
          } else {
            answerKey = null;
          }

          const stem: StemBlock[] = [{ type: "text", text: stemRaw }];
          if (imageRaw) {
            stem.push({ type: "image", url: imageRaw });
          }

          const candidate = {
            type,
            stem,
            options,
            answerKey,
            defaultScore,
            gradeLevel,
            analysis: analysisRaw,
            difficulty,
          };
          const duplicateKey = createQuestionDuplicateKey(candidate);
          if (duplicateKeys.has(duplicateKey)) {
            existingCount++;
            existingReasons.push(`第 ${lineNo} 行：已存在`);
            setImportExistingCount(existingCount);
            setImportExistingReasons(existingReasons.slice(0, 5));
            continue;
          }

          pendingQuestions.push(candidate);
          duplicateKeys.add(duplicateKey);
          successCount++;
          stats[type] += 1;
          setImportSuccessCount(successCount);
          setImportStats({ ...stats });
        } catch (e) {
          const msg = e instanceof Error ? e.message : "未知错误";
          errors.push(`第 ${lineNo} 行：${msg}`);
          setImportFailureCount(errors.length);
        } finally {
          setImportProcessedCount(i);
        }
      }

      if (pendingQuestions.length > 0) {
        await teacherUpsertQuestionsRemote(me.id, pendingQuestions);
      }
      setImportProcessedCount(importRows.length);
      await refreshQuestions();
      setImportStats({ ...stats });
      setImportSuccessCount(successCount);
      setImportFailureCount(errors.length);
      setImportExistingCount(existingCount);
      setImportExistingReasons(existingReasons.slice(0, 5));
      const existingText = existingCount > 0 ? `，已存在 ${existingCount} 条` : "";
      if (errors.length > 0) {
        setImportResult(`导入完成：成功 ${successCount} 条${existingText}，失败 ${errors.length} 条。${[...existingReasons.slice(0, 3), ...errors.slice(0, 3)].join("；")}`);
      } else {
        setImportResult(`导入完成：成功 ${successCount} 条${existingText}。${existingReasons.slice(0, 3).join("；")}`);
      }
    } catch (e) {
      setImportError(e instanceof Error ? `导入失败：${e.message}` : "导入失败");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!me) return null;

  if (isLoading && visibleQuestions.length === 0) {
    return <TableSkeleton title="题库管理" columns={6} rows={6} />;
  }

  if (error && visibleQuestions.length === 0) {
    return <Card className="px-4 py-10 text-center text-sm text-red-600">加载题库失败</Card>;
  }

  const filteredQuestions = visibleQuestions.filter((q) => {
    if (filterId && !q.id.toLowerCase().includes(filterId.toLowerCase())) return false;
    if (filterType !== "all" && q.type !== filterType) return false;
    if (filterGrade !== "all" && q.gradeLevel !== filterGrade) return false;
    return true;
  });

  // Re-sync selection state with filtered questions if needed, or keep it independent. 
  // Here we keep selection independent but clear it on filter change if desired, or let users select across pages.
  // For simplicity, let's keep selection state valid only for visible items if we want "Select All" to mean "Select All Visible".
  
  const allSelected = filteredQuestions.length > 0 && selectedIds.size === filteredQuestions.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredQuestions.length;

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">题库管理</h1>
          {isRefreshing || refreshingList ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="danger" onClick={handleBatchDelete}>
              <Trash2 className="mr-2 h-4 w-4" />
              删除选中 ({selectedIds.size})
            </Button>
          )}
          <div className="relative">
            <Button variant="secondary" onClick={() => setImportMenuOpen((v) => !v)}>
              <Upload className="mr-2 h-4 w-4" />
              导入
            </Button>
            {importMenuOpen ? (
              <div className="absolute right-0 z-10 mt-2 w-52 rounded-md border border-zinc-200 bg-white p-2 shadow-sm">
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                  onClick={() => {
                    handleDownloadTemplate();
                    setImportMenuOpen(false);
                  }}
                >
                  下载模板
                </button>
                <button
                  type="button"
                  className="mt-1 w-full rounded-md px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setImportMenuOpen(false);
                  }}
                >
                  导入模板
                </button>
              </div>
            ) : null}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleImportFile(f);
            }}
          />
          <Button onClick={() => navigate("/teacher/questions/create/single")}>
            <Plus className="mr-2 h-4 w-4" />
            新建题目
          </Button>
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-end flex-wrap">
          <div className="w-full md:w-48">
            <label className="mb-1 block text-xs font-medium text-zinc-500">题目 ID</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                placeholder="搜索 ID..."
                value={filterId}
                onChange={(e) => setFilterId(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="w-full md:w-32">
            <label className="mb-1 block text-xs font-medium text-zinc-500">年级</label>
            <Select
              value={filterGrade === "all" ? "all" : String(filterGrade)}
              onChange={(e) => setFilterGrade(e.target.value === "all" ? "all" : Number(e.target.value))}
            >
              <option value="all">全部年级</option>
              {GRADE_LEVELS.map((gl) => (
                <option key={gl.value} value={gl.value}>
                  {gl.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-full md:w-32">
            <label className="mb-1 block text-xs font-medium text-zinc-500">题型</label>
            <Select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as "all" | QuestionType)}
            >
              <option value="all">全部题型</option>
              {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { 
              setFilterId(""); 
              setFilterType("all");
              setFilterGrade("all");
            }}>
              重置
            </Button>
          </div>
        </div>
      </Card>

      <div className="rounded-xl border border-zinc-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium w-10">
                  <input 
                    type="checkbox" 
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    checked={allSelected}
                    ref={input => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 font-medium">ID</th>
                <th className="px-4 py-3 font-medium">学科</th>
                <th className="px-4 py-3 font-medium">年级</th>
                <th className="px-4 py-3 font-medium">题型</th>
                <th className="px-4 py-3 font-medium">题干预览</th>
                <th className="px-4 py-3 font-medium">难度</th>
                <th className="px-4 py-3 font-medium">默认分值</th>
                <th className="px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                    加载中...
                  </td>
                </tr>
              ) : filteredQuestions.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-zinc-500">
                    暂无数据
                  </td>
                </tr>
              ) : (
                filteredQuestions.map((q) => (
                  <tr key={q.id} className="hover:bg-zinc-50/50 transition-colors">
                    <td className="px-4 py-3">
                      <input 
                        type="checkbox"
                        className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedIds.has(q.id)}
                        onChange={() => toggleSelection(q.id)}
                      />
                    </td>
                    <td className="px-4 py-3 font-mono text-zinc-600">{q.id.slice(0, 8)}</td>
                    <td className="px-4 py-3 text-zinc-700">{SUBJECTS.find(s => s.id === q.subjectId)?.name || "-"}</td>
                    <td className="px-4 py-3 text-zinc-700">{GRADE_LEVELS.find(g => g.value === q.gradeLevel)?.label || "-"}</td>
                    <td className="px-4 py-3">
                      <Tag tone="blue">{QUESTION_TYPE_LABELS[q.type]}</Tag>
                    </td>
                    <td className="px-4 py-3 max-w-md truncate text-zinc-800">
                      {q.stem && q.stem.length > 0 
                        ? (q.stem.find(b => b.type === 'text')?.text || "[非文本内容]") 
                        : "无题干"}
                    </td>
                    <td className="px-4 py-3 text-zinc-600">{q.difficulty || "-"}</td>
                    <td className="px-4 py-3 text-zinc-600">{q.defaultScore} 分</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => navigate(`/teacher/questions/${q.id}`)}
                          className="p-1 text-zinc-400 hover:text-blue-600 transition-colors"
                          title="编辑"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(q.id)}
                          className="p-1 text-zinc-400 hover:text-red-600 transition-colors"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t border-zinc-100 px-4 py-3 text-xs text-zinc-500 flex justify-between items-center">
          <span>共 {filteredQuestions.length} 条记录</span>
          {/* Mock Pagination UI */}
          <div className="flex gap-1">
            <button className="px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-50" disabled>上一页</button>
            <button className="px-2 py-1 rounded bg-blue-50 text-blue-600 font-medium">1</button>
            <button className="px-2 py-1 rounded hover:bg-zinc-100 disabled:opacity-50" disabled>下一页</button>
          </div>
        </div>
      </div>
      <Modal
        isOpen={Boolean(deleteConfirm)}
        onClose={() => {
          if (!deleting) setDeleteConfirm(null);
        }}
        title="确认删除题目"
        width="max-w-lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={deleting} onClick={() => setDeleteConfirm(null)}>
              取消
            </Button>
            <Button variant="danger" disabled={deleting || refreshingList} onClick={() => void confirmDelete()}>
              {deleting || refreshingList ? "处理中..." : "确认删除"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-4 text-sm text-zinc-700">
          <div className="rounded-md bg-red-50 px-3 py-3 text-red-700">
            {deleteConfirm?.mode === "batch"
              ? `确定要删除选中的 ${deleteConfirm.ids.length} 道题目吗？`
              : "确定要删除这道题目吗？"}
          </div>
          <div className="text-zinc-500">删除后不可恢复，请确认后再操作。</div>
          {deleteError ? <div className="rounded-md bg-red-50 px-3 py-2 text-red-600">{deleteError}</div> : null}
        </div>
      </Modal>
      <Modal
        isOpen={importDialogOpen}
        onClose={() => {
          if (!importing) setImportDialogOpen(false);
        }}
        title={importing ? "导入中" : importError ? "导入失败" : "导入完成"}
        width="max-w-md"
        footer={
          !importing ? (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={async () => {
                await refreshQuestions();
                setImportDialogOpen(false);
              }}>
                关闭
              </Button>
            </div>
          ) : null
        }
      >
        <div className="grid gap-4 text-sm text-zinc-700">
          {importing ? (
            <>
              <div>正在导入题目：{importProcessedCount} / {importTotalCount}</div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all"
                  style={{ width: `${importTotalCount > 0 ? Math.round((importProcessedCount / importTotalCount) * 100) : 0}%` }}
                />
              </div>
            </>
          ) : importError ? (
            <div className="rounded-md bg-red-50 px-3 py-2 text-red-700">{importError}</div>
          ) : (
            <>
              <div className="rounded-md bg-green-50 px-3 py-2 text-green-700">{importResult || "导入完成"}</div>
              <div className="grid gap-2">
                <div className="font-medium text-zinc-900">题型统计</div>
                {Object.entries(QUESTION_TYPE_LABELS).map(([type, label]) => (
                  <div key={type} className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2">
                    <span>{label}</span>
                    <span className="font-semibold text-zinc-900">{importStats[type as QuestionType]} 道</span>
                  </div>
                ))}
              </div>
              <div className="text-xs text-zinc-500">成功 {importSuccessCount} 条，已存在 {importExistingCount} 条，失败 {importFailureCount} 条，题目列表已刷新。</div>
              {importExistingReasons.length > 0 ? (
                <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {importExistingReasons.map((reason) => (
                    <div key={reason}>{reason}</div>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
