import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { getUsers, createUser, updateUser, deleteUser, resetPassword, getMenuPermissions, updateMenuPermissions, type UserSummary, type UserRole, type MenuPermission } from '../../api/users'
import { useAuth } from '../../context/useAuth'
import PageHeader from '../../components/PageHeader'
import { Button, Input, Select, Modal, Table, TableHeader, TableBody, TableRow, TableHead, TableCell, Panel, Tag, EmptyState, Checkbox } from '../../components/ui'

function apiError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return e.response.data.error
  return e instanceof Error ? e.message : String(e)
}

const ROLE_LABELS: Record<string, string> = { ADMIN: '관리자', MANAGER: '매니저', MEMBER: '팀원', EXTERNAL: '외부팀원' }
const MENU_LABELS: Record<string, string> = {
  change_requests: '변경 관리', deploys: '배포 관리', inventory: '인벤토리',
  meeting_minutes: '회의록', weekly_report: '주간보고', daily_check: '일일점검',
  finance: '손익 관리', key_tasks: '중점과제', todos: 'To-Do', system_mgmt: '시스템 관리',
  user_mgmt: '사용자 관리', notifications: '공지 발송',
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
        <Modal open onClose={() => setCreatedInfo(null)} title="계정 생성 완료" width={400} closeOnEscape={false} showCloseButton={false}>
            <p style={{ fontSize: 13, marginBottom: 8 }}>이메일로 임시 비밀번호가 발송되었습니다.</p>
            <div style={s.infoBox}>
              <div>아이디: <strong>{createdInfo.username}</strong></div>
              <div>임시 비밀번호: <strong>{createdInfo.tempPassword}</strong></div>
            </div>
            <Button variant="filled" style={{ marginTop: 16, width: '100%' }} onClick={() => setCreatedInfo(null)}>확인</Button>
        </Modal>
      )}

      <PageHeader
        title="사용자 관리"
        actions={
          <div style={{ display: 'flex', gap: 8 }}>
            {isAdminOrManager && (
              <Button variant="outlined"
                onClick={() => { setTab(tab === 'menus' ? 'users' : 'menus'); if (tab !== 'menus') setTimeout(initMenuEdits, 100) }}>
                {tab === 'menus' ? '사용자 목록' : '메뉴 권한 설정'}
              </Button>
            )}
            <Button variant="filled" onClick={openCreate}>+ 사용자 추가</Button>
          </div>
        }
      />

      {tab === 'menus' && isAdminOrManager ? (
        <Panel style={{ display: 'block', padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ margin: 0, fontSize: 16 }}>역할별 메뉴 접근 권한</h3>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {menuSaved && <span style={{ fontSize: 13, color: 'var(--c-tag-done-t)' }}>저장되었습니다 ✓</span>}
              <Button variant="filled" style={{ opacity: (!menuDirty || menuMut.isPending) ? 0.6 : 1 }}
                onClick={saveMenuPerms} disabled={!menuDirty || menuMut.isPending}>
                {menuMut.isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
          </div>
          <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={s.th}>메뉴</TableHead>
                {ROLES.map(r => <TableHead key={r} style={s.th}>{ROLE_LABELS[r]}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {MENU_KEYS.map(menuKey => (
                <TableRow key={menuKey}>
                  <TableCell>{MENU_LABELS[menuKey]}</TableCell>
                  {ROLES.map(role => {
                    const key = `${role}__${menuKey}`
                    const val = menuEdits[key] ?? menuPerms.find(p => p.role === role && p.menuKey === menuKey)?.enabled ?? false
                    return (
                      <TableCell key={role} style={{ textAlign: 'center' }}>
                        <Checkbox checked={val}
                          onCheckedChange={c => { setMenuEdits(prev => ({ ...prev, [key]: c })); setMenuDirty(true) }} />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
          </div>
        </Panel>
      ) : (
        <>
          {showForm && (
            <Panel style={{ display: 'block', padding: 24, marginBottom: 16 }}>
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{editing ? '사용자 수정' : '사용자 추가'}</h3>
              <div style={s.grid}>
                <label style={s.label}>아이디</label>
                <Input value={form.username} disabled={!!editing}
                  onChange={e => setForm({ ...form, username: e.target.value })} placeholder="로그인 아이디" />
                <label style={s.label}>이름</label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="성명" />
                <label style={s.label}>부서</label>
                <Input value={form.dept} onChange={e => setForm({ ...form, dept: e.target.value })} placeholder="소속 부서" />
                <label style={s.label}>이메일</label>
                <Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="이메일 (임시 비밀번호 발송)" />
                <label style={s.label}>레드마인 ID</label>
                <Input type="number" value={form.redmineUserId} onChange={e => setForm({ ...form, redmineUserId: e.target.value })} placeholder="레드마인 사용자 ID (숫자)" />
                {editing && (
                  <>
                    <label style={s.label}>역할</label>
                    <Select style={{ width: '100%' }} value={form.role} onValueChange={v => setForm({ ...form, role: v as UserRole })}>
                      {editableRoles.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                    </Select>
                  </>
                )}
              </div>
              {(createMut.isPending || updateMut.isPending) && (
                <div style={s.progressBar}><div style={s.progressFill} /></div>
              )}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                <Button variant="outlined" onClick={() => { setShowForm(false); setEditing(null) }}
                  disabled={createMut.isPending || updateMut.isPending}>취소</Button>
                <Button variant="filled" style={{ opacity: (createMut.isPending || updateMut.isPending) ? 0.6 : 1 }}
                  onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
                  {createMut.isPending || updateMut.isPending ? '처리 중...' : '저장'}
                </Button>
              </div>
            </Panel>
          )}

          <Panel style={{ display: 'block', marginBottom: 16 }}>
            <div className="table-scroll">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead style={s.th}>아이디</TableHead>
                  <TableHead style={s.th}>이름</TableHead>
                  <TableHead style={s.th}>부서</TableHead>
                  <TableHead style={s.th}>이메일</TableHead>
                  <TableHead style={s.th}>레드마인ID</TableHead>
                  <TableHead style={s.th}>역할</TableHead>
                  <TableHead style={s.th}>상태</TableHead>
                  <TableHead style={s.th}>가입일</TableHead>
                  {isAdminOrManager && <TableHead style={s.th}>액션</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.length === 0 && <TableRow><TableCell colSpan={8}><EmptyState title="사용자가 없습니다" /></TableCell></TableRow>}
                {users.map(u => (
                  <TableRow key={u.id}>
                    <TableCell style={{ fontWeight: 600 }}>{u.username}</TableCell>
                    <TableCell>{u.name ?? '-'}</TableCell>
                    <TableCell>{u.dept ?? '-'}</TableCell>
                    <TableCell>{u.email ?? '-'}</TableCell>
                    <TableCell style={{ color: u.redmineUserId ? 'var(--c-text)' : 'var(--c-text-muted)', fontSize: 12 }}>{u.redmineUserId ?? '-'}</TableCell>
                    <TableCell><Tag {...roleColors(u.role)}>{ROLE_LABELS[u.role]}</Tag></TableCell>
                    <TableCell>
                      <span style={{ color: u.active ? 'var(--c-tag-done-t)' : 'var(--c-tag-err-t)', fontSize: 12 }}>
                        {u.active ? '활성' : '비활성'}
                      </span>
                      {u.mustChangePassword && <span style={{ marginLeft: 6, fontSize: 11, color: 'var(--c-tag-warn-t)' }}>비번변경필요</span>}
                    </TableCell>
                    <TableCell>{u.createdAt?.slice(0, 10)}</TableCell>
                    {isAdminOrManager && (
                      <TableCell>
                        <Button variant="outlined" size="sm" onClick={() => openEdit(u)}>수정</Button>
                        <Button variant="outlined" size="sm" style={{ color: 'var(--c-tag-warn-t)' }}
                          onClick={() => { if (confirm(`${u.username} 비밀번호를 초기화하시겠습니까?`)) resetMut.mutate(u.id) }}>
                          비번초기화
                        </Button>
                        <Button variant="outlined" size="sm" style={{ color: 'var(--c-tag-err-t)' }}
                          onClick={() => { if (confirm(`${u.username} 계정을 삭제하시겠습니까?`)) deleteMut.mutate(u.id) }}>
                          삭제
                        </Button>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}

// 역할별 태그 색 (글자 / 배경)
function roleColors(role: string): { color: string; bg: string } {
  if (role === 'ADMIN') return { bg: 'var(--c-tag-err-bg)', color: 'var(--c-tag-err-t)' }
  if (role === 'MANAGER') return { bg: 'var(--c-tag-sys)', color: 'var(--c-tag-sys-t)' }
  if (role === 'MEMBER') return { bg: 'var(--c-tag-sub)', color: 'var(--c-tag-sub-t)' }
  return { bg: 'var(--c-bg)', color: 'var(--c-text-muted)' }
}

const s: Record<string, React.CSSProperties> = {
  btnSecondary: { padding: '8px 16px', background: 'var(--c-card)', color: 'var(--c-text-sub)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid var(--c-border-in)', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  grid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--c-text-sub)' },
  th: { textAlign: 'left' as const },
  progressBar: { height: 3, background: 'var(--c-border)', borderRadius: 2, marginTop: 12, overflow: 'hidden' },
  progressFill: { height: '100%', background: 'var(--c-action)', borderRadius: 2, animation: 'progress 1.2s ease-in-out infinite', width: '40%' },
  infoBox: { background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '12px 16px', fontSize: 14, display: 'flex', flexDirection: 'column' as const, gap: 6 },
}
