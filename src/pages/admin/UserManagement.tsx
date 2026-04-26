import { useMemo, useState } from "react";
import { useAuthStore } from "@/stores/authStore";
import { User, UserRole, SUBJECTS } from "@/types/domain";
import { Card } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Tag from "@/components/ui/Tag";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Select from "@/components/ui/Select";
import { Search, Plus, Upload, Trash2, Pencil, CheckCircle, XCircle } from "lucide-react";
import UserImportModal from "./UserImportModal";
import {
  adminBatchUpdateUserStatusRemote,
  adminDeleteUserRemote,
  adminUpsertUserRemote,
} from "@/utils/remoteApi";
import { useAdminUserManagementQuery } from "@/hooks/domain/useAdminUserManagementQuery";
import { invalidateByPrefix } from "@/lib/query/invalidate";
import TableSkeleton from "@/components/feedback/TableSkeleton";

const EMPTY_USERS: User[] = [];
const EMPTY_CLASSES: { id: string; name: string }[] = [];

export default function UserManagement() {
  const me = useAuthStore((s) => s.getMe());
  const [activeTab, setActiveTab] = useState<UserRole>("student");
  const [query, setQuery] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Partial<User> | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const { data, isLoading, isRefreshing, error } = useAdminUserManagementQuery(me?.id, activeTab);
  const users = data?.users ?? EMPTY_USERS;
  const classes = data?.classes ?? EMPTY_CLASSES;

  const classNameMap = useMemo(
    () => new Map(classes.map((item) => [item.id, item.name])),
    [classes],
  );

  const filteredUsers = users.filter((u) => {
    if (classFilter && u.classId !== classFilter) return false;
    if (!query) return true;
    const s = query.toLowerCase();
    return (
      u.displayName.toLowerCase().includes(s) ||
      u.schoolNo.toLowerCase().includes(s) ||
      u.phone.includes(s)
    );
  });

  const handleDelete = async (id: string) => {
    if (!me) return;
    if (!confirm("确定要删除该用户吗？此操作不可恢复。")) return;
    try {
      await adminDeleteUserRemote(me.id, id);
      invalidateByPrefix("admin", me.id, ["users", "stats", "classes"]);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "删除用户失败");
    }
  };

  const handleSaveUser = async () => {
    if (!me || !editingUser) return;
    try {
      if (!editingUser.schoolNo || !editingUser.displayName) {
        alert("请填写必填项");
        return;
      }
      const payload: Partial<User> & { role: User["role"] } = { ...editingUser, role: activeTab };
      await adminUpsertUserRemote(me.id, payload);
      setIsEditOpen(false);
      invalidateByPrefix("admin", me.id, ["users", "stats", "classes"]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "保存用户失败");
    }
  };

  const handleBatchStatus = async (status: "active" | "disabled") => {
    if (!me) return;
    if (selectedIds.size === 0) return;
    try {
      await adminBatchUpdateUserStatusRemote(me.id, Array.from(selectedIds), status);
      invalidateByPrefix("admin", me.id, ["users", "stats"]);
    } catch (e) {
      alert(e instanceof Error ? e.message : "批量更新状态失败");
    }
  };

  const handleBatchDelete = async () => {
    if (!me) return;
    if (selectedIds.size === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.size} 个用户吗？此操作不可恢复。`)) return;
    try {
      await Promise.all(Array.from(selectedIds).map((id) => adminDeleteUserRemote(me.id, id)));
      invalidateByPrefix("admin", me.id, ["users", "stats", "classes"]);
      setSelectedIds(new Set());
    } catch (e) {
      alert(e instanceof Error ? e.message : "批量删除用户失败");
    }
  };

  const toggleSelection = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUsers.map((u) => u.id)));
    }
  };

  const allSelected = filteredUsers.length > 0 && selectedIds.size === filteredUsers.length;
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < filteredUsers.length;

  const getStatusLabel = (s: string) => {
    return s === "active" ? "启用" : "禁用";
  };

  const getGenderLabel = (g: string | undefined) => {
    if (g === "male") return "男";
    if (g === "female") return "女";
    return "-";
  };

  if (isLoading && !data) {
    return <TableSkeleton title="用户管理" columns={activeTab === "teacher" || activeTab === "student" ? 7 : 6} />;
  }

  if (error && !data) {
    return <Card className="px-4 py-10 text-center text-sm text-red-600">{error.message || "加载用户失败"}</Card>;
  }

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-zinc-900">用户管理</h1>
          {isRefreshing ? <span className="text-xs text-zinc-500">正在刷新...</span> : null}
        </div>
        <div className="flex gap-2">
           {selectedIds.size > 0 && (
             <>
               <Button variant="secondary" onClick={() => handleBatchStatus("active")}>
                 <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                 启用 ({selectedIds.size})
               </Button>
               <Button variant="secondary" onClick={() => handleBatchStatus("disabled")}>
                 <XCircle className="mr-2 h-4 w-4 text-red-600" />
                 禁用 ({selectedIds.size})
               </Button>
               <Button variant="secondary" className="text-red-700 hover:bg-red-50" onClick={handleBatchDelete}>
                 <Trash2 className="mr-2 h-4 w-4" />
                 删除 ({selectedIds.size})
               </Button>
             </>
           )}
           <Button onClick={() => setIsImportOpen(true)}>
             <Upload className="mr-2 h-4 w-4" />
             批量导入{activeTab === "student" ? "学生" : activeTab === "teacher" ? "教师" : "管理员"}
           </Button>
           <Button onClick={() => { setEditingUser({}); setIsEditOpen(true); }}>
             <Plus className="mr-2 h-4 w-4" />
             新建{activeTab === "student" ? "学生" : activeTab === "teacher" ? "教师" : "管理员"}
           </Button>
        </div>
      </div>

      <div className="border-b border-zinc-200">
        <nav className="-mb-px flex gap-6">
          {(["student", "teacher", "admin"] as const).map((role) => (
            <button
              key={role}
              onClick={() => setActiveTab(role)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                activeTab === role
                  ? "border-blue-600 text-blue-600"
                  : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
              }`}
            >
              {role === "student" ? "学生列表" : role === "teacher" ? "教师列表" : "管理员列表"}
            </button>
          ))}
        </nav>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
          <Input
            placeholder="搜索姓名、学号/工号..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {activeTab === "student" && (
          <Select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="w-40"
          >
            <option value="">所有班级</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium w-10">
                  <input
                    type="checkbox"
                    className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    checked={allSelected}
                    ref={(input) => {
                      if (input) input.indeterminate = isIndeterminate;
                    }}
                    onChange={toggleAll}
                  />
                </th>
                <th className="px-4 py-3 font-medium">学号/工号</th>
                <th className="px-4 py-3 font-medium">姓名</th>
                <th className="px-4 py-3 font-medium">状态</th>
                <th className="px-4 py-3 font-medium">年龄/性别</th>
                {activeTab === "teacher" && <th className="px-4 py-3 font-medium">教学信息</th>}
                {activeTab === "student" && <th className="px-4 py-3 font-medium">班级</th>}
                <th className="px-4 py-3 font-medium text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredUsers.map((u) => (
                <tr key={u.id} className="hover:bg-zinc-50/50 cursor-pointer" onClick={() => toggleSelection(u.id)}>
                  <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedIds.has(u.id)}
                      onChange={() => toggleSelection(u.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-zinc-600">{u.schoolNo}</td>
                  <td className="px-4 py-3 font-medium text-zinc-900">{u.displayName}</td>
                  <td className="px-4 py-3">
                    <Tag tone={u.status === "active" ? "green" : "red"}>
                      {getStatusLabel(u.status)}
                    </Tag>
                  </td>
                  <td className="px-4 py-3 text-zinc-600">
                    {u.age ? `${u.age}岁` : "-"} / {getGenderLabel(u.gender)}
                  </td>
                  {activeTab === "teacher" && (
                    <td className="px-4 py-3 text-zinc-600">
                      {u.gradeLevel ? `${u.gradeLevel}年级` : ""} {SUBJECTS.find(s => s.id === u.subjectId)?.name}
                    </td>
                  )}
                  {activeTab === "student" && (
                    <td className="px-4 py-3 text-zinc-600">
                      {classNameMap.get(u.classId || "") || "-"}
                    </td>
                  )}
                  <td className="px-4 py-3 text-right flex justify-end gap-2">
                    <Button variant="ghost" size="sm" onClick={() => { setEditingUser(u); setIsEditOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:bg-red-50" onClick={() => handleDelete(u.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                    暂无用户数据
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <UserImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        role={activeTab}
        onSuccess={() => {
          if (!me) return;
          invalidateByPrefix("admin", me.id, ["users", "stats", "classes"]);
        }}
      />

      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title={`${editingUser?.id ? "编辑" : "新建"}${activeTab === "student" ? "学生" : activeTab === "teacher" ? "教师" : "管理员"}`}
      >
        <div className="space-y-4">
          <div className="grid gap-2">
            <label className="text-sm font-medium">学号/工号 <span className="text-red-500">*</span></label>
            <Input
              value={editingUser?.schoolNo || ""}
              onChange={(e) => setEditingUser(prev => ({ ...prev, schoolNo: e.target.value }))}
              placeholder="请输入唯一编号"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">姓名 <span className="text-red-500">*</span></label>
            <Input
              value={editingUser?.displayName || ""}
              onChange={(e) => setEditingUser(prev => ({ ...prev, displayName: e.target.value }))}
              placeholder="请输入姓名"
            />
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">密码</label>
            <Input
              value={editingUser?.password || ""}
              onChange={(e) => setEditingUser(prev => ({ ...prev, password: e.target.value }))}
              placeholder="默认 OexTest#2026!A1"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
                <label className="text-sm font-medium">年龄</label>
                <Input
                type="number"
                value={editingUser?.age || ""}
                onChange={(e) => setEditingUser(prev => ({ ...prev, age: Number(e.target.value) }))}
                />
            </div>
            <div className="grid gap-2">
                <label className="text-sm font-medium">性别</label>
                <Select
                    value={editingUser?.gender || ""}
                    onChange={(e) => setEditingUser(prev => ({ ...prev, gender: e.target.value as User["gender"] }))}
                >
                    <option value="">请选择</option>
                    <option value="male">男</option>
                    <option value="female">女</option>
                </Select>
            </div>
          </div>
          <div className="grid gap-2">
            <label className="text-sm font-medium">状态</label>
            <Select
                value={editingUser?.status || "active"}
                onChange={(e) => setEditingUser(prev => ({ ...prev, status: e.target.value as User["status"] }))}
            >
                <option value="active">启用</option>
                <option value="disabled">禁用</option>
            </Select>
          </div>

          {activeTab === "student" && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">班级</label>
                <Select
                  value={editingUser?.classId || ""}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, classId: e.target.value }))}
                >
                  <option value="">未分配</option>
                  {classes.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              </div>
          )}

          {activeTab === "teacher" && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">年级 (数字)</label>
                <Input
                  type="number"
                  value={editingUser?.gradeLevel || ""}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, gradeLevel: Number(e.target.value) }))}
                  placeholder="例如：7 代表七年级"
                />
              </div>
          )}

          {activeTab === "teacher" && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">学科</label>
                <Select
                  value={editingUser?.subjectId || ""}
                  onChange={(e) => setEditingUser(prev => ({ ...prev, subjectId: e.target.value }))}
                >
                  <option value="">无</option>
                  {SUBJECTS.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </Select>
              </div>
          )}
          
          <div className="flex justify-end gap-2 pt-4 border-t border-zinc-200">
            <Button variant="secondary" onClick={() => setIsEditOpen(false)}>取消</Button>
            <Button onClick={handleSaveUser}>保存</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
