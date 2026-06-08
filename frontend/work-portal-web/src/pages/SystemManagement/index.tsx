import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSystems, createSystem, updateSystem, deleteSystem, System,
  getSystemManagers, addSystemManager, removeSystemManager, getUsers,
  getSubSystems, createSubSystem, updateSubSystem, deleteSubSystem, SubSystem,
} from '../../api/systems'

const emptyForm = () => ({ code: '', name: '', description: '', redmineProjectKey: '' })
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
    mutationFn: ({ id, data }: { id: number; data: { name: string; description?: string; active?: boolean; redmineProjectKey?: string } }) =>
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
    setForm({ code: s.code, name: s.name, description: s.description ?? '', redmineProjectKey: s.redmineProjectKey ?? '' })
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
      updateMut.mutate({ id: editing.id, data: { name: form.name, description: form.description || undefined, redmineProjectKey: form.redmineProjectKey || undefined } })
    } else {
      createMut.mutate({ code: form.code, name: form.name, description: form.description || undefined, redmineProjectKey: form.redmineProjectKey || undefined })
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
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>시스템 관리</h2>
        <button onClick={() => { reset(); setShowForm(true) }} style={btn}>
          + 시스템 등록
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border-in)', borderRadius: 8, padding: 24, marginBottom: 24 }}>
          <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>{editing ? '시스템 수정' : '시스템 등록'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {!editing && (
                <label style={labelStyle}>
                  <span style={{ fontSize: 13 }}>시스템 코드 *</span>
                  <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    required placeholder="예: SYS003" style={inputStyle} />
                </label>
              )}
              <label style={labelStyle}>
                <span style={{ fontSize: 13 }}>시스템명 *</span>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required placeholder="시스템 이름" style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, gridColumn: editing ? '1 / -1' : 'auto' }}>
                <span style={{ fontSize: 13 }}>설명</span>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="시스템 설명" style={inputStyle} />
              </label>
              <label style={{ ...labelStyle, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 13 }}>레드마인 프로젝트 키</span>
                <input value={form.redmineProjectKey} onChange={e => setForm(f => ({ ...f, redmineProjectKey: e.target.value }))}
                  placeholder="예: retail-platform (레드마인 프로젝트 식별자)" style={inputStyle} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" style={btn}>{editing ? '수정' : '등록'}</button>
              <button type="button" onClick={reset} style={btnSecondary}>취소</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <p>로딩 중...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--c-card)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <thead>
            <tr style={{ background: 'var(--c-thead)' }}>
              {['코드', '시스템명', '설명', '상태', '등록일', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--c-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {systems.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--c-text-muted)' }}>등록된 시스템이 없습니다.</td></tr>
            ) : systems.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid var(--c-thead)' }}>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#1976d2' }}>{s.code}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: 'var(--c-text-sub)' }}>{s.description ?? '-'}</td>
                <td style={{ padding: '10px 16px' }}>
                  <span onClick={() => toggleActive(s)} style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                    background: s.active ? '#e8f5e9' : '#fafafa',
                    color: s.active ? '#2e7d32' : '#999',
                    border: `1px solid ${s.active ? '#a5d6a7' : '#ddd'}`,
                  }}>
                    {s.active ? '운영중' : '비활성'}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: 'var(--c-text-muted)' }}>
                  {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => { setSubPanel(s); resetSubForm() }}
                    style={{ marginRight: 6, padding: '4px 10px', fontSize: 12, border: '1px solid #80cbc4', borderRadius: 4, background: '#e0f2f1', color: '#00695c', cursor: 'pointer' }}>
                    하위시스템
                  </button>
                  <button onClick={() => setManagerPanel(s)}
                    style={{ marginRight: 6, padding: '4px 10px', fontSize: 12, border: '1px solid #b39ddb', borderRadius: 4, background: '#ede7f6', color: '#4527a0', cursor: 'pointer' }}>
                    담당자
                  </button>
                  <button onClick={() => openEdit(s)}
                    style={{ marginRight: 6, padding: '4px 10px', fontSize: 12, border: '1px solid #90caf9', borderRadius: 4, background: '#e3f2fd', color: '#1565c0', cursor: 'pointer' }}>
                    수정
                  </button>
                  <button onClick={() => { if (confirm(`[${s.code}] ${s.name}을 삭제하시겠습니까?`)) deleteMut.mutate(s.id) }}
                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ef9a9a', borderRadius: 4, background: '#ffebee', color: '#c62828', cursor: 'pointer' }}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Sub-system panel */}
      {subPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--c-card)', borderRadius: 10, padding: 28, width: 560, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <h3 style={{ margin: 0, fontSize: 16 }}>{subPanel.name} 하위시스템 관리</h3>
              <button
                onClick={() => { setShowSubForm(true); setEditingSub(null); setSubForm(emptySubForm()) }}
                style={{ ...btn, padding: '6px 14px', fontSize: 12 }}
              >
                + 추가
              </button>
            </div>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--c-text-muted)' }}>프론트엔드, 백엔드, API 등 구성 컴포넌트를 관리합니다.</p>

            {showSubForm && (
              <form onSubmit={handleSubSubmit} style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border-in)', borderRadius: 8, padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
                  {!editingSub && (
                    <label style={labelStyle}>
                      <span style={{ fontSize: 12 }}>코드 *</span>
                      <input value={subForm.code} onChange={e => setSubForm(f => ({ ...f, code: e.target.value }))}
                        required placeholder="예: FRONTEND" style={{ ...inputStyle, fontSize: 12 }} />
                    </label>
                  )}
                  <label style={labelStyle}>
                    <span style={{ fontSize: 12 }}>이름 *</span>
                    <input value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))}
                      required placeholder="하위시스템 이름" style={{ ...inputStyle, fontSize: 12 }} />
                  </label>
                  <label style={{ ...labelStyle, gridColumn: editingSub ? '1 / -1' : 'auto' }}>
                    <span style={{ fontSize: 12 }}>설명</span>
                    <input value={subForm.description} onChange={e => setSubForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="설명" style={{ ...inputStyle, fontSize: 12 }} />
                  </label>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button type="submit" style={{ ...btn, padding: '6px 14px', fontSize: 12 }}>{editingSub ? '수정' : '등록'}</button>
                  <button type="button" onClick={resetSubForm} style={{ ...btnSecondary, padding: '6px 12px', fontSize: 12 }}>취소</button>
                </div>
              </form>
            )}

            {subSystems.length === 0 ? (
              <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 하위시스템이 없습니다.</p>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--c-thead)' }}>
                    {['코드', '이름', '설명', '상태', ''].map(h => (
                      <th key={h} style={{ padding: '8px 10px', textAlign: 'left', fontWeight: 600, fontSize: 12, borderBottom: '1px solid var(--c-border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {subSystems.map(sub => (
                    <tr key={sub.id} style={{ borderBottom: '1px solid var(--c-thead)' }}>
                      <td style={{ padding: '8px 10px', fontWeight: 600, color: '#1976d2', fontSize: 12 }}>{sub.code}</td>
                      <td style={{ padding: '8px 10px' }}>{sub.name}</td>
                      <td style={{ padding: '8px 10px', color: 'var(--c-text-sub)', fontSize: 12 }}>{sub.description ?? '-'}</td>
                      <td style={{ padding: '8px 10px' }}>
                        <span onClick={() => toggleSubActive(sub)} style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          background: sub.active ? '#e8f5e9' : '#fafafa',
                          color: sub.active ? '#2e7d32' : '#999',
                          border: `1px solid ${sub.active ? '#a5d6a7' : '#ddd'}`,
                        }}>
                          {sub.active ? '활성' : '비활성'}
                        </span>
                      </td>
                      <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                        <button onClick={() => openSubEdit(sub)}
                          style={{ marginRight: 4, padding: '3px 8px', fontSize: 11, border: '1px solid #90caf9', borderRadius: 4, background: '#e3f2fd', color: '#1565c0', cursor: 'pointer' }}>
                          수정
                        </button>
                        <button onClick={() => { if (confirm(`[${sub.code}] ${sub.name}을 삭제하시겠습니까?`)) deleteSubMut.mutate({ systemId: subPanel.id, subId: sub.id }) }}
                          style={{ padding: '3px 8px', fontSize: 11, border: '1px solid #ef9a9a', borderRadius: 4, background: '#ffebee', color: '#c62828', cursor: 'pointer' }}>
                          삭제
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button onClick={() => { setSubPanel(null); resetSubForm() }} style={btnSecondary}>닫기</button>
            </div>
          </div>
        </div>
      )}

      {/* Manager panel */}
      {managerPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--c-card)', borderRadius: 10, padding: 28, width: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{managerPanel.name} 담당자 관리</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--c-text-muted)' }}>시스템 담당자는 변경 요청 승인/반려 권한을 갖습니다.</p>

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
                        style={{ padding: '2px 8px', fontSize: 12, border: '1px solid #ef9a9a', borderRadius: 4, background: '#ffebee', color: '#c62828', cursor: 'pointer' }}>
                        제거
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {availableUsers.length > 0 && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
                <select
                  value={selectedUserId}
                  onChange={e => setSelectedUserId(Number(e.target.value))}
                  style={{ flex: 1, padding: '8px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 13, background: 'var(--c-input-bg)', color: 'var(--c-text)' }}
                >
                  <option value={0}>담당자 선택</option>
                  {availableUsers.map(u => (
                    <option key={u.id} value={u.id}>{u.username}</option>
                  ))}
                </select>
                <button
                  onClick={() => { if (selectedUserId) addManagerMut.mutate({ systemId: managerPanel.id, userId: selectedUserId }) }}
                  disabled={!selectedUserId}
                  style={{ ...btn, opacity: selectedUserId ? 1 : 0.5 }}
                >
                  추가
                </button>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={() => { setManagerPanel(null); setSelectedUserId(0) }} style={btnSecondary}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const btn: React.CSSProperties = { padding: '8px 18px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 }
const btnSecondary: React.CSSProperties = { padding: '8px 16px', background: 'var(--c-card)', color: 'var(--c-text-sub)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const inputStyle: React.CSSProperties = { padding: '8px', borderRadius: 4, border: '1px solid var(--c-border-in)', fontSize: 13, width: '100%', background: 'var(--c-input-bg)', color: 'var(--c-text)' }
