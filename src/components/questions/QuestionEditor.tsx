import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import FileUpload from "@/components/ui/FileUpload";
import { type Question, type QuestionType, type StemBlock, QUESTION_TYPE_LABELS, GRADE_LEVELS, SUBJECTS } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";

interface QuestionEditorProps {
  initialQuestion?: Question | null;
  defaultType?: QuestionType;
  onSave: (data: Omit<Question, "id" | "createdAt" | "updatedAt" | "teacherId"> & { id?: string }) => void;
  onDelete?: (id: string) => void;
}

function emptyStem(): StemBlock[] {
  return [
    {
      type: "text",
      text: "",
    },
  ];
}

function stemToText(blocks: StemBlock[]): string {
  if (blocks.length === 1 && blocks[0].type === "text") {
    return blocks[0].text;
  }
  return JSON.stringify(blocks, null, 2);
}

function textToStem(text: string): StemBlock[] {
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed as StemBlock[];
    return [{ type: "text", text }];
  } catch {
    return [{ type: "text", text }];
  }
}

export default function QuestionEditor({ initialQuestion, defaultType = "single", onSave, onDelete }: QuestionEditorProps) {
  const me = useAuthStore((s) => s.getMe());
  const [type, setType] = useState<QuestionType>(initialQuestion?.type || defaultType);
  const [defaultScore, setDefaultScore] = useState(5);
  const [gradeLevel, setGradeLevel] = useState<number | undefined>(undefined);
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [difficulty, setDifficulty] = useState<number>(3);
  const [analysis, setAnalysis] = useState("");
  const [stemBlocks, setStemBlocks] = useState<StemBlock[]>(initialQuestion?.stem || emptyStem());
  const [options, setOptions] = useState<{ id: string; text: string }[]>([
    { id: "A", text: "" },
    { id: "B", text: "" },
    { id: "C", text: "" },
    { id: "D", text: "" },
  ]);
  const [answerKeyText, setAnswerKeyText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialQuestion) {
      setType(initialQuestion.type);
      setDefaultScore(initialQuestion.defaultScore);
      setGradeLevel(initialQuestion.gradeLevel);
      setSubjectId(initialQuestion.subjectId);
      setDifficulty(initialQuestion.difficulty ?? 3);
      setAnalysis(initialQuestion.analysis ?? "");
      setStemBlocks(initialQuestion.stem && initialQuestion.stem.length > 0 ? initialQuestion.stem : emptyStem());
      setOptions(
        initialQuestion.options && initialQuestion.options.length > 0
          ? initialQuestion.options
          : [
              { id: "A", text: "选项A" },
              { id: "B", text: "选项B" },
              { id: "C", text: "选项C" },
              { id: "D", text: "选项D" },
            ]
      );
      setAnswerKeyText(
        initialQuestion.type === "multiple"
          ? JSON.stringify(initialQuestion.answerKey ?? [])
          : String(initialQuestion.answerKey ?? "")
      );
    } else {
      setType(defaultType);
      setDefaultScore(5);
      setGradeLevel(me?.gradeLevel);
      setSubjectId(me?.subjectId);
      setDifficulty(3);
      setAnalysis("");
      setStemBlocks(emptyStem());
      setOptions([
        { id: "A", text: "" },
        { id: "B", text: "" },
        { id: "C", text: "" },
        { id: "D", text: "" },
      ]);
      setAnswerKeyText("");
    }
    setError(null);
  }, [initialQuestion, defaultType, me]);

  const handleSave = () => {
    setError(null);
    let finalOptions: Question["options"] = undefined;
    let answerKey: unknown = null;

    if (type === "single" || type === "multiple") {
      finalOptions = options.map((o) => ({ ...o, text: o.text.trim() })).filter((o) => o.text !== "");
      if (type === "single") answerKey = answerKeyText.trim();
      else {
        try {
          const arr = JSON.parse(answerKeyText);
          answerKey = Array.isArray(arr) ? arr : [];
        } catch {
          answerKey = answerKeyText
            .split(",")
            .map((x) => x.trim())
            .filter(Boolean);
        }
      }
    } else if (type === "true_false") {
      answerKey = answerKeyText.trim() === "true";
    } else if (type === "blank" || type === "short") {
      answerKey = answerKeyText;
    } else {
      answerKey = null;
    }

    try {
      onSave({
        id: initialQuestion?.id,
        type,
        stem: stemBlocks,
        options: finalOptions,
        answerKey,
        defaultScore: Math.max(1, Math.floor(defaultScore)),
        gradeLevel,
        subjectId,
        analysis,
        difficulty,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  };

  const updateOption = (idx: number, text: string) => {
    const next = [...options];
    next[idx] = { ...next[idx], text };
    setOptions(next);
  };

  const addOption = () => {
    const nextId = String.fromCharCode(65 + options.length);
    setOptions([...options, { id: nextId, text: "" }]);
  };

  const removeOption = (idx: number) => {
    if (options.length <= 1) return;
    const next = options
      .filter((_, i) => i !== idx)
      .map((opt, i) => ({
        ...opt,
        id: String.fromCharCode(65 + i),
      }));
    setOptions(next);
  };

  const toggleSingleAnswer = (id: string) => {
    setAnswerKeyText(id);
  };

  const toggleMultipleAnswer = (id: string) => {
    let arr: string[] = [];
    try {
      const parsed = JSON.parse(answerKeyText);
      arr = Array.isArray(parsed) ? parsed : [];
    } catch {
      arr = answerKeyText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    const next = new Set(arr);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setAnswerKeyText(JSON.stringify(Array.from(next).sort()));
  };

  const toggleTrueFalseAnswer = (val: boolean) => {
    setAnswerKeyText(String(val));
  };

  const handleAddStemBlock = (type: "text" | "image") => {
    setStemBlocks([...stemBlocks, type === "text" ? { type: "text", text: "" } : { type: "image", url: "" }]);
  };

  const updateStemBlock = (idx: number, content: string) => {
    const next = [...stemBlocks];
    if (next[idx].type === "text") {
      next[idx] = { ...next[idx], text: content };
    } else if (next[idx].type === "image") {
      next[idx] = { ...next[idx], url: content };
    }
    setStemBlocks(next);
  };

  const removeStemBlock = (idx: number) => {
    if (stemBlocks.length <= 1) return;
    setStemBlocks(stemBlocks.filter((_, i) => i !== idx));
  };

  return (
    <Card className="h-full">
      <CardHeader>
        <div className="flex h-9 items-center justify-between">
          <CardTitle>{initialQuestion ? "编辑题目" : "新建题目"}</CardTitle>
          {initialQuestion && onDelete ? (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                const ok = window.confirm("确认删除该题目？");
                if (ok) onDelete(initialQuestion.id);
              }}
            >
              删除
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">年级</div>
              <Select
                value={gradeLevel ? String(gradeLevel) : ""}
                onChange={(e) => setGradeLevel(e.target.value ? Number(e.target.value) : undefined)}
              >
                <option value="">请选择年级</option>
                {GRADE_LEVELS.map((gl) => (
                  <option key={gl.value} value={gl.value}>
                    {gl.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">学科</div>
              <Select
                value={subjectId || ""}
                onChange={(e) => setSubjectId(e.target.value || undefined)}
              >
                <option value="">请选择学科</option>
                {SUBJECTS.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </Select>
            </div>
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">默认分值</div>
              <Input
                value={String(defaultScore)}
                onChange={(e) => setDefaultScore(Number(e.target.value || 0))}
                inputMode="numeric"
              />
            </div>
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">难度 (1-5)</div>
              <Select
                value={String(difficulty)}
                onChange={(e) => setDifficulty(Number(e.target.value))}
              >
                {[1, 2, 3, 4, 5].map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid gap-1">
            <div className="text-xs font-medium text-zinc-700">题型</div>
            <Select value={type} onChange={(e) => setType(e.target.value as QuestionType)}>
              {Object.entries(QUESTION_TYPE_LABELS).map(([t, label]) => (
                <option key={t} value={t}>
                  {label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-1">
            <div className="flex items-center justify-between mb-1">
              <div className="text-xs font-medium text-zinc-700">题干</div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleAddStemBlock("text")} className="h-7 text-xs">
                  + 文字
                </Button>
                <Button variant="secondary" size="sm" onClick={() => handleAddStemBlock("image")} className="h-7 text-xs">
                  + 图片
                </Button>
              </div>
            </div>
            <div className="grid gap-3">
              {stemBlocks.map((block, idx) => (
                <div key={idx} className="relative group">
                  {block.type === "text" ? (
                    <Textarea
                      value={block.text}
                      onChange={(e) => updateStemBlock(idx, e.target.value)}
                      className="min-h-24 font-mono text-sm"
                      placeholder="请输入题目文字内容..."
                    />
                  ) : block.type === "image" ? (
                    <div className="p-3 border border-zinc-200 rounded-md bg-zinc-50">
                      <FileUpload
                        value={block.url}
                        onChange={(url) => updateStemBlock(idx, url)}
                        onRemove={() => updateStemBlock(idx, "")}
                        placeholder="点击或拖拽上传题干图片"
                      />
                    </div>
                  ) : null}
                  {stemBlocks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeStemBlock(idx)}
                      className="absolute -top-2 -right-2 rounded-full bg-white p-1 text-zinc-400 shadow-sm border border-zinc-200 hover:text-red-600 transition-opacity opacity-0 group-hover:opacity-100"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {type === "single" || type === "multiple" ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-zinc-700">选项设置</div>
                <Button variant="secondary" size="sm" onClick={addOption} className="h-7 text-xs">
                  + 添加选项
                </Button>
              </div>
              <div className="grid gap-2">
                {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-zinc-50 text-sm font-bold text-zinc-600">
                      {opt.id}
                    </div>
                    <Input
                      value={opt.text}
                      onChange={(e) => updateOption(idx, e.target.value)}
                      placeholder={`请输入选项 ${opt.id} 的内容`}
                      className="h-9"
                    />
                    <button
                      type="button"
                      onClick={() => removeOption(idx)}
                      disabled={options.length <= 1}
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30 disabled:hover:bg-transparent"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {type !== "short" && type !== "blank" && type !== "single" && type !== "multiple" && type !== "true_false" ? (
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
              {/* Fallback */}
            </div>
          ) : null}

          <div className="grid gap-1">
            <div className="text-xs font-medium text-zinc-700">
              {type === "short" ? "参考答案（仅供参考，不计入自动评分）" : "标准答案"}
            </div>
            {type === "single" || type === "multiple" ? (
              <div className="flex flex-wrap gap-2">
                {options.map((opt) => {
                  const isSelected =
                    type === "single"
                      ? answerKeyText === opt.id
                      : (() => {
                          try {
                            const arr = JSON.parse(answerKeyText);
                            return Array.isArray(arr) && arr.includes(opt.id);
                          } catch {
                            return answerKeyText.split(",").includes(opt.id);
                          }
                        })();
                  return (
                    <Button
                      key={opt.id}
                      variant={isSelected ? "primary" : "secondary"}
                      size="sm"
                      onClick={() => (type === "single" ? toggleSingleAnswer(opt.id) : toggleMultipleAnswer(opt.id))}
                      className="h-9 min-w-[44px] font-bold"
                    >
                      {opt.id}
                    </Button>
                  );
                })}
                {type === "multiple" && (
                  <div className="ml-2 flex items-center text-[10px] text-zinc-500">（可多选）</div>
                )}
              </div>
            ) : type === "true_false" ? (
              <div className="flex gap-2">
                <Button
                  variant={answerKeyText === "true" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => toggleTrueFalseAnswer(true)}
                  className="h-9 min-w-[80px]"
                >
                  对
                </Button>
                <Button
                  variant={answerKeyText === "false" ? "primary" : "secondary"}
                  size="sm"
                  onClick={() => toggleTrueFalseAnswer(false)}
                  className="h-9 min-w-[80px]"
                >
                  错
                </Button>
              </div>
            ) : (
              <Textarea
                value={answerKeyText}
                onChange={(e) => setAnswerKeyText(e.target.value)}
                className="min-h-24 font-mono text-sm"
                placeholder={type === "short" ? "请输入参考答案..." : "请输入标准答案内容"}
              />
            )}
          </div>

          <div className="grid gap-1">
            <div className="text-xs font-medium text-zinc-700">解析</div>
            <Textarea
              value={analysis}
              onChange={(e) => setAnalysis(e.target.value)}
              className="min-h-24 font-mono text-sm"
              placeholder="请输入题目解析..."
            />
          </div>

          {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

          <div className="flex items-center gap-2">
            <Button onClick={handleSave}>保存</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
