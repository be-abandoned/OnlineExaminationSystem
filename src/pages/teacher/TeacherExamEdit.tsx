import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Tag from "@/components/ui/Tag";
import QuestionSelectorModal from "@/components/questions/QuestionSelectorModal";
import { useAuthStore } from "@/stores/authStore";
import { GRADE_LEVELS, SUBJECTS, QUESTION_TYPE_LABELS, type Class, type Exam, type Question, type QuestionType } from "@/types/domain";
import {
  teacherSetExamAssignmentsRemote,
  teacherSetExamQuestionsRemote,
  teacherUpsertExamRemote,
} from "@/utils/remoteApi";
import { useTeacherExamDetailQuery } from "@/hooks/domain/useTeacherExamDetailQuery";
import TableSkeleton from "@/components/feedback/TableSkeleton";
import { invalidateByPrefix } from "@/lib/query/invalidate";

type SelectedQuestionItem = { questionId: string; score: number };
type EditorState = {
  items: SelectedQuestionItem[];
  selectedIds: string[];
  activeId: string | null;
  scoreDraft: string;
  history: SelectedQuestionItem[][];
  future: SelectedQuestionItem[][];
};

type EditorAction =
  | { type: "toggle_question"; questionId: string; defaultScore: number }
  | { type: "set_single_score"; questionId: string; score: number }
  | { type: "set_batch_score"; score: number }
  | { type: "move_up" }
  | { type: "move_down" }
  | { type: "set_active"; questionId: string | null }
  | { type: "toggle_batch"; questionId: string }
  | { type: "set_score_draft"; scoreDraft: string }
  | { type: "add_questions"; items: { questionId: string; defaultScore: number }[] }
  | { type: "reorder"; items: SelectedQuestionItem[] }
  | { type: "undo" }
  | { type: "redo" };

function clampScore(score: number) {
  if (!Number.isFinite(score)) return 0;
  return Math.max(0, Math.floor(score));
}

function pushHistory(state: EditorState, nextItems: SelectedQuestionItem[]): EditorState {
  if (JSON.stringify(state.items) === JSON.stringify(nextItems)) return state;
  return {
    ...state,
    items: nextItems,
    history: [...state.history, state.items],
    future: [],
    activeId:
      state.activeId && nextItems.some((x) => x.questionId === state.activeId)
        ? state.activeId
        : (nextItems[0]?.questionId ?? null),
    selectedIds: state.selectedIds.filter((id) => nextItems.some((x) => x.questionId === id)),
  };
}

function moveByOne(items: SelectedQuestionItem[], activeIds: string[], direction: "up" | "down") {
  if (items.length <= 1 || activeIds.length === 0) return items;
  const set = new Set(activeIds);
  const next = items.slice();
  if (direction === "up") {
    for (let i = 1; i < next.length; i++) {
      if (set.has(next[i].questionId) && !set.has(next[i - 1].questionId)) {
        const a = next[i - 1];
        next[i - 1] = next[i];
        next[i] = a;
      }
    }
    return next;
  }
  for (let i = next.length - 2; i >= 0; i--) {
    if (set.has(next[i].questionId) && !set.has(next[i + 1].questionId)) {
      const a = next[i + 1];
      next[i + 1] = next[i];
      next[i] = a;
    }
  }
  return next;
}

function editorReducer(state: EditorState, action: EditorAction): EditorState {
  if (action.type === "toggle_question") {
    const exists = state.items.some((x) => x.questionId === action.questionId);
    if (exists) {
      return pushHistory(
        {
          ...state,
          selectedIds: state.selectedIds.filter((id) => id !== action.questionId),
          activeId: state.activeId === action.questionId ? null : state.activeId,
        },
        state.items.filter((x) => x.questionId !== action.questionId),
      );
    }
    return pushHistory(state, [...state.items, { questionId: action.questionId, score: clampScore(action.defaultScore) }]);
  }
  if (action.type === "set_single_score") {
    return pushHistory(
      state,
      state.items.map((x) => (x.questionId === action.questionId ? { ...x, score: clampScore(action.score) } : x)),
    );
  }
  if (action.type === "set_batch_score") {
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.activeId ? [state.activeId] : [];
    if (ids.length === 0) return state;
    const set = new Set(ids);
    return pushHistory(
      state,
      state.items.map((x) => (set.has(x.questionId) ? { ...x, score: clampScore(action.score) } : x)),
    );
  }
  if (action.type === "move_up") {
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.activeId ? [state.activeId] : [];
    return pushHistory(state, moveByOne(state.items, ids, "up"));
  }
  if (action.type === "move_down") {
    const ids = state.selectedIds.length > 0 ? state.selectedIds : state.activeId ? [state.activeId] : [];
    return pushHistory(state, moveByOne(state.items, ids, "down"));
  }
  if (action.type === "set_active") {
    return { ...state, activeId: action.questionId };
  }
  if (action.type === "toggle_batch") {
    return {
      ...state,
      selectedIds: state.selectedIds.includes(action.questionId)
        ? state.selectedIds.filter((id) => id !== action.questionId)
        : [...state.selectedIds, action.questionId],
    };
  }
  if (action.type === "set_score_draft") {
    return { ...state, scoreDraft: action.scoreDraft };
  }
  if (action.type === "add_questions") {
    const existingIds = new Set(state.items.map((x) => x.questionId));
    const newItems = action.items
      .filter((x) => !existingIds.has(x.questionId))
      .map((x) => ({ questionId: x.questionId, score: clampScore(x.defaultScore) }));
    if (newItems.length === 0) return state;
    return pushHistory(state, [...state.items, ...newItems]);
  }
  if (action.type === "reorder") {
    return pushHistory(state, action.items);
  }
  if (action.type === "undo") {
    if (state.history.length === 0) return state;
    const prev = state.history[state.history.length - 1];
    return {
      ...state,
      items: prev,
      history: state.history.slice(0, -1),
      future: [state.items, ...state.future],
      selectedIds: state.selectedIds.filter((id) => prev.some((x) => x.questionId === id)),
      activeId: state.activeId && prev.some((x) => x.questionId === state.activeId) ? state.activeId : (prev[0]?.questionId ?? null),
    };
  }
  if (action.type === "redo") {
    if (state.future.length === 0) return state;
    const [nextItems, ...rest] = state.future;
    return {
      ...state,
      items: nextItems,
      history: [...state.history, state.items],
      future: rest,
      selectedIds: state.selectedIds.filter((id) => nextItems.some((x) => x.questionId === id)),
      activeId:
        state.activeId && nextItems.some((x) => x.questionId === state.activeId)
          ? state.activeId
          : (nextItems[0]?.questionId ?? null),
    };
  }
  return state;
}

interface SortableQuestionItemProps {
  item: SelectedQuestionItem;
  idx: number;
  questionMap: Map<string, Question>;
  isActive: boolean;
  isChecked: boolean;
  dispatch: React.Dispatch<EditorAction>;
}

function SortableQuestionItem({ item, idx, questionMap, isActive, isChecked, dispatch }: SortableQuestionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: item.questionId });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const q = questionMap.get(item.questionId);
  if (!q) return null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={
        isActive
          ? "rounded-lg border border-blue-300 bg-blue-50 p-3"
          : "rounded-lg border border-zinc-200 bg-white p-3"
      }
      onClick={() => dispatch({ type: "set_active", questionId: item.questionId })}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={isChecked}
          onChange={(e) => {
            e.stopPropagation();
            dispatch({ type: "toggle_batch", questionId: item.questionId });
          }}
          aria-label={`批量选择第${idx + 1}题`}
          className="mt-1 cursor-pointer"
          onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
        />
        <div className="min-w-0 flex-1 cursor-move">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-bold text-zinc-900">#{idx + 1}</span>
            <Tag tone="blue">{QUESTION_TYPE_LABELS[q.type]}</Tag>
            <span className="text-xs text-zinc-500">
              {GRADE_LEVELS.find((g) => g.value === q.gradeLevel)?.label} · {SUBJECTS.find((s) => s.id === q.subjectId)?.name}
            </span>
          </div>
          <div className="text-sm text-zinc-800 line-clamp-2 select-none">
            {q.stem[0]?.type === "text" ? q.stem[0].text : "[非文本题目]"}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 w-24">
          <Input
            id={`score-input-${item.questionId}`}
            value={String(item.score)}
            onChange={(e) =>
              dispatch({
                type: "set_single_score",
                questionId: item.questionId,
                score: Number(e.target.value || 0),
              })
            }
            className="h-8 w-full text-right"
            aria-label={`第${idx + 1}题分值`}
            placeholder="分值"
            onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
            onClick={(e) => e.stopPropagation()}
          />
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:bg-red-50 hover:text-red-700 h-8 px-2"
            onClick={(e) => {
              e.stopPropagation();
              dispatch({ type: "toggle_question", questionId: item.questionId, defaultScore: 0 });
            }}
            onPointerDown={(e) => e.stopPropagation()} // Prevent drag start
          >
            移除
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function TeacherExamEdit() {
  const me = useAuthStore((s) => s.getMe());
  const { examId } = useParams();
  const navigate = useNavigate();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [gradeLevel, setGradeLevel] = useState<number | undefined>(undefined);
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"draft" | "published" | "closed">("draft");
  const [attemptLimit, setAttemptLimit] = useState(1);
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  // Auto calculate time
  const handleTimeChange = (field: "duration" | "start" | "end", value: string | number) => {
    if (field === "duration") {
      const dur = Number(value);
      setDurationMinutes(dur);
      if (startAt && dur > 0) {
        const start = new Date(startAt);
        // Add duration (minutes) * 60000 milliseconds
        // IMPORTANT: The date string from input type="datetime-local" is local time
        // We can just operate on timestamps directly
        const endTimestamp = start.getTime() + dur * 60 * 1000;
        
        // Convert back to local ISO string YYYY-MM-DDTHH:mm
        const end = new Date(endTimestamp);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const localEndStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
        
        setEndAt(localEndStr);
      } else if (endAt && dur > 0) {
        const end = new Date(endAt);
        const startTimestamp = end.getTime() - dur * 60 * 1000;
        
        const start = new Date(startTimestamp);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const localStartStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
        
        setStartAt(localStartStr);
      }
    } else if (field === "start") {
      const start = String(value);
      setStartAt(start);
      if (start && durationMinutes > 0) {
        const s = new Date(start);
        const endTimestamp = s.getTime() + durationMinutes * 60 * 1000;
        
        const end = new Date(endTimestamp);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const localEndStr = `${end.getFullYear()}-${pad(end.getMonth() + 1)}-${pad(end.getDate())}T${pad(end.getHours())}:${pad(end.getMinutes())}`;
        
        setEndAt(localEndStr);
      } else if (start && endAt) {
        const s = new Date(start);
        const e = new Date(endAt);
        const diff = Math.floor((e.getTime() - s.getTime()) / 60000);
        if (diff > 0) setDurationMinutes(diff);
      }
    } else if (field === "end") {
      const end = String(value);
      setEndAt(end);
      if (end && startAt) {
        const s = new Date(startAt);
        const e = new Date(end);
        const diff = Math.floor((e.getTime() - s.getTime()) / 60000);
        if (diff > 0) setDurationMinutes(diff);
      } else if (end && durationMinutes > 0) {
        const e = new Date(end);
        const startTimestamp = e.getTime() - durationMinutes * 60 * 1000;
        
        const start = new Date(startTimestamp);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const localStartStr = `${start.getFullYear()}-${pad(start.getMonth() + 1)}-${pad(start.getDate())}T${pad(start.getHours())}:${pad(start.getMinutes())}`;
        
        setStartAt(localStartStr);
      }
    }
  };

  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | QuestionType>("all");
  const [editorState, dispatch] = useReducer(editorReducer, {
    items: [],
    selectedIds: [],
    activeId: null,
    scoreDraft: "",
    history: [],
    future: [],
  });
  const initializedRef = useRef<string | null>(null);
  const { data: detailData, isLoading, isRefreshing } = useTeacherExamDetailQuery(me?.id, examId);

  useEffect(() => {
    if (!detailData || !examId) return;
    setExam(detailData.exam);
    setQuestions(detailData.questions);
    setClasses(detailData.classes);
    if (initializedRef.current === examId) return;
    initializedRef.current = examId;
    setSelectedClassIds(detailData.exam.assignedClassIds ?? []);
    setTitle(detailData.exam.title || "");
    setDurationMinutes(detailData.exam.durationMinutes || 30);
    setGradeLevel(detailData.exam.gradeLevel);
    setSubjectId(detailData.exam.subjectId);
    setStatus(detailData.exam.status);
    setAttemptLimit(detailData.exam.attemptLimit || 1);
    setStartAt(detailData.exam.startAt ? detailData.exam.startAt.slice(0, 16) : "");
    setEndAt(detailData.exam.endAt ? detailData.exam.endAt.slice(0, 16) : "");
    dispatch({
      type: "reorder",
      items: detailData.examQuestions.map((x) => ({ questionId: x.questionId, score: x.score })),
    });
  }, [detailData, examId]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = editorState.items.findIndex((item) => item.questionId === active.id);
      const newIndex = editorState.items.findIndex((item) => item.questionId === over.id);
      const newItems = arrayMove(editorState.items, oldIndex, newIndex);
      dispatch({ type: "reorder", items: newItems });
    }
  };

  if (!me || !examId) return null;

  if (isLoading && !detailData) {
    return <TableSkeleton title="试卷创编" columns={2} rows={6} />;
  }

  if (!exam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>试卷不存在</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/teacher/exams">
            <Button variant="secondary">返回试卷列表</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  const questionMap = new Map(questions.map((q) => [q.id, q] as const));
  const selectedQuestions = editorState.items
    .map((x) => ({ questionId: x.questionId, score: x.score, q: questionMap.get(x.questionId) }))
    .filter((x): x is { questionId: string; score: number; q: Question } => Boolean(x.q));

  const saveAll = async (targetStatus: "draft" | "published" | "closed" = "draft") => {
    const next = await teacherUpsertExamRemote(me.id, {
      id: examId,
      title: title.trim() || exam.title,
      durationMinutes: Math.max(1, Math.floor(durationMinutes)),
      gradeLevel,
      subjectId,
      status: targetStatus,
      attemptLimit: Math.max(1, Math.floor(attemptLimit)),
      startAt: startAt ? new Date(startAt).toISOString() : undefined,
      endAt: endAt ? new Date(endAt).toISOString() : undefined,
    });
    await teacherSetExamQuestionsRemote(me.id, examId, editorState.items);
    // Only update assignments when publishing or if previously published
    if (targetStatus === "published" || status === "published") {
      await teacherSetExamAssignmentsRemote(me.id, examId, selectedClassIds);
    }
    setStatus(targetStatus);
    invalidateByPrefix("teacher", me.id, ["exam-detail", "exams", "dashboard"]);
    return next;
  };

  const totalScore = editorState.items.reduce((sum, x) => sum + (x.score || 0), 0);
  
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>试卷创编</CardTitle>
              {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <Tag tone={status === "published" ? "green" : status === "draft" ? "zinc" : "amber"}>
                {status === "published" ? "已发布" : status === "draft" ? "草稿" : "已关闭"}
              </Tag>
              <Button
                variant="secondary"
                onClick={async () => {
                  await saveAll("draft");
                  alert("已保存为草稿");
                }}
              >
                保存草稿
              </Button>
              <Button
                onClick={() => setIsPublishModalOpen(true)}
              >
                发布
              </Button>
              <Button variant="secondary" onClick={() => navigate(`/teacher/exams/${examId}/grading`)}>
                去阅卷
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">标题</div>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
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
              <div className="text-xs font-medium text-zinc-700">状态</div>
              <Select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published" | "closed")}>
                <option value="draft">草稿</option>
                <option value="published">已发布</option>
                <option value="closed">已关闭</option>
              </Select>
            </div>
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">时长（分钟）</div>
              <Input
                value={String(durationMinutes)}
                onChange={(e) => {
                  const val = Number(e.target.value || 0);
                  if (val > 180) {
                    if (window.confirm("考试时长超过3小时（180分钟），确定要设置这么长吗？")) {
                      handleTimeChange("duration", val);
                    }
                  } else {
                    handleTimeChange("duration", val);
                  }
                }}
              />
            </div>
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">次数限制</div>
              <Input value={String(attemptLimit)} onChange={(e) => setAttemptLimit(Number(e.target.value || 0))} />
            </div>
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">开始时间</div>
              <Input type="datetime-local" step="300" value={startAt} onChange={(e) => handleTimeChange("start", e.target.value)} />
            </div>
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">截止时间</div>
              <Input type="datetime-local" step="300" value={endAt} onChange={(e) => handleTimeChange("end", e.target.value)} />
            </div>
          </div>
          <div className="mt-3 text-xs text-zinc-500">总分：{totalScore} 分</div>
        </CardContent>
      </Card>

      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>试卷题目 ({editorState.items.length})</CardTitle>
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加题目
              </Button>
              <Button
                variant="ghost"
                aria-label="上移题目"
                onClick={() => dispatch({ type: "move_up" })}
                disabled={editorState.items.length === 0}
              >
                ↑ 上移
              </Button>
              <Button
                variant="ghost"
                aria-label="下移题目"
                onClick={() => dispatch({ type: "move_down" })}
                disabled={editorState.items.length === 0}
              >
                ↓ 下移
              </Button>
              <Input
                value={editorState.scoreDraft}
                onChange={(e) => dispatch({ type: "set_score_draft", scoreDraft: e.target.value })}
                placeholder="分值"
                className="h-9 w-20"
                aria-label="设置分值输入框"
              />
              <Button
                variant="secondary"
                aria-label="设置分值"
                onClick={() => dispatch({ type: "set_batch_score", score: Number(editorState.scoreDraft || 0) })}
              >
                设置分值
              </Button>
              <Button variant="secondary" aria-label="撤销" onClick={() => dispatch({ type: "undo" })}>
                撤销
              </Button>
              <Button variant="secondary" aria-label="重做" onClick={() => dispatch({ type: "redo" })}>
                重做
              </Button>
              <Link to="/teacher/questions">
                <Button variant="secondary">去题库</Button>
              </Link>
            </div>
          </div>
          <div className="mt-2 text-xs text-zinc-500" aria-live="polite">
            已选中 {editorState.selectedIds.length} 题
          </div>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={editorState.items.map(x => x.questionId)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-3 overflow-visible">
                {editorState.items.map((it, idx) => {
                  const isActive = editorState.activeId === it.questionId;
                  const isChecked = editorState.selectedIds.includes(it.questionId);
                  return (
                    <SortableQuestionItem
                      key={it.questionId}
                      item={it}
                      idx={idx}
                      questionMap={questionMap}
                      isActive={isActive}
                      isChecked={isChecked}
                      dispatch={dispatch}
                    />
                  );
                })}
                {editorState.items.length === 0 ? (
                  <div className="px-3 py-10 text-center text-sm text-zinc-500">
                    暂无题目，请点击右上角“添加题目”
                  </div>
                ) : null}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>
      
      <QuestionSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={(selected) => {
          dispatch({
            type: "add_questions",
            items: selected.map((q) => ({ questionId: q.id, defaultScore: q.defaultScore })),
          });
        }}
        excludeIds={editorState.items.map((x) => x.questionId)}
      />

      {/* Publish Modal */}
      {isPublishModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-bold">选择发布班级</h3>
            <div className="mb-4 max-h-60 overflow-y-auto space-y-2">
              {classes.map((c) => {
                const checked = selectedClassIds.includes(c.id);
                return (
                  <label key={c.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50">
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{c.name}</div>
                      <div className="text-xs text-zinc-500">{GRADE_LEVELS.find(g => g.value === c.gradeLevel)?.label}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedClassIds((arr) => [...arr, c.id]);
                        else setSelectedClassIds((arr) => arr.filter((x) => x !== c.id));
                      }}
                    />
                  </label>
                );
              })}
              {classes.length === 0 && <div className="text-center text-sm text-zinc-500">暂无班级</div>}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsPublishModalOpen(false)}>取消</Button>
              <Button
                disabled={selectedClassIds.length === 0}
                onClick={async () => {
                  await saveAll("published");
                  setIsPublishModalOpen(false);
                  alert("发布成功！");
                }}
              >
                确认发布
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
