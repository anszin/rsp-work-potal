import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSystems, createSystem, updateSystem, deleteSystem, System,
  getSystemManagers, addSystemManager, removeSystemManager, getUsers,
} from '../../api/systems'

const emptyForm = () => ({ code: '', name: '', description: '' })

export default function SystemManagementPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<System | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [managerPanel, setManagerPanel] = useState<System | null>(null)
  const [selectedUserId, setSelectedUserId] = useState<number>(0)

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

  const invalidate = () => qc.invalidateQueries({ queryKey: ['systems'] })
  const invalidateManagers = () => qc.invalidateQueries({ queryKey: ['systems', managerPanel?.id, 'managers'] })

  const createMut = useMutation({ mutationFn: createSystem, onSuccess: () => { invalidate(); reset() } })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; description?: string; active?: boolean } }) =>
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

  const reset = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }

  const openEdit = (s: System) => {
    setEditing(s)
    setForm({ code: s.code, name: s.name, description: s.description ?? '' })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (editing) {
      updateMut.mutate({ id: editing.id, data: { name: form.name, description: form.description || undefined } })
    } else {
      createMut.mutate({ code: form.code, name: form.name, description: form.description || undefined })
    }
  }

  const toggleActive = (s: System) => {
    updateMut.mutate({ id: s.id, data: { name: s.name, active: !s.active } })
  }

  const assignedUserIds = new Set(managers.map(m => m.userId))
  const availableUsers = users.filter(u => !assignedUserIds.has(u.id))

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>시스템 관리</h2>
        <button
          onClick={() => { reset(); setShowForm(true) }}
          style={btn}
        >
          + 시스템 등록
        </button>
      </div>

      {showForm && (
        <div style={{ background: '#f5f7fa', border: '1px solid #ddd', borderRadius: 8, padding: 24, marginBottom: 24 }}>
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
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit" style={btn}>{editing ? '수정' : '등록'}</button>
              <button type="button" onClick={reset} style={btnSecondary}>취소</button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <p>로딩 중...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <thead>
            <tr style={{ background: '#f5f7fa' }}>
              {['코드', '시스템명', '설명', '상태', '등록일', ''].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 13, borderBottom: '1px solid #e0e0e0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {systems.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#999' }}>등록된 시스템이 없습니다.</td></tr>
            ) : systems.map(s => (
              <tr key={s.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 16px', fontSize: 13, fontWeight: 600, color: '#1976d2' }}>{s.code}</td>
                <td style={{ padding: '10px 16px', fontWeight: 500 }}>{s.name}</td>
                <td style={{ padding: '10px 16px', fontSize: 13, color: '#666' }}>{s.description ?? '-'}</td>
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
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#999' }}>
                  {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
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

      {managerPanel && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 28, width: 460, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
            <h3 style={{ margin: '0 0 4px', fontSize: 16 }}>{managerPanel.name} 담당자 관리</h3>
            <p style={{ margin: '0 0 20px', fontSize: 13, color: '#888' }}>시스템 담당자는 변경 요청 승인/반려 권한을 갖습니다.</p>

            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>현재 담당자</div>
              {managers.length === 0 ? (
                <p style={{ color: '#aaa', fontSize: 13 }}>등록된 담당자가 없습니다.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {managers.map(m => (
                    <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#f8f8f8', borderRadius: 6, fontSize: 13 }}>
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
                  style={{ flex: 1, padding: '8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}
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
const btnSecondary: React.CSSProperties = { padding: '8px 16px', background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 }
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 }
const inputStyle: React.CSSProperties = { padding: '8px', borderRadius: 4, border: '1px solid #ccc', fontSize: 13, width: '100%' }
