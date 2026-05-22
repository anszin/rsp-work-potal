import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weeklyApi, WeeklyReport, SaveWeeklyRequest } from '../../api/reports'

const emptyForm = (): SaveWeeklyRequest => {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today); mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  return {
    title: `${mon.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' })} 주간보고`,
    weekStart: mon.toISOString().slice(0, 10),
    weekEnd: fri.toISOString().slice(0, 10),
    accomplishments: '', plans: '', issues: '',
  }
}

export default function WeeklyReportPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<WeeklyReport | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<WeeklyReport | null>(null)
  const [form, setForm] = useState<SaveWeeklyRequest>(emptyForm())

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['weekly-reports'],
    queryFn: () => weeklyApi.list().then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['weekly-reports'] })

  const createMut = useMutation({
    mutationFn: (d: SaveWeeklyRequest) => weeklyApi.create(d),
    onSuccess: (res) => { invalidate(); resetForm(); setSelected(res.data) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: SaveWeeklyRequest }) => weeklyApi.update(id, d),
    onSuccess: (res) => { invalidate(); resetForm(); setSelected(res.data) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => weeklyApi.delete(id),
    onSuccess: () => { invalidate(); setSelected(null) },
  })

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }

  const openEdit = (item: WeeklyReport) => {
    setEditing(item)
    setForm({
      title: item.title, weekStart: item.weekStart, weekEnd: item.weekEnd,
      accomplishments: item.accomplishments ?? '', plans: item.plans ?? '', issues: item.issues ?? '',
    })
    setShowForm(true); setSelected(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const d = {
      ...form,
      accomplishments: form.accomplishments || undefined,
      plans: form.plans || undefined,
      issues: form.issues || undefined,
    }
    if (editing) updateMut.mutate({ id: editing.id, d })
    else createMut.mutate(d)
  }

  const Section = ({ label, content, bg }: { label: string; content: string | null; bg: string }) =>
    content ? (
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
        <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: bg, padding: '14px 16px', borderRadius: 6, border: '1px solid #f0f0f0' }}>{content}</div>
      </div>
    ) : null

  return (
    <div style={{ display: 'flex', gap: 20, height: '100%' }}>
      <div style={{ width: 280, flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>주간보고</h2>
          <button onClick={() => { resetForm(); setShowForm(true); setSelected(null) }}
            style={{ padding: '6px 14px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
            + 작성
          </button>
        </div>
        {isLoading ? <p>로딩 중...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.length === 0 ? <p style={{ color: '#999', fontSize: 13 }}>등록된 주간보고가 없습니다.</p>
              : items.map(item => (
                <div key={item.id}
                  onClick={() => { setSelected(item); setShowForm(false) }}
                  style={{
                    padding: '10px 14px', borderRadius: 8, border: '1px solid',
                    borderColor: selected?.id === item.id ? '#1976d2' : '#e0e0e0',
                    background: selected?.id === item.id ? '#e3f2fd' : '#fff',
                    cursor: 'pointer',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{item.weekStart} ~ {item.weekEnd}</div>
                  <div style={{ fontSize: 11, color: '#999', marginTop: 2 }}>{item.author}</div>
                </div>
              ))}
          </div>
        )}
      </div>

      <div style={{ flex: 1, background: '#fff', borderRadius: 8, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflowY: 'auto' }}>
        {showForm ? (
          <>
            <h3 style={{ margin: '0 0 20px' }}>{editing ? '주간보고 수정' : '새 주간보고 작성'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>제목 *</span>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>주간 시작 *</span>
                  <input type="date" value={form.weekStart} onChange={e => setForm(f => ({ ...f, weekStart: e.target.value }))}
                    required style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>주간 종료 *</span>
                  <input type="date" value={form.weekEnd} onChange={e => setForm(f => ({ ...f, weekEnd: e.target.value }))}
                    required style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14 }} />
                </label>
                {[
                  { key: 'accomplishments', label: '금주 주요업무' },
                  { key: 'plans', label: '차주 계획' },
                  { key: 'issues', label: '이슈/특이사항' },
                ].map(({ key, label }) => (
                  <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                    <span style={{ fontSize: 13, fontWeight: 500 }}>{label}</span>
                    <textarea
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      rows={5} style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid #ccc', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
                  </label>
                ))}
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
          </>
        ) : selected ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: '0 0 6px' }}>{selected.title}</h2>
                <div style={{ fontSize: 13, color: '#666' }}>{selected.weekStart} ~ {selected.weekEnd} · {selected.author}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => openEdit(selected)}
                  style={{ padding: '6px 14px', border: '1px solid #90caf9', borderRadius: 6, background: '#e3f2fd', color: '#1565c0', cursor: 'pointer', fontSize: 13 }}>
                  수정
                </button>
                <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(selected.id) }}
                  style={{ padding: '6px 14px', border: '1px solid #ef9a9a', borderRadius: 6, background: '#ffebee', color: '#c62828', cursor: 'pointer', fontSize: 13 }}>
                  삭제
                </button>
              </div>
            </div>
            <Section label="금주 주요업무" content={selected.accomplishments} bg="#f8fffe" />
            <Section label="차주 계획" content={selected.plans} bg="#f8f9ff" />
            <Section label="이슈/특이사항" content={selected.issues} bg="#fffde7" />
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: '#bbb', fontSize: 15 }}>
            목록에서 주간보고를 선택하거나 새로 작성하세요
          </div>
        )}
      </div>
    </div>
  )
}
