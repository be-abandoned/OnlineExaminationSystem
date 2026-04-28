import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Tag from "@/components/ui/Tag";
import Modal from "@/components/ui/Modal";
import { EXAM_STATUS_LABELS, EXAM_STATUS_TONES } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";
import { teacherDeleteExamRemote, teacherUpsertExamRemote } from "@/utils/remoteApi";
import { useTeacherExamsQuery } from "@/hooks/domain/useTeacherExamsQuery";
import { usePrefetchTeacherExamDetail } from "@/hooks/domain/useTeacherExamDetailQuery";
import { invalidateByPrefix } from "@/lib/query/invalidate";
import TableSkeleton from "@/components/feedback/TableSkeleton";

const EMPTY_EXAMS: { id: string; title: string; status: string; durationMinutes: number; updatedAt: string }[] = [];
const EMPTY_COUNTS = new Map<string, number>();

export default function TeacherExams() {
  const me = useAuthStore((s) => s.getMe());
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createTitle, setCreateTitle] = useState("新建试卷");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const prefetchTeacherExamDetail = usePrefetchTeacherExamDetail();
  const { data, isLoading, isRefreshing, error } = useTeacherExamsQuery(me?.id);
  const exams = data?.exams ?? EMPTY_EXAMS;
  const counts = data?.assignmentCounts ?? EMPTY_COUNTS;

  const items = useMemo(() => {
    const all = exams;
    const s = q.trim();
    if (!s) return all;
    return all.filter((e) => e.title.includes(s) || EXAM_STATUS_LABELS[e.status as keyof typeof EXAM_STATUS_LABELS]?.includes(s));
  }, [exams, q]);

  const createExam = async () => {
    if (!me || creating) return;
    const title = createTitle.trim();
    if (!title) {
      setCreateError("请输入试卷标题");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const exam = await teacherUpsertExamRemote(me.id, { title, durationMinutes: 30 });
      invalidateByPrefix("teacher", me.id, ["exams", "dashboard"]);
      setCreateOpen(false);
      setCreateTitle("新建试卷");
      navigate(`/teacher/exams/${exam.id}/edit`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "新建试卷失败");
    } finally {
      setCreating(false);
    }
  };

  if (!me) return null;

  if (isLoading && !data) {
    return <TableSkeleton title="试卷列表" />;
  }

  if (error && !data) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-red-600">{error.message || "加载试卷失败"}</CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle>试卷列表</CardTitle>
            {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-56">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="搜索标题/状态" />
            </div>
            <Button
              onClick={() => {
                setCreateTitle("新建试卷");
                setCreateError(null);
                setCreateOpen(true);
              }}
            >
              新建试卷
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-auto">
          <table className="min-w-full border-collapse text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr>
                <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">标题</th>
                <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">状态</th>
                <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">时长</th>
                <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">分配人数</th>
                <th className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold text-zinc-700">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.id} className="odd:bg-zinc-50">
                  <td className="border-b border-zinc-100 px-3 py-2">
                    <div className="font-medium text-zinc-900">{e.title}</div>
                    <div className="text-xs text-zinc-500">更新于 {new Date(e.updatedAt).toLocaleString()}</div>
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2">
                    <Tag tone={EXAM_STATUS_TONES[e.status as keyof typeof EXAM_STATUS_TONES] ?? "zinc"}>{EXAM_STATUS_LABELS[e.status as keyof typeof EXAM_STATUS_LABELS] ?? e.status}</Tag>
                  </td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700">{e.durationMinutes} 分钟</td>
                  <td className="border-b border-zinc-100 px-3 py-2 text-zinc-700">{counts.get(e.id) ?? 0}</td>
                  <td className="border-b border-zinc-100 px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/teacher/exams/${e.id}/edit`}
                        onMouseEnter={() => prefetchTeacherExamDetail(me?.id, e.id)}
                        onFocus={() => prefetchTeacherExamDetail(me?.id, e.id)}
                        onClick={() => prefetchTeacherExamDetail(me?.id, e.id)}
                      >
                        <Button variant="secondary">编辑</Button>
                      </Link>
                      <Link to={`/teacher/exams/${e.id}/grading`}>
                        <Button variant="secondary">阅卷</Button>
                      </Link>
                      <Button
                        variant="danger"
                        onClick={async () => {
                          const ok = window.confirm(`确认删除试卷「${e.title}」？`);
                          if (!ok) return;
                          await teacherDeleteExamRemote(me.id, e.id);
                          invalidateByPrefix("teacher", me.id, ["exams", "dashboard", "exam-detail"]);
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-10 text-center text-sm text-zinc-500">
                    暂无试卷
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </CardContent>
      <Modal
        isOpen={createOpen}
        onClose={() => {
          if (!creating) setCreateOpen(false);
        }}
        title="新建试卷"
        width="max-w-md"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" disabled={creating} onClick={() => setCreateOpen(false)}>
              取消
            </Button>
            <Button disabled={creating} onClick={createExam}>
              {creating ? "创建中..." : "创建"}
            </Button>
          </div>
        }
      >
        <div className="grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">试卷标题</label>
            <Input
              value={createTitle}
              onChange={(e) => setCreateTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") createExam();
              }}
              placeholder="请输入试卷标题"
            />
          </div>
          {createError ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</div> : null}
        </div>
      </Modal>
    </Card>
  );
}
