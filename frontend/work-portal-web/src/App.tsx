import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { useAuth } from './context/useAuth'
import { aiConfig } from './config/aiConfig'
import LoginPage from './pages/Login'
import ChangePasswordPage from './pages/ChangePassword'
import DashboardPage from './pages/Dashboard'
import ChangeRequestPage from './pages/ChangeRequest'
import DeployRequestPage from './pages/DeployRequest'
import InventoryPage from './pages/Inventory'
import FinancePage from './pages/Finance'
import MeetingMinutesPage from './pages/MeetingMinutes'
import WeeklyReportPage from './pages/WeeklyReport'
import DailyCheckPage from './pages/DailyCheck'
import SystemManagementPage from './pages/SystemManagement'
import UserManagementPage from './pages/UserManagement'
import KeyTaskPage from './pages/KeyTask'
import Layout from './components/Layout'
import AiChatPage from './pages/AiChat'
import AiDocumentsPage from './pages/AiDocuments'
import AiPromptsPage from './pages/AiPrompts'
import AiKnowledgePage from './pages/AiKnowledge'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
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
            <Route path="admin/systems" element={<SystemManagementPage />} />
            <Route path="admin/users" element={<UserManagementPage />} />
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
      </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  )
}
