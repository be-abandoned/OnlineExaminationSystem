import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import StemViewer from "@/components/questions/StemViewer";
import AnswerEditor from "@/components/questions/AnswerEditor";
import { useAuthStore } from "@/stores/authStore";
import { type AttemptAnswer, QUESTION_TYPE_LABELS } from "@/types/domain";
import { useStudentResultDetailQuery } from "@/hooks/domain/useStudentResultDetailQuery";
import TableSkeleton from "@/components/feedback/TableSkeleton";

export default function StudentResultDetail() {
  const me = useAuthStore((s) => s.getMe());
  const { attemptId } = useParams();
  const { data, isLoading, isRefreshing } = useStudentResultDetailQuery(me?.id, attemptId);

  if (!me || !attemptId) return null;
  if (isLoading && !data) {
    return <TableSkeleton title="成绩详情" columns={2} rows={5} />;
  }
  if (!data) {
    return (
      <Card>
        <CardContent className="px-4 py-10 text-center text-sm text-zinc-500">记录不存在或无权限</CardContent>
      </Card>
    );
  }

  const { attempt, exam, questions, answers } = data;
  const typedAnswers = answers as AttemptAnswer[];
  const byQ = new Map<string, AttemptAnswer>(typedAnswers.map((a) => [a.questionId, a]));

  // 统计每种题型的正误情况
  const stats = useMemo(() => {
    const s = {
      correct: 0,
      partial: 0,
      wrong: 0,
      manual: 0,
    };
    
    if (!attempt.scorePublished) return null;

    questions.forEach(({ eq, q }) => {
      const aa = byQ.get(q.id);
      const score = (aa?.autoScore ?? 0) + (aa?.manualScore ?? 0);
      const total = eq.score;
      
      if (q.type === "short") {
        s.manual++;
      } else if (score === total && score > 0) {
        s.correct++;
      } else if (score > 0) {
        s.partial++;
      } else {
        s.wrong++;
      }
    });
    return s;
  }, [attempt.scorePublished, questions, byQ]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>{exam.title}</CardTitle>
              {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
            </div>
            <div className="flex items-center gap-2">
              <Tag tone={attempt.scorePublished ? "green" : "zinc"}>{attempt.scorePublished ? "已出分" : "待出分"}</Tag>
              <Link to="/student/results">
                <Button variant="secondary">返回</Button>
              </Link>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">提交时间</div>
              <div className="mt-1 text-sm font-medium text-zinc-900">
                {attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString() : "-"}
              </div>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <div className="text-xs text-zinc-500">总分</div>
              <div className="mt-1 text-sm font-semibold text-zinc-900">
                {attempt.scorePublished ? <span className="text-xl text-blue-600">{attempt.totalScore}</span> : "待出分"}
              </div>
            </div>
            {stats && (
              <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 col-span-2">
                <div className="text-xs text-zinc-500 mb-1">答题统计</div>
                <div className="flex gap-3 text-sm">
                  <span className="text-green-600 font-medium">正确 {stats.correct}</span>
                  {stats.partial > 0 && <span className="text-amber-600 font-medium">半对 {stats.partial}</span>}
                  <span className="text-red-600 font-medium">错误 {stats.wrong}</span>
                  {stats.manual > 0 && <span className="text-blue-600 font-medium">主观题 {stats.manual}</span>}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>答题明细</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            {questions.map(({ eq, q }, idx) => {
              const aa = byQ.get(q.id);
              const score = (aa?.autoScore ?? 0) + (aa?.manualScore ?? 0);
              const scoreText = attempt.scorePublished
                ? `${score} / ${eq.score}`
                : `- / ${eq.score}`;
              
              const isFullScore = attempt.scorePublished && score === eq.score;
              const isZeroScore = attempt.scorePublished && score === 0;

              return (
                <div key={q.id} className={`rounded-xl border p-4 ${
                  attempt.scorePublished 
                    ? isFullScore 
                      ? "border-green-200 bg-green-50/30" 
                      : isZeroScore 
                        ? "border-red-200 bg-red-50/30" 
                        : "border-amber-200 bg-amber-50/30"
                    : "border-zinc-200"
                }`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-semibold text-zinc-900">
                      第 {idx + 1} 题 <span className="ml-2 text-xs font-medium text-zinc-500">({QUESTION_TYPE_LABELS[q.type]})</span>
                    </div>
                    <Tag tone={attempt.scorePublished ? (isFullScore ? "green" : isZeroScore ? "red" : "amber") : "blue"}>
                      {scoreText}
                    </Tag>
                  </div>
                  <div className="mt-3">
                    <StemViewer blocks={q.stem} />
                  </div>
                  <div className="mt-4">
                    <div className="mb-2 text-xs font-medium text-zinc-700">我的作答</div>
                    <AnswerEditor
                      question={{ ...q, defaultScore: eq.score }}
                      value={aa?.answer}
                      isSubmitted={true}
                      correctAnswer={attempt.scorePublished ? q.answerKey : undefined}
                      isDisabled={true}
                    />
                    
                    {attempt.scorePublished && (
                      <div className="mt-4 space-y-3">
                        {/* 题目解析 */}
                        <div className="rounded-md bg-blue-50 p-3">
                          <div className="text-xs font-bold text-blue-800 mb-1">题目解析</div>
                          <div className="text-sm text-blue-900 whitespace-pre-wrap">
                            {q.analysis || "暂无解析"}
                          </div>
                        </div>

                        {/* 主观题参考答案 */}
                        {q.type === "short" && (
                          <div className="rounded-md bg-zinc-100 p-3">
                            <div className="text-xs font-bold text-zinc-700 mb-1">参考答案</div>
                            <div className="text-sm text-zinc-800 whitespace-pre-wrap">
                              {String(q.answerKey || "无")}
                            </div>
                          </div>
                        )}

                        {/* 教师评语 */}
                        {aa?.teacherComment && (
                          <div className="rounded-md bg-amber-50 p-3 border border-amber-100">
                            <div className="text-xs font-bold text-amber-800 mb-1">教师评语</div>
                            <div className="text-sm text-amber-900 whitespace-pre-wrap">
                              {aa.teacherComment}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
