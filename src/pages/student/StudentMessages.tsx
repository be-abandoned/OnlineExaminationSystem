import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Tag from "@/components/ui/Tag";
import { useAuthStore } from "@/stores/authStore";
import { useStudentMessagesQuery } from "@/hooks/domain/useStudentMessagesQuery";
import TableSkeleton from "@/components/feedback/TableSkeleton";

export default function StudentMessages() {
  const me = useAuthStore((s) => s.getMe());
  const { data, isLoading, isRefreshing, error } = useStudentMessagesQuery(me?.id);
  const items = useMemo(() => {
    if (!data) return [];
    return data.messages.map((m) => {
      const teacher = data.teachersById.get(m.teacherId);
      return { m, teacherName: teacher?.displayName ?? "教师" };
    });
  }, [data]);

  if (!me) return null;

  if (isLoading && !data) {
    return <TableSkeleton title="消息中心" columns={2} rows={5} />;
  }

  if (error && !data) {
    return <Card className="px-4 py-10 text-center text-sm text-red-600">加载消息中心失败</Card>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>消息中心</CardTitle>
          {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3">
          {items.map((it) => (
            <div key={it.m.id} className="rounded-xl border border-zinc-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-zinc-900">{it.m.title}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    {it.teacherName} · {new Date(it.m.createdAt).toLocaleString()}
                  </div>
                </div>
                <Tag tone="blue">公告</Tag>
              </div>
              <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{it.m.content}</div>
            </div>
          ))}
          {items.length === 0 ? <div className="px-3 py-10 text-center text-sm text-zinc-500">暂无消息</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
