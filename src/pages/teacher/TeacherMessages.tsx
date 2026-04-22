import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Tag from "@/components/ui/Tag";
import { useAuthStore } from "@/stores/authStore";
import type { Message, User } from "@/types/domain";
import { teacherSendMessageRemote } from "@/utils/remoteApi";
import { useTeacherMessagesQuery } from "@/hooks/domain/useTeacherMessagesQuery";
import { invalidateByPrefix } from "@/lib/query/invalidate";
import TableSkeleton from "@/components/feedback/TableSkeleton";

type TargetMode = "all" | "students";

export default function TeacherMessages() {
  const me = useAuthStore((s) => s.getMe());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetMode, setTargetMode] = useState<TargetMode>("all");
  const [studentIds, setStudentIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, isRefreshing, error: loadError } = useTeacherMessagesQuery(me?.id);
  const students = data?.students || [];
  const sent = data?.sent || [];

  if (!me) return null;

  if (isLoading && !data) {
    return <TableSkeleton title="消息中心" columns={2} rows={5} />;
  }

  if (loadError && !data) {
    return <Card className="px-4 py-10 text-center text-sm text-red-600">加载消息中心失败</Card>;
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <CardTitle>发送公告</CardTitle>
            {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              try {
                await teacherSendMessageRemote(me.id, {
                  title: title.trim() || "公告",
                  content: content.trim(),
                  target:
                    targetMode === "all" ? { type: "all_students" } : { type: "students", studentIds: studentIds.slice() },
                });
                setTitle("");
                setContent("");
                setStudentIds([]);
                invalidateByPrefix("teacher", me.id, ["messages"]);
              } catch (err) {
                setError(err instanceof Error ? err.message : "发送失败");
              }
            }}
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="grid gap-1">
                <div className="text-xs font-medium text-zinc-700">标题</div>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例如：考试通知" />
              </div>
              <div className="grid gap-1">
                <div className="text-xs font-medium text-zinc-700">目标</div>
                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input type="radio" checked={targetMode === "all"} onChange={() => setTargetMode("all")} />
                    全体学生
                  </label>
                  <label className="flex items-center gap-2 text-sm text-zinc-700">
                    <input type="radio" checked={targetMode === "students"} onChange={() => setTargetMode("students")} />
                    指定学生
                  </label>
                </div>
              </div>
            </div>

            {targetMode === "students" ? (
              <div>
                <div className="text-xs font-medium text-zinc-700">选择学生</div>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {students.map((s) => {
                    const checked = studentIds.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
                      >
                        <div>
                          <div className="text-sm font-medium text-zinc-900">{s.displayName}</div>
                          <div className="text-xs text-zinc-500">{s.schoolNo}</div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            if (e.target.checked) setStudentIds((arr) => [...arr, s.id]);
                            else setStudentIds((arr) => arr.filter((x) => x !== s.id));
                          }}
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">内容</div>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="请输入公告内容" />
            </div>

            {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

            <div>
              <Button type="submit" disabled={!content.trim()}>
                发送
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>已发送</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3">
            {sent.map((m) => (
              <div key={m.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{m.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                  <Tag tone="blue">{m.target.type === "all_students" ? "全体" : `指定 ${m.target.studentIds.length} 人`}</Tag>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{m.content}</div>
              </div>
            ))}
            {sent.length === 0 ? <div className="px-3 py-10 text-center text-sm text-zinc-500">暂无公告</div> : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
