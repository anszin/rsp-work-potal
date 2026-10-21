import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { useAuth } from './context/useAuth'
import { aiConfig } from './config/aiConfig'
import LoginPage from './pages/Login'
import Layout from './components/Layout'
import { Loading } from './components/ui'
// 페이지는 지연 로딩(code splitting) — 해당 화면 진입 시 내려받아 첫 로딩 용량 감소
// 로그인·레이아웃은 첫 화면에 필요하므로 즉시 로딩
const ChangePasswordPage = lazy(() => import('./pages/ChangePassword'))
const DashboardPage = lazy(() => import('./pages/Dashboard'))
const ChangeRequestPage = lazy(() => import('./pages/ChangeRequest'))
const DeployRequestPage = lazy(() => import('./pages/DeployRequest'))
const InventoryPage = lazy(() => import('./pages/Inventory'))
const FinancePage = lazy(() => import('./pages/Finance'))
const MeetingMinutesPage = lazy(() => import('./pages/MeetingMinutes'))
const WeeklyReportPage = lazy(() => import('./pages/WeeklyReport'))
const DailyCheckPage = lazy(() => import('./pages/DailyCheck'))
const SystemManagementPage = lazy(() => import('./pages/SystemManagement'))
const UserManagementPage = lazy(() => import('./pages/UserManagement'))
const KeyTaskPage = lazy(() => import('./pages/KeyTask'))
const TodoPage = lazy(() => import('./pages/Todo'))
const NotificationPage = lazy(() => import('./pages/Notification'))
const AiChatPage = lazy(() => import('./pages/AiChat'))
const AiDocumentsPage = lazy(() => import('./pages/AiDocuments'))
const AiPromptsPage = lazy(() => import('./pages/AiPrompts'))
const AiKnowledgePage = lazy(() => import('./pages/AiKnowledge'))
const UiShowcase = lazy(() => import('./pages/UiShowcase'))

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token, user } = useAuth()
  const { pathname } = useLocation()
  if (!token) return <Navigate to="/login" replace />
  // 새로고침 직후 user 가 로드되기 전에는 보호 화면을 그리지 않음 — 쿼리가 먼저 나가 403 을 받는 것을 방지 (R-011)
  if (!user) return <Loading style={{ minHeight: '60vh' }} />
  // 비밀번호 변경이 필요한 사용자는 변경 화면 외 진입 차단. 새로고침·URL 직접 입력도 refreshMe 로 복원된 user 로 막힘 (F-AUTH-001 R-007)
  if (user.mustChangePassword && pathname !== '/change-password') return <Navigate to="/change-password" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Suspense fallback={<Loading style={{ minHeight: '60vh' }} />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/ui" element={<UiShowcase />} />
          <Route path="/change-password" element={<PrivateRoute><ChangePasswordPage /></PrivateRoute>} />
          <Route
            path="/"
            element={<PrivateRoute><Layout /></PrivateRoute>}
          >
            <Route index element={<DashboardPage />} />
            <Route path="requests" element={<ChangeRequestPage />} />
            <Route path="deploys" element={<DeployRequestPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="reports/meeting" element={<MeetingMinutesPage />} />
            <Route path="reports/weekly" element={<WeeklyReportPage />} />
            <Route path="reports/daily" element={<DailyCheckPage />} />
            <Route path="key-tasks" element={<KeyTaskPage />} />
            <Route path="todos" element={<TodoPage />} />
            <Route path="admin/systems" element={<SystemManagementPage />} />
            <Route path="admin/users" element={<UserManagementPage />} />
            <Route path="admin/notifications" element={<NotificationPage />} />
            {aiConfig.enabled && (
              <Route path="ai" element={<AiChatPage />} />
            )}
            {aiConfig.enabled && (
              <Route path="ai/documents" element={<AiDocumentsPage />} />
            )}
            {aiConfig.enabled && (
              <Route path="ai/prompts" element={<AiPromptsPage />} />
            )}
            {aiConfig.enabled && (
              <Route path="ai/knowledge" element={<AiKnowledgePage />} />
            )}
          </Route>
        </Routes>
        </Suspense>
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
