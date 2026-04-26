import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppShell from "@/components/layout/AppShell";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { BookOpenCheck, MessageSquare, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePrefetchStudentDashboard } from "@/hooks/domain/useStudentDashboardQuery";
import { usePrefetchStudentMessages } from "@/hooks/domain/useStudentMessagesQuery";
import { studentListMessagesRemote } from "@/utils/remoteApi";

export default function StudentLayout() {
  const me = useAuthStore((s) => s.getMe());
  const prefetchStudentDashboard = usePrefetchStudentDashboard();
  const prefetchStudentMessages = usePrefetchStudentMessages();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);
  const [noticeOpen, setNoticeOpen] = useState(false);

  useEffect(() => {
    if (!me || me.role !== "student") return;
    let cancelled = false;
    studentListMessagesRemote(me.id)
      .then((data) => {
        if (cancelled) return;
        const count = data.messages.filter((message) => !message.readAt).length;
        if (count > 0) {
          setUnreadCount(count);
          setNoticeOpen(true);
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [me?.id, me?.role]);

  return (
    <>
      <AppShell
        title="学生端"
        items={[
          {
            to: "/student",
            label: "工作台",
            icon: <BookOpenCheck className="h-4 w-4" />,
            onMouseEnter: () => prefetchStudentDashboard(me?.id),
          },
          {
            to: "/student/messages",
            label: "消息中心",
            icon: <MessageSquare className="h-4 w-4" />,
            onMouseEnter: () => prefetchStudentMessages(me?.id),
          },
          { to: "/student/profile", label: "个人资料", icon: <User className="h-4 w-4" /> },
        ]}
      />
      <Modal
        isOpen={noticeOpen}
        onClose={() => setNoticeOpen(false)}
        title="未读消息提醒"
        width="max-w-sm"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNoticeOpen(false)}>
              稍后查看
            </Button>
            <Button
              onClick={() => {
                setNoticeOpen(false);
                navigate("/student/messages");
              }}
            >
              去消息中心
            </Button>
          </div>
        }
      >
        <div className="text-sm text-zinc-700">您有{unreadCount}条未读消息，请到消息中心查看</div>
      </Modal>
    </>
  );
}
