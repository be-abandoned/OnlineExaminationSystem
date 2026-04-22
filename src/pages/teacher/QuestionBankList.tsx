import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, Upload } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Tag from "@/components/ui/Tag";
import { Card } from "@/components/ui/Card";
import { GRADE_LEVELS, SUBJECTS, QUESTION_TYPE_LABELS, type Question, type QuestionType, type StemBlock } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";
import * as XLSX from "xlsx";
import {
  teacherDeleteQuestionRemote,
  teacherDeleteQuestionsRemote,
  teacherUpsertQuestionRemote,
} from "@/utils/remoteApi";
import { useTeacherQuestionsQuery } from "@/hooks/domain/useTeacherQuestionsQuery";
import { invalidateByPrefix } from "@/lib/query/invalidate";
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

export default function QuestionBankList() {
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.getMe());
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [filterId, setFilterId] = useState("");
  const [filterType, setFilterType] = useState<"all" | QuestionType>("all");
  const [filterGrade, setFilterGrade] = useState<number | "all">("all");
  const [filterSubject, setFilterSubject] = useState<string | "all">("all");
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<string>("");
  const [importMenuOpen, setImportMenuOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data: questions = [], isLoading, isRefreshing, error } = useTeacherQuestionsQuery(me?.id);

  const handleBatchDelete = async () => {
    if (!me) return;
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIds.size} 道题目吗？`)) return;
    try {
      await teacherDeleteQuestionsRemote(me.id, Array.from(selectedIds));
      invalidateByPrefix("teacher", me.id, ["questions"]);
      setSelectedIds(new Set());
    } catch (error) {
      console.error("Failed to delete questions", error);
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

  const handleDelete = async (id: string) => {
    if (!me) return;
    if (!window.confirm("确定要删除这道题目吗？")) return;
    try {
      await teacherDeleteQuestionRemote(me.id, id);
      invalidateByPrefix("teacher", me.id, ["questions"]);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (error) {
      console.error("Failed to delete question", error);
    }
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
    setImportResult("");
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
      const errors: string[] = [];

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
          const gradeByLabel = GRADE_LEVELS.find((g) => g.label === gradeRaw)?.value;
          const gradeByNumber = Number.isFinite(Number(gradeRaw)) ? Number(gradeRaw) : undefined;
          const gradeLevel = gradeByLabel ?? gradeByNumber ?? me.gradeLevel;

          const subjectByName = SUBJECTS.find((s) => s.name === subjectRaw)?.id;
          const subjectById = SUBJECTS.find((s) => s.id === subjectRaw)?.id;
          const subjectId = subjectByName ?? subjectById ?? me.subjectId;

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

          await teacherUpsertQuestionRemote(me.id, {
            type,
            stem,
            options,
            answerKey,
            defaultScore,
            gradeLevel,
            subjectId,
            analysis: analysisRaw,
            difficulty,
          });
          successCount++;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "未知错误";
          errors.push(`第 ${lineNo} 行：${msg}`);
        }
      }

      invalidateByPrefix("teacher", me.id, ["questions"]);
      if (errors.length > 0) {
        setImportResult(`导入完成：成功 ${successCount} 条，失败 ${errors.length} 条。${errors.slice(0, 3).join("；")}`);
      } else {
        setImportResult(`导入完成：成功 ${successCount} 条。`);
      }
    } catch (e) {
      setImportResult(e instanceof Error ? `导入失败：${e.message}` : "导入失败");
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!me) return null;

  if (isLoading && questions.length === 0) {
    return <TableSkeleton title="题库管理" columns={6} rows={6} />;
  }

  if (error && questions.length === 0) {
    return <Card className="px-4 py-10 text-center text-sm text-red-600">加载题库失败</Card>;
  }

  const filteredQuestions = questions.filter((q) => {
    if (filterId && !q.id.toLowerCase().includes(filterId.toLowerCase())) return false;
    if (filterType !== "all" && q.type !== filterType) return false;
    if (filterGrade !== "all" && q.gradeLevel !== filterGrade) return false;
    if (filterSubject !== "all" && q.subjectId !== filterSubject) return false;
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
          {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
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
      {importing ? <div className="rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">导入中...</div> : null}
      {importResult ? <div className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700">{importResult}</div> : null}

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
            <label className="mb-1 block text-xs font-medium text-zinc-500">学科</label>
            <Select
              value={filterSubject}
              onChange={(e) => setFilterSubject(e.target.value)}
            >
              <option value="all">全部学科</option>
              {SUBJECTS.map((sub) => (
                <option key={sub.id} value={sub.id}>
                  {sub.name}
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
              setFilterSubject("all");
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
    </div>
  );
}
