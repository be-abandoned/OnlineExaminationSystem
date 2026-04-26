import { useState, useRef, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { adminListClassesRemote, adminBatchImportUsersRemote } from "@/utils/remoteApi";
import { User, UserRole, SUBJECTS, Class } from "@/types/domain";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import * as XLSX from "xlsx";
import { Download, Upload, AlertCircle, CheckCircle, XCircle } from "lucide-react";

interface UserImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  role: UserRole;
  onSuccess: () => void;
}

const GRADE_MAP: Record<string, number> = {
  一年级: 1,
  二年级: 2,
  三年级: 3,
  四年级: 4,
  五年级: 5,
  六年级: 6,
  七年级: 7,
  八年级: 8,
  九年级: 9,
  高一: 10,
  高二: 11,
  高三: 12,
};

export default function UserImportModal({ isOpen, onClose, role, onSuccess }: UserImportModalProps) {
  const me = useAuthStore((s) => s.getMe());
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<Partial<User>[]>([]);
  const [importResult, setImportResult] = useState<{
    successCount: number;
    failCount: number;
    errors: string[];
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [classes, setClasses] = useState<Class[]>([]);

  useEffect(() => {
    const loadClasses = async () => {
      if (!me || role !== "student") return;
      try {
        const list = await adminListClassesRemote(me.id);
        setClasses(list);
      } catch (e) {
        console.error("加载班级失败", e);
      }
    };

    if (isOpen) {
      setFile(null);
      setPreviewData([]);
      setImportResult(null);
      void loadClasses();
    }
  }, [isOpen, me, role]);

  const getTemplateHeader = () => {
    const common = ["学号/工号", "初始密码", "姓名", "年龄", "性别(male/female)", "状态(active/disabled)"];
    if (role === "teacher") {
      return [...common, "年级(数字)", "学科ID(如math)"];
    }
    if (role === "student") {
      return [...common, "班级"];
    }
    return common;
  };

  const downloadTemplate = () => {
    const header = getTemplateHeader();
    const ws = XLSX.utils.aoa_to_sheet([header]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "用户导入模板");
    XLSX.writeFile(wb, `${role}_import_template.xlsx`);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

        if (jsonData.length < 2) {
          alert("文件为空或格式错误");
          return;
        }

        const headers = jsonData[0]; // 第一行为表头
        const rows = jsonData.slice(1);

        const parsed: Partial<User>[] = rows.map((row) => {
          // 映射逻辑：按列索引
          // 0: schoolNo, 1: password, 2: displayName, 3: age, 4: gender, 5: status
          // teacher: 6: gradeLevel, 7: subjectId
          // student: 6: gradeLevel

          const rawGender = String(row[4] || "").trim();
          let gender: "male" | "female" | undefined;
          if (rawGender === "男" || rawGender === "male") gender = "male";
          else if (rawGender === "女" || rawGender === "female") gender = "female";

          const rawStatus = String(row[5] || "").trim();
          let status: "active" | "disabled" = "active";
          if (rawStatus === "disabled" || rawStatus === "禁用") status = "disabled";

          const u: Partial<User> = {
            role,
            schoolNo: String(row[0] || ""),
            password: String(row[1] || "OexTest#2026!A1"),
            displayName: String(row[2] || ""),
            age: row[3] ? Number(row[3]) : undefined,
            gender,
            status,
          };

          if (role === "teacher") {
            if (row[6]) u.gradeLevel = Number(row[6]);
            const rawSubject = String(row[7] || "").trim();
            if (rawSubject) {
              const foundSubject = SUBJECTS.find((s) => s.name === rawSubject || s.id === rawSubject);
              u.subjectId = foundSubject ? foundSubject.id : rawSubject;
            }
          } else if (role === "student") {
            const rawClass = String(row[6] || "").trim();
            if (rawClass) {
              // 1. 尝试匹配班级名称
              const matchedClass = classes.find((c) => c.name === rawClass);
              if (matchedClass) {
                u.classId = matchedClass.id;
                u.gradeLevel = matchedClass.gradeLevel;
              } else {
                // 2. 尝试匹配年级文本
                // 先看是否纯数字
                if (!isNaN(Number(rawClass))) {
                  u.gradeLevel = Number(rawClass);
                } else {
                  // 尝试从文本中提取年级关键词
                  for (const [key, val] of Object.entries(GRADE_MAP)) {
                    if (rawClass.includes(key)) {
                      u.gradeLevel = val;
                      break;
                    }
                  }
                }
              }
            }
          }

          return u;
        });

        setPreviewData(parsed.filter((u) => u.schoolNo)); // 过滤空行
      } catch (err) {
        console.error(err);
        alert("解析失败，请检查文件格式");
      }
    };
    reader.readAsBinaryString(f);
  };

  const handleImport = async () => {
    if (!me || previewData.length === 0) return;
    const res = await adminBatchImportUsersRemote(me.id, previewData);
    setImportResult(res);
    if (res.failCount === 0) {
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } else {
        onSuccess(); // 部分成功也刷新列表
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`批量导入${role === "admin" ? "管理员" : role === "teacher" ? "教师" : "学生"}`}>
      <div className="space-y-4">
        <div className="flex gap-4">
          <Button variant="secondary" onClick={downloadTemplate}>
            <Download className="mr-2 h-4 w-4" />
            下载模板
          </Button>
          <div className="relative">
             <input
                type="file"
                accept=".xlsx, .xls"
                className="hidden"
                ref={fileInputRef}
                onChange={handleFileChange}
             />
             <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                选择文件上传
             </Button>
          </div>
        </div>

        {file && (
            <div className="text-sm text-zinc-600">
                已选择: {file.name} (解析出 {previewData.length} 条数据)
            </div>
        )}

        {importResult && (
            <div className={`p-4 rounded-md ${importResult.failCount > 0 ? "bg-red-50" : "bg-green-50"}`}>
                <div className="flex items-center gap-2 mb-2">
                    {importResult.failCount > 0 ? (
                        <AlertCircle className="h-5 w-5 text-red-600" />
                    ) : (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                    )}
                    <span className="font-medium">
                        导入完成：成功 {importResult.successCount} 条，失败 {importResult.failCount} 条
                    </span>
                </div>
                {importResult.errors.length > 0 && (
                    <ul className="list-disc list-inside text-sm text-red-600 max-h-32 overflow-y-auto">
                        {importResult.errors.map((e, i) => (
                            <li key={i}>{e}</li>
                        ))}
                    </ul>
                )}
            </div>
        )}

        {!importResult && previewData.length > 0 && (
            <div className="max-h-60 overflow-y-auto border rounded-md">
                <table className="w-full text-sm text-left">
                    <thead className="bg-zinc-50 sticky top-0">
                        <tr>
                            <th className="p-2">工号/学号</th>
                            <th className="p-2">姓名</th>
                            <th className="p-2">密码</th>
                            <th className="p-2">状态</th>
                        </tr>
                    </thead>
                    <tbody>
                        {previewData.slice(0, 10).map((u, i) => (
                            <tr key={i} className="border-t">
                                <td className="p-2">{u.schoolNo}</td>
                                <td className="p-2">{u.displayName}</td>
                                <td className="p-2">{u.password}</td>
                                <td className="p-2">{u.status}</td>
                            </tr>
                        ))}
                        {previewData.length > 10 && (
                            <tr>
                                <td colSpan={4} className="p-2 text-center text-zinc-500">
                                    ...还有 {previewData.length - 10} 条...
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        )}

        <div className="flex justify-end gap-2 pt-4">
             <Button variant="secondary" onClick={onClose}>取消</Button>
             <Button onClick={handleImport} disabled={!file || previewData.length === 0 || !!importResult}>
                确认导入
             </Button>
        </div>
      </div>
    </Modal>
  );
}
