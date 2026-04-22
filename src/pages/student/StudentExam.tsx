import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { useAuthStore } from "@/stores/authStore";
import { studentStartOrResumeAttemptRemote } from "@/utils/remoteApi";

import ExamTimeStatusDisplay from "@/components/exam/ExamTimeStatus";

import { QUESTION_TYPE_LABELS } from "@/types/domain";
import { useStudentExamDetailQuery } from "@/hooks/domain/useStudentExamDetailQuery";
import TableSkeleton from "@/components/feedback/TableSkeleton";

export default function StudentExam() {
  const me = useAuthStore((s) => s.getMe());
  const { examId } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isRefreshing } = useStudentExamDetailQuery(me?.id, examId);

  if (!me || !examId) return null;

  if (isLoading && !data) {
    return <TableSkeleton title="考试详情" columns={2} rows={4} />;
  }

  if (!data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>考试不可用</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-zinc-600">你可能没有权限，或考试已被撤回。</div>
          <div className="mt-4">
            <Link to="/student">
              <Button variant="secondary">返回工作台</Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { exam, questions } = data;
  const totalScore = useMemo(() => questions.reduce((sum, x) => sum + (x.eq.score || 0), 0), [questions]);

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>{exam.title}</CardTitle>
              {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
            </div>
            <ExamTimeStatusDisplay exam={exam} showDetail={false} />
          </div>
        </CardHeader>
        <CardContent>
          {exam.description ? <div className="text-sm text-zinc-600 mb-4">{exam.description}</div> : null}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-medium text-zinc-900 mb-2">考试时间</div>
              <ExamTimeStatusDisplay exam={exam} showDetail={true} />
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
              <div className="text-sm font-medium text-zinc-900 mb-2">考试规则</div>
              <div className="text-xs text-zinc-500 space-y-1">
                <div>• 总分：{totalScore} 分</div>
                <div>• 题目：{questions.length} 题</div>
                <div>• 限时：{exam.durationMinutes} 分钟</div>
                <div>• 次数：限 {exam.attemptLimit} 次</div>
              </div>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-2">
            {(!exam.endAt || Date.now() < Date.parse(exam.endAt)) && (
              <Button
                onClick={async () => {
                  const a = await studentStartOrResumeAttemptRemote(me.id, exam.id);
                  navigate(`/student/attempts/${a.id}`);
                }}
              >
                开始/继续作答
              </Button>
            )}
            <Link to="/student">
              <Button variant="secondary">返回</Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>题目预览</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {questions.map(({ eq, q }, idx) => (
              <div key={q.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500 w-6">#{idx + 1}</span>
                  <Tag tone="blue" className="text-xs px-1.5 py-0.5">{QUESTION_TYPE_LABELS[q.type]}</Tag>
                </div>
                <div className="text-xs font-medium text-zinc-600">{eq.score} 分</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
