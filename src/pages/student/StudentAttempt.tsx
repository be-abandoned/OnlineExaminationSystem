import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import Modal from "@/components/ui/Modal";
import StemViewer from "@/components/questions/StemViewer";
import AnswerEditor from "@/components/questions/AnswerEditor";
import { useAuthStore } from "@/stores/authStore";
import { QUESTION_TYPE_LABELS } from "@/types/domain";
import {
  studentSaveAnswerRemote,
  studentSubmitAttemptRemote,
} from "@/utils/remoteApi";
import { useStudentAttemptDetailQuery, updateStudentAttemptAnswerCache } from "@/hooks/domain/useStudentAttemptDetailQuery";
import { queryClient } from "@/lib/query/queryClient";
import TableSkeleton from "@/components/feedback/TableSkeleton";

function msToClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}


export default function StudentAttempt() {
  const me = useAuthStore((s) => s.getMe());
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [saving, setSaving] = useState<"idle" | "saving">("idle");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [submitStage, setSubmitStage] = useState<"confirm" | "submitting" | "done">("confirm");
  const [submitProgress, setSubmitProgress] = useState(0);
  const { data, isLoading, isRefreshing } = useStudentAttemptDetailQuery(me?.id, attemptId);

  const [remainingMs, setRemainingMs] = useState<number | null>(null);

  useEffect(() => {
    if (!data) return;
    const startedAt = Date.parse(data.attempt.startedAt);
    const durationMs = data.exam.durationMinutes * 60_000;
    const tick = async () => {
      const elapsed = Date.now() - startedAt;
      const remain = durationMs - elapsed;
      setRemainingMs(remain);
      if (remain <= 0 && data.attempt.status === "in_progress") {
        try {
          await studentSubmitAttemptRemote(me!.id, data.attempt.id);
          navigate(`/student/results/${data.attempt.id}`, { replace: true });
        } catch {
          setError("自动交卷失败，请手动交卷");
        }
      }
    };
    void tick();
    const t = window.setInterval(() => {
      void tick();
    }, 1000);
    return () => window.clearInterval(t);
  }, [data, navigate, me]);

  const byQ = useMemo(
    () => new Map((data?.answers ?? []).map((a) => [a.questionId, a] as const)),
    [data?.answers],
  );

  useEffect(() => {
    if (submitStage !== "submitting") return;
    setSubmitProgress(8);
    const timer = window.setInterval(() => {
      setSubmitProgress((progress) => Math.min(progress + 8, 92));
    }, 120);
    return () => window.clearInterval(timer);
  }, [submitStage]);

  useEffect(() => {
    if (submitStage !== "done") return;
    setSubmitProgress(100);
    const timer = window.setTimeout(() => {
      navigate("/student", { replace: true });
    }, 600);
    return () => window.clearTimeout(timer);
  }, [submitStage, navigate]);

  if (!me || !attemptId) return null;
  if (isLoading && !data) {
    return <TableSkeleton title="作答页面" columns={2} rows={5} />;
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="px-4 py-10 text-center text-sm text-zinc-500">答卷不存在或无权限</CardContent>
      </Card>
    );
  }

  const { attempt, exam, questions } = data;
  const activeItem = questions[active] ?? questions[0];

  const getStatusLabel = (s: string) => {
    switch (s) {
      case "in_progress": return "作答中";
      case "submitted": return "已提交";
      case "graded": return "已阅卷";
      default: return s;
    }
  };

  const openSubmitModal = () => {
    setError(null);
    setSubmitStage("confirm");
    setSubmitProgress(0);
    setIsSubmitModalOpen(true);
  };

  const confirmSubmit = async () => {
    if (submitStage !== "confirm") return;
    setError(null);
    setSubmitStage("submitting");
    setSubmitProgress(8);
    try {
      await studentSubmitAttemptRemote(me.id, attempt.id);
      setSubmitStage("done");
    } catch (e) {
      setSubmitStage("confirm");
      setSubmitProgress(0);
      setError(e instanceof Error ? e.message : "交卷失败");
    }
  };

  if (!activeItem) return null;

  return (
    <div className="grid gap-4">
      <div className="sticky top-[60px] z-10 rounded-xl border border-zinc-200 bg-white/90 px-4 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-zinc-900">{exam.title}</div>
            <div className="mt-1 flex items-center gap-2 text-xs text-zinc-600">
              <Tag tone={attempt.status === "in_progress" ? "green" : "zinc"}>
                {getStatusLabel(attempt.status)}
              </Tag>
              <span>保存状态：{saving === "saving" ? "保存中" : "已保存"}</span>
              {isRefreshing ? <span>后台刷新中</span> : null}
              {remainingMs !== null ? (
                <span className={remainingMs <= 60_000 ? "font-mono text-red-600" : "font-mono"}>
                  剩余 {msToClock(remainingMs)}
                </span>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => navigate("/student")}>
              返回
            </Button>
            <Button
              variant="danger"
              disabled={attempt.status !== "in_progress"}
              onClick={openSubmitModal}
            >
              交卷
            </Button>
          </div>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-3">
          <Card>
            <CardContent className="px-3 py-3">
              <div className="grid grid-cols-6 gap-2 md:grid-cols-4">
                {questions.map(({ q }, idx) => {
                  const ans = byQ.get(q.id);
                  const done = ans && ans.answer !== undefined && ans.answer !== null && `${ans.answer}` !== "";
                  return (
                    <button
                      key={q.id}
                      onClick={() => setActive(idx)}
                      className={
                        idx === active
                          ? "h-9 rounded-md border border-blue-300 bg-blue-50 text-sm font-semibold text-blue-700"
                          : done
                            ? "h-9 rounded-md border border-green-200 bg-green-50 text-sm text-green-700 hover:bg-green-100"
                            : "h-9 rounded-md border border-zinc-200 bg-white text-sm text-zinc-700 hover:bg-zinc-50"
                      }
                    >
                      {idx + 1}
                    </button>
                  );
                })}
              </div>
              <div className="mt-3 text-xs text-zinc-500">绿色表示已作答</div>
            </CardContent>
          </Card>
        </div>
        <div className="col-span-12 md:col-span-9">
          <Card>
            <CardContent className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="text-sm font-semibold text-zinc-900">
                  第 {active + 1} 题 <span className="ml-2 text-xs font-medium text-zinc-500">({QUESTION_TYPE_LABELS[activeItem.q.type]})</span>
                </div>
                <Tag tone="blue">{activeItem.eq.score} 分</Tag>
              </div>
              <div className="mt-3">
                <StemViewer blocks={activeItem.q.stem} />
              </div>

              <div className="mt-4">
                <div className="mb-2 text-xs font-medium text-zinc-700">作答</div>
                <AnswerEditor
                  question={{ ...activeItem.q, defaultScore: activeItem.eq.score }}
                  value={byQ.get(activeItem.q.id)?.answer}
                  onChange={async (v) => {
                    if (attempt.status !== "in_progress") return;
                    setSaving("saving");
                    updateStudentAttemptAnswerCache(me.id, attempt.id, activeItem.q.id, v);
                    try {
                      await studentSaveAnswerRemote(me.id, attempt.id, activeItem.q.id, v);
                      queryClient.invalidateQueries((key) => key[0] === "student" && key[1] === me.id && key[2] === "attempt-detail");
                    } finally {
                      window.setTimeout(() => setSaving("idle"), 200);
                    }
                  }}
                />
              </div>

              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="secondary"
                  disabled={active === 0}
                  onClick={() => setActive((x) => Math.max(0, x - 1))}
                >
                  上一题
                </Button>
                <Button
                  variant="secondary"
                  disabled={active === questions.length - 1}
                  onClick={() => setActive((x) => Math.min(questions.length - 1, x + 1))}
                >
                  下一题
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={isSubmitModalOpen}
        onClose={() => {
          if (submitStage === "confirm") setIsSubmitModalOpen(false);
        }}
        title="确认交卷"
        width="max-w-lg"
        footer={
          submitStage === "confirm" ? (
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setIsSubmitModalOpen(false)}>取消</Button>
              <Button variant="danger" onClick={() => void confirmSubmit()}>确认交卷</Button>
            </div>
          ) : null
        }
      >
        <div className="grid gap-4 text-sm text-zinc-700">
          {submitStage === "confirm" ? (
            <>
              <div className="rounded-md bg-red-50 px-3 py-3 text-red-700">确认交卷后将不能修改本次作答。</div>
              <div className="text-zinc-500">请确认所有题目已经完成作答后再提交。</div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-zinc-900">{submitStage === "done" ? "交卷完成，正在返回工作台" : "正在交卷"}</span>
                <span className="font-mono text-blue-700">{submitProgress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className="h-full rounded-full bg-blue-600 transition-all duration-150"
                  style={{ width: `${submitProgress}%` }}
                />
              </div>
              <div className="text-xs text-zinc-500">请勿关闭页面，系统会在交卷完成后自动返回学生工作台。</div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
