import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useTheme } from '../../context/useTheme'

const MENU_ITEMS = [
  { key: 'change_requests', to: '/requests',       label: '변경 관리' },
  { key: 'deploys',         to: '/deploys',         label: '배포 관리' },
  { key: 'inventory',       to: '/inventory',       label: '인벤토리' },
  { key: 'meeting_minutes', to: '/reports/meeting', label: '회의록' },
  { key: 'weekly_report',   to: '/reports/weekly',  label: '주간보고' },
  { key: 'daily_check',     to: '/reports/daily',   label: '일일점검' },
  { key: 'finance',         to: '/finance',         label: '손익 관리' },
  { key: 'key_tasks',      to: '/key-tasks',       label: '중점과제' },
]

const SETTINGS_ITEMS = [
  { key: 'system_mgmt', to: '/admin/systems', label: '시스템 관리' },
  { key: 'user_mgmt',   to: '/admin/users',   label: '사용자 관리' },
]

export default function Layout() {
  const { user, menuPermissions, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const isInSettings = SETTINGS_ITEMS.some(item => location.pathname.startsWith(item.to))
  const [settingsOpen, setSettingsOpen] = useState(isInSettings)

  const visibleSettings = SETTINGS_ITEMS.filter(({ key }) => menuPermissions[key] !== false)
  const handleLogout = () => { logout(); navigate('/login') }
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="layout-container">
      <button className="hamburger-btn" onClick={() => setSidebarOpen(o => !o)} aria-label="메뉴">☰</button>
      <div className={`sidebar-overlay${sidebarOpen ? ' open' : ''}`} onClick={closeSidebar} />
      <aside className={`layout-sidebar${sidebarOpen ? ' open' : ''}`}>
        <div style={styles.logo}>업무 포탈</div>
        <nav style={styles.nav}>
          <NavItem to="/" onClick={closeSidebar}>대시보드</NavItem>
          {MENU_ITEMS.map(({ key, to, label }) =>
            menuPermissions[key] !== false && <NavItem key={key} to={to} onClick={closeSidebar}>{label}</NavItem>
          )}
          {visibleSettings.length > 0 && (
            <>
              <button style={styles.groupHeader} onClick={() => setSettingsOpen(o => !o)}>
                <span>설정</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{settingsOpen ? '▲' : '▼'}</span>
              </button>
              {settingsOpen && visibleSettings.map(({ key, to, label }) => (
                <NavItem key={key} to={to} indent onClick={closeSidebar}>{label}</NavItem>
              ))}
            </>
          )}
        </nav>
        <div style={styles.userSection}>
          <div style={{ fontSize: 13, color: '#fff' }}>{user?.name || user?.username}</div>
          {user?.dept && <div style={{ fontSize: 11, color: '#718096' }}>{user.dept}</div>}
          <div style={{ fontSize: 11, color: '#4a5568' }}>{user?.role}</div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <button style={styles.themeBtn} onClick={toggle} title={theme === 'light' ? '다크 모드' : '라이트 모드'}>
              {theme === 'light' ? '🌙' : '☀️'}
            </button>
            <button style={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
          </div>
        </div>
      </aside>
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({ to, children, indent, onClick }: { to: string; children: React.ReactNode; indent?: boolean; onClick?: () => void }) {
  return (
    <NavLink to={to} end={to === '/'} onClick={onClick}
      style={({ isActive }) => ({
        ...navItemStyle,
        paddingLeft: indent ? 32 : 20,
        background: isActive ? '#2d3748' : 'transparent',
        color: isActive ? '#fff' : '#a0aec0',
      })}>
      {indent && <span style={{ marginRight: 6, opacity: 0.5 }}>└</span>}
      {children}
    </NavLink>
  )
}

const navItemStyle: React.CSSProperties = {
  padding: '10px 20px', fontSize: 14, textDecoration: 'none',
  borderRadius: 4, margin: '2px 8px', display: 'block',
}

const styles: Record<string, React.CSSProperties> = {
  logo: { padding: '24px 20px', fontSize: 17, fontWeight: 700, color: '#fff', borderBottom: '1px solid #2d3748' },
  nav: { flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  groupHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 20px', margin: '2px 8px', fontSize: 14, fontWeight: 400,
    color: '#a0aec0', background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer',
  },
  userSection: { padding: '16px 20px', borderTop: '1px solid #2d3748', display: 'flex', flexDirection: 'column', gap: 4 },
  themeBtn: { background: 'transparent', border: '1px solid #4a5568', borderRadius: 4, padding: '5px 8px', cursor: 'pointer', fontSize: 14 },
  logoutBtn: { flex: 1, background: 'transparent', border: '1px solid #4a5568', color: '#a0aec0', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 13 },
}
