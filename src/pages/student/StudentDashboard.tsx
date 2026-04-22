import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/stores/authStore";
import { Attempt } from "@/types/domain";
import Modal from "@/components/ui/Modal";
import ExamTimeStatusDisplay from "@/components/exam/ExamTimeStatus";
import { formatTime, formatDuration } from "@/utils/examTime";
import { studentStartOrResumeAttemptRemote } from "@/utils/remoteApi";
import { useStudentDashboardQuery } from "@/hooks/domain/useStudentDashboardQuery";
import { usePrefetchStudentExamDetail } from "@/hooks/domain/useStudentExamDetailQuery";
import TableSkeleton from "@/components/feedback/TableSkeleton";

const getExamStatusDisplay = (e: any, attempts: Attempt[]) => {
  const attempt = attempts.find((a) => a.examId === e.id);
  if (attempt) {
    switch (attempt.status) {
      case "submitted": return { label: "已交卷", tone: "zinc" as const };
      case "graded": return { label: "已阅卷", tone: "green" as const };
      case "in_progress": return { label: "作答中", tone: "blue" as const };
    }
  }
  return null; // Return null to fallback to time status
};

export default function StudentDashboard() {
  const me = useAuthStore((s) => s.getMe());
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [isWarningOpen, setIsWarningOpen] = useState(false);
  const { data, isLoading, isRefreshing, error } = useStudentDashboardQuery(me?.id);
  const prefetchStudentExamDetail = usePrefetchStudentExamDetail();
  const exams = data?.exams || [];
  const attempts = data?.attempts || [];

  const handleDetailClick = (e: any) => {
    const attempt = attempts.find(a => a.examId === e.id);
    if (attempt && (attempt.status === "submitted" || attempt.status === "graded")) {
      // Check if exam is ended
      const now = Date.now();
      const end = e.endAt ? Date.parse(e.endAt) : undefined;
      if (end && now <= end) {
        setIsWarningOpen(true);
        return;
      }
      navigate(`/student/results/${attempt.id}`);
    } else {
      navigate(`/student/exams/${e.id}`);
    }
  };

  const filtered = useMemo(() => {
    const s = q.trim();
    if (!s) return exams;
    return exams.filter((e) => e.title.includes(s));
  }, [exams, q]);

  if (!me) return null;

  if (isLoading && !data) {
    return <TableSkeleton title="我的考试" columns={6} />;
  }

  if (error && !data) {
    return <Card className="px-4 py-10 text-center text-sm text-red-600">加载学生工作台失败</Card>;
  }

  const pending = filtered.filter((e) => {
    const status = getExamStatusDisplay(e, attempts);
    if (status) return status.label !== "已交卷" && status.label !== "已阅卷";
    // For time-based status, we consider "ended" as not pending
    // But since calculateExamTimeStatus is dynamic, we approximate here
    // Or better: rely on the fact that if it's ended, it will show up in "Ended" list if we filter correctly
    // Actually, the requirement says "Ended" list contains ended exams.
    // Let's check endAt
    const now = Date.now(); // This might cause hydration mismatch if not careful, but for logic it's fine
    const end = e.endAt ? Date.parse(e.endAt) : undefined;
    if (end && now > end) return false;
    return true;
  }).length;
  const ended = filtered.length - pending;

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>待考/进行中</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-zinc-900">{pending}</div>
            <div className="mt-1 text-xs text-zinc-500">已分配且尚未结束</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>已结束</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold text-zinc-900">{ended}</div>
            <div className="mt-1 text-xs text-zinc-500">仍可查看详情</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>快速搜索</CardTitle>
          </CardHeader>
          <CardContent>
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="输入考试名称" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CardTitle>我的考试</CardTitle>
              {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-auto">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr>
                  <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">考试</th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">开始时间</th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">总时长</th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">结束时间</th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">当前时间状态</th>
                  <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e) => {
                  const tag = getExamStatusDisplay(e, attempts);
                  return (
                    <tr key={e.id} className="odd:bg-zinc-50">
                      <td className="border-b border-zinc-100 px-3 py-2">
                        <div className="font-medium text-zinc-900">{e.title}</div>
                        {e.description ? <div className="text-xs text-zinc-500">{e.description}</div> : null}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 text-xs">
                        {e.startAt ? formatTime(e.startAt) : "-"}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 text-xs">
                        {formatDuration(e.durationMinutes)}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700 text-xs">
                        {e.endAt ? formatTime(e.endAt) : "-"}
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2">
                        <div className="flex flex-col items-start gap-1">
                          <ExamTimeStatusDisplay exam={e} showDetail={false} />
                          {tag && (
                            <div className="text-xs text-zinc-500 font-medium">[{tag.label}]</div>
                          )}
                        </div>
                      </td>
                      <td className="border-b border-zinc-100 px-3 py-2">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="secondary"
                            onMouseEnter={() => prefetchStudentExamDetail(me.id, e.id)}
                            onClick={() => handleDetailClick(e)}
                          >
                            详情
                          </Button>
                          {(!tag || (!tag.label.includes("已交卷") && !tag.label.includes("已阅卷"))) && (
                            // Only show Start button if not ended
                            (e.endAt && Date.now() > Date.parse(e.endAt)) ? null : (
                              <Button
                                onClick={async () => {
                                  const a = await studentStartOrResumeAttemptRemote(me.id, e.id);
                                  navigate(`/student/attempts/${a.id}`);
                                }}
                              >
                                开始/继续
                              </Button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-10 text-center text-sm text-zinc-500">
                      暂无考试
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={isWarningOpen}
        onClose={() => setIsWarningOpen(false)}
        title="提示"
      >
        <div className="space-y-4">
          <p className="text-zinc-600">考试时间未结束，请耐心等候考试结果</p>
          <div className="flex justify-end">
            <Button onClick={() => setIsWarningOpen(false)}>确定</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
