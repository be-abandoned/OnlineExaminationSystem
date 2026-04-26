import AppShell from "@/components/layout/AppShell";
import { BookOpenText, ClipboardCheck, FileText, MessageSquare, User } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePrefetchTeacherExams } from "@/hooks/domain/useTeacherExamsQuery";
import { usePrefetchTeacherDashboard } from "@/hooks/domain/useTeacherDashboardQuery";
import { usePrefetchTeacherQuestions } from "@/hooks/domain/useTeacherQuestionsQuery";
import { usePrefetchTeacherMessages } from "@/hooks/domain/useTeacherMessagesQuery";

export default function TeacherLayout() {
  const me = useAuthStore((s) => s.getMe());
  const prefetchTeacherExams = usePrefetchTeacherExams();
  const prefetchTeacherDashboard = usePrefetchTeacherDashboard();
  const prefetchTeacherQuestions = usePrefetchTeacherQuestions();
  const prefetchTeacherMessages = usePrefetchTeacherMessages();

  return (
    <AppShell
      title="教师端"
      items={[
        {
          to: "/teacher",
          label: "工作台",
          icon: <ClipboardCheck className="h-4 w-4" />,
          onMouseEnter: () => prefetchTeacherDashboard(me?.id),
        },
        {
          to: "/teacher/questions",
          label: "题库管理",
          icon: <BookOpenText className="h-4 w-4" />,
          onMouseEnter: () => prefetchTeacherQuestions(me?.id),
          children: [
            { to: "/teacher/questions", label: "题目列表" },
            { to: "/teacher/questions/create/single", label: "单选题创编" },
            { to: "/teacher/questions/create/multiple", label: "多选题创编" },
            { to: "/teacher/questions/create/true_false", label: "判断题创编" },
            { to: "/teacher/questions/create/blank", label: "填空题创编" },
            { to: "/teacher/questions/create/short", label: "简答题创编" },
          ],
        },
        {
          to: "/teacher/exams",
          label: "试卷列表",
          icon: <FileText className="h-4 w-4" />,
          onMouseEnter: () => prefetchTeacherExams(me?.id),
        },
        {
          to: "/teacher/messages",
          label: "消息中心",
          icon: <MessageSquare className="h-4 w-4" />,
          onMouseEnter: () => prefetchTeacherMessages(me?.id),
        },
        { to: "/teacher/profile", label: "个人资料", icon: <User className="h-4 w-4" /> },
      ]}
    />
  );
}
