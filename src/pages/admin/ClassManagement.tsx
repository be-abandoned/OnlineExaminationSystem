import { useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { GRADE_LEVELS, Class, User } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { Plus, Trash2, Pencil, Search } from "lucide-react";
import {
  adminDeleteClassRemote,
  adminUpsertClassRemote,
} from "@/utils/remoteApi";
import { useAdminClassManagementQuery } from "@/hooks/domain/useAdminClassManagementQuery";
import { invalidateByPrefix } from "@/lib/query/invalidate";
import TableSkeleton from "@/components/feedback/TableSkeleton";

export default function ClassManagement() {
  const me = useAuthStore((s) => s.getMe());
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<Partial<Class> | null>(null);
  const [query, setQuery] = useState("");
  const { data, isLoading, isRefreshing, error } = useAdminClassManagementQuery(me?.id);
  const classes = data?.classes || [];
  const teachers = data?.teachers || [];

  const teacherNameMap = useMemo(
    () => new Map(teachers.map((teacher) => [teacher.id, teacher.displayName])),
    [teachers],
  );

  const handleSaveClass = async () => {
    if (!me || !editingClass) return;
    try {
      if (!editingClass.name || !editingClass.gradeLevel) {
        alert("请填写必填项");
        return;
      }
      await adminUpsertClassRemote(me.id, editingClass);
      setIsEditOpen(false);
      invalidateByPrefix("admin", me.id, ["classes", "users", "stats"]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const handleDelete = async (id: string) => {
    if (!me) return;
    if (!confirm("确定要删除该班级吗？相关学生将变为无班级状态。")) return;
    try {
      await adminDeleteClassRemote(me.id, id);
      invalidateByPrefix("admin", me.id, ["classes", "users", "stats"]);
    } catch (e: any) {
      alert(e.message);
    }
  };

  const filteredClasses = classes.filter((c) => 
    c.name.toLowerCase().includes(query.toLowerCase())
  );

  if (isLoading && !data) {
    return <TableSkeleton title="班级管理" columns={4} />;
  }

  if (error && !data) {
    return <Card className="px-4 py-10 text-center text-sm text-red-600">{error.message || "加载班级失败"}</Card>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">班级管理</h1>
          {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
        </div>
        <Button onClick={() => { setEditingClass({ gradeLevel: 1 }); setIsEditOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" />
          新建班级
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
        <Input
          placeholder="搜索班级名称..."
          className="pl-9"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">班级名称</th>
                <th className="px-4 py-3 font-medium">年级</th>
                <th className="px-4 py-3 font-medium">班主任</th>
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredClasses.map((c) => (
                <tr key={c.id} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-3 font-medium text-zinc-900">{c.name}</td>
                  <td className="px-4 py-3 text-zinc-600">
                    {GRADE_LEVELS.find(g => g.value === c.gradeLevel)?.label}
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {teacherNameMap.get(c.teacherId || "") || "未分配"}
                  </td>
                  <td className="px-4 py-3 text-right flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingClass(c); setIsEditOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredClasses.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-zinc-500">
                    暂无班级数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`${editingClass?.id ? "编辑" : "新建"}班级`}
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">班级名称 <span className="text-red-500">*</span></label>
            <Input
              value={editingClass?.name || ""}
              onChange={(e) => setEditingClass(prev => ({ ...prev, name: e.target.value }))}
              placeholder="例如：高一(1)班"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">所属年级 <span className="text-red-500">*</span></label>
            <Select
              value={editingClass?.gradeLevel || ""}
              onChange={(e) => setEditingClass(prev => ({ ...prev, gradeLevel: Number(e.target.value) }))}
            >
              <option value="">请选择年级</option>
              {GRADE_LEVELS.map(g => (
                <option key={g.value} value={g.value}>{g.label}</option>
              ))}
            </Select>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">班主任</label>
            <Select
              value={editingClass?.teacherId || ""}
              onChange={(e) => setEditingClass(prev => ({ ...prev, teacherId: e.target.value }))}
            >
              <option value="">未分配</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>{t.displayName} ({t.schoolNo})</option>
              ))}
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="secondary" onClick={() => setIsEditOpen(false)}>取消</Button>
            <Button onClick={handleSaveClass}>保存</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
