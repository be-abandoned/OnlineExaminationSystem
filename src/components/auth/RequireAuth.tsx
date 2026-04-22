import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import type { UserRole } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";

export default function RequireAuth({ role, children }: { role: UserRole; children: ReactNode }) {
  const me = useAuthStore((s) => s.getMe());
  if (!me) return <Navigate to="/login" replace />;
  if (me.role !== role) return <Navigate to="/" replace />;
  return children;
}

