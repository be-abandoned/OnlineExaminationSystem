import { useParams, useNavigate } from "react-router-dom";
import QuestionEditor from "@/components/questions/QuestionEditor";
import { QuestionType } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button";
import { teacherUpsertQuestionRemote } from "@/utils/remoteApi";

export default function TeacherQuestionCreate() {
  const { type } = useParams<{ type: string }>();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.getMe());

  const handleSave = async (data: any) => {
    if (!me) return;
    await teacherUpsertQuestionRemote(me.id, data);
    navigate("/teacher/questions");
  };

  if (!me) return null;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate("/teacher/questions")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
      </div>
      <QuestionEditor 
        defaultType={(type as QuestionType) || "single"} 
        onSave={handleSave} 
      />
    </div>
  );
}
