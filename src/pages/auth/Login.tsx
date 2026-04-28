import { useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { LoaderCircle } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import type { UserRole } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";
import { queryClient } from "@/lib/query/queryClient";
import { createQueryKey } from "@/lib/query/queryKey";
import {
  adminGetStatsRemote,
  studentListAssignedExamsRemote,
  studentListAttemptsRemote,
  studentListMessagesRemote,
  teacherGetDashboardRemote,
  teacherListMessagesRemote,
} from "@/utils/remoteApi";

type LoginStep = "auth" | "dashboard" | "messages";

async function refreshEntryData(user: { id: string; role: UserRole }, setStep: (step: LoginStep) => void) {
  setStep("dashboard");
  if (user.role === "student") {
    await queryClient.fetchQuery(createQueryKey("student", user.id, "dashboard", {}), {
      fetcher: async () => {
        const [exams, attempts] = await Promise.all([
          studentListAssignedExamsRemote(user.id),
          studentListAttemptsRemote(user.id),
        ]);
        return { exams, attempts };
      },
    });
    setStep("messages");
    await queryClient.fetchQuery(createQueryKey("student", user.id, "messages", {}), {
      fetcher: () => studentListMessagesRemote(user.id),
    });
    return;
  }

  if (user.role === "teacher") {
    await queryClient.fetchQuery(createQueryKey("teacher", user.id, "dashboard", {}), {
      fetcher: () => teacherGetDashboardRemote(user.id),
    });
    setStep("messages");
    await queryClient.fetchQuery(createQueryKey("teacher", user.id, "messages", {}), {
      fetcher: () => teacherListMessagesRemote(user.id),
    });
    return;
  }

  await queryClient.fetchQuery(createQueryKey("admin", user.id, "stats", {}), {
    fetcher: () => adminGetStatsRemote(user.id),
  });
}

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const me = useAuthStore((s) => s.getMe());

  const [role, setRole] = useState<UserRole>("student");
  const [schoolNo, setSchoolNo] = useState("S20230001");
  const [password, setPassword] = useState("OexTest#2026!A1");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loginStep, setLoginStep] = useState<LoginStep>("auth");

  const helper = useMemo(() => {
    return {
      student: { schoolNo: "S20230001", password: "OexTest#2026!A1" },
      teacher: { schoolNo: "T10001", password: "OexTest#2026!A1" },
      admin: { schoolNo: "admin", password: "OexTest#2026!A1" },
    };
  }, []);

  const loginStepText = {
    auth: "正在验证账号信息...",
    dashboard: "正在刷新工作台...",
    messages: "正在刷新消息中心...",
  }[loginStep];

  if (me && !loading) {
    if (me.role === "admin") return <Navigate to="/admin" replace />;
    return <Navigate to={me.role === "teacher" ? "/teacher" : "/student"} replace />;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#F6F7FB] px-4 py-14">
      <div className="mb-8 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 lg:text-5xl">
          在线考试系统
        </h1>
        <p className="mt-4 text-sm text-zinc-600">
          支持学生端/教师端/管理员端：登录后自动进入对应工作台
          <br />
          <span className="text-xs text-zinc-400">（账号注册请联系管理员）</span>
        </p>
      </div>

      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>登录</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-3"
              onSubmit={async (e) => {
                e.preventDefault();
                setError(null);
                setLoading(true);
                setLoginStep("auth");
                try {
                  const u = await login({ role, schoolNo: schoolNo.trim(), password });
                  await refreshEntryData(u, setLoginStep);
                  if (u.role === "admin") navigate("/admin", { replace: true });
                  else navigate(u.role === "teacher" ? "/teacher" : "/student", { replace: true });
                } catch (err) {
                  logout();
                  setError(err instanceof Error ? err.message : "操作失败");
                } finally {
                  setLoading(false);
                }
              }}
            >
              <div className="grid gap-1">
                <div className="text-xs font-medium text-zinc-700">身份</div>
                <Select
                  value={role}
                  onChange={(e) => {
                    const next = e.target.value as UserRole;
                    setRole(next);
                    setError(null);
                    if (next === "teacher") {
                      setSchoolNo(helper.teacher.schoolNo);
                      setPassword(helper.teacher.password);
                    } else if (next === "admin") {
                      setSchoolNo(helper.admin.schoolNo);
                      setPassword(helper.admin.password);
                    } else {
                      setSchoolNo(helper.student.schoolNo);
                      setPassword(helper.student.password);
                    }
                  }}
                >
                  <option value="student">学生端</option>
                  <option value="teacher">教师端</option>
                  <option value="admin">管理员</option>
                </Select>
              </div>

              <div className="grid gap-1">
                <div className="text-xs font-medium text-zinc-700">学号/工号</div>
                <Input value={schoolNo} onChange={(e) => setSchoolNo(e.target.value)} placeholder="例如 S20230001" />
              </div>

              <div className="grid gap-1">
                <div className="text-xs font-medium text-zinc-700">密码</div>
                <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

              <Button type="submit" disabled={loading}>
                {loading ? "处理中..." : "登录"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {loading ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 text-center shadow-2xl">
            <LoaderCircle className="mx-auto h-8 w-8 animate-spin text-blue-600" />
            <div className="mt-4 text-lg font-semibold text-zinc-900">登录中</div>
            <div className="mt-2 text-sm text-zinc-600">{loginStepText}</div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{ width: loginStep === "auth" ? "33%" : loginStep === "dashboard" ? "66%" : "92%" }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
