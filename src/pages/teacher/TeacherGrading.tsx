import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Tag from "@/components/ui/Tag";
import Textarea from "@/components/ui/Textarea";
import StemViewer from "@/components/questions/StemViewer";
import { useAuthStore } from "@/stores/authStore";
import {
  teacherPublishExamResultsRemote,
  teacherSaveManualScoresRemote,
} from "@/utils/remoteApi";
import {
  updateTeacherGradingListAfterScore,
  updateTeacherGradingListAttempt,
  useTeacherGradingListQuery,
} from "@/hooks/domain/useTeacherGradingQuery";
import { invalidateByPrefix } from "@/lib/query/invalidate";
import TableSkeleton from "@/components/feedback/TableSkeleton";
import { QUESTION_TYPE_LABELS, type Attempt, type AttemptAnswer, type QuestionType } from "@/types/domain";

const SUBJECTIVE_TYPES = new Set<QuestionType>(["blank", "short"]);

type Draft = {
  manualScore: string;
  teacherComment: string;
};

function isSubjectiveType(type: QuestionType) {
  return SUBJECTIVE_TYPES.has(type);
}

function getAnswerKey(attemptId: string, questionId: string) {
  return `${attemptId}:${questionId}`;
}

function formatAnswerValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "未作答";
  if (Array.isArray(value)) return value.length > 0 ? value.join("、") : "未作答";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function isAnswerManuallyGraded(answer: AttemptAnswer | undefined, attempt: Attempt) {
  const submittedAt = attempt.submittedAt ? Date.parse(attempt.submittedAt) : Number.NaN;
  const updatedAt = answer?.updatedAt ? Date.parse(answer.updatedAt) : Number.NaN;
  return Number.isFinite(submittedAt) && Number.isFinite(updatedAt) && updatedAt > submittedAt;
}

export default function TeacherGrading() {
  const me = useAuthStore((s) => s.getMe());
  const { examId } = useParams();
  const { data, isLoading, isRefreshing } = useTeacherGradingListQuery(me?.id, examId);
  const exam = data?.exam || null;
  const attempts = data?.attempts || [];
  const allQuestions = data?.questions || [];
  const allAnswers = data?.answers || [];
  const [activeIndexByQuestionId, setActiveIndexByQuestionId] = useState<Record<string, number>>({});
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [publishBusy, setPublishBusy] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const gradableAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.status === "submitted" || attempt.status === "graded"),
    [attempts],
  );

  const subjectiveQuestions = useMemo(
    () => allQuestions.filter(({ q }) => isSubjectiveType(q.type)),
    [allQuestions],
  );

  const answersByAttemptQuestion = useMemo(() => {
    const next = new Map<string, AttemptAnswer>();
    allAnswers.forEach((answer) => next.set(getAnswerKey(answer.attemptId, answer.questionId), answer));
    return next;
  }, [allAnswers]);

  const totalAnswerCount = subjectiveQuestions.length * gradableAttempts.length;
  const gradedAnswerCount = subjectiveQuestions.reduce((sum, { q }) => {
    return sum + gradableAttempts.filter((attempt) => {
      const answer = answersByAttemptQuestion.get(getAnswerKey(attempt.id, q.id));
      return isAnswerManuallyGraded(answer, attempt);
    }).length;
  }, 0);
  const publishableAttempts = attempts.filter((attempt) => attempt.status === "graded" && !attempt.scorePublished);

  const persistScore = async (
    questionId: string,
    maxScore: number,
    attempt: Attempt,
    options: { force?: boolean } = {},
  ) => {
    if (!me?.id || !examId) return false;
    const draftKey = getAnswerKey(attempt.id, questionId);
    const draft = drafts[draftKey];
    if (!draft) {
      const existingAnswer = answersByAttemptQuestion.get(draftKey);
      if (options.force && isAnswerManuallyGraded(existingAnswer, attempt)) {
        return true;
      }
      if (options.force) {
        setStatusMessage("请填写分数后再保存");
        return false;
      }
      return true;
    }

    const trimmedScore = draft.manualScore.trim();
    if (!trimmedScore) {
      setStatusMessage("请填写分数后再保存");
      return false;
    }
    const numericScore = Number(trimmedScore);
    if (!Number.isFinite(numericScore)) {
      setStatusMessage("分数格式不正确");
      return false;
    }

    const manualScore = Math.min(maxScore, Math.max(0, Math.floor(numericScore)));
    setSavingKey(draftKey);
    setStatusMessage(null);
    try {
      const result = await teacherSaveManualScoresRemote(me.id, attempt.id, [{
        questionId,
        manualScore,
        teacherComment: draft.teacherComment.trim() || undefined,
      }]);
      updateTeacherGradingListAfterScore(me.id, examId, result.attempt, result.answers);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      invalidateByPrefix("teacher", me.id, ["exams", "dashboard"]);
      setStatusMessage("评分已保存");
      return true;
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "保存评分失败");
      return false;
    } finally {
      setSavingKey(null);
    }
  };

  const publishGradedScores = async () => {
    if (!me?.id || !examId || publishBusy || publishableAttempts.length === 0) return;
    setPublishBusy(true);
    setStatusMessage(null);
    try {
      const updatedAttempts = await teacherPublishExamResultsRemote(me.id, examId);
      for (const attempt of updatedAttempts) {
        updateTeacherGradingListAttempt(me.id, examId, attempt.id, (current) => ({
          ...current,
          ...attempt,
        }));
      }
      invalidateByPrefix("teacher", me.id, ["grading-list", "grading-detail", "exams", "dashboard", "messages"]);
      setStatusMessage("已发布已阅卷成绩，并发送考试结果通知");
    } catch (err) {
      setStatusMessage(err instanceof Error ? err.message : "发布成绩失败");
    } finally {
      setPublishBusy(false);
    }
  };

  if (!me || !examId) return null;

  if (isLoading && !data) {
    return <TableSkeleton title="阅卷中心" columns={2} rows={5} />;
  }

  if (!exam) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>阅卷页不可用</CardTitle>
        </CardHeader>
        <CardContent>
          <Link to="/teacher/exams">
            <Button variant="secondary">返回试卷列表</Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>{exam.title}</CardTitle>
              <div className="mt-1 text-xs text-zinc-500">
                {isRefreshing ? "正在刷新..." : `主观题 ${subjectiveQuestions.length} 道 · 已提交答卷 ${gradableAttempts.length} 份`}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={gradedAnswerCount === totalAnswerCount && totalAnswerCount > 0 ? "green" : "amber"}>
                {gradedAnswerCount}/{totalAnswerCount}
              </Tag>
              <Button
                variant="secondary"
                disabled={publishBusy || publishableAttempts.length === 0}
                onClick={() => void publishGradedScores()}
              >
                {publishBusy ? "发布中..." : "发布已阅卷成绩"}
              </Button>
              <Link to={`/teacher/exams/${examId}/edit`}>
                <Button variant="secondary">回到编辑</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all duration-300"
              style={{ width: totalAnswerCount > 0 ? `${Math.round((gradedAnswerCount / totalAnswerCount) * 100)}%` : "0%" }}
            />
          </div>
          {statusMessage ? <div className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-700">{statusMessage}</div> : null}
        </CardContent>
      </Card>

      {subjectiveQuestions.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-10 text-center text-sm text-zinc-500">
            暂无需要人工阅卷的填空题或简答题
          </CardContent>
        </Card>
      ) : null}

      {subjectiveQuestions.length > 0 && gradableAttempts.length === 0 ? (
        <Card>
          <CardContent className="px-4 py-10 text-center text-sm text-zinc-500">
            暂无已提交答卷
          </CardContent>
        </Card>
      ) : null}

      {subjectiveQuestions.map(({ eq, q }, questionIndex) => {
        const rows = gradableAttempts.map((attempt) => ({
          attempt,
          answer: answersByAttemptQuestion.get(getAnswerKey(attempt.id, q.id)),
        }));
        const activeIndex = rows.length > 0
          ? Math.min(activeIndexByQuestionId[q.id] ?? 0, rows.length - 1)
          : 0;
        const current = rows[activeIndex];
        const draftKey = current ? getAnswerKey(current.attempt.id, q.id) : "";
        const graded = current ? isAnswerManuallyGraded(current.answer, current.attempt) : false;
        const currentDraft = current
          ? drafts[draftKey] ?? {
              manualScore: graded ? String(current.answer?.manualScore ?? 0) : "",
              teacherComment: current.answer?.teacherComment ?? "",
            }
          : { manualScore: "", teacherComment: "" };
        const gradedCount = rows.filter((row) => isAnswerManuallyGraded(row.answer, row.attempt)).length;
        const progress = rows.length > 0 ? Math.round((gradedCount / rows.length) * 100) : 0;
        const isSavingCurrent = Boolean(draftKey && savingKey === draftKey);

        const goPrevious = () => {
          if (!current) return;
          setActiveIndexByQuestionId((prev) => ({
            ...prev,
            [q.id]: Math.max(activeIndex - 1, 0),
          }));
        };

        const goNext = async () => {
          if (!current) return;
          const saved = await persistScore(q.id, eq.score, current.attempt, { force: true });
          if (!saved) return;
          setActiveIndexByQuestionId((prev) => ({
            ...prev,
            [q.id]: Math.min(activeIndex + 1, rows.length - 1),
          }));
        };

        const updateDraft = (patch: Partial<Draft>) => {
          if (!current) return;
          setDrafts((prev) => ({
            ...prev,
            [draftKey]: {
              manualScore: currentDraft.manualScore,
              teacherComment: currentDraft.teacherComment,
              ...patch,
            },
          }));
        };

        return (
          <Card key={q.id}>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle>
                    第 {questionIndex + 1} 题
                    <span className="ml-2 text-sm font-medium text-zinc-500">({QUESTION_TYPE_LABELS[q.type]})</span>
                  </CardTitle>
                  <div className="mt-1 text-xs text-zinc-500">满分 {eq.score} 分</div>
                </div>
                <div className="min-w-40">
                  <div className="mb-1 flex items-center justify-between text-xs text-zinc-500">
                    <span>阅卷进度</span>
                    <span>{gradedCount}/{rows.length}</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className="h-full rounded-full bg-blue-600 transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4">
                <div className="rounded-lg border border-zinc-200 bg-white p-4">
                  <StemViewer blocks={q.stem} />
                </div>

                <div className="grid grid-cols-[auto_1fr_auto] items-stretch gap-3">
                  <Button
                    variant="secondary"
                    disabled={!current || activeIndex === 0 || isSavingCurrent}
                    onClick={goPrevious}
                    className="min-h-44"
                  >
                    上一份
                  </Button>
                  <div className="rounded-lg border border-zinc-200 bg-white p-4">
                    {current ? (
                      <div className="min-h-44 max-h-[28rem] overflow-auto whitespace-pre-wrap break-words rounded-md bg-zinc-50 px-4 py-4 text-base leading-7 text-zinc-900">
                        {formatAnswerValue(current.answer?.answer)}
                      </div>
                    ) : (
                      <div className="flex min-h-44 items-center justify-center text-sm text-zinc-500">暂无作答</div>
                    )}
                  </div>
                  <Button
                    variant="secondary"
                    disabled={!current || isSavingCurrent}
                    onClick={() => void goNext()}
                    className="min-h-44"
                  >
                    下一份
                  </Button>
                </div>

                <div className="grid gap-3 rounded-lg border border-zinc-200 p-4">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">打分</label>
                    <Input
                      type="number"
                      min={0}
                      max={eq.score}
                      value={currentDraft.manualScore}
                      disabled={!current || isSavingCurrent}
                      onChange={(event) => updateDraft({ manualScore: event.target.value })}
                      placeholder={`0-${eq.score}`}
                      className="max-w-48"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-zinc-600">评语</label>
                    <Textarea
                      value={currentDraft.teacherComment}
                      disabled={!current || isSavingCurrent}
                      onChange={(event) => updateDraft({ teacherComment: event.target.value })}
                      placeholder="可选"
                      className="min-h-20"
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-blue-100 bg-blue-50 p-4">
                  <div className="mb-2 text-xs font-semibold text-blue-800">参考答案</div>
                  <div className="whitespace-pre-wrap break-words text-sm text-blue-950">
                    {formatAnswerValue(q.answerKey)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
