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
const CREATABLE_ROLES: UserRole[] = ['MANAGER', 'MEMBER', 'EXTERNAL']
const MENU_KEYS = Object.keys(MENU_LABELS)

const emptyForm = { username: '', name: '', dept: '', email: '', role: 'MEMBER' as UserRole, redmineUserId: '' }

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
  const [menuSaved, setMenuSaved] = useState(false)
  const menuMut = useMutation({
    mutationFn: (data: MenuPermission[]) => updateMenuPermissions(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['menu-permissions'] })
      setMenuDirty(false)
      setMenuSaved(true)
      setTimeout(() => setMenuSaved(false), 2500)
    },
    onError: (e: unknown) => alert('저장 실패: ' + apiError(e)),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, role: isMember ? 'EXTERNAL' : 'MEMBER' })
    setShowForm(true)
  }
  const openEdit = (u: UserSummary) => {
    setEditing(u)
    setForm({ username: u.username, name: u.name ?? '', dept: u.dept ?? '', email: u.email ?? '', role: u.role, redmineUserId: u.redmineUserId != null ? String(u.redmineUserId) : '' })
    setShowForm(true)
  }

  const submit = () => {
    if (!form.username) return
    if (editing) {
      const redmineUserId = form.redmineUserId !== '' ? Number(form.redmineUserId) : null
      updateMut.mutate({ id: editing.id, data: { name: form.name, dept: form.dept, email: form.email, role: form.role, redmineUserId } })
    } else {
      createMut.mutate({ username: form.username, name: form.name, dept: form.dept, email: form.email, role: form.role })
    }
  }

  // 편집 시 역할 선택 목록 (ADMIN 제외, MEMBER는 EXTERNAL만)
  const editableRoles: UserRole[] = isMember ? ['EXTERNAL'] : CREATABLE_ROLES

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
    <div className="page-wrap">
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 15 }}>역할별 메뉴 접근 권한</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {menuSaved && <span style={{ fontSize: 13, color: '#276749' }}>저장되었습니다 ✓</span>}
              <button style={{ ...s.btn, opacity: (!menuDirty || menuMut.isPending) ? 0.6 : 1 }}
                onClick={saveMenuPerms} disabled={!menuDirty || menuMut.isPending}>
                {menuMut.isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
          <div className="table-scroll">
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
                <label style={s.label}>레드마인 ID</label>
                <input style={s.input} type="number" value={form.redmineUserId} onChange={e => setForm({ ...form, redmineUserId: e.target.value })} placeholder="레드마인 사용자 ID (숫자)" />
                {editing && (
                  <>
                    <label style={s.label}>역할</label>
                    <select style={s.input} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as UserRole })}>
                      {editableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </select>
                  </>
                )}
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
            <div className="table-scroll">
            <table style={s.table}>
              <thead>
                <tr style={s.thead}>
                  <th style={s.th}>아이디</th>
                  <th style={s.th}>이름</th>
                  <th style={s.th}>부서</th>
                  <th style={s.th}>이메일</th>
                  <th style={s.th}>레드마인ID</th>
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
                    <td style={{ ...s.td, color: u.redmineUserId ? 'var(--c-text)' : 'var(--c-text-muted)', fontSize: 12 }}>{u.redmineUserId ?? '-'}</td>
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
          </div>
        </>
      )}
    </div>
  )
}

function roleStyle(role: string): React.CSSProperties {
  if (role === 'ADMIN') return { background: '#fff0f0', color: '#c53030' }
  if (role === 'MANAGER') return { background: 'var(--c-tag-sys)', color: 'var(--c-tag-sys-t)' }
  if (role === 'MEMBER') return { background: 'var(--c-tag-sub)', color: 'var(--c-tag-sub-t)' }
  return { background: 'var(--c-bg)', color: 'var(--c-text-muted)' }
}

const s: Record<string, React.CSSProperties> = {
  card: { background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, padding: 24, marginBottom: 16 },
  btn: { padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSecondary: { padding: '8px 16px', background: 'var(--c-card)', color: 'var(--c-text-sub)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid var(--c-border-in)', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  grid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--c-text-sub)' },
  input: { padding: '8px 10px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' as const },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  thead: { background: 'var(--c-thead)' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', borderBottom: '1px solid var(--c-border)' },
  tr: { borderBottom: '1px solid var(--c-border-in)' },
  td: { padding: '10px 14px', fontSize: 13 },
  roleTag: { padding: '2px 8px', borderRadius: 4, fontSize: 12 },
  empty: { padding: 32, textAlign: 'center' as const, color: 'var(--c-text-muted)', fontSize: 13 },
  progressBar: { height: 3, background: 'var(--c-border)', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', background: '#1a1a2e', borderRadius: 2, animation: 'progress 1.2s ease-in-out infinite', width: '40%' },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--c-card)', borderRadius: 8, padding: 24, width: 400, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  infoBox: { background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '12px 16px', fontSize: 14, display: 'flex', flexDirection: 'column' as const, gap: 6 },
}
