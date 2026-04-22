import { LogOut } from "lucide-react";
import Button from "@/components/ui/Button";
import Clock from "@/components/common/Clock";
import { useAuthStore } from "@/stores/authStore";
import { Link, useNavigate } from "react-router-dom";

export default function TopNav({ title }: { title: string }) {
  const me = useAuthStore((s) => s.getMe());
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-blue-600" />
          <div>
            <div className="text-sm font-semibold text-zinc-900">{title}</div>
            <div className="text-xs text-zinc-500">在线考试系统</div>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <Clock />
          {me ? (
            <div className="flex items-center gap-2">
              <img
                src={
                  me.avatarUrl ||
                  "https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=avatar%2C%20minimal%20flat%20illustration%2C%20blue%20accent&image_size=square"
                }
                alt="avatar"
                className="h-8 w-8 rounded-full border border-zinc-200 object-cover"
              />
              <div className="hidden sm:block">
                <div className="text-sm font-medium text-zinc-900">{me.displayName}</div>
                <div className="text-xs text-zinc-500">
                  {me.role === "teacher" ? "教师端" : me.role === "admin" ? "管理员" : "学生端"}
                </div>
              </div>
              <Button
                variant="ghost"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
                aria-label="退出登录"
              >
                <LogOut className="mr-1 h-4 w-4" />
                退出
              </Button>
            </div>
          ) : (
            <Button onClick={() => navigate("/login")}>登录</Button>
          )}
        </div>
      </div>
    </header>
  );
}

