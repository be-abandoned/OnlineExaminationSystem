import { Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/authStore";

export default function RoleIndex() {
  const me = useAuthStore((s) => s.getMe());
  if (!me) return <Navigate to="/login" replace />;
  if (me.role === "admin") return <Navigate to="/admin" replace />;
  return <Navigate to={me.role === "teacher" ? "/teacher" : "/student"} replace />;
}

