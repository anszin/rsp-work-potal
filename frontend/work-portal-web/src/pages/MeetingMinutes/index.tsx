import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { meetingApi, MeetingMinute, SaveMeetingRequest } from '../../api/reports'
import { Button } from '../../components/ui'

const emptyForm = (): SaveMeetingRequest => ({
  title: '', meetingDate: new Date().toISOString().slice(0, 10),
  location: '', attendees: '', content: '', actionItems: '',
})

export default function MeetingMinutesPage() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState<MeetingMinute | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<MeetingMinute | null>(null)
  const [form, setForm] = useState<SaveMeetingRequest>(emptyForm())

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['meeting-minutes'],
    queryFn: () => meetingApi.list().then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['meeting-minutes'] })

  const createMut = useMutation({
    mutationFn: (d: SaveMeetingRequest) => meetingApi.create(d),
    onSuccess: (res) => { invalidate(); resetForm(); setSelected(res.data) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: SaveMeetingRequest }) => meetingApi.update(id, d),
    onSuccess: (res) => { invalidate(); resetForm(); setSelected(res.data) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => meetingApi.delete(id),
    onSuccess: () => { invalidate(); setSelected(null) },
  })

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }

  const openEdit = (item: MeetingMinute) => {
    setEditing(item)
    setForm({
      title: item.title, meetingDate: item.meetingDate,
      location: item.location ?? '', attendees: item.attendees ?? '',
      content: item.content ?? '', actionItems: item.actionItems ?? '',
    })
    setShowForm(true)
    setSelected(null)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const d = {
      ...form,
      location: form.location || undefined,
      attendees: form.attendees || undefined,
      content: form.content || undefined,
      actionItems: form.actionItems || undefined,
    }
    if (editing) updateMut.mutate({ id: editing.id, d })
    else createMut.mutate(d)
  }

  return (
    <div className="master-detail page-wrap">
      {/* 목록 패널 */}
      <div className="master-panel" style={{ width: 320 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>회의록</h2>
          <Button variant="filled" onClick={() => { resetForm(); setShowForm(true); setSelected(null) }}>+ 작성</Button>
        </div>
        {isLoading ? <p>로딩 중...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.length === 0 ? <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 회의록이 없습니다.</p>
              : items.map(item => (
                <div key={item.id}
                  onClick={() => { setSelected(item); setShowForm(false) }}
                  style={{
                    padding: '10px 14px', borderRadius: 8, border: '1px solid',
                    borderColor: selected?.id === item.id ? '#1976d2' : 'var(--c-border)',
                    background: selected?.id === item.id ? '#e3f2fd' : 'var(--c-card)',
                    cursor: 'pointer',
                  }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 3 }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-sub)' }}>
                    {item.meetingDate} · {item.author}
                  </div>
                  {item.location && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{item.location}</div>}
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 상세/작성 패널 */}
      <div className="detail-panel">
        {showForm ? (
          <>
            <h3 style={{ margin: '0 0 20px' }}>{editing ? '회의록 수정' : '새 회의록 작성'}</h3>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>제목 *</span>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--c-border-in)', fontSize: 14 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>회의일 *</span>
                  <input type="date" value={form.meetingDate} onChange={e => setForm(f => ({ ...f, meetingDate: e.target.value }))}
                    required style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--c-border-in)', fontSize: 14 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>장소</span>
                  <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                    style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--c-border-in)', fontSize: 14 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>참석자</span>
                  <input value={form.attendees} onChange={e => setForm(f => ({ ...f, attendees: e.target.value }))}
                    placeholder="홍길동, 김철수, ..." style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--c-border-in)', fontSize: 14 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>회의 내용</span>
                  <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                    rows={8} style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--c-border-in)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>액션 아이템</span>
                  <textarea value={form.actionItems} onChange={e => setForm(f => ({ ...f, actionItems: e.target.value }))}
                    rows={4} placeholder="- [ ] 담당자 | 내용 | 기한" style={{ padding: '8px 10px', borderRadius: 4, border: '1px solid var(--c-border-in)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }} />
                </label>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
                <Button variant="filled" type="submit">{editing ? '수정' : '저장'}</Button>
                <Button variant="outlined" type="button" onClick={resetForm}>취소</Button>
              </div>
            </form>
          </>
        ) : selected ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: '0 0 6px' }}>{selected.title}</h2>
                <div style={{ fontSize: 13, color: 'var(--c-text-sub)' }}>
                  {selected.meetingDate}
                  {selected.location && ` · ${selected.location}`}
                  {' · '}{selected.author}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="outlined" onClick={() => openEdit(selected)}>수정</Button>
                <Button variant="outlined" onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(selected.id) }} style={{ color: '#c62828', borderColor: '#ef9a9a' }}>삭제</Button>
              </div>
            </div>
            {selected.attendees && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 4 }}>참석자</div>
                <div style={{ fontSize: 14 }}>{selected.attendees}</div>
              </div>
            )}
            {selected.content && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>회의 내용</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'var(--c-bg)', padding: '14px 16px', borderRadius: 6, border: '1px solid var(--c-border-in)' }}>{selected.content}</div>
              </div>
            )}
            {selected.actionItems && (
              <div>
                <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 8, fontWeight: 600, textTransform: 'uppercase' }}>액션 아이템</div>
                <div style={{ fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: '#fffde7', padding: '14px 16px', borderRadius: 6, border: '1px solid #fff9c4' }}>{selected.actionItems}</div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--c-text-muted)', fontSize: 15 }}>
            목록에서 회의록을 선택하거나 새로 작성하세요
          </div>
        )}
      </div>
    </div>
  )
}
