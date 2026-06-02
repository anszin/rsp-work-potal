import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSystems, createSystem, updateSystem, deleteSystem, System } from '../../api/systems'

const emptyForm = () => ({ code: '', name: '', description: '' })

export default function SystemManagementPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<System | null>(null)
  const [form, setForm] = useState(emptyForm())

  const { data: systems = [], isLoading } = useQuery({ queryKey: ['systems'], queryFn: getSystems })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['systems'] })

  const createMut = useMutation({ mutationFn: createSystem, onSuccess: () => { invalidate(); reset() } })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { name: string; description?: string; active?: boolean } }) =>
      updateSystem(id, data),
    onSuccess: () => { invalidate(); reset() },
  })
  const deleteMut = useMutation({ mutationFn: deleteSystem, onSuccess: invalidate })

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

  return (
    <div style={{ padding: 32 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>시스템 관리</h2>
        <button
          onClick={() => { reset(); setShowForm(true) }}
          style={{ padding: '8px 18px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}
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
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13 }}>시스템 코드 *</span>
                  <input
                    value={form.code}
                    onChange={e => setForm(f => ({ ...f, code: e.target.value }))}
                    required placeholder="예: SYS003"
                    style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc', fontFamily: 'inherit' }}
                  />
                </label>
              )}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13 }}>시스템명 *</span>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required placeholder="시스템 이름"
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc', fontFamily: 'inherit' }}
                />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: editing ? '1 / -1' : 'auto' }}>
                <span style={{ fontSize: 13 }}>설명</span>
                <input
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="시스템 설명"
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc', fontFamily: 'inherit' }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit"
                style={{ padding: '8px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                {editing ? '수정' : '등록'}
              </button>
              <button type="button" onClick={reset}
                style={{ padding: '8px 20px', background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit' }}>
                취소
              </button>
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
                  <span
                    onClick={() => toggleActive(s)}
                    style={{
                      padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                      background: s.active ? '#e8f5e9' : '#fafafa',
                      color: s.active ? '#2e7d32' : '#999',
                      border: `1px solid ${s.active ? '#a5d6a7' : '#ddd'}`,
                    }}
                  >
                    {s.active ? '운영중' : '비활성'}
                  </span>
                </td>
                <td style={{ padding: '10px 16px', fontSize: 12, color: '#999' }}>
                  {new Date(s.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(s)}
                    style={{ marginRight: 6, padding: '4px 10px', fontSize: 12, border: '1px solid #90caf9', borderRadius: 4, background: '#e3f2fd', color: '#1565c0', cursor: 'pointer', fontFamily: 'inherit' }}>
                    수정
                  </button>
                  <button onClick={() => { if (confirm(`[${s.code}] ${s.name}을 삭제하시겠습니까?`)) deleteMut.mutate(s.id) }}
                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ef9a9a', borderRadius: 4, background: '#ffebee', color: '#c62828', cursor: 'pointer', fontFamily: 'inherit' }}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
