import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { useAuth } from './context/useAuth'
import LoginPage from './pages/Login'
import DashboardPage from './pages/Dashboard'
import ChangeRequestPage from './pages/ChangeRequest'
import DeployRequestPage from './pages/DeployRequest'
import InventoryPage from './pages/Inventory'
import FinancePage from './pages/Finance'
import MeetingMinutesPage from './pages/MeetingMinutes'
import WeeklyReportPage from './pages/WeeklyReport'
import DailyCheckPage from './pages/DailyCheck'
import Layout from './components/Layout'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Layout />
              </PrivateRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="requests" element={<ChangeRequestPage />} />
            <Route path="deploys" element={<DeployRequestPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="reports/meeting" element={<MeetingMinutesPage />} />
            <Route path="reports/weekly" element={<WeeklyReportPage />} />
            <Route path="reports/daily" element={<DailyCheckPage />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
