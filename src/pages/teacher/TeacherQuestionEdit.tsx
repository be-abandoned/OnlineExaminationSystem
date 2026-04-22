import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import QuestionEditor from "@/components/questions/QuestionEditor";
import { Question } from "@/types/domain";
import { useAuthStore } from "@/stores/authStore";
import { ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button";
import {
  teacherDeleteQuestionRemote,
  teacherListQuestionsRemote,
  teacherUpsertQuestionRemote,
} from "@/utils/remoteApi";

export default function TeacherQuestionEdit() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const me = useAuthStore((s) => s.getMe());
  const [question, setQuestion] = useState<Question | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id && me) {
      loadQuestion(id);
    }
  }, [id, me]);

  const loadQuestion = async (qId: string) => {
    if (!me) return;
    setLoading(true);
    try {
      const all = await teacherListQuestionsRemote(me.id);
      const found = all.find((q) => q.id === qId);
      setQuestion(found || null);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (data: any) => {
    if (!me) return;
    await teacherUpsertQuestionRemote(me.id, { ...data, id: question?.id });
    navigate("/teacher/questions");
  };

  const handleDelete = async (qId: string) => {
    if (!me) return;
    await teacherDeleteQuestionRemote(me.id, qId);
    navigate("/teacher/questions");
  };

  if (!me) return null;
  if (loading) return <div className="p-8 text-center text-zinc-500">加载中...</div>;
  if (!question) return <div className="p-8 text-center text-zinc-500">未找到题目</div>;

  return (
    <div className="p-4 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center">
        <Button variant="ghost" onClick={() => navigate("/teacher/questions")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          返回列表
        </Button>
      </div>
      <QuestionEditor 
        initialQuestion={question}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
