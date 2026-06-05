import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { getUsers, createUser, updateUser, deleteUser, resetPassword, getMenuPermissions, updateMenuPermissions, type UserSummary, type UserRole, type MenuPermission } from '../../api/users'
import { useAuth } from '../../context/useAuth'
import PageHeader from '../../components/PageHeader'

function apiError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return e.response.data.error
  return e instanceof Error ? e.message : String(e)
}

const ROLE_LABELS: Record<string, string> = { ADMIN: '관리자', MANAGER: '매니저', MEMBER: '팀원', EXTERNAL: '외부팀원' }
const MENU_LABELS: Record<string, string> = {
  change_requests: '변경 관리', deploys: '배포 관리', inventory: '인벤토리',
  meeting_minutes: '회의록', weekly_report: '주간보고', daily_check: '일일점검',
  finance: '손익 관리', system_mgmt: '시스템 관리', user_mgmt: '사용자 관리',
}
const ROLES: UserRole[] = ['ADMIN', 'MANAGER', 'MEMBER', 'EXTERNAL']
const MENU_KEYS = Object.keys(MENU_LABELS)

const emptyForm = { username: '', name: '', dept: '', email: '', role: 'MEMBER' as UserRole }

export default function UserManagementPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const isMember = user?.role === 'MEMBER'

  const [tab, setTab] = useState<'users' | 'menus'>('users')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<UserSummary | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [createdInfo, setCreatedInfo] = useState<{ username: string; tempPassword: string } | null>(null)
  const [menuEdits, setMenuEdits] = useState<Record<string, boolean>>({})
  const [menuDirty, setMenuDirty] = useState(false)

  const { data: users = [] } = useQuery({ queryKey: ['users'], queryFn: getUsers })
  const { data: menuPerms = [] } = useQuery({ queryKey: ['menu-permissions'], queryFn: getMenuPermissions, enabled: tab === 'menus' })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['users'] })

  const createMut = useMutation({
    mutationFn: createUser,
    onSuccess: (data) => {
      invalidate()
      setShowForm(false)
      setForm(emptyForm)
      if (data.tempPassword) setCreatedInfo({ username: data.username, tempPassword: data.tempPassword })
    },
    onError: (e: unknown) => alert('생성 실패: ' + apiError(e)),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Parameters<typeof updateUser>[1] }) => updateUser(id, data),
    onSuccess: () => { invalidate(); setShowForm(false); setEditing(null) },
    onError: (e: unknown) => alert('수정 실패: ' + apiError(e)),
  })
  const deleteMut = useMutation({
    mutationFn: deleteUser,
    onSuccess: invalidate,
  })
  const resetMut = useMutation({
    mutationFn: resetPassword,
    onSuccess: (data) => {
      if (data.tempPassword) setCreatedInfo({ username: data.username, tempPassword: data.tempPassword })
    },
    onError: (e: unknown) => alert('초기화 실패: ' + apiError(e)),
  })
  const menuMut = useMutation({
    mutationFn: (data: MenuPermission[]) => updateMenuPermissions(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-permissions'] }); setMenuDirty(false) },
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, role: isMember ? 'EXTERNAL' : 'MEMBER' })
    setShowForm(true)
  }
  const openEdit = (u: UserSummary) => {
    setEditing(u)
    setForm({ username: u.username, name: u.name ?? '', dept: u.dept ?? '', email: u.email ?? '', role: u.role })
    setShowForm(true)
  }

  const submit = () => {
    if (!form.username) return
    if (editing) {
      updateMut.mutate({ id: editing.id, data: { name: form.name, dept: form.dept, email: form.email, role: form.role } })
    } else {
      createMut.mutate({ username: form.username, name: form.name, dept: form.dept, email: form.email, role: form.role })
    }
  }

  const allowedRoles: UserRole[] = isMember ? ['EXTERNAL'] : user?.role === 'ADMIN' ? ROLES : ['MANAGER', 'MEMBER', 'EXTERNAL']

  // 메뉴 권한 편집 초기화
  const initMenuEdits = () => {
    const map: Record<string, boolean> = {}
    menuPerms.forEach(p => { map[`${p.role}__${p.menuKey}`] = p.enabled })
    setMenuEdits(map)
    setMenuDirty(false)
  }

  const saveMenuPerms = () => {
    const updates: MenuPermission[] = Object.entries(menuEdits).map(([key, enabled]) => {
      const [role, menuKey] = key.split('__')
      return { role, menuKey, enabled }
    })
    menuMut.mutate(updates)
  }

  return (
    <div style={s.page}>
      {createdInfo && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>계정 생성 완료</h3>
            <p style={{ fontSize: 13, marginBottom: 8 }}>이메일로 임시 비밀번호가 발송되었습니다.</p>
            <div style={s.infoBox}>
              <div>아이디: <strong>{createdInfo.username}</strong></div>
              <div>임시 비밀번호: <strong>{createdInfo.tempPassword}</strong></div>
            </div>
            <button style={{ ...s.btn, marginTop: 16, width: '100%' }} onClick={() => setCreatedInfo(null)}>확인</button>
          </div>
        </div>
      )}

      <PageHeader
        title="사용자 관리"
        action={
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdminOrManager && (
              <button style={{ ...s.btn, background: tab === 'menus' ? '#1976d2' : '#1a1a2e' }}
                onClick={() => { setTab(tab === 'menus' ? 'users' : 'menus'); if (tab !== 'menus') setTimeout(initMenuEdits, 100) }}>
                {tab === 'menus' ? '사용자 목록' : '메뉴 권한 설정'}
              </button>
            )}
            <button style={s.btn} onClick={openCreate}>+ 사용자 추가</button>
          </div>
        }
      />

      {tab === 'menus' && isAdminOrManager ? (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>역할별 메뉴 접근 권한</h3>
            <button style={s.btn} onClick={saveMenuPerms} disabled={!menuDirty}>저장</button>
          </div>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>메뉴</th>
                {ROLES.map(r => <th key={r} style={s.th}>{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {MENU_KEYS.map(menuKey => (
                <tr key={menuKey} style={s.tr}>
                  <td style={s.td}>{MENU_LABELS[menuKey]}</td>
                  {ROLES.map(role => {
                    const key = `${role}__${menuKey}`
                    const val = menuEdits[key] ?? menuPerms.find(p => p.role === role && p.menuKey === menuKey)?.enabled ?? false
                    return (
                      <td key={role} style={{ ...s.td, textAlign: 'center' }}>
                        <input type="checkbox" checked={val}
                          onChange={e => { setMenuEdits(prev => ({ ...prev, [key]: e.target.checked })); setMenuDirty(true) }} />
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          {showForm && (
            <div style={s.card}>
              <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>{editing ? '사용자 수정' : '사용자 추가'}</h3>
              <div style={s.grid}>
                <label style={s.label}>아이디</label>
                <input style={s.input} value={form.username} disabled={!!editing}
                  onChange={e => setForm({ ...form, username: e.target.value })} placeholder="로그인 아이디" />
                <label style={s.label}>이름</label>
                <input style={s.input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="성명" />
                <label style={s.label}>부서</label>
                <input style={s.input} value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })} placeholder="소속 부서" />
                <label style={s.label}>이메일</label>
                <input style={s.input} type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="이메일 (임시 비밀번호 발송)" />
                <label style={s.label}>역할</label>
                <select style={s.input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}>
                  {allowedRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                </select>
              </div>
              {(createMut.isPending || updateMut.isPending) && (
                <div style={s.progressBar}><div style={s.progressFill} /></div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <button style={s.btnSecondary} onClick={() => { setShowForm(false); setEditing(null) }}
                  disabled={createMut.isPending || updateMut.isPending}>취소</button>
                <button style={{ ...s.btn, opacity: (createMut.isPending || updateMut.isPending) ? 0.6 : 1 }}
                  onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
                  {createMut.isPending || updateMut.isPending ? '처리 중...' : '저장'}
                </button>
              </div>
            </div>
          )}

          <div style={s.card}>
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>아이디</th>
                  <th style={s.th}>이름</th>
                  <th style={s.th}>부서</th>
                  <th style={s.th}>이메일</th>
                  <th style={s.th}>역할</th>
                  <th style={s.th}>상태</th>
                  <th style={s.th}>가입일</th>
                  {isAdminOrManager && <th style={s.th}>액션</th>}
                </tr>
              </thead>
              <tbody>
                {users.length === 0 && <tr><td colSpan={8} style={s.empty}>사용자가 없습니다</td></tr>}
                {users.map(u => (
                  <tr key={u.id} style={s.tr}>
                    <td style={{ ...s.td, fontWeight: 600 }}>{u.username}</td>
                    <td style={s.td}>{u.name ?? '-'}</td>
                    <td style={s.td}>{u.dept ?? '-'}</td>
                    <td style={s.td}>{u.email ?? '-'}</td>
                    <td style={s.td}><span style={{ ...s.roleTag, ...roleStyle(u.role) }}>{ROLE_LABELS[u.role]}</span></td>
                    <td style={s.td}>
                      <span style={{ color: u.active ? '#276749' : '#e53e3e', fontSize: 12 }}>
                        {u.active ? '활성' : '비활성'}
                      </span>
                      {u.mustChangePassword && <span style={{ marginLeft: 6, fontSize: 11, color: '#e69900' }}>비번변경필요</span>}
                    </td>
                    <td style={s.td}>{u.createdAt?.slice(0, 10)}</td>
                    {isAdminOrManager && (
                      <td style={s.td}>
                        <button style={s.btnSm} onClick={() => openEdit(u)}>수정</button>
                        <button style={{ ...s.btnSm, color: '#d97706' }}
                          onClick={() => { if (confirm(`${u.username} 비밀번호를 초기화하시겠습니까?`)) resetMut.mutate(u.id) }}>
                          비번초기화
                        </button>
                        <button style={{ ...s.btnSm, color: '#e53e3e' }}
                          onClick={() => { if (confirm(`${u.username} 계정을 삭제하시겠습니까?`)) deleteMut.mutate(u.id) }}>
                          삭제
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function roleStyle(role: string): React.CSSProperties {
  if (role === 'ADMIN') return { background: '#fff0f0', color: '#c53030' }
  if (role === 'MANAGER') return { background: '#ebf8ff', color: '#2b6cb0' }
  if (role === 'MEMBER') return { background: '#f0fff4', color: '#276749' }
  return { background: '#fafafa', color: '#888' }
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 40px' },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24, marginBottom: 16 },
  btn: { padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSecondary: { padding: '8px 16px', background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  grid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: 500, color: '#555' },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  thead: { background: '#f7f8fa' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 14px', fontSize: 13 },
  roleTag: { padding: '2px 8px', borderRadius: 4, fontSize: 12 },
  empty: { padding: 32, textAlign: 'center' as const, color: '#aaa', fontSize: 13 },
  progressBar: { height: 3, background: '#e2e8f0', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#1a1a2e', borderRadius: 2, animation: 'progress 1.2s ease-in-out infinite', width: '40%' },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 8, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  infoBox: { background: '#f7f8fa', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 16px', fontSize: 14, display: 'flex', flexDirection: 'column' as const, gap: 6 },
}
