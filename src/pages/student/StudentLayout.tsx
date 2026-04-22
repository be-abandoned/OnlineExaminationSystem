import AppShell from "@/components/layout/AppShell";
import { BookOpenCheck, ClipboardList, MessageSquare, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePrefetchStudentDashboard } from "@/hooks/domain/useStudentDashboardQuery";
import { usePrefetchStudentMessages } from "@/hooks/domain/useStudentMessagesQuery";

export default function StudentLayout() {
  const me = useAuthStore((s) => s.getMe());
  const prefetchStudentDashboard = usePrefetchStudentDashboard();
  const prefetchStudentMessages = usePrefetchStudentMessages();

  return (
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
  );
}
