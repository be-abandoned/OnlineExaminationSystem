import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { EXAM_STATUS_LABELS, EXAM_STATUS_TONES } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";
import { useTeacherDashboardQuery } from "@/hooks/domain/useTeacherDashboardQuery";
import TableSkeleton from "@/components/feedback/TableSkeleton";

const EMPTY_EXAMS: { id: string; title: string; status: string; updatedAt: string }[] = [];

export default function TeacherDashboard() {
  const me = useAuthStore((s) => s.getMe());
  const { data, isLoading, isRefreshing, error } = useTeacherDashboardQuery(me?.id);
  const exams = data?.exams ?? EMPTY_EXAMS;
  const pendingGrading = data?.pendingGrading || 0;
  const recentExams = useMemo(() => exams.slice(0, 6), [exams]);

  if (!me) return null;
  if (isLoading && !data) {
    return <TableSkeleton title="教师工作台" columns={3} rows={4} />;
  }
  if (error && !data) {
    return <Card className="px-4 py-10 text-center text-sm text-red-600">加载教师工作台失败</Card>;
  }
  const notStarted = exams.filter((e) => e.status === "not_started").length;
  const inProgress = exams.filter((e) => e.status === "in_progress").length;
  const drafts = exams.filter((e) => e.status === "draft").length;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle>草稿</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-zinc-900">{drafts}</div>
            <div className="mt-1 text-xs text-zinc-500">编辑中未发布</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>未开始</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-zinc-900">{notStarted}</div>
            <div className="mt-1 text-xs text-zinc-500">发布后待开考</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>考试中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-zinc-900">{inProgress}</div>
            <div className="mt-1 text-xs text-zinc-500">当前可作答</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>待阅卷</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-zinc-900">{pendingGrading}</div>
            <div className="mt-1 text-xs text-zinc-500">已交卷待评分</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>我的试卷</CardTitle>
              {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
            </div>
            <Link to="/teacher/exams">
              <Button>进入试卷管理</Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {recentExams.map((e) => (
              <div key={e.id} className="flex items-center justify-between rounded-lg border border-zinc-200 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-zinc-900">{e.title}</div>
                  <div className="text-xs text-zinc-500">更新于 {new Date(e.updatedAt).toLocaleString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Tag tone={EXAM_STATUS_TONES[e.status as keyof typeof EXAM_STATUS_TONES] ?? "zinc"}>{EXAM_STATUS_LABELS[e.status as keyof typeof EXAM_STATUS_LABELS] ?? e.status}</Tag>
                  <Link to={`/teacher/exams/${e.id}/edit`}>
                    <Button variant="secondary">编辑</Button>
                  </Link>
                  <Link to={`/teacher/exams/${e.id}/grading`}>
                    <Button variant="secondary">阅卷</Button>
                  </Link>
                </div>
              </div>
            ))}
            {exams.length === 0 ? <div className="px-3 py-10 text-center text-sm text-zinc-500">暂无试卷</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
