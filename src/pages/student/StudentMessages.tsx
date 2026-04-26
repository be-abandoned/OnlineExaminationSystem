import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import { useAuthStore } from "@/stores/authStore";
import { useStudentMessagesQuery } from "@/hooks/domain/useStudentMessagesQuery";
import TableSkeleton from "@/components/feedback/TableSkeleton";
import { studentMarkMessageReadRemote } from "@/utils/remoteApi";
import { invalidateByPrefix } from "@/lib/query/invalidate";

export default function StudentMessages() {
  const me = useAuthStore((s) => s.getMe());
  const { data, isLoading, isRefreshing, error } = useStudentMessagesQuery(me?.id);
  const [expandedRead, setExpandedRead] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const items = useMemo(() => {
    if (!data) return [];
    return data.messages.map((m) => {
      const teacher = data.teachersById.get(m.teacherId);
      return { m, teacherName: teacher?.displayName ?? "教师" };
    });
  }, [data]);
  const unreadItems = useMemo(() => items.filter((it) => !it.m.readAt), [items]);
  const readItems = useMemo(() => items.filter((it) => it.m.readAt), [items]);

  if (!me) return null;

  const markAsRead = async (messageId: string) => {
    setMarkingId(messageId);
    setActionError(null);
    try {
      await studentMarkMessageReadRemote(me.id, messageId);
      invalidateByPrefix("student", me.id, ["messages"]);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "标记已读失败");
    } finally {
      setMarkingId(null);
    }
  };

  const renderMessage = (it: (typeof items)[number], read: boolean) => (
    <div key={it.m.id} className="rounded-xl border border-zinc-200 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-zinc-900">{it.m.title}</div>
          <div className="mt-1 text-xs text-zinc-500">
            {it.teacherName} · {new Date(it.m.createdAt).toLocaleString()}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Tag tone={read ? "green" : "amber"}>{read ? "已读" : "公告"}</Tag>
          {!read ? (
            <Button type="button" size="sm" variant="danger" disabled={markingId === it.m.id} onClick={() => markAsRead(it.m.id)}>
              {markingId === it.m.id ? "处理中..." : "未读"}
            </Button>
          ) : null}
        </div>
      </div>
      <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{it.m.content}</div>
      {read && it.m.readAt ? <div className="mt-3 text-xs text-zinc-500">已读时间：{new Date(it.m.readAt).toLocaleString()}</div> : null}
    </div>
  );

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
        <div className="grid gap-4">
          {actionError ? <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{actionError}</div> : null}

          <div className="grid gap-3">
            {unreadItems.map((it) => renderMessage(it, false))}
            {unreadItems.length === 0 ? <div className="px-3 py-10 text-center text-sm text-zinc-500">暂无未读公告</div> : null}
          </div>

          {readItems.length > 0 ? (
            <div className="rounded-xl border border-zinc-200">
              <button
                type="button"
                className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-zinc-900 hover:bg-zinc-50"
                onClick={() => setExpandedRead((v) => !v)}
              >
                <span>已读的公告（{readItems.length}）</span>
                {expandedRead ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              {expandedRead ? <div className="grid gap-3 border-t border-zinc-200 p-4">{readItems.map((it) => renderMessage(it, true))}</div> : null}
            </div>
          ) : null}

          {items.length === 0 ? <div className="px-3 py-10 text-center text-sm text-zinc-500">暂无消息</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
