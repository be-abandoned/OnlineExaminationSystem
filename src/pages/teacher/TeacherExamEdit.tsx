import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragOverlay } from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useReducer, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Tag from "@/components/ui/Tag";
import Modal from "@/components/ui/Modal";
import QuestionSelectorModal from "@/components/questions/QuestionSelectorModal";
import { useAuthStore } from "@/stores/authStore";
import { EXAM_STATUS_LABELS, GRADE_LEVELS, SUBJECTS, QUESTION_TYPE_LABELS, type Class, type Exam, type ExamQuestionTypeSettings, type ExamStatus, type Question, type QuestionType, type QuestionTypePreset } from "@/types/domain";
import {
  teacherDeleteQuestionTypePresetRemote,
  teacherListQuestionTypePresetsRemote,
  teacherSetExamAssignmentsRemote,
  teacherSetExamQuestionsRemote,
  teacherUpsertExamRemote,
  teacherUpsertQuestionTypePresetRemote,
} from "@/utils/remoteApi";
import { useTeacherExamDetailQuery } from "@/hooks/domain/useTeacherExamDetailQuery";
import TableSkeleton from "@/components/feedback/TableSkeleton";
import { invalidateByPrefix } from "@/lib/query/invalidate";
import { cn } from "@/lib/utils";

type SelectedQuestionItem = { questionId: string; score: number };
type TypeSettings = ExamQuestionTypeSettings;

const EMPTY_TYPE_SETTINGS: TypeSettings = {
  single: { count: 0, score: 0 },
  multiple: { count: 0, score: 0 },
  true_false: { count: 0, score: 0 },
  blank: { count: 0, score: 0 },
  short: { count: 0, score: 0 },
};

function cloneTypeSettings(settings: TypeSettings): TypeSettings {
  return {
    single: { ...settings.single },
    multiple: { ...settings.multiple },
    true_false: { ...settings.true_false },
    blank: { ...settings.blank },
    short: { ...settings.short },
  };
}

function normalizeTypeSettings(settings?: ExamQuestionTypeSettings): TypeSettings {
  if (!settings) return cloneTypeSettings(EMPTY_TYPE_SETTINGS);
  return {
    single: { count: Number(settings.single?.count || 0), score: Number(settings.single?.score || 0) },
    multiple: { count: Number(settings.multiple?.count || 0), score: Number(settings.multiple?.score || 0) },
    true_false: { count: Number(settings.true_false?.count || 0), score: Number(settings.true_false?.score || 0) },
    blank: { count: Number(settings.blank?.count || 0), score: Number(settings.blank?.score || 0) },
    short: { count: Number(settings.short?.count || 0), score: Number(settings.short?.score || 0) },
  };
}

function getAutomaticExamStatus(isPublished: boolean, endAt?: string): ExamStatus {
  if (!isPublished) return "draft";
  if (endAt && Date.now() > new Date(endAt).getTime()) return "closed";
  return "published";
}

function toLocalDateTimeInputValue(isoString?: string) {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIsoFromLocalDateTimeInput(value?: string) {
  if (!value) return undefined;
  const [datePart, timePart] = value.split("T");
  if (!datePart || !timePart) return undefined;
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const localDate = new Date(year, (month || 1) - 1, day || 1, hour || 0, minute || 0, 0, 0);
  if (Number.isNaN(localDate.getTime())) return undefined;
  return localDate.toISOString();
}

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
  | { type: "remove_selected" }
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
  if (action.type === "remove_selected") {
    if (state.selectedIds.length === 0) return state;
    const selected = new Set(state.selectedIds);
    return pushHistory(
      { ...state, selectedIds: [], activeId: state.activeId && selected.has(state.activeId) ? null : state.activeId },
      state.items.filter((item) => !selected.has(item.questionId)),
    );
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
  const [isTypeSettingsOpen, setIsTypeSettingsOpen] = useState(false);
  const [typeSettings, setTypeSettings] = useState<TypeSettings>(EMPTY_TYPE_SETTINGS);
  const [typeSettingsDraft, setTypeSettingsDraft] = useState<TypeSettings>(EMPTY_TYPE_SETTINGS);
  const [typeSettingsError, setTypeSettingsError] = useState<string | null>(null);
  const [typePresets, setTypePresets] = useState<QuestionTypePreset[]>([]);
  const [isPresetPanelOpen, setIsPresetPanelOpen] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [isPresetSaving, setIsPresetSaving] = useState(false);
  const [isPresetLoading, setIsPresetLoading] = useState(false);
  const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);
  const autoOpenedTypeSettingsRef = useRef<string | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);

  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(30);
  const [gradeLevel, setGradeLevel] = useState<number | undefined>(undefined);
  const [subjectId, setSubjectId] = useState<string | undefined>(undefined);
  const [hasPublished, setHasPublished] = useState(false);
  const [status, setStatus] = useState<ExamStatus>("draft");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [draftSaveMessage, setDraftSaveMessage] = useState<string | null>(null);
  const [draftSaveProgress, setDraftSaveProgress] = useState(0);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState(0);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const draftSaveTimerRef = useRef<number | null>(null);
  const publishSuccessTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (draftSaveTimerRef.current) {
        window.clearTimeout(draftSaveTimerRef.current);
      }
      if (publishSuccessTimerRef.current) {
        window.clearTimeout(publishSuccessTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!me?.id) return;
    setIsPresetLoading(true);
    teacherListQuestionTypePresetsRemote(me.id)
      .then(setTypePresets)
      .catch((err) => setPresetMessage(err instanceof Error ? err.message : "题型预设加载失败"))
      .finally(() => setIsPresetLoading(false));
  }, [me?.id]);

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
  const [examQuestionTypeFilter, setExamQuestionTypeFilter] = useState<"all" | QuestionType>("all");
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
    setHasPublished(detailData.exam.status !== "draft");
    setStatus(getAutomaticExamStatus(detailData.exam.status !== "draft", detailData.exam.endAt));
    setStartAt(toLocalDateTimeInputValue(detailData.exam.startAt));
    setEndAt(toLocalDateTimeInputValue(detailData.exam.endAt));
    const savedTypeSettings = normalizeTypeSettings(detailData.exam.questionTypeSettings);
    setTypeSettings(savedTypeSettings);
    setTypeSettingsDraft(cloneTypeSettings(savedTypeSettings));
    dispatch({
      type: "reorder",
      items: detailData.examQuestions.map((x) => ({ questionId: x.questionId, score: x.score })),
    });
    if (detailData.examQuestions.length === 0 && autoOpenedTypeSettingsRef.current !== examId) {
      autoOpenedTypeSettingsRef.current = examId;
      setTypeSettingsDraft(cloneTypeSettings(typeSettings));
      setTypeSettingsError(null);
      setIsTypeSettingsOpen(true);
    }
  }, [detailData, examId]);

  useEffect(() => {
    setStatus(getAutomaticExamStatus(hasPublished, endAt));
  }, [hasPublished, endAt]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (examQuestionTypeFilter !== "all" && typeSettings[examQuestionTypeFilter].count <= 0) {
      setExamQuestionTypeFilter("all");
    }
  }, [examQuestionTypeFilter, typeSettings]);

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
  const questionBankTypeCounts = questions.reduce<Record<QuestionType, number>>((acc, question) => {
    acc[question.type] += 1;
    return acc;
  }, { single: 0, multiple: 0, true_false: 0, blank: 0, short: 0 });
  const selectedTypeCounts = editorState.items.reduce<Record<QuestionType, number>>((acc, item) => {
    const question = questionMap.get(item.questionId);
    if (question) acc[question.type] += 1;
    return acc;
  }, { single: 0, multiple: 0, true_false: 0, blank: 0, short: 0 });
  const selectedTypeScores = editorState.items.reduce<Record<QuestionType, number>>((acc, item) => {
    const question = questionMap.get(item.questionId);
    if (question) acc[question.type] += item.score || 0;
    return acc;
  }, { single: 0, multiple: 0, true_false: 0, blank: 0, short: 0 });
  const expectedTypeScores = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).reduce<Record<QuestionType, number>>((acc, type) => {
    acc[type] = typeSettingsDraft[type].count * typeSettingsDraft[type].score;
    return acc;
  }, { single: 0, multiple: 0, true_false: 0, blank: 0, short: 0 });
  const expectedTotalScore = (Object.keys(expectedTypeScores) as QuestionType[]).reduce((sum, type) => sum + expectedTypeScores[type], 0);
  const selectedQuestions = editorState.items
    .map((x) => ({ questionId: x.questionId, score: x.score, q: questionMap.get(x.questionId) }))
    .filter((x): x is { questionId: string; score: number; q: Question } => Boolean(x.q));
  const visibleEditorItems = examQuestionTypeFilter === "all"
    ? editorState.items
    : editorState.items.filter((item) => questionMap.get(item.questionId)?.type === examQuestionTypeFilter);
  const visibleTypeFilterButtons = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).filter((type) => typeSettings[type].count > 0);

  const openTypeSettings = () => {
    setTypeSettingsDraft(cloneTypeSettings(typeSettings));
    setTypeSettingsError(null);
    setPresetMessage(null);
    setIsTypeSettingsOpen(true);
  };

  const saveTypeSettings = () => {
    for (const [type, setting] of Object.entries(typeSettingsDraft) as [QuestionType, TypeSettings[QuestionType]][]) {
      if (setting.count > questionBankTypeCounts[type]) {
        setTypeSettingsError(`${QUESTION_TYPE_LABELS[type]}预期数量不能大于题库该类型总量 ${questionBankTypeCounts[type]} 道`);
        return;
      }
    }
    setTypeSettings(cloneTypeSettings(typeSettingsDraft));
    setIsTypeSettingsOpen(false);
  };

  const refreshTypePresets = async () => {
    if (!me?.id) return;
    setIsPresetLoading(true);
    try {
      setTypePresets(await teacherListQuestionTypePresetsRemote(me.id));
    } catch (err) {
      setPresetMessage(err instanceof Error ? err.message : "题型预设加载失败");
    } finally {
      setIsPresetLoading(false);
    }
  };

  const resetPresetForm = () => {
    setPresetName("");
    setPresetMessage(null);
  };

  const clearTypeSettingsDraft = () => {
    setTypeSettingsDraft(cloneTypeSettings(EMPTY_TYPE_SETTINGS));
    setTypeSettingsError(null);
    setPresetMessage(null);
  };

  const savePreset = async () => {
    if (!me?.id) return;
    const name = presetName.trim();
    if (!name) {
      setPresetMessage("请填写预设名称");
      return;
    }
    if (typePresets.length >= 6) {
      setPresetMessage("最多只能保存六种题型预设");
      return;
    }
    setIsPresetSaving(true);
    setPresetMessage(null);
    try {
      await teacherUpsertQuestionTypePresetRemote(me.id, {
        name,
        settings: cloneTypeSettings(typeSettingsDraft),
      });
      await refreshTypePresets();
      setPresetMessage("题型预设已保存");
      resetPresetForm();
    } catch (err) {
      setPresetMessage(err instanceof Error ? err.message : "题型预设保存失败");
    } finally {
      setIsPresetSaving(false);
    }
  };

  const applyPreset = (preset: QuestionTypePreset) => {
    setTypeSettingsDraft(cloneTypeSettings(normalizeTypeSettings(preset.settings)));
    setPresetMessage(`已应用预设：${preset.name}`);
  };

  const deletePreset = async (preset: QuestionTypePreset) => {
    if (!me?.id) return;
    setPresetMessage(null);
    try {
      await teacherDeleteQuestionTypePresetRemote(me.id, preset.id);
      await refreshTypePresets();
      setPresetMessage("题型预设已删除");
    } catch (err) {
      setPresetMessage(err instanceof Error ? err.message : "题型预设删除失败");
    }
  };

  const getTypeShortageMessage = () => {
    const shortages = (Object.keys(QUESTION_TYPE_LABELS) as QuestionType[])
      .filter((type) => typeSettings[type].count > selectedTypeCounts[type])
      .map((type) => `${QUESTION_TYPE_LABELS[type]} ${selectedTypeCounts[type]}/${typeSettings[type].count}`);
    return shortages.length > 0 ? shortages.join("、") : "";
  };

  const saveAll = async (shouldPublish = hasPublished, onProgress?: (progress: number) => void) => {
    const nextStatus = getAutomaticExamStatus(shouldPublish, endAt);
    onProgress?.(20);
    const next = await teacherUpsertExamRemote(me.id, {
      id: examId,
      title: title.trim() || exam.title,
      durationMinutes: Math.max(1, Math.floor(durationMinutes)),
      gradeLevel,
      subjectId,
      status: nextStatus,
      attemptLimit: 1,
      startAt: toIsoFromLocalDateTimeInput(startAt),
      endAt: toIsoFromLocalDateTimeInput(endAt),
      questionTypeSettings: typeSettings,
    });
    onProgress?.(55);
    await teacherSetExamQuestionsRemote(me.id, examId, editorState.items);
    onProgress?.(shouldPublish ? 75 : 90);
    if (shouldPublish) {
      await teacherSetExamAssignmentsRemote(me.id, examId, selectedClassIds);
    }
    onProgress?.(100);
    setHasPublished(shouldPublish);
    setStatus(nextStatus);
    invalidateByPrefix("teacher", me.id, ["exam-detail", "exams", "dashboard"]);
    return next;
  };

  const saveDraft = async () => {
    if (draftSaveTimerRef.current) {
      window.clearTimeout(draftSaveTimerRef.current);
      draftSaveTimerRef.current = null;
    }
    setDraftSaveProgress(8);
    setDraftSaveMessage("保存中...");
    try {
      await saveAll(false, setDraftSaveProgress);
      setDraftSaveProgress(100);
      setDraftSaveMessage("保存成功！");
      draftSaveTimerRef.current = window.setTimeout(() => {
        setDraftSaveMessage(null);
        setDraftSaveProgress(0);
        draftSaveTimerRef.current = null;
        navigate("/teacher", { replace: true });
      }, 1600);
    } catch (err) {
      setDraftSaveMessage(null);
      setDraftSaveProgress(0);
      alert(err instanceof Error ? err.message : "保存失败");
    }
  };

  const publishExam = async () => {
    if (isPublishing) return;
    if (publishSuccessTimerRef.current) {
      window.clearTimeout(publishSuccessTimerRef.current);
      publishSuccessTimerRef.current = null;
    }
    setIsPublishing(true);
    setPublishProgress(8);
    setPublishSuccess(false);
    setPublishError(null);
    try {
      await saveAll(true, setPublishProgress);
      setPublishProgress(100);
      setPublishSuccess(true);
      publishSuccessTimerRef.current = window.setTimeout(() => {
        setIsPublishModalOpen(false);
        setPublishSuccess(false);
        setPublishProgress(0);
        publishSuccessTimerRef.current = null;
        navigate("/teacher", { replace: true });
      }, 1600);
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : "发布失败");
      setPublishProgress(0);
    } finally {
      setIsPublishing(false);
    }
  };

  const totalScore = editorState.items.reduce((sum, x) => sum + (x.score || 0), 0);
  
  return (
    <div className="grid gap-4">
      {draftSaveMessage ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white px-8 py-10 text-center shadow-2xl">
            <div className="text-2xl font-semibold text-zinc-900">{draftSaveMessage}</div>
            <div className="mt-6 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all duration-300"
                style={{ width: `${draftSaveProgress}%` }}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">{draftSaveProgress}%</div>
          </div>
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button onClick={openTypeSettings}>
                <SlidersHorizontal className="mr-2 h-4 w-4" />
                题型设置
              </Button>
              {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <Tag tone={status === "published" ? "green" : status === "draft" ? "zinc" : "amber"}>
                {EXAM_STATUS_LABELS[status]}
              </Tag>
              <Button
                variant="secondary"
                onClick={saveDraft}
                disabled={draftSaveMessage === "保存中..."}
              >
                保存草稿
              </Button>
              <Button
                onClick={() => {
                  const shortage = getTypeShortageMessage();
                  if (shortage) {
                    alert(`未选够预设题型数量：${shortage}`);
                    return;
                  }
                  setIsPublishModalOpen(true);
                  setPublishError(null);
                  setPublishSuccess(false);
                  setPublishProgress(0);
                }}
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
            <div className="flex items-center gap-3">
              <CardTitle>试卷题目 ({editorState.items.length})</CardTitle>
              <span className="text-xs text-zinc-500">已选中 {editorState.selectedIds.length} 题</span>
              {editorState.selectedIds.length > 0 ? (
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-red-600 text-white shadow-sm hover:bg-red-700"
                  aria-label="删除选中题目"
                  onClick={() => dispatch({ type: "remove_selected" })}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                添加题目
              </Button>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2" aria-live="polite">
            <button
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition",
                examQuestionTypeFilter === "all" ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
              )}
              onClick={() => setExamQuestionTypeFilter("all")}
            >
              全部
            </button>
            {visibleTypeFilterButtons.map((type) => (
              <button
                key={type}
                type="button"
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-medium transition",
                  examQuestionTypeFilter === type ? "bg-blue-600 text-white" : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
                onClick={() => setExamQuestionTypeFilter(type)}
              >
                {QUESTION_TYPE_LABELS[type]} {selectedTypeCounts[type]}/{typeSettings[type].count || "不限"}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={visibleEditorItems.map(x => x.questionId)} strategy={verticalListSortingStrategy}>
              <div className="grid gap-3 overflow-visible">
                {visibleEditorItems.map((it, idx) => {
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
                ) : visibleEditorItems.length === 0 ? (
                  <div className="px-3 py-10 text-center text-sm text-zinc-500">
                    当前筛选下暂无题目
                  </div>
                ) : null}
              </div>
            </SortableContext>
          </DndContext>
        </CardContent>
      </Card>
      
      <Modal
        isOpen={isTypeSettingsOpen}
        onClose={() => setIsTypeSettingsOpen(false)}
        title="题型设置"
        width="max-w-3xl"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={clearTypeSettingsDraft}>清空</Button>
            <Button variant="secondary" onClick={() => setIsTypeSettingsOpen(false)}>取消</Button>
            <Button onClick={saveTypeSettings}>保存设置</Button>
          </div>
        }
      >
        <div className="grid gap-4">
          {typeSettingsError ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{typeSettingsError}</div> : null}
          <div className="flex items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => setIsPresetPanelOpen((open) => !open)}>
              题型预设方案
            </Button>
            <span className="text-xs text-zinc-500">全教师共用，当前 {typePresets.length}/6</span>
          </div>
          {isPresetPanelOpen ? (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">题型预设方案</div>
                  <div className="text-xs text-zinc-500">保存当前填写的各题型数量和分值，最多 6 种</div>
                </div>
                {isPresetLoading ? <span className="text-xs text-zinc-500">加载中...</span> : null}
              </div>
              <div className="mb-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                <Input
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="请输入预设名称"
                />
                <Button onClick={savePreset} disabled={isPresetSaving || typePresets.length >= 6}>
                  {isPresetSaving ? "保存中..." : "保存为预设"}
                </Button>
              </div>
              {presetMessage ? <div className="mb-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{presetMessage}</div> : null}
              <div className="grid gap-2">
                {typePresets.map((preset) => (
                  <div key={preset.id} className="rounded-lg border border-zinc-200 bg-white p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <div className="font-medium text-zinc-900">{preset.name}</div>
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="secondary" onClick={() => applyPreset(preset)}>应用</Button>
                        <Button size="sm" variant="danger" onClick={() => void deletePreset(preset)}>删除</Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 text-xs text-zinc-500">
                      {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
                        <span key={type} className="rounded-full bg-zinc-100 px-2 py-0.5">
                          {QUESTION_TYPE_LABELS[type]} {preset.settings[type].count}题/{preset.settings[type].score}分
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {!isPresetLoading && typePresets.length === 0 ? <div className="rounded-lg border border-dashed border-zinc-200 bg-white px-3 py-4 text-center text-sm text-zinc-500">暂无题型预设</div> : null}
              </div>
            </div>
          ) : null}
          <div className="grid gap-3">
            {(Object.keys(QUESTION_TYPE_LABELS) as QuestionType[]).map((type) => (
              <div key={type} className="grid grid-cols-4 items-center gap-3 rounded-lg border border-zinc-200 p-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{QUESTION_TYPE_LABELS[type]}</div>
                  <div className="text-xs text-zinc-500">题库共 {questionBankTypeCounts[type]} 道，已选 {selectedTypeCounts[type]} 道</div>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">预期数量</label>
                  <Input
                    type="number"
                    min={0}
                    max={questionBankTypeCounts[type]}
                    value={String(typeSettingsDraft[type].count)}
                    onChange={(e) => {
                      const count = Math.max(0, Math.floor(Number(e.target.value || 0)));
                      setTypeSettingsDraft((prev) => ({ ...prev, [type]: { ...prev[type], count } }));
                    }}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-zinc-500">默认分值</label>
                  <Input
                    type="number"
                    min={0}
                    value={String(typeSettingsDraft[type].score)}
                    onChange={(e) => {
                      const score = Math.max(0, Math.floor(Number(e.target.value || 0)));
                      setTypeSettingsDraft((prev) => ({ ...prev, [type]: { ...prev[type], score } }));
                    }}
                  />
                </div>
                <div>
                  <div className="mb-1 text-xs text-zinc-500">该题型累计分数</div>
                  <div className="text-sm font-semibold text-zinc-900">{selectedTypeScores[type]}/{expectedTypeScores[type]} 分</div>
                </div>
              </div>
            ))}
          </div>
          <div className="rounded-lg bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700">
            试卷分数：{totalScore}/{expectedTotalScore} 分
          </div>
        </div>
      </Modal>

      <QuestionSelectorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={(selected) => {
          dispatch({
            type: "add_questions",
            items: selected.map((q) => ({
              questionId: q.id,
              defaultScore: typeSettings[q.type].score > 0 ? typeSettings[q.type].score : q.defaultScore,
            })),
          });
        }}
        excludeIds={editorState.items.map((x) => x.questionId)}
        initialType={examQuestionTypeFilter}
        typeSettings={typeSettings}
        selectedTypeCounts={selectedTypeCounts}
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
                  <label key={c.id} className={cn("flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50", isPublishing && "pointer-events-none opacity-70")}>
                    <div>
                      <div className="text-sm font-medium text-zinc-900">{c.name}</div>
                      <div className="text-xs text-zinc-500">{GRADE_LEVELS.find(g => g.value === c.gradeLevel)?.label}</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isPublishing}
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
            {(isPublishing || publishSuccess) ? (
              <div className="mb-4 rounded-lg bg-blue-50 px-3 py-3">
                <div className="mb-2 flex items-center justify-between text-sm font-medium text-blue-700">
                  <span>{publishSuccess ? "发布成功！" : "发布中..."}</span>
                  <span>{publishProgress}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-blue-100">
                  <div
                    className="h-full rounded-full bg-blue-600 transition-all duration-300"
                    style={{ width: `${publishProgress}%` }}
                  />
                </div>
              </div>
            ) : null}
            {publishError ? <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{publishError}</div> : null}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsPublishModalOpen(false)} disabled={isPublishing}>取消</Button>
              <Button
                disabled={selectedClassIds.length === 0 || isPublishing || publishSuccess}
                onClick={publishExam}
              >
                {isPublishing ? "发布中..." : publishSuccess ? "发布成功" : "确认发布"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
