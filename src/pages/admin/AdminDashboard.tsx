import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { useAuthStore } from "@/stores/authStore";
import { useAdminStatsQuery } from "@/hooks/domain/useAdminStatsQuery";
import TableSkeleton from "@/components/feedback/TableSkeleton";

export default function AdminDashboard() {
  const me = useAuthStore((s) => s.getMe());
  const { data, isLoading, isRefreshing } = useAdminStatsQuery(me?.id);

  if (!me) return null;

  if (isLoading && !data) {
    return <TableSkeleton title="管理员工作台" columns={3} rows={1} />;
  }

  const studentCount = data?.studentCount || 0;
  const teacherCount = data?.teacherCount || 0;
  const adminCount = data?.adminCount || 0;

  return (
    <div className="space-y-6 p-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold text-zinc-900">管理员工作台</h1>
        {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">学生总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-900">{studentCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">教师总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-900">{teacherCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">管理员总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-zinc-900">{adminCount}</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
