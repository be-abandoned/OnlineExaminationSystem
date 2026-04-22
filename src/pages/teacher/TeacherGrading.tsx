import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Tag from "@/components/ui/Tag";
import StemViewer from "@/components/questions/StemViewer";
import { useAuthStore } from "@/stores/authStore";
import {
  teacherSaveManualScoresRemote,
  teacherSetScorePublishedRemote,
} from "@/utils/remoteApi";
import {
  updateTeacherGradingDetailCache,
  updateTeacherGradingListAttempt,
  updateTeacherGradingPublishedCache,
  useTeacherGradingDetailQuery,
  useTeacherGradingListQuery,
} from "@/hooks/domain/useTeacherGradingQuery";
import { invalidateByPrefix } from "@/lib/query/invalidate";
import TableSkeleton from "@/components/feedback/TableSkeleton";

export default function TeacherGrading() {
  const me = useAuthStore((s) => s.getMe());
  const { examId } = useParams();
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const { data: listData, isLoading, isRefreshing } = useTeacherGradingListQuery(me?.id, examId);
  const { data: detailData, isFetching: isDetailFetching } = useTeacherGradingDetailQuery(me?.id, selectedAttemptId || undefined);
  const exam = listData?.exam || null;
  const attempts = listData?.attempts || [];
  const studentsById = listData?.studentsById || new Map();
  const selectedAttempt = detailData?.attempt || null;
  const detail = detailData
    ? { questions: detailData.questions, byQ: detailData.byQ, student: detailData.student }
    : null;

  const [manualPatch, setManualPatch] = useState<Record<string, { manualScore: number; teacherComment: string }>>({});
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());

  const handleSaveScore = async (questionId: string, manualScore: number, teacherComment: string) => {
    if (!selectedAttempt) return;
    try {
      const patch = [{
        questionId,
        manualScore,
        teacherComment
      }];
      updateTeacherGradingDetailCache(me?.id || "", selectedAttempt.id, questionId, manualScore, teacherComment);
      await teacherSaveManualScoresRemote(me?.id || "", selectedAttempt.id, patch);
      updateTeacherGradingListAttempt(me?.id || "", examId || "", selectedAttempt.id, (attempt) => ({
        ...attempt,
        status: "graded",
        totalScore: detailData?.questions.reduce((sum, item) => {
          if (item.q.id === questionId) {
            const answer = detailData?.byQ.get(item.q.id);
            return sum + Number(answer?.autoScore || 0) + manualScore;
          }
          const answer = detailData?.byQ.get(item.q.id);
          return sum + Number(answer?.autoScore || 0) + Number(answer?.manualScore || 0);
        }, 0) || attempt.totalScore,
      }));
      
      setSuccessIds(prev => {
        const next = new Set(prev);
        next.add(questionId);
        return next;
      });
    } catch (e) {
      console.error(e);
      alert("保存失败");
    }
  };

  if (!me || !examId) return null;

  if (isLoading && !listData) {
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
      <div className="grid grid-cols-12 gap-4">
        <div className="col-span-12 md:col-span-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle>答卷列表</CardTitle>
                  {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
                </div>
                <Link to={`/teacher/exams/${examId}/edit`}>
                  <Button variant="secondary">回到编辑</Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2">
                {attempts.map((a) => {
                  const student = studentsById.get(a.studentId);
                  const active = selectedAttemptId === a.id;
                  return (
                    <button
                      key={a.id}
                      className={
                        active
                          ? "rounded-xl border border-blue-300 bg-blue-50 px-3 py-2 text-left"
                          : "rounded-xl border border-zinc-200 bg-white px-3 py-2 text-left hover:bg-zinc-50"
                      }
                      onClick={() => {
                        setSelectedAttemptId(a.id);
                        setManualPatch({});
                        setSuccessIds(new Set());
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-sm font-medium text-zinc-900">{student?.displayName ?? "学生"}</div>
                        <Tag tone={a.status === "graded" ? "green" : a.status === "submitted" ? "amber" : "zinc"}>{a.status}</Tag>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                        <span>{a.submittedAt ? new Date(a.submittedAt).toLocaleString() : "未交卷"}</span>
                        <span>{a.scorePublished ? `已发布：${a.totalScore}` : "未发布"}</span>
                      </div>
                    </button>
                  );
                })}
                {attempts.length === 0 ? <div className="px-3 py-10 text-center text-sm text-zinc-500">暂无答卷</div> : null}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="col-span-12 md:col-span-7">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>阅卷面板</CardTitle>
                {selectedAttempt ? (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="secondary"
                      onClick={async () => {
                        const patch = Object.entries(manualPatch).map(([questionId, v]) => ({
                          questionId,
                          manualScore: v.manualScore,
                          teacherComment: v.teacherComment || undefined,
                        }));
                        patch.forEach((item) => {
                          updateTeacherGradingDetailCache(me.id, selectedAttempt.id, item.questionId, item.manualScore, item.teacherComment || "");
                        });
                        await teacherSaveManualScoresRemote(me.id, selectedAttempt.id, patch);
                        invalidateByPrefix("teacher", me.id, ["grading-list", "grading-detail"]);
                      }}
                    >
                      保存评分
                    </Button>
                    <Button
                      onClick={async () => {
                        const next = !selectedAttempt.scorePublished;
                        updateTeacherGradingPublishedCache(me.id, selectedAttempt.id, next);
                        updateTeacherGradingListAttempt(me.id, examId, selectedAttempt.id, (attempt) => ({
                          ...attempt,
                          scorePublished: next,
                        }));
                        await teacherSetScorePublishedRemote(me.id, selectedAttempt.id, next);
                        invalidateByPrefix("teacher", me.id, ["grading-list", "grading-detail"]);
                      }}
                    >
                      {selectedAttempt.scorePublished ? "撤回成绩" : "发布成绩"}
                    </Button>
                  </div>
                ) : null}
              </div>
            </CardHeader>
            <CardContent>
              {!selectedAttempt || !detail ? (
                <div className="px-3 py-10 text-center text-sm text-zinc-500">
                  {isDetailFetching ? "正在加载答卷详情..." : "选择一份答卷开始阅卷"}
                </div>
              ) : (
                <div className="grid gap-4">
                  <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                    <div className="text-sm font-medium text-zinc-900">{detail.student?.displayName ?? "学生"}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      提交：{selectedAttempt.submittedAt ? new Date(selectedAttempt.submittedAt).toLocaleString() : "-"}
                      <span className="mx-2">·</span>
                      状态：{selectedAttempt.status}
                      <span className="mx-2">·</span>
                      总分：{selectedAttempt.totalScore}
                    </div>
                  </div>

                  {detail.questions.map(({ eq, q }, idx) => {
                    const aa = detail.byQ.get(q.id);
                    const current = manualPatch[q.id] ?? { manualScore: aa?.manualScore ?? 0, teacherComment: aa?.teacherComment ?? "" };
                    const isShort = q.type === "short";
                    return (
                      <div key={q.id} className="rounded-xl border border-zinc-200 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-zinc-900">
                            第 {idx + 1} 题 <span className="ml-2 text-xs font-medium text-zinc-500">({q.type})</span>
                          </div>
                          <Tag tone="blue">{eq.score} 分</Tag>
                        </div>
                        <div className="mt-3">
                          <StemViewer blocks={q.stem} />
                        </div>
                        <div className="mt-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3">
                          <div className="text-xs font-medium text-zinc-700">学生作答</div>
                          <div className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-800">
                            {aa?.answer !== undefined && aa?.answer !== null && `${aa.answer}` !== ""
                              ? typeof aa.answer === "string"
                                ? aa.answer
                                : JSON.stringify(aa.answer)
                              : "未作答"}
                          </div>
                          <div className={`mt-3 grid grid-cols-1 gap-3 sm:grid-cols-${isShort ? 1 : 2}`}>
                            {!isShort && (
                              <div className="rounded-lg border border-zinc-200 bg-white p-3">
                                <div className="text-xs font-medium text-zinc-700">自动得分</div>
                                <div className="mt-1 text-sm font-semibold text-zinc-900">{aa?.autoScore ?? 0}</div>
                              </div>
                            )}
                            <div className={`rounded-lg border border-zinc-200 p-3 transition-colors duration-500 ${
                              successIds.has(q.id) ? "bg-green-50 border-green-200" : "bg-white"
                            }`}>
                              <div className="text-xs font-medium text-zinc-700">人工得分</div>
                              {isShort ? (
                                <div className="flex gap-2 items-center">
                                  <Input
                                    type="number"
                                    value={String(current.manualScore)}
                                    onChange={(e) => {
                                      const v = Number(e.target.value || 0);
                                      setManualPatch((p) => ({
                                        ...p,
                                        [q.id]: { ...current, manualScore: Math.max(0, Math.floor(v)) },
                                      }));
                                    }}
                                    className="mt-2 w-20"
                                  />
                                  <Button 
                                    size="sm" 
                                    className="mt-2 h-9"
                                    onClick={() => handleSaveScore(q.id, current.manualScore, current.teacherComment)}
                                  >
                                    确定
                                  </Button>
                                </div>
                              ) : (
                                <div className="mt-1 text-sm font-semibold text-zinc-900">{aa?.manualScore ?? 0}</div>
                              )}
                            </div>
                          </div>
                          {isShort ? (
                            <div className="mt-3 space-y-3">
                              <div className="rounded-md bg-blue-50 p-3 text-xs text-blue-800">
                                <span className="font-bold">参考答案：</span>
                                {String(q.answerKey || "无")}
                              </div>
                              <div>
                                <div className="text-xs font-medium text-zinc-700">评语</div>
                                <Input
                                  value={current.teacherComment}
                                  onChange={(e) =>
                                    setManualPatch((p) => ({
                                      ...p,
                                      [q.id]: { ...current, teacherComment: e.target.value },
                                    }))
                                  }
                                  className="mt-2"
                                  placeholder="可选"
                                />
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
