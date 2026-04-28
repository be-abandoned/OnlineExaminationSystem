import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Textarea from "@/components/ui/Textarea";
import Tag from "@/components/ui/Tag";
import Modal from "@/components/ui/Modal";
import { Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { GRADE_LEVELS, type Message } from "@/types/domain";
import { teacherDeleteMessageRemote, teacherSendMessageRemote, teacherUpdateMessageRemote } from "@/utils/remoteApi";
import { useTeacherMessagesQuery } from "@/hooks/domain/useTeacherMessagesQuery";
import { invalidateByPrefix } from "@/lib/query/invalidate";
import TableSkeleton from "@/components/feedback/TableSkeleton";

type SendNoticeStatus = "idle" | "sending" | "success";
type NoticeAction = "create" | "edit";

export default function TeacherMessages() {
  const me = useAuthStore((s) => s.getMe());
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [classIds, setClassIds] = useState<string[]>([]);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [expandedReadStatusById, setExpandedReadStatusById] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [sendStatus, setSendStatus] = useState<SendNoticeStatus>("idle");
  const [lastAction, setLastAction] = useState<NoticeAction>("create");
  const { data, isLoading, isRefreshing, error: loadError } = useTeacherMessagesQuery(me?.id);
  const students = data?.students || [];
  const classes = data?.classes || [];
  const sent = data?.sent || [];

  const resetForm = () => {
    setTitle("");
    setContent("");
    setClassIds([]);
    setEditingMessageId(null);
    setError(null);
  };

  const getTargetClassIds = (target: Message["target"]) => {
    if (target.type === "classes") return target.classIds;
    if (target.type === "all_students") return classes.map((item) => item.id);
    if (target.type === "students") {
      const targetStudentIds = new Set(target.studentIds);
      return classes
        .filter((item) => students.some((student) => student.classId === item.id && targetStudentIds.has(student.id)))
        .map((item) => item.id);
    }
    return [];
  };

  const startEdit = (message: Message) => {
    setEditingMessageId(message.id);
    setTitle(message.title);
    setContent(message.content);
    setClassIds(getTargetClassIds(message.target));
    setError(null);
  };

  const getMessageAudience = (message: Message) => {
    if (message.target.type === "all_students") return students;
    if (message.target.type === "students") {
      const targetIds = new Set(message.target.studentIds);
      return students.filter((student) => targetIds.has(student.id));
    }
    const targetClassIds = new Set(message.target.classIds);
    return students.filter((student) => student.classId && targetClassIds.has(student.classId));
  };

  const getMessageReadStatus = (message: Message) => {
    const audience = getMessageAudience(message);
    const readStudentIds = new Set((message.reads || []).map((read) => read.studentId));
    const readStudents = audience.filter((student) => readStudentIds.has(student.id));
    const unreadStudents = audience.filter((student) => !readStudentIds.has(student.id));
    return { readStudents, unreadStudents };
  };

  const renderStudentNames = (items: typeof students) => {
    if (items.length === 0) return <div className="text-xs text-zinc-400">暂无学生</div>;
    return (
      <div className="flex flex-wrap gap-2">
        {items.map((student) => (
          <span key={student.id} className="rounded-full bg-white px-2 py-1 text-xs text-zinc-700 ring-1 ring-zinc-200">
            {student.displayName}
          </span>
        ))}
      </div>
    );
  };

  const renderClassNames = (target: Message["target"]) => {
    if (target.type === "all_students") return "全体学生";
    if (target.type === "students") return `指定学生 ${target.studentIds.length} 人`;
    const targetClassIds = new Set(target.classIds);
    const names = classes.filter((item) => targetClassIds.has(item.id)).map((item) => item.name);
    if (names.length === 0) return `指定班级 ${target.classIds.length} 个`;
    return names.join("、");
  };

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
            <CardTitle>{editingMessageId ? "编辑公告" : "发送公告"}</CardTitle>
            {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
          </div>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              setError(null);
              const isEditing = Boolean(editingMessageId);
              setLastAction(isEditing ? "edit" : "create");
              setSendStatus("sending");
              const payload = {
                title: title.trim() || "公告",
                content: content.trim(),
                target: { type: "classes" as const, classIds: classIds.slice() },
              };
              try {
                if (isEditing && editingMessageId) {
                  await teacherUpdateMessageRemote(me.id, editingMessageId, payload);
                } else {
                  await teacherSendMessageRemote(me.id, payload);
                }
                resetForm();
                invalidateByPrefix("teacher", me.id, ["messages"]);
                setSendStatus("success");
              } catch (err) {
                setSendStatus("idle");
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
                <div className="flex items-center gap-2 text-sm text-zinc-700">
                  <span>按班级发布公告</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setClassIds(classes.map((item) => item.id))}
                  >
                    全选
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setClassIds([])}>
                    清空
                  </Button>
                </div>
              </div>
            </div>

            <div>
              <div className="text-xs font-medium text-zinc-700">发布班级</div>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {classes.map((c) => {
                  const checked = classIds.includes(c.id);
                  const studentCount = students.filter((student) => student.classId === c.id).length;
                  return (
                    <label
                      key={c.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-zinc-200 px-3 py-2 hover:bg-zinc-50"
                    >
                      <div>
                        <div className="text-sm font-medium text-zinc-900">{c.name}</div>
                        <div className="text-xs text-zinc-500">
                          {GRADE_LEVELS.find((grade) => grade.value === c.gradeLevel)?.label || `${c.gradeLevel}年级`} · {studentCount} 人
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          if (e.target.checked) setClassIds((arr) => arr.includes(c.id) ? arr : [...arr, c.id]);
                          else setClassIds((arr) => arr.filter((x) => x !== c.id));
                        }}
                      />
                    </label>
                  );
                })}
                {classes.length === 0 ? (
                  <div className="rounded-lg border border-zinc-200 px-3 py-6 text-center text-sm text-zinc-500 sm:col-span-2">
                    暂无班级
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">内容</div>
              <Textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="请输入公告内容" />
            </div>

            {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

            <div className="flex items-center gap-2">
              <Button type="submit" disabled={!content.trim() || classIds.length === 0 || sendStatus === "sending"}>
                {editingMessageId ? "保存修改" : "发送"}
              </Button>
              {editingMessageId ? (
                <Button type="button" variant="secondary" onClick={resetForm}>
                  取消编辑
                </Button>
              ) : null}
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
            {sent.map((m) => {
              const { readStudents, unreadStudents } = getMessageReadStatus(m);
              const expanded = Boolean(expandedReadStatusById[m.id]);
              return (
              <div key={m.id} className="rounded-xl border border-zinc-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{m.title}</div>
                    <div className="mt-1 text-xs text-zinc-500">{new Date(m.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Tag tone="blue">{m.target.type === "classes" ? `班级 ${m.target.classIds.length} 个` : "旧目标"}</Tag>
                    <Button type="button" variant="ghost" size="sm" onClick={() => startEdit(m)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50"
                      onClick={async () => {
                        const ok = window.confirm(`确定要删除公告「${m.title}」吗？`);
                        if (!ok) return;
                        try {
                          await teacherDeleteMessageRemote(me.id, m.id);
                          if (editingMessageId === m.id) {
                            resetForm();
                          }
                          invalidateByPrefix("teacher", me.id, ["messages"]);
                        } catch (err) {
                          setError(err instanceof Error ? err.message : "删除失败");
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-2 text-xs text-zinc-500">发布对象：{renderClassNames(m.target)}</div>
                <div className="mt-3 whitespace-pre-wrap text-sm text-zinc-700">{m.content}</div>
                <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium text-zinc-900 hover:bg-zinc-100"
                    onClick={() => setExpandedReadStatusById((prev) => ({ ...prev, [m.id]: !prev[m.id] }))}
                  >
                    <span>
                      阅读情况：未读 {unreadStudents.length} 人 / 已读 {readStudents.length} 人
                    </span>
                    {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  {expanded ? (
                    <div className="grid gap-3 border-t border-zinc-200 p-3 sm:grid-cols-2">
                      <div className="rounded-lg bg-red-50 p-3">
                        <div className="mb-2 text-xs font-semibold text-red-700">未读学生（{unreadStudents.length}人）</div>
                        {renderStudentNames(unreadStudents)}
                      </div>
                      <div className="rounded-lg bg-green-50 p-3">
                        <div className="mb-2 text-xs font-semibold text-green-700">已读学生（{readStudents.length}人）</div>
                        {renderStudentNames(readStudents)}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
              );
            })}
            {sent.length === 0 ? <div className="px-3 py-10 text-center text-sm text-zinc-500">暂无公告</div> : null}
          </div>
        </CardContent>
      </Card>

      <Modal
        isOpen={sendStatus !== "idle"}
        onClose={() => {
          if (sendStatus === "sending") return;
          setSendStatus("idle");
        }}
        title={sendStatus === "sending" ? (lastAction === "edit" ? "保存中" : "发送中") : (lastAction === "edit" ? "修改成功" : "发布成功")}
        width="max-w-sm"
        footer={
          sendStatus === "success" ? (
            <div className="flex justify-end">
              <Button variant="secondary" onClick={() => setSendStatus("idle")}>关闭</Button>
            </div>
          ) : null
        }
      >
        <div className="text-sm text-zinc-600">
          {sendStatus === "sending"
            ? (lastAction === "edit" ? "正在保存公告修改，请稍候..." : "正在发送通知，请稍候...")
            : (lastAction === "edit" ? "公告已更新，点击关闭即可继续操作。" : "通知已成功发布，点击关闭即可继续操作。")}
        </div>
      </Modal>
    </div>
  );
}
