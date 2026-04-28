import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/stores/authStore";
import { studentGetProfileRemote, studentUpdateProfileRemote } from "@/utils/remoteApi";
import { getStudentProfileKey, useStudentProfileQuery } from "@/hooks/domain/useStudentProfileQuery";
import { queryClient } from "@/lib/query/queryClient";

export default function StudentProfile() {
  const me = useAuthStore((s) => s.getMe());
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const { data, isLoading, error } = useStudentProfileQuery(me?.id);
  const profileUser = data?.user ?? me;
  const [name, setName] = useState(profileUser?.displayName ?? "");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!profileUser) return;
    setName(profileUser.displayName);
  }, [profileUser?.displayName]);

  const classText = useMemo(() => {
    if (isLoading && !data) return "加载中...";
    if (error) return "班级信息加载失败";
    if (data?.classInfo) {
      return `${data.classInfo.name}（${data.classInfo.gradeLevel}年级）`;
    }
    if (profileUser?.classId) return "未找到班级信息";
    return "暂未分配班级";
  }, [data, error, isLoading, profileUser?.classId]);

  if (!me || !profileUser) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>个人资料</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">姓名</div>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid gap-1">
              <div className="text-xs font-medium text-zinc-700">学号</div>
              <Input value={profileUser.schoolNo} readOnly className="bg-zinc-50 text-zinc-600" />
            </div>
            <div className="grid gap-1 sm:col-span-2">
              <div className="text-xs font-medium text-zinc-700">所在班级</div>
              <Input value={classText} readOnly className="bg-zinc-50 text-zinc-600" />
            </div>
          </div>

          {ok ? <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">已保存</div> : null}
          {saveError ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{saveError}</div> : null}

          <div>
            <Button
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setOk(false);
                setSaveError(null);
                try {
                  const saved = await studentUpdateProfileRemote(me.id, { displayName: name.trim() || me.displayName });
                  updateProfile({ displayName: saved.displayName });
                  queryClient.setQueryData<Awaited<ReturnType<typeof studentGetProfileRemote>>>(getStudentProfileKey(me.id), (current) => ({
                    user: saved,
                    classInfo: current?.classInfo ?? data?.classInfo ?? null,
                  }));
                  setName(saved.displayName);
                  setOk(true);
                } catch (err) {
                  setSaveError(err instanceof Error ? err.message : "保存失败");
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "保存中..." : "保存修改"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
