import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserRole } from "@/types/domain";
import { loginRemote, logoutRemote, registerRemote } from "@/utils/remoteApi";

type AuthState = {
  userId: string | null;
  me: User | null;
  login: (args: { role: UserRole; schoolNo: string; password: string }) => Promise<User>;
  register: (args: {
    role: UserRole;
    schoolNo: string;
    password: string;
    displayName: string;
  }) => Promise<User>;
  logout: () => void;
  getMe: () => User | null;
  updateProfile: (patch: { displayName?: string; avatarUrl?: string; gradeLevel?: number; subjectId?: string }) => User;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      userId: null,
      me: null,
      login: async ({ role, schoolNo, password }) => {
        const found = await loginRemote({ role, schoolNo, password });
        set({ userId: found.id, me: found });
        return found;
      },
      register: async ({ role, schoolNo, password, displayName }) => {
        const user = await registerRemote({ role, schoolNo, password, displayName });
        set({ userId: user.id, me: user });
        return user;
      },
      logout: () => {
        void logoutRemote();
        set({ userId: null, me: null });
      },
      getMe: () => get().me,
      updateProfile: (patch) => {
        const me = get().getMe();
        if (!me) throw new Error("未登录");
        const next: User = { ...me, ...patch };
        set({ me: next });
        return next;
      },
    }),
    {
      name: "oex_auth_v1",
      partialize: (s) => ({ userId: s.userId, me: s.me }),
    },
  ),
);
