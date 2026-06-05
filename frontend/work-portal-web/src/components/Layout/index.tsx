import { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

const MENU_ITEMS = [
  { key: 'change_requests', to: '/requests',       label: '변경 관리' },
  { key: 'deploys',         to: '/deploys',         label: '배포 관리' },
  { key: 'inventory',       to: '/inventory',       label: '인벤토리' },
  { key: 'meeting_minutes', to: '/reports/meeting', label: '회의록' },
  { key: 'weekly_report',   to: '/reports/weekly',  label: '주간보고' },
  { key: 'daily_check',     to: '/reports/daily',   label: '일일점검' },
  { key: 'finance',         to: '/finance',         label: '손익 관리' },
]

const SETTINGS_ITEMS = [
  { key: 'system_mgmt', to: '/admin/systems', label: '시스템 관리' },
  { key: 'user_mgmt',   to: '/admin/users',   label: '사용자 관리' },
]

export default function Layout() {
  const { user, menuPermissions, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const isInSettings = SETTINGS_ITEMS.some(item => location.pathname.startsWith(item.to))
  const [settingsOpen, setSettingsOpen] = useState(isInSettings)

  const visibleSettings = SETTINGS_ITEMS.filter(({ key }) => menuPermissions[key] !== false)

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div style={styles.container}>
      <aside style={styles.sidebar}>
        <div style={styles.logo}>업무 포탈</div>
        <nav style={styles.nav}>
          <NavItem to="/">대시보드</NavItem>
          {MENU_ITEMS.map(({ key, to, label }) =>
            menuPermissions[key] !== false && <NavItem key={key} to={to}>{label}</NavItem>
          )}

          {visibleSettings.length > 0 && (
            <>
              <button style={styles.groupHeader} onClick={() => setSettingsOpen(o => !o)}>
                <span>설정</span>
                <span style={{ fontSize: 10, opacity: 0.7 }}>{settingsOpen ? '▲' : '▼'}</span>
              </button>
              {settingsOpen && visibleSettings.map(({ key, to, label }) => (
                <NavItem key={key} to={to} indent>{label}</NavItem>
              ))}
            </>
          )}
        </nav>
        <div style={styles.userSection}>
          <div style={{ fontSize: 13, color: '#fff' }}>{user?.name || user?.username}</div>
          {user?.dept && <div style={{ fontSize: 11, color: '#718096' }}>{user.dept}</div>}
          <div style={{ fontSize: 11, color: '#4a5568' }}>{user?.role}</div>
          <button style={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
        </div>
      </aside>
      <main style={styles.main}>
        <Outlet />
      </main>
    </div>
  )
}

function NavItem({ to, children, indent }: { to: string; children: React.ReactNode; indent?: boolean }) {
  return (
    <NavLink to={to} end={to === '/'}
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
  container: { display: 'flex', minHeight: '100vh' },
  sidebar: { width: 220, background: '#1a1a2e', display: 'flex', flexDirection: 'column', position: 'fixed', top: 0, left: 0, height: '100vh' },
  logo: { padding: '24px 20px', fontSize: 17, fontWeight: 700, color: '#fff', borderBottom: '1px solid #2d3748' },
  nav: { flex: 1, padding: '12px 0', display: 'flex', flexDirection: 'column', overflowY: 'auto' },
  groupHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 20px', margin: '2px 8px', fontSize: 14, fontWeight: 400,
    color: '#a0aec0', background: 'transparent', border: 'none', borderRadius: 4,
    cursor: 'pointer',
  },
  userSection: { padding: '16px 20px', borderTop: '1px solid #2d3748', display: 'flex', flexDirection: 'column', gap: 4 },
  logoutBtn: { background: 'transparent', border: '1px solid #4a5568', color: '#a0aec0', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 13, marginTop: 8 },
  main: { flex: 1, marginLeft: 220, minHeight: '100vh', background: '#f7f8fa' },
}
