import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import { useAuthStore } from "@/stores/authStore";
import { GRADE_LEVELS, SUBJECTS } from "@/types/domain";

function imageUrl(prompt: string, size: string) {
  const encoded = encodeURIComponent(prompt);
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encoded}&image_size=${size}`;
}

export default function TeacherProfile() {
  const me = useAuthStore((s) => s.getMe());
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [name, setName] = useState(me?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [gradeLevel, setGradeLevel] = useState<number | undefined>(me?.gradeLevel);
  const [subjectId, setSubjectId] = useState<string | undefined>(me?.subjectId);
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  const avatars = useMemo(() => {
    return [
      "/avatars/man1.png",
      "/avatars/woman1.png",
    ];
  }, []);

  useEffect(() => {
    if (!me) return;
    if (me.avatarUrl && avatars.includes(me.avatarUrl)) {
      setAvatarUrl(me.avatarUrl);
    } else {
      setAvatarUrl(avatars[0]);
    }
  }, [me, avatars]);

  if (!me) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>个人资料</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <div className="text-xs font-medium text-zinc-700">头像预览</div>
              <div className="mt-2">
                <img
                  src={avatarUrl || me.avatarUrl || avatars[0]}
                  alt="avatar"
                  className="h-24 w-24 rounded-full border border-zinc-200 object-cover"
                />
              </div>
            </div>
            <div className="sm:col-span-2">
              <div className="grid gap-3">
                <div className="grid gap-1">
                  <div className="text-xs font-medium text-zinc-700">姓名</div>
                  <Input value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <div className="text-xs font-medium text-zinc-700">执教年级</div>
                    <Select
                      value={gradeLevel ? String(gradeLevel) : ""}
                      onChange={(e) => setGradeLevel(e.target.value ? Number(e.target.value) : undefined)}
                    >
                      <option value="">请选择年级</option>
                      {GRADE_LEVELS.map((gl) => (
                        <option key={gl.value} value={gl.value}>
                          {gl.label}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="grid gap-1">
                    <div className="text-xs font-medium text-zinc-700">执教学科</div>
                    <Select
                      value={subjectId || ""}
                      onChange={(e) => setSubjectId(e.target.value || undefined)}
                    >
                      <option value="">请选择学科</option>
                      {SUBJECTS.map((sub) => (
                        <option key={sub.id} value={sub.id}>
                          {sub.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-medium text-zinc-700">推荐头像</div>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {avatars.map((u) => (
                <button
                  key={u}
                  className={
                    (avatarUrl || me.avatarUrl) === u
                      ? "overflow-hidden rounded-xl border border-blue-400"
                      : "overflow-hidden rounded-xl border border-zinc-200 hover:border-zinc-300"
                  }
                  onClick={() => setAvatarUrl(u)}
                >
                  <img src={u} alt="avatar" className="aspect-square w-full object-cover" />
                </button>
              ))}
            </div>
          </div>

          {ok ? <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">已保存</div> : null}

          <div>
            <Button
              disabled={saving}
              onClick={() => {
                setSaving(true);
                setOk(false);
                try {
                  const payload = {
                    displayName: name.trim() || me.displayName,
                    avatarUrl,
                    gradeLevel,
                    subjectId,
                  };
                  updateProfile(payload);
                  setOk(true);
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
