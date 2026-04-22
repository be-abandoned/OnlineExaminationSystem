import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import RequireAuth from "@/components/auth/RequireAuth";
import Login from "@/pages/auth/Login";
import NotFound from "@/pages/NotFound";
import RoleIndex from "@/pages/RoleIndex";
import StudentLayout from "@/pages/student/StudentLayout";
import StudentAttempt from "@/pages/student/StudentAttempt";
import StudentDashboard from "@/pages/student/StudentDashboard";
import StudentExam from "@/pages/student/StudentExam";
import StudentMessages from "@/pages/student/StudentMessages";
import StudentProfile from "@/pages/student/StudentProfile";
import StudentResultDetail from "@/pages/student/StudentResultDetail";
import TeacherDashboard from "@/pages/teacher/TeacherDashboard";
import TeacherExamEdit from "@/pages/teacher/TeacherExamEdit";
import TeacherExams from "@/pages/teacher/TeacherExams";
import TeacherGrading from "@/pages/teacher/TeacherGrading";
import TeacherLayout from "@/pages/teacher/TeacherLayout";
import TeacherMessages from "@/pages/teacher/TeacherMessages";
import TeacherProfile from "@/pages/teacher/TeacherProfile";
import QuestionBankList from "@/pages/teacher/QuestionBankList";
import TeacherQuestionCreate from "@/pages/teacher/TeacherQuestionCreate";
import TeacherQuestionEdit from "@/pages/teacher/TeacherQuestionEdit";
import AdminLayout from "@/pages/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import UserManagement from "@/pages/admin/UserManagement";
import ClassManagement from "@/pages/admin/ClassManagement";

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<RoleIndex />} />
        <Route path="/login" element={<Login />} />

        <Route
          path="/student"
          element={
            <RequireAuth role="student">
              <StudentLayout />
            </RequireAuth>
          }
        >
          <Route index element={<StudentDashboard />} />
          <Route path="exams/:examId" element={<StudentExam />} />
          <Route path="attempts/:attemptId" element={<StudentAttempt />} />
          <Route path="results/:attemptId" element={<StudentResultDetail />} />
          <Route path="messages" element={<StudentMessages />} />
          <Route path="profile" element={<StudentProfile />} />
        </Route>

        <Route
          path="/teacher"
          element={
            <RequireAuth role="teacher">
              <TeacherLayout />
            </RequireAuth>
          }
        >
          <Route index element={<TeacherDashboard />} />
          <Route path="questions" element={<QuestionBankList />} />
          <Route path="questions/create/:type" element={<TeacherQuestionCreate />} />
          <Route path="questions/:id" element={<TeacherQuestionEdit />} />
          <Route path="exams" element={<TeacherExams />} />
          <Route path="exams/:examId/edit" element={<TeacherExamEdit />} />
          <Route path="exams/:examId/grading" element={<TeacherGrading />} />
          <Route path="messages" element={<TeacherMessages />} />
          <Route path="profile" element={<TeacherProfile />} />
        </Route>

        <Route
          path="/admin"
          element={
            <RequireAuth role="admin">
              <AdminLayout />
            </RequireAuth>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="classes" element={<ClassManagement />} />
          <Route path="users" element={<UserManagement />} />
        </Route>

        <Route path="/other" element={<Navigate to="/" replace />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
