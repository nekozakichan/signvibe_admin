import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

import LoginPage from './pages/auth/LoginPage';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import ManageTeachers from './pages/admin/ManageTeachers';

// Teacher
import TeacherDashboard from './pages/teacher/TeacherDashboard';
import StudentsList from './pages/teacher/StudentsList';
import StudentProgress from './pages/teacher/StudentProgress';
import ClassOverview from './pages/teacher/ClassOverview';
import ManageModules from './pages/teacher/ManageModules';
import Reports from './pages/teacher/Reports';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />

          {/* Admin routes */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute allowedRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/teachers"
            element={
              <ProtectedRoute allowedRole="admin">
                <ManageTeachers />
              </ProtectedRoute>
            }
          />

          {/* Teacher routes */}
          <Route
            path="/teacher/dashboard"
            element={
              <ProtectedRoute allowedRole="teacher">
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/students"
            element={
              <ProtectedRoute allowedRole="teacher">
                <StudentsList />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/students/:studentId/progress"
            element={
              <ProtectedRoute allowedRole="teacher">
                <StudentProgress />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/class-overview"
            element={
              <ProtectedRoute allowedRole="teacher">
                <ClassOverview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/modules"
            element={
              <ProtectedRoute allowedRole="teacher">
                <ManageModules />
              </ProtectedRoute>
            }
          />
          <Route
            path="/teacher/reports"
            element={
              <ProtectedRoute allowedRole="teacher">
                <Reports />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}