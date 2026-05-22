import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi, ItemType, ItemStatus, SaveInventoryRequest, InventoryItem } from '../../api/inventory'

const TYPE_LABEL: Record<ItemType, string> = { CONTRACT: '수주', PROPOSAL: '제안' }
const STATUS_LABEL: Record<ItemStatus, string> = {
  ACTIVE: '진행중', COMPLETED: '완료', CANCELLED: '취소', ON_HOLD: '보류',
}
const STATUS_COLOR: Record<ItemStatus, string> = {
  ACTIVE: '#2196f3', COMPLETED: '#4caf50', CANCELLED: '#9e9e9e', ON_HOLD: '#ff9800',
}

const emptyForm = (): SaveInventoryRequest => ({
  type: 'CONTRACT', name: '', client: '', amount: undefined,
  status: 'ACTIVE', startDate: '', endDate: '', note: '',
})

export default function InventoryPage() {
  const qc = useQueryClient()
  const [typeFilter, setTypeFilter] = useState<ItemType | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<SaveInventoryRequest>(emptyForm())

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', typeFilter],
    queryFn: () => inventoryApi.list(typeFilter || undefined).then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory'] })

  const createMut = useMutation({
    mutationFn: (data: SaveInventoryRequest) => inventoryApi.create(data),
    onSuccess: () => { invalidate(); resetForm() },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveInventoryRequest }) =>
      inventoryApi.update(id, data),
    onSuccess: () => { invalidate(); resetForm() },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => inventoryApi.delete(id),
    onSuccess: invalidate,
  })

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }

  const openEdit = (item: InventoryItem) => {
    setEditing(item)
    setForm({
      type: item.type, name: item.name, client: item.client ?? '',
      amount: item.amount ?? undefined, status: item.status,
      startDate: item.startDate ?? '', endDate: item.endDate ?? '', note: item.note ?? '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...form,
      client: form.client || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      note: form.note || undefined,
    }
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  const fmt = (n: number | null) =>
    n != null ? n.toLocaleString('ko-KR') + '원' : '-'

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ margin: 0 }}>인벤토리 (수주/제안)</h2>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['', 'CONTRACT', 'PROPOSAL'] as const).map(t => (
            <button key={t}
              onClick={() => setTypeFilter(t)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #ddd', cursor: 'pointer',
                background: typeFilter === t ? '#1976d2' : '#fff',
                color: typeFilter === t ? '#fff' : '#333',
              }}>
              {t === '' ? '전체' : TYPE_LABEL[t]}
            </button>
          ))}
          <button
            onClick={() => { resetForm(); setShowForm(true) }}
            style={{ padding: '6px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            + 추가
          </button>
        </div>
      </div>

      {showForm && (
        <div style={{ background: '#f5f7fa', border: '1px solid #ddd', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>{editing ? '항목 수정' : '새 항목 추가'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>구분 *</span>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as ItemType }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc' }}>
                  <option value="CONTRACT">수주</option>
                  <option value="PROPOSAL">제안</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>항목명 *</span>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>고객사</span>
                <input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>금액 (원)</span>
                <input type="number" value={form.amount ?? ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value ? +e.target.value : undefined }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>상태</span>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ItemStatus }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc' }}>
                  {(Object.keys(STATUS_LABEL) as ItemStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>시작일</span>
                <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>종료일</span>
                <input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span>비고</span>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid #ccc', resize: 'vertical' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit"
                style={{ padding: '8px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                {editing ? '수정' : '저장'}
              </button>
              <button type="button" onClick={resetForm}
                style={{ padding: '8px 20px', background: '#fff', border: '1px solid #ccc', borderRadius: 6, cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? (
        <p>로딩 중...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <thead>
            <tr style={{ background: '#f5f7fa' }}>
              {['구분', '항목명', '고객사', '금액', '상태', '기간', '비고', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 13, borderBottom: '1px solid #e0e0e0' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 40, color: '#999' }}>데이터가 없습니다.</td></tr>
            ) : items.map(item => (
              <tr key={item.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: item.type === 'CONTRACT' ? '#e3f2fd' : '#fff3e0', color: item.type === 'CONTRACT' ? '#1565c0' : '#e65100', fontSize: 12 }}>
                    {TYPE_LABEL[item.type]}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{item.name}</td>
                <td style={{ padding: '10px 14px', color: '#555' }}>{item.client ?? '-'}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.amount)}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: STATUS_COLOR[item.status] + '22', color: STATUS_COLOR[item.status], fontSize: 12 }}>
                    {STATUS_LABEL[item.status]}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#666' }}>
                  {item.startDate ?? '-'} ~ {item.endDate ?? '-'}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#666', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.note ?? '-'}</td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(item)}
                    style={{ marginRight: 6, padding: '4px 10px', fontSize: 12, border: '1px solid #90caf9', borderRadius: 4, background: '#e3f2fd', color: '#1565c0', cursor: 'pointer' }}>
                    수정
                  </button>
                  <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(item.id) }}
                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ef9a9a', borderRadius: 4, background: '#ffebee', color: '#c62828', cursor: 'pointer' }}>
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
