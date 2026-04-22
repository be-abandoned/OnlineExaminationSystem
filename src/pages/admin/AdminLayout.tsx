import AppShell from "@/components/layout/AppShell";
import { Users, LayoutDashboard, School } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import { usePrefetchAdminUsers } from "@/hooks/domain/useAdminUserManagementQuery";
import { usePrefetchAdminClasses } from "@/hooks/domain/useAdminClassManagementQuery";

export default function AdminLayout() {
  const me = useAuthStore((s) => s.getMe());
  const prefetchAdminUsers = usePrefetchAdminUsers();
  const prefetchAdminClasses = usePrefetchAdminClasses();

  return (
    <AppShell
      title="管理员端"
      items={[
        { to: "/admin", label: "工作台", icon: <LayoutDashboard className="h-4 w-4" /> },
        {
          to: "/admin/classes",
          label: "班级管理",
          icon: <School className="h-4 w-4" />,
          onMouseEnter: () => prefetchAdminClasses(me?.id),
        },
        {
          to: "/admin/users",
          label: "用户管理",
          icon: <Users className="h-4 w-4" />,
          onMouseEnter: () => prefetchAdminUsers(me?.id, "student"),
        },
      ]}
    />
  );
}
