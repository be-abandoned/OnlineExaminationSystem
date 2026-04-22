import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { useAuthStore } from "@/stores/authStore";

function imageUrl(prompt: string, size: string) {
  const encoded = encodeURIComponent(prompt);
  return `https://coresg-normal.trae.ai/api/ide/v1/text_to_image?prompt=${encoded}&image_size=${size}`;
}

export default function StudentProfile() {
  const me = useAuthStore((s) => s.getMe());
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const [name, setName] = useState(me?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(me?.avatarUrl ?? "");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState(false);

  const avatars = useMemo(() => {
    return [
      imageUrl("portrait avatar, student, minimal flat illustration, blue accent, white background", "square"),
      imageUrl("portrait avatar, student with glasses, minimal flat illustration, blue accent, white background", "square"),
      imageUrl("portrait avatar, student, minimal flat illustration, warm neutral, white background", "square"),
      imageUrl("portrait avatar, student, minimal flat illustration, light background, friendly", "square"),
    ];
  }, []);

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
                <div className="grid gap-1">
                  <div className="text-xs font-medium text-zinc-700">头像 URL（可选）</div>
                  <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
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
                  <img src={u} alt="avatar" className="h-20 w-full object-cover" />
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
                  updateProfile({ displayName: name.trim() || me.displayName, avatarUrl: avatarUrl.trim() || undefined });
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

