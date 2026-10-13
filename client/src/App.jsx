import { BrowserRouter, Navigate, Route, Routes } from 'react-router';
import AuthProvider from './auth/AuthProvider';
import { useAuth, HOME_BY_ROLE } from './auth/auth';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import StudentHome from './pages/student/StudentHome';
import TakeExam from './pages/student/TakeExam';
import { Results, ResultDetail } from './pages/student/Results';
import TeacherHome from './pages/teacher/TeacherHome';
import QuestionBank from './pages/teacher/QuestionBank';
import Exams from './pages/teacher/Exams';
import ExamBuilder from './pages/teacher/ExamBuilder';
import ExamResults from './pages/teacher/ExamResults';
import GradeAttempt from './pages/teacher/GradeAttempt';
import AdminHome from './pages/admin/AdminHome';
import { Departments, Courses, Subjects, Semesters } from './pages/admin/AcademicPages';
import Staff from './pages/admin/Staff';
import Assignments from './pages/admin/Assignments';

// "/" shows the landing page to visitors and sends logged-in users to their own dashboard
function Home() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  return user ? <Navigate to={HOME_BY_ROLE[user.role]} replace /> : <Landing />;
}

// Unknown URLs go to the user's dashboard, or the landing page when logged out
function RootRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="page-loading">Loading…</div>;
  return <Navigate to={user ? HOME_BY_ROLE[user.role] : '/'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route element={<Layout />}>
              <Route path="/admin" element={<AdminHome />} />
              <Route path="/admin/departments" element={<Departments />} />
              <Route path="/admin/courses" element={<Courses />} />
              <Route path="/admin/semesters" element={<Semesters />} />
              <Route path="/admin/subjects" element={<Subjects />} />
              <Route path="/admin/staff" element={<Staff />} />
              <Route path="/admin/assignments" element={<Assignments />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['TEACHER']} />}>
            <Route element={<Layout />}>
              <Route path="/teacher" element={<TeacherHome />} />
              <Route path="/teacher/questions" element={<QuestionBank />} />
              <Route path="/teacher/exams" element={<Exams />} />
              <Route path="/teacher/exams/:id" element={<ExamBuilder />} />
              <Route path="/teacher/exams/:id/results" element={<ExamResults />} />
              <Route path="/teacher/grading/:id" element={<GradeAttempt />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={['STUDENT']} />}>
            <Route element={<Layout />}>
              <Route path="/student" element={<StudentHome />} />
              <Route path="/student/results" element={<Results />} />
              <Route path="/student/results/:id" element={<ResultDetail />} />
            </Route>
            {/* Full screen, outside the sidebar layout */}
            <Route path="/student/exam/:id" element={<TakeExam />} />
          </Route>

          <Route path="*" element={<RootRedirect />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
