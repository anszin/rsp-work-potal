import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weeklyApi, WeeklyReport, SaveWeeklyRequest } from '../../api/reports'
import { useAuth } from '../../context/useAuth'

// ── 날짜 유틸 ────────────────────────────────────────────────────────────────

function currentWeekRange() {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today)
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const fri = new Date(mon)
  fri.setDate(mon.getDate() + 4)
  return {
    weekStart: mon.toISOString().slice(0, 10),
    weekEnd: fri.toISOString().slice(0, 10),
    label: mon.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' }),
  }
}

const emptyForm = (): SaveWeeklyRequest => {
  const { weekStart, weekEnd, label } = currentWeekRange()
  return {
    title: `${label} 주간보고`,
    weekStart, weekEnd,
    thisWeekWork: '', thisWeekProposal: '', thisWeekEtc: '',
    nextWeekWork: '', nextWeekProposal: '', nextWeekEtc: '',
  }
}

function fmtWeek(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  return `${s.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~ ${e.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
}

// ── 서브컴포넌트 ──────────────────────────────────────────────────────────────

interface WeekBlockProps {
  week: '금주' | '차주'
  color: string
  fields: { key: keyof SaveWeeklyRequest; label: string }[]
  form: SaveWeeklyRequest
  onChange: (key: keyof SaveWeeklyRequest, val: string) => void
}

function WeekFormBlock({ week, color, fields, form, onChange }: WeekBlockProps) {
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color + '14', borderBottom: `1px solid ${color}33`, fontWeight: 700, fontSize: 13, color }}>
        {week}
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {fields.map(({ key, label }) => (
          <label key={key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)' }}>{label}</span>
            <textarea
              value={(form[key] as string) ?? ''}
              onChange={e => onChange(key, e.target.value)}
              rows={3}
              style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </label>
        ))}
      </div>
    </div>
  )
}

interface WeekDetailBlockProps {
  week: '금주' | '차주'
  color: string
  rows: { label: string; content: string | null }[]
}

function WeekDetailBlock({ week, color, rows }: WeekDetailBlockProps) {
  const hasContent = rows.some(r => r.content)
  if (!hasContent) return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color + '14', borderBottom: `1px solid ${color}33`, fontWeight: 700, fontSize: 13, color }}>
        {week}
      </div>
      <div style={{ padding: '14px', fontSize: 13, color: 'var(--c-text-muted)' }}>내용 없음</div>
    </div>
  )
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color + '14', borderBottom: `1px solid ${color}33`, fontWeight: 700, fontSize: 13, color }}>
        {week}
      </div>
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {rows.map(({ label, content }) => content ? (
          <div key={label}>
            <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
            <div style={{ fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'var(--c-bg)', padding: '10px 12px', borderRadius: 6, border: '1px solid var(--c-border)' }}>
              {content}
            </div>
          </div>
        ) : null)}
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

const THIS_WEEK_FIELDS: { key: keyof SaveWeeklyRequest; label: string }[] = [
  { key: 'thisWeekWork',     label: '수행' },
  { key: 'thisWeekProposal', label: '제안' },
  { key: 'thisWeekEtc',      label: '기타사항' },
]
const NEXT_WEEK_FIELDS: { key: keyof SaveWeeklyRequest; label: string }[] = [
  { key: 'nextWeekWork',     label: '수행' },
  { key: 'nextWeekProposal', label: '제안' },
  { key: 'nextWeekEtc',      label: '기타사항' },
]

export default function WeeklyReportPage() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const [selected, setSelected] = useState<WeeklyReport | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<WeeklyReport | null>(null)
  const [form, setForm] = useState<SaveWeeklyRequest>(emptyForm())
  const [printOpen, setPrintOpen] = useState(false)

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
      thisWeekWork:     item.thisWeekWork ?? '',
      thisWeekProposal: item.thisWeekProposal ?? '',
      thisWeekEtc:      item.thisWeekEtc ?? '',
      nextWeekWork:     item.nextWeekWork ?? '',
      nextWeekProposal: item.nextWeekProposal ?? '',
      nextWeekEtc:      item.nextWeekEtc ?? '',
    })
    setShowForm(true); setSelected(null)
  }

  const setField = (key: keyof SaveWeeklyRequest, val: string) =>
    setForm(f => ({ ...f, [key]: val }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const clean = (v?: string) => v || undefined
    const d: SaveWeeklyRequest = {
      title: form.title, weekStart: form.weekStart, weekEnd: form.weekEnd,
      thisWeekWork:     clean(form.thisWeekWork),
      thisWeekProposal: clean(form.thisWeekProposal),
      thisWeekEtc:      clean(form.thisWeekEtc),
      nextWeekWork:     clean(form.nextWeekWork),
      nextWeekProposal: clean(form.nextWeekProposal),
      nextWeekEtc:      clean(form.nextWeekEtc),
    }
    if (editing) updateMut.mutate({ id: editing.id, d })
    else createMut.mutate(d)
  }

  // 이번 주 항목 (PPT용)
  const { weekStart: thisWeekStart } = currentWeekRange()
  const thisWeekItems = items.filter(i => i.weekStart === thisWeekStart)

  return (
    <div className="master-detail page-wrap">

      {/* ── PPT 인쇄 오버레이 ─────────────────────────────────────────── */}
      {printOpen && (
        <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9999, overflowY: 'auto', padding: '24px 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>주간 업무 보고</h2>
              <div style={{ fontSize: 13, color: '#555', marginTop: 3 }}>
                {fmtWeek(thisWeekStart, items.find(i => i.weekStart === thisWeekStart)?.weekEnd ?? thisWeekStart)}
                {' · '}{thisWeekItems.length}명 제출
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => window.print()}
                style={{ padding: '7px 18px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                🖨 인쇄 / PDF
              </button>
              <button
                onClick={() => setPrintOpen(false)}
                style={{ padding: '7px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
              >
                닫기
              </button>
            </div>
          </div>

          {thisWeekItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', paddingTop: 60, fontSize: 14 }}>이번 주 등록된 보고서가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
              {thisWeekItems.map(item => (
                <div key={item.id} style={{ pageBreakInside: 'avoid', border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden' }}>
                  {/* 슬라이드 헤더 */}
                  <div style={{ padding: '10px 18px', background: '#1976d2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{item.author}</span>
                    <span style={{ fontSize: 12, opacity: 0.85 }}>{fmtWeek(item.weekStart, item.weekEnd)}</span>
                  </div>
                  {/* 금주/차주 2컬럼 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0 }}>
                    {/* 금주 */}
                    <div style={{ padding: '14px 18px', borderRight: '1px solid #eee' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#1976d2', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #1976d220' }}>금주</div>
                      {[
                        { label: '수행',     val: item.thisWeekWork },
                        { label: '제안',     val: item.thisWeekProposal },
                        { label: '기타사항', val: item.thisWeekEtc },
                      ].map(({ label, val }) => val ? (
                        <div key={label} style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                          <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 2, color: '#333' }}>{val}</div>
                        </div>
                      ) : null)}
                    </div>
                    {/* 차주 */}
                    <div style={{ padding: '14px 18px' }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: '#4caf50', marginBottom: 10, paddingBottom: 6, borderBottom: '2px solid #4caf5020' }}>차주</div>
                      {[
                        { label: '수행',     val: item.nextWeekWork },
                        { label: '제안',     val: item.nextWeekProposal },
                        { label: '기타사항', val: item.nextWeekEtc },
                      ].map(({ label, val }) => val ? (
                        <div key={label} style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                          <div style={{ fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginTop: 2, color: '#333' }}>{val}</div>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── 마스터 패널 ──────────────────────────────────────────────── */}
      <div className="master-panel" style={{ width: 280 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>주간보고</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setPrintOpen(true)}
              title="이번 주 전체 보고서 인쇄"
              style={{ padding: '5px 10px', background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--c-text-muted)' }}
            >
              🖨
            </button>
            <button
              onClick={() => { resetForm(); setShowForm(true); setSelected(null) }}
              style={{ padding: '6px 14px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}
            >
              + 작성
            </button>
          </div>
        </div>

        {isLoading ? <p>로딩 중...</p> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.length === 0
              ? <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 주간보고가 없습니다.</p>
              : items.map(item => {
                const isMine = item.author === user?.username
                const isSelected = selected?.id === item.id
                return (
                  <div key={item.id}
                    onClick={() => { setSelected(item); setShowForm(false) }}
                    style={{
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${isSelected ? '#1976d2' : 'var(--c-border)'}`,
                      background: isSelected ? '#e3f2fd' : 'var(--c-card)',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.title}</div>
                      {isMine && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: '#1976d222', color: '#1976d2', fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>내것</span>}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--c-text-sub)', marginTop: 2 }}>{fmtWeek(item.weekStart, item.weekEnd)}</div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{item.author}</div>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* ── 디테일 패널 ──────────────────────────────────────────────── */}
      <div className="detail-panel">
        {showForm ? (
          <>
            <h3 style={{ margin: '0 0 20px' }}>{editing ? '주간보고 수정' : '새 주간보고 작성'}</h3>
            <form onSubmit={handleSubmit}>
              {/* 제목 + 기간 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>제목 *</span>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>주간 시작 *</span>
                  <input type="date" value={form.weekStart} onChange={e => setForm(f => ({ ...f, weekStart: e.target.value }))}
                    required style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14 }} />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>주간 종료 *</span>
                  <input type="date" value={form.weekEnd} onChange={e => setForm(f => ({ ...f, weekEnd: e.target.value }))}
                    required style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14 }} />
                </label>
              </div>

              {/* 금주 / 차주 2컬럼 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <WeekFormBlock week="금주" color="#1976d2" fields={THIS_WEEK_FIELDS} form={form} onChange={setField} />
                <WeekFormBlock week="차주" color="#4caf50" fields={NEXT_WEEK_FIELDS} form={form} onChange={setField} />
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
                <button type="submit"
                  style={{ padding: '8px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600 }}>
                  {editing ? '수정' : '저장'}
                </button>
                <button type="button" onClick={resetForm}
                  style={{ padding: '8px 20px', background: 'var(--c-card)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer' }}>
                  취소
                </button>
              </div>
            </form>
          </>
        ) : selected ? (
          <>
            {/* 헤더 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: '0 0 6px', fontSize: 20 }}>{selected.title}</h2>
                <div style={{ fontSize: 13, color: 'var(--c-text-sub)' }}>
                  {fmtWeek(selected.weekStart, selected.weekEnd)}
                  {' · '}<strong>{selected.author}</strong>
                </div>
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

            {/* 금주 / 차주 2컬럼 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <WeekDetailBlock week="금주" color="#1976d2" rows={[
                { label: '수행',     content: selected.thisWeekWork },
                { label: '제안',     content: selected.thisWeekProposal },
                { label: '기타사항', content: selected.thisWeekEtc },
              ]} />
              <WeekDetailBlock week="차주" color="#4caf50" rows={[
                { label: '수행',     content: selected.nextWeekWork },
                { label: '제안',     content: selected.nextWeekProposal },
                { label: '기타사항', content: selected.nextWeekEtc },
              ]} />
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--c-text-muted)', fontSize: 15 }}>
            목록에서 주간보고를 선택하거나 새로 작성하세요
          </div>
        )}
      </div>
    </div>
  )
}
