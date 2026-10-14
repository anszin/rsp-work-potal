import { Suspense, useState } from 'react'
import type { ComponentType } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import {
  ClipboardCheck, FileText, GitPullRequest, LayoutDashboard, ListTodo, LogOut, Moon,
  NotebookPen, Package, Rocket, Settings, Sparkles, Sun, Target, Wallet,
} from 'lucide-react'
import {
  SidebarProvider,
  SidebarPrimitive,
  SidebarHeader,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarInset,
  SidebarTrigger,
  useSidebar,
} from '@lotte/rsp-react-design-system/shadcn'
import { useAuth } from '../../context/useAuth'
import { useTheme } from '../../context/useTheme'
import AiGate from '../ai/AiGate'
import { Loading } from '../ui'

type Icon = ComponentType<{ className?: string }>

const MENU_ITEMS: { key: string; to: string; label: string; icon: Icon }[] = [
  { key: 'change_requests', to: '/requests',       label: '변경 관리', icon: GitPullRequest },
  { key: 'deploys',         to: '/deploys',         label: '배포 관리', icon: Rocket },
  { key: 'inventory',       to: '/inventory',       label: '인벤토리',  icon: Package },
  { key: 'meeting_minutes', to: '/reports/meeting', label: '회의록',    icon: NotebookPen },
  { key: 'weekly_report',   to: '/reports/weekly',  label: '주간보고',  icon: FileText },
  { key: 'daily_check',     to: '/reports/daily',   label: '일일점검',  icon: ClipboardCheck },
  { key: 'finance',         to: '/finance',         label: '손익 관리', icon: Wallet },
  { key: 'key_tasks',      to: '/key-tasks',       label: '중점과제',  icon: Target },
  { key: 'todos',          to: '/todos',           label: 'To-Do',     icon: ListTodo },
]

const AI_ITEMS = [
  { to: '/ai',           label: 'AI 어시스턴트' },
  { to: '/ai/documents', label: 'RAG 문서' },
  { to: '/ai/knowledge', label: '지식베이스 현황' },
  { to: '/ai/prompts',   label: '프롬프트 관리' },
]

const SETTINGS_ITEMS = [
  { key: 'system_mgmt',     to: '/admin/systems',        label: '시스템 관리' },
  { key: 'user_mgmt',       to: '/admin/users',          label: '사용자 관리' },
  { key: 'notifications',   to: '/admin/notifications',  label: '공지 발송' },
]

// 정확히 일치해야 활성인 경로 (하위 경로에서 상위 메뉴까지 함께 강조되지 않도록)
const EXACT_PATHS = ['/', '/ai']
const SIDEBAR_STORAGE_KEY = 'sidebar_open'

function isActivePath(pathname: string, to: string) {
  if (EXACT_PATHS.includes(to)) return pathname === to
  return pathname === to || pathname.startsWith(to + '/')
}

function readSidebarOpen() {
  try { return localStorage.getItem(SIDEBAR_STORAGE_KEY) !== 'false' } catch { return true }
}

// 레이아웃 — RSP 디자인시스템 SDK Sidebar
// 데스크톱: 펼침(220px) / 접힘(아이콘만 48px, 상태 localStorage 유지), 모바일(767px 이하): SDK Sheet
export default function Layout() {
  const [open, setOpen] = useState(readSidebarOpen)
  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    try { localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next)) } catch { /* 저장 실패 무시 */ }
  }

  return (
    <SidebarProvider open={open} onOpenChange={handleOpenChange} style={{ '--sidebar-width': '220px' } as React.CSSProperties}>
      <PortalSidebar />
      {/* 모바일에서만 표시되는 메뉴 열기 버튼 (index.css .sidebar-mobile-trigger) */}
      <SidebarTrigger className="sidebar-mobile-trigger" aria-label="메뉴" />
      <SidebarInset className="layout-main">
        {/* 페이지 지연 로딩 중에도 사이드바는 유지 */}
        <Suspense fallback={<Loading style={{ minHeight: '60vh' }} />}>
          <Outlet />
        </Suspense>
      </SidebarInset>
    </SidebarProvider>
  )
}

function PortalSidebar() {
  const { user, menuPermissions, logout } = useAuth()
  const { theme, toggle } = useTheme()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { isMobile, setOpenMobile, state, setOpen } = useSidebar()
  const collapsed = state === 'collapsed' && !isMobile

  const [settingsOpen, setSettingsOpen] = useState(SETTINGS_ITEMS.some(item => pathname.startsWith(item.to)))
  const [aiOpen, setAiOpen] = useState(pathname.startsWith('/ai'))

  const visibleSettings = SETTINGS_ITEMS.filter(({ key }) => menuPermissions[key] !== false)
  const handleLogout = () => { logout(); navigate('/login') }
  // 모바일 Sheet 는 메뉴 이동 시 닫기
  const closeMobile = () => { if (isMobile) setOpenMobile(false) }
  // 접힌 상태에서 그룹을 누르면 사이드바를 펼치고 그룹을 연다
  const toggleGroup = (setter: (fn: (o: boolean) => boolean) => void) => () => {
    if (collapsed) { setOpen(true); setter(() => true) } else setter(o => !o)
  }

  return (
    <SidebarPrimitive collapsible="icon" className="portal-sidebar">
      <SidebarHeader style={collapsed ? styles.logoCollapsed : styles.logo}>
        {!collapsed && <span>업무 포탈</span>}
        {/* 데스크톱 접기/펼치기 버튼 (Ctrl+B 단축키도 동작) */}
        {!isMobile && <SidebarTrigger className="sidebar-collapse-btn" aria-label={collapsed ? '사이드바 펼치기' : '사이드바 접기'} />}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <NavItem to="/" label="대시보드" icon={LayoutDashboard} pathname={pathname} onNavigate={closeMobile} />
            {MENU_ITEMS.map(({ key, to, label, icon }) =>
              menuPermissions[key] !== false && <NavItem key={key} to={to} label={label} icon={icon} pathname={pathname} onNavigate={closeMobile} />
            )}

            <AiGate>
              <NavGroup label="AI 기능" icon={Sparkles} open={aiOpen} active={pathname.startsWith('/ai')} onToggle={toggleGroup(setAiOpen)}>
                {AI_ITEMS.map(({ to, label }) => (
                  <NavSubItem key={to} to={to} label={label} pathname={pathname} onNavigate={closeMobile} />
                ))}
              </NavGroup>
            </AiGate>

            {visibleSettings.length > 0 && (
              <NavGroup label="설정" icon={Settings} open={settingsOpen} active={visibleSettings.some(s => pathname.startsWith(s.to))} onToggle={toggleGroup(setSettingsOpen)}>
                {visibleSettings.map(({ key, to, label }) => (
                  <NavSubItem key={key} to={to} label={label} pathname={pathname} onNavigate={closeMobile} />
                ))}
              </NavGroup>
            )}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter style={collapsed ? styles.userSectionCollapsed : styles.userSection}>
        {collapsed ? (
          // 접힘: 테마 전환·로그아웃 아이콘만
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={theme === 'light' ? '다크 모드' : '라이트 모드'} onClick={toggle}>
                {theme === 'light' ? <Moon /> : <Sun />}
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="로그아웃" onClick={handleLogout}>
                <LogOut />
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        ) : (
          <>
            <div style={{ fontSize: 13, color: 'var(--rsp-color-neutral-50)' }}>{user?.name || user?.username}</div>
            {user?.dept && <div style={{ fontSize: 11, color: 'var(--rsp-color-neutral-500)' }}>{user.dept}</div>}
            <div style={{ fontSize: 11, color: 'var(--rsp-color-neutral-700)' }}>{user?.role}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button type="button" style={styles.themeBtn} onClick={toggle} title={theme === 'light' ? '다크 모드' : '라이트 모드'}>
                {theme === 'light' ? '🌙' : '☀️'}
              </button>
              <button type="button" style={styles.logoutBtn} onClick={handleLogout}>로그아웃</button>
            </div>
          </>
        )}
      </SidebarFooter>
    </SidebarPrimitive>
  )
}

interface NavProps { to: string; label: string; pathname: string; onNavigate: () => void }

// tooltip: 접힌(아이콘) 상태에서만 SDK 가 메뉴 이름을 툴팁으로 표시
function NavItem({ to, label, icon: IconComp, pathname, onNavigate }: NavProps & { icon: Icon }) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        tooltip={label}
        isActive={isActivePath(pathname, to)}
        render={<NavLink to={to} end={EXACT_PATHS.includes(to)} onClick={onNavigate} />}
      >
        <IconComp />
        <span>{label}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function NavSubItem({ to, label, pathname, onNavigate }: NavProps) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        isActive={isActivePath(pathname, to)}
        render={<NavLink to={to} end={EXACT_PATHS.includes(to)} onClick={onNavigate} />}
      >
        {label}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function NavGroup({ label, icon: IconComp, open, active, onToggle, children }: {
  label: string; icon: Icon; open: boolean; active: boolean; onToggle: () => void; children: React.ReactNode
}) {
  return (
    <SidebarMenuItem>
      {/* 접힘 상태에서는 하위 메뉴가 숨겨지므로, 그룹 내 페이지에 있으면 그룹 아이콘을 활성 표시 */}
      <SidebarMenuButton tooltip={label} onClick={onToggle} aria-expanded={open} isActive={active && !open}>
        <IconComp />
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{ fontSize: 11, opacity: 0.7 }}>{open ? '▲' : '▼'}</span>
      </SidebarMenuButton>
      {open && <SidebarMenuSub>{children}</SidebarMenuSub>}
    </SidebarMenuItem>
  )
}

const styles: Record<string, React.CSSProperties> = {
  logo: {
    padding: '20px 12px 20px 20px', fontSize: 17, fontWeight: 700, color: 'var(--rsp-color-neutral-50)',
    borderBottom: '1px solid var(--rsp-color-neutral-800)', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  logoCollapsed: { padding: '20px 0', borderBottom: '1px solid var(--rsp-color-neutral-800)', alignItems: 'center' },
  userSection: { padding: '16px 20px', borderTop: '1px solid var(--rsp-color-neutral-800)', gap: 4 },
  userSectionCollapsed: { padding: '8px 0', borderTop: '1px solid var(--rsp-color-neutral-800)' },
  themeBtn: { background: 'transparent', border: '1px solid var(--rsp-color-neutral-700)', borderRadius: 4, padding: '5px 8px', cursor: 'pointer', fontSize: 14 },
  logoutBtn: { flex: 1, background: 'transparent', border: '1px solid var(--rsp-color-neutral-700)', color: 'var(--rsp-color-neutral-500)', borderRadius: 4, padding: '6px 12px', cursor: 'pointer', fontSize: 13 },
}
