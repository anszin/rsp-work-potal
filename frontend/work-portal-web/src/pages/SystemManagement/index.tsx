import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSystems, createSystem, updateSystem, deleteSystem, System,
  getSystemManagers, addSystemManager, removeSystemManager, getUsers,
  getSubSystems, createSubSystem, updateSubSystem, deleteSubSystem, SubSystem,
} from '../../api/systems'
import PageHeader from '../../components/PageHeader'

const emptyForm = () => ({ code: '', name: '', description: '', redmineProjectKey: '', webexRoomId: '' })
const emptySubForm = () => ({ code: '', name: '', description: '' })

export default function SystemManagementPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<System | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [managerPanel, setManagerPanel] = useState<System | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number>(0)
  const [subPanel, setSubPanel] = useState<System | null>(null)
  const [subForm, setSubForm] = useState(emptySubForm())
  const [editingSub, setEditingSub] = useState<SubSystem | null>(null)
  const [showSubForm, setShowSubForm] = useState(false)

  const { data: systems = [], isLoading } = useQuery({ queryKey: ['systems'], queryFn: getSystems })
  const { data: managers = [] } = useQuery({
    queryKey: ['systems', managerPanel?.id, 'managers'],
    queryFn: () => getSystemManagers(managerPanel!.id),
    enabled: !!managerPanel,
  })
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: !!managerPanel,
  })
  const { data: subSystems = [] } = useQuery({
    queryKey: ['systems', subPanel?.id, 'subsystems'],
    queryFn: () => getSubSystems(subPanel!.id),
    enabled: !!subPanel,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['systems'] })
  const invalidateManagers = () => qc.invalidateQueries({ queryKey: ['systems', managerPanel?.id, 'managers'] })
  const invalidateSubs = () => qc.invalidateQueries({ queryKey: ['systems', subPanel?.id, 'subsystems'] })

  const createMut = useMutation({ mutationFn: createSystem, onSuccess: () => { invalidate(); reset() } })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; description?: string; active?: boolean; redmineProjectKey?: string; webexRoomId?: string } }) =>
      updateSystem(id, data),
    onSuccess: () => { invalidate(); reset() },
  })
  const deleteMut = useMutation({ mutationFn: deleteSystem, onSuccess: invalidate })
  const addManagerMut = useMutation({
    mutationFn: ({ systemId, userId }: { systemId: number; userId: number }) => addSystemManager(systemId, userId),
    onSuccess: () => { invalidateManagers(); setSelectedUserId(0) },
  })
  const removeManagerMut = useMutation({
    mutationFn: ({ systemId, userId }: { systemId: number; userId: number }) => removeSystemManager(systemId, userId),
    onSuccess: invalidateManagers,
  })
  const createSubMut = useMutation({
    mutationFn: ({ systemId, data }: { systemId: number; data: { code: string; name: string; description?: string } }) =>
      createSubSystem(systemId, data),
    onSuccess: () => { invalidateSubs(); resetSubForm() },
    onError: (e: any) => alert(e.response?.data?.error ?? '하위시스템 등록 실패'),
  })
  const updateSubMut = useMutation({
    mutationFn: ({ systemId, subId, data }: { systemId: number; subId: number; data: { name: string; description?: string; active?: boolean } }) =>
      updateSubSystem(systemId, subId, data),
    onSuccess: () => { invalidateSubs(); resetSubForm() },
    onError: (e: any) => alert(e.response?.data?.error ?? '하위시스템 수정 실패'),
  })
  const deleteSubMut = useMutation({
    mutationFn: ({ systemId, subId }: { systemId: number; subId: number }) => deleteSubSystem(systemId, subId),
    onSuccess: invalidateSubs,
    onError: (e: any) => alert(e.response?.data?.error ?? '하위시스템 삭제 실패'),
  })

  const reset = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }
  const resetSubForm = () => { setShowSubForm(false); setEditingSub(null); setSubForm(emptySubForm()) }

  const openEdit = (s: System) => {
    setEditing(s)
    setForm({ code: s.code, name: s.name, description: s.description ?? '', redmineProjectKey: s.redmineProjectKey ?? '', webexRoomId: s.webexRoomId ?? '' })
    setShowForm(true)
  }

  const openSubEdit = (sub: SubSystem) => {
    setEditingSub(sub)
    setSubForm({ code: sub.code, name: sub.name, description: sub.description ?? '' })
    setShowSubForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) {
      updateMut.mutate({ id: editing.id, data: { name: form.name, description: form.description || undefined, redmineProjectKey: form.redmineProjectKey || undefined, webexRoomId: form.webexRoomId || undefined } })
    } else {
      createMut.mutate({ code: form.code, name: form.name, description: form.description || undefined, redmineProjectKey: form.redmineProjectKey || undefined, webexRoomId: form.webexRoomId || undefined })
    }
  }

  const handleSubSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!subPanel) return
    if (editingSub) {
      updateSubMut.mutate({ systemId: subPanel.id, subId: editingSub.id, data: { name: subForm.name, description: subForm.description || undefined } })
    } else {
      createSubMut.mutate({ systemId: subPanel.id, data: { code: subForm.code, name: subForm.name, description: subForm.description || undefined } })
    }
  }

  const toggleActive = (s: System) => {
    updateMut.mutate({ id: s.id, data: { name: s.name, active: !s.active } })
  }

  const toggleSubActive = (sub: SubSystem) => {
    if (!subPanel) return
    updateSubMut.mutate({ systemId: subPanel.id, subId: sub.id, data: { name: sub.name, active: !sub.active } })
  }

  const assignedUserIds = new Set(managers.map(m => m.userId))
  const availableUsers = users.filter(u => !assignedUserIds.has(u.id))

  return (
    <div style={s.page}>
      <PageHeader
        title="시스템 관리"
        action={<button onClick={() => { reset(); setShowForm(true) }} style={s.btn}>+ 시스템 등록</button>}
      />

      {showForm && (
        <div style={s.card}>
          <h3 style={{ margin: '0 0 16px', fontSize: 15 }}>{editing ? '시스템 수정' : '시스템 등록'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={s.grid}>
              {!editing && (
                <>
                  <label style={s.label}>시스템 코드 *</label>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    required placeholder="예: SYS003" style={s.input} />
                </>
              )}
              <label style={s.label}>시스템명 *</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required placeholder="시스템 이름" style={s.input} />
              <label style={s.label}>설명</label>
              <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="시스템 설명" style={s.input} />
              <label style={s.label}>레드마인 키</label>
              <input value={form.redmineProjectKey} onChange={e => setForm(f => ({ ...f, redmineProjectKey: e.target.value }))}
                placeholder="예: retail-platform" style={s.input} />
              <label style={s.label}>Webex Room ID</label>
              <input value={form.webexRoomId} onChange={e => setForm(f => ({ ...f, webexRoomId: e.target.value }))}
                placeholder="Webex 스페이스 Room ID" style={s.input} />
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button type="button" onClick={reset} style={s.btnSecondary}>취소</button>
              <button type="submit" style={s.btn}>{editing ? '수정' : '등록'}</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <p style={{ color: 'var(--c-text-muted)', padding: 16 }}>로딩 중...</p> : (
        <div style={s.card}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                {['코드', '시스템명', '설명', '상태', '등록일', ''].map(h => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {systems.length === 0 ? (
                <tr><td colSpan={6} style={s.empty}>등록된 시스템이 없습니다.</td></tr>
              ) : systems.map(sys => (
                <tr key={sys.id} style={s.tr}>
                  <td style={{ ...s.td, fontWeight: 600, color: '#1976d2' }}>{sys.code}</td>
                  <td style={{ ...s.td, fontWeight: 500 }}>{sys.name}</td>
                  <td style={{ ...s.td, color: 'var(--c-text-sub)' }}>{sys.description ?? '-'}</td>
                  <td style={s.td}>
                    <span onClick={() => toggleActive(sys)} style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: sys.active ? '#e8f5e9' : '#fafafa',
                      color: sys.active ? '#2e7d32' : '#999',
                      border: `1px solid ${sys.active ? '#a5d6a7' : '#ddd'}`,
                    }}>
                      {sys.active ? '운영중' : '비활성'}
                    </span>
                  </td>
                  <td style={{ ...s.td, color: 'var(--c-text-muted)' }}>
                    {new Date(sys.createdAt).toLocaleDateString('ko-KR')}
                  </td>
                  <td style={s.td}>
                    <button onClick={() => { setSubPanel(sys); resetSubForm() }} style={{ ...s.btnSm, color: '#00695c', borderColor: '#80cbc4' }}>하위시스템</button>
                    <button onClick={() => setManagerPanel(sys)} style={{ ...s.btnSm, color: '#4527a0', borderColor: '#b39ddb' }}>담당자</button>
                    <button onClick={() => openEdit(sys)} style={s.btnSm}>수정</button>
                    <button onClick={() => { if (confirm(`[${sys.code}] ${sys.name}을 삭제하시겠습니까?`)) deleteMut.mutate(sys.id) }}
                      style={{ ...s.btnSm, color: '#e53e3e' }}>삭제</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 하위시스템 패널 */}
      {subPanel && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 15 }}>{subPanel.name} 하위시스템 관리</h3>
              <button onClick={() => { setShowSubForm(true); setEditingSub(null); setSubForm(emptySubForm()) }}
                style={{ ...s.btn, padding: '6px 14px', fontSize: 12 }}>+ 추가</button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--c-text-muted)' }}>프론트엔드, 백엔드, API 등 구성 컴포넌트를 관리합니다.</p>

            {showSubForm && (
              <form onSubmit={handleSubSubmit} style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border-in)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr', gap: '10px 12px', alignItems: 'center', marginBottom: 10 }}>
                  {!editingSub && (
                    <>
                      <label style={s.label}>코드 *</label>
                      <input value={subForm.code} onChange={e => setSubForm(f => ({ ...f, code: e.target.value }))}
                        required placeholder="예: FRONTEND" style={{ ...s.input, fontSize: 12 }} />
                    </>
                  )}
                  <label style={s.label}>이름 *</label>
                  <input value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                    required placeholder="하위시스템 이름" style={{ ...s.input, fontSize: 12 }} />
                  <label style={s.label}>설명</label>
                  <input value={subForm.description} onChange={e => setSubForm(f => ({ ...f, description: e.target.value }))}
                    placeholder="설명" style={{ ...s.input, fontSize: 12 }} />
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button type="button" onClick={resetSubForm} style={{ ...s.btnSecondary, padding: '6px 12px', fontSize: 12 }}>취소</button>
                  <button type="submit" style={{ ...s.btn, padding: '6px 14px', fontSize: 12 }}>{editingSub ? '수정' : '등록'}</button>
                </div>
              </form>
            )}

            {subSystems.length === 0 ? (
              <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 하위시스템이 없습니다.</p>
            ) : (
              <table style={s.table}>
                <thead>
                  <tr style={s.thead}>
                    {['코드', '이름', '설명', '상태', ''].map(h => (
                      <th key={h} style={{ ...s.th, fontSize: 12 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subSystems.map(sub => (
                    <tr key={sub.id} style={s.tr}>
                      <td style={{ ...s.td, fontWeight: 600, color: '#1976d2', fontSize: 12 }}>{sub.code}</td>
                      <td style={{ ...s.td, fontSize: 12 }}>{sub.name}</td>
                      <td style={{ ...s.td, color: 'var(--c-text-sub)', fontSize: 12 }}>{sub.description ?? '-'}</td>
                      <td style={s.td}>
                        <span onClick={() => toggleSubActive(sub)} style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          background: sub.active ? '#e8f5e9' : '#fafafa',
                          color: sub.active ? '#2e7d32' : '#999',
                          border: `1px solid ${sub.active ? '#a5d6a7' : '#ddd'}`,
                        }}>
                          {sub.active ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td style={s.td}>
                        <button onClick={() => openSubEdit(sub)} style={s.btnSm}>수정</button>
                        <button onClick={() => { if (confirm(`[${sub.code}] ${sub.name}을 삭제하시겠습니까?`)) deleteSubMut.mutate({ systemId: subPanel.id, subId: sub.id }) }}
                          style={{ ...s.btnSm, color: '#e53e3e' }}>삭제</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setSubPanel(null); resetSubForm() }} style={s.btnSecondary}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* 담당자 패널 */}
      {managerPanel && (
        <div style={s.overlay}>
          <div style={{ ...s.modal, width: 460 }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 15 }}>{managerPanel.name} 담당자 관리</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--c-text-muted)' }}>시스템 담당자는 배포 요청 제출/완료 권한을 갖습니다.</p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>현재 담당자</div>
              {managers.length === 0 ? (
                <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 담당자가 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {managers.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: 'var(--c-bg)', borderRadius: 6, fontSize: 13 }}>
                      <span>{m.username}</span>
                      <button onClick={() => removeManagerMut.mutate({ systemId: managerPanel.id, userId: m.userId })}
                        style={{ ...s.btnSm, color: '#e53e3e' }}>제거</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {availableUsers.length > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <select value={selectedUserId} onChange={e => setSelectedUserId(Number(e.target.value))}
                  style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 13, background: 'var(--c-input-bg)', color: 'var(--c-text)' }}>
                  <option value={0}>담당자 선택</option>
                  {availableUsers.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                </select>
                <button onClick={() => { if (selectedUserId) addManagerMut.mutate({ systemId: managerPanel.id, userId: selectedUserId }) }}
                  disabled={!selectedUserId} style={{ ...s.btn, opacity: selectedUserId ? 1 : 0.5 }}>추가</button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { setManagerPanel(null); setSelectedUserId(0) }} style={s.btnSecondary}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 40px' },
  card: { background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, padding: 24, marginBottom: 16 },
  btn: { padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSecondary: { padding: '8px 16px', background: 'var(--c-card)', color: 'var(--c-text-sub)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid var(--c-border-in)', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  grid: { display: 'grid', gridTemplateColumns: '120px 1fr', gap: '12px 16px', alignItems: 'center' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--c-text-sub)' },
  input: { padding: '8px 10px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' as const, background: 'var(--c-input-bg)', color: 'var(--c-text)' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  thead: { background: 'var(--c-thead)' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', borderBottom: '1px solid var(--c-border)' },
  tr: { borderBottom: '1px solid var(--c-border-in)' },
  td: { padding: '10px 14px', fontSize: 13 },
  empty: { padding: 32, textAlign: 'center' as const, color: 'var(--c-text-muted)', fontSize: 13 },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--c-card)', borderRadius: 10, padding: 28, width: 560, maxHeight: '80vh', overflowY: 'auto' as const, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
}
