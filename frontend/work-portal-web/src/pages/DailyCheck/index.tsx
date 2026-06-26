import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dailyCheckApi, DailyCheckReport, SaveDailyCheckRequest, CheckStatus } from '../../api/reports'
import client from '../../api/client'

interface SystemOption { id: number; name: string }

const STATUS_LABEL: Record<CheckStatus, string> = { NORMAL: '정상', WARNING: '주의', CRITICAL: '위험' }
const STATUS_COLOR: Record<CheckStatus, string> = { NORMAL: '#4caf50', WARNING: '#ff9800', CRITICAL: '#f44336' }

const emptyForm = (): SaveDailyCheckRequest => ({
  systemId: 0, checkDate: new Date().toISOString().slice(0, 10), status: 'NORMAL', note: '',
})

export default function DailyCheckPage() {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [dateFilter, setDateFilter] = useState(today)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DailyCheckReport | null>(null)
  const [form, setForm] = useState<SaveDailyCheckRequest>(emptyForm())

  const { data: systems = [] } = useQuery({
    queryKey: ['systems-list'],
    queryFn: () => client.get<SystemOption[]>('/api/systems').then(r => r.data),
  })

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['daily-checks', dateFilter],
    queryFn: () => dailyCheckApi.list(dateFilter || undefined).then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['daily-checks'] })

  const createMut = useMutation({
    mutationFn: (d: SaveDailyCheckRequest) => dailyCheckApi.create(d),
    onSuccess: () => { invalidate(); resetForm() },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: SaveDailyCheckRequest }) => dailyCheckApi.update(id, d),
    onSuccess: () => { invalidate(); resetForm() },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => dailyCheckApi.delete(id),
    onSuccess: invalidate,
  })

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }

  const openEdit = (r: DailyCheckReport) => {
    setEditing(r)
    setForm({ systemId: r.systemId, checkDate: r.checkDate, status: r.status, note: r.note ?? '' })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.systemId) return alert('시스템을 선택해주세요.')
    const d = { ...form, note: form.note || undefined }
    if (editing) updateMut.mutate({ id: editing.id, d })
    else createMut.mutate(d)
  }

  const hasCritical = reports.some(r => r.status === 'CRITICAL')
  const hasWarning = reports.some(r => r.status === 'WARNING')

  return (
    <div className="page-wrap">
      <div className="deploy-header">
        <h2 style={{ margin: 0 }}>일일 점검</h2>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14 }} />
          <button onClick={() => setDateFilter('')}
            style={{ padding: '6px 12px', border: '1px solid var(--c-border-in)', borderRadius: 6, background: dateFilter ? 'var(--c-card)' : '#1976d2', color: dateFilter ? 'var(--c-text)' : '#fff', cursor: 'pointer', fontSize: 13 }}>
            전체
          </button>
          <button onClick={() => { resetForm(); setShowForm(true) }}
            style={{ padding: '6px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
            + 점검 등록
          </button>
        </div>
      </div>

      {/* 오늘 날짜 상태 요약 */}
      {dateFilter === today && reports.length > 0 && (
        <div style={{
          padding: '10px 16px', borderRadius: 8, marginBottom: 16,
          background: hasCritical ? '#ffebee' : hasWarning ? '#fff3e0' : '#e8f5e9',
          border: `1px solid ${hasCritical ? '#ef9a9a' : hasWarning ? '#ffcc80' : '#a5d6a7'}`,
          fontSize: 14, fontWeight: 600,
          color: hasCritical ? '#c62828' : hasWarning ? '#e65100' : '#2e7d32',
        }}>
          {hasCritical ? '위험 시스템이 있습니다' : hasWarning ? '주의가 필요한 시스템이 있습니다' : '모든 시스템 정상'}
          <span style={{ fontWeight: 400, marginLeft: 8 }}>({reports.length}개 시스템 점검 완료)</span>
        </div>
      )}

      {showForm && (
        <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border-in)', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>{editing ? '점검 수정' : '점검 등록'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid-2col">
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13 }}>시스템 *</span>
                <select value={form.systemId} onChange={e => setForm(f => ({ ...f, systemId: +e.target.value }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--c-border-in)' }}>
                  <option value={0}>-- 선택 --</option>
                  {systems.map((s: SystemOption) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13 }}>점검일 *</span>
                <input type="date" value={form.checkDate} onChange={e => setForm(f => ({ ...f, checkDate: e.target.value }))}
                  required style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--c-border-in)' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13 }}>상태 *</span>
                <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as CheckStatus }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--c-border-in)' }}>
                  {(Object.keys(STATUS_LABEL) as CheckStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 13 }}>비고</span>
                <textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={3}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--c-border-in)', resize: 'vertical', fontFamily: 'inherit', fontSize: 14 }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit"
                style={{ padding: '8px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                {editing ? '수정' : '저장'}
              </button>
              <button type="button" onClick={resetForm}
                style={{ padding: '8px 20px', background: 'var(--c-card)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <p>로딩 중...</p> : (
        <div className="table-scroll">
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--c-card)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <thead>
            <tr style={{ background: 'var(--c-thead)' }}>
              {['점검일', '시스템', '상태', '비고', '점검자', '등록시간', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--c-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {reports.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--c-text-muted)' }}>점검 데이터가 없습니다.</td></tr>
            ) : reports.map(r => (
              <tr key={r.id} style={{ borderBottom: '1px solid var(--c-border-in)' }}>
                <td style={{ padding: '10px 14px', fontSize: 13 }}>{r.checkDate}</td>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{r.systemName}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                    background: STATUS_COLOR[r.status] + '22', color: STATUS_COLOR[r.status],
                  }}>
                    {STATUS_LABEL[r.status]}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--c-text-sub)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.note ?? '-'}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 13, color: 'var(--c-text-sub)' }}>{r.reporter}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--c-text-muted)' }}>
                  {new Date(r.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(r)}
                    style={{ marginRight: 6, padding: '4px 10px', fontSize: 12, border: '1px solid #90caf9', borderRadius: 4, background: '#e3f2fd', color: '#1565c0', cursor: 'pointer' }}>
                    수정
                  </button>
                  <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(r.id) }}
                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ef9a9a', borderRadius: 4, background: '#ffebee', color: '#c62828', cursor: 'pointer' }}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  )
}
