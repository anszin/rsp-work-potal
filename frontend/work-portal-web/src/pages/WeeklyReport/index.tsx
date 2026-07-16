import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weeklyApi, WeeklyReport, SaveWeeklyRequest } from '../../api/reports'
import { useAuth } from '../../context/useAuth'

// ── 업무 타입 ─────────────────────────────────────────────────────────────────

type WorkType = '중점' | '기타'
const WORK_TYPES: WorkType[] = ['중점', '기타']

const TYPE_STYLE: Record<WorkType, { bg: string; color: string }> = {
  중점: { bg: '#1976d218', color: '#1976d2' },
  기타: { bg: 'var(--c-thead)', color: 'var(--c-text-muted)' },
}

interface WorkItem {
  id: string
  type: WorkType
  content: string
}

type ContentKey =
  | 'thisWeekWork' | 'thisWeekProposal' | 'thisWeekEtc'
  | 'nextWeekWork' | 'nextWeekProposal' | 'nextWeekEtc'

// ── 직렬화 헬퍼 ───────────────────────────────────────────────────────────────

function newItem(): WorkItem {
  return { id: Math.random().toString(36).slice(2), type: '중점', content: '' }
}

function parseItems(raw: string | null | undefined): WorkItem[] {
  if (!raw) return []
  try {
    const arr = JSON.parse(raw)
    if (Array.isArray(arr)) return arr
  } catch { /* 구형 plain-text → 단일 기타 행으로 폴백 */ }
  return [{ id: Math.random().toString(36).slice(2), type: '기타', content: raw }]
}

function serializeItems(items: WorkItem[]): string | undefined {
  const filled = items.filter(i => i.content.trim())
  return filled.length ? JSON.stringify(filled) : undefined
}

// ── 내부 폼 상태 ──────────────────────────────────────────────────────────────

interface WeeklyFormState {
  title: string
  weekStart: string
  weekEnd: string
  thisWeekWork: WorkItem[]
  thisWeekProposal: WorkItem[]
  thisWeekEtc: WorkItem[]
  nextWeekWork: WorkItem[]
  nextWeekProposal: WorkItem[]
  nextWeekEtc: WorkItem[]
}

// ── 날짜 유틸 ────────────────────────────────────────────────────────────────

function currentWeekRange() {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today)
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  const weekOfMonth = Math.ceil(mon.getDate() / 7)
  return {
    weekStart: mon.toISOString().slice(0, 10),
    weekEnd: fri.toISOString().slice(0, 10),
    label: `${mon.getMonth() + 1}월 ${weekOfMonth}주차`,
  }
}

function fmtWeek(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  return `${s.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~ ${e.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
}

function emptyFormState(): WeeklyFormState {
  const { weekStart, weekEnd, label } = currentWeekRange()
  return {
    title: `${label} 주간보고`, weekStart, weekEnd,
    thisWeekWork: [], thisWeekProposal: [], thisWeekEtc: [],
    nextWeekWork: [], nextWeekProposal: [], nextWeekEtc: [],
  }
}

function reportToForm(item: WeeklyReport): WeeklyFormState {
  return {
    title: item.title, weekStart: item.weekStart, weekEnd: item.weekEnd,
    thisWeekWork:     parseItems(item.thisWeekWork),
    thisWeekProposal: parseItems(item.thisWeekProposal),
    thisWeekEtc:      parseItems(item.thisWeekEtc),
    nextWeekWork:     parseItems(item.nextWeekWork),
    nextWeekProposal: parseItems(item.nextWeekProposal),
    nextWeekEtc:      parseItems(item.nextWeekEtc),
  }
}

function formToRequest(f: WeeklyFormState): SaveWeeklyRequest {
  return {
    title: f.title, weekStart: f.weekStart, weekEnd: f.weekEnd,
    thisWeekWork:     serializeItems(f.thisWeekWork),
    thisWeekProposal: serializeItems(f.thisWeekProposal),
    thisWeekEtc:      serializeItems(f.thisWeekEtc),
    nextWeekWork:     serializeItems(f.nextWeekWork),
    nextWeekProposal: serializeItems(f.nextWeekProposal),
    nextWeekEtc:      serializeItems(f.nextWeekEtc),
  }
}

// ── 행 입력 컴포넌트 ──────────────────────────────────────────────────────────

interface WorkSectionFormProps {
  label: string
  sectionColor: string
  items: WorkItem[]
  onChange: (items: WorkItem[]) => void
}

function WorkSectionForm({ label, sectionColor, items, onChange }: WorkSectionFormProps) {
  const add = () => onChange([...items, newItem()])
  const update = (idx: number, next: WorkItem) => onChange(items.map((it, i) => i === idx ? next : it))
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: sectionColor, letterSpacing: '0.03em' }}>{label}</span>
        <button
          type="button" onClick={add}
          style={{ fontSize: 11, padding: '2px 9px', border: `1px solid ${sectionColor}55`, borderRadius: 10, background: sectionColor + '12', color: sectionColor, cursor: 'pointer', fontWeight: 600 }}
        >
          + 행 추가
        </button>
      </div>
      {items.length === 0 ? (
        <div
          onClick={add}
          style={{ fontSize: 12, color: 'var(--c-text-muted)', padding: '7px 12px', background: 'var(--c-bg)', borderRadius: 6, border: '1px dashed var(--c-border)', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
        >
          + 클릭하여 추가
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <select
                value={item.type}
                onChange={e => update(i, { ...item, type: e.target.value as WorkType })}
                style={{
                  flexShrink: 0, padding: '4px 6px', borderRadius: 6,
                  border: `1px solid ${TYPE_STYLE[item.type].color}55`,
                  background: TYPE_STYLE[item.type].bg, color: TYPE_STYLE[item.type].color,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', appearance: 'none',
                  textAlign: 'center', width: 46,
                }}
              >
                {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <textarea
                value={item.content}
                onChange={e => {
                  update(i, { ...item, content: e.target.value })
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                placeholder="업무 내용 입력..."
                rows={1}
                style={{ flex: 1, padding: '5px 9px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 13, background: 'var(--c-bg)', color: 'var(--c-text)', outline: 'none', resize: 'none', overflow: 'hidden', lineHeight: 1.6, fontFamily: 'inherit', minHeight: 30 }}
              />
              <button
                type="button" onClick={() => remove(i)}
                style={{ flexShrink: 0, width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 16, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}
              >×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── 주간 블록 (폼) ────────────────────────────────────────────────────────────

const WEEK_SECTIONS: { key: ContentKey; label: string }[] = [
  { key: 'thisWeekWork',     label: '수행' },
  { key: 'thisWeekProposal', label: '제안' },
  { key: 'thisWeekEtc',      label: '기타사항' },
]
const NEXT_SECTIONS: { key: ContentKey; label: string }[] = [
  { key: 'nextWeekWork',     label: '수행' },
  { key: 'nextWeekProposal', label: '제안' },
  { key: 'nextWeekEtc',      label: '기타사항' },
]

interface WeekFormBlockProps {
  week: '금주' | '차주'
  color: string
  sections: { key: ContentKey; label: string }[]
  form: WeeklyFormState
  onChange: (key: ContentKey, items: WorkItem[]) => void
}

function WeekFormBlock({ week, color, sections, form, onChange }: WeekFormBlockProps) {
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color + '14', borderBottom: `1px solid ${color}22`, fontWeight: 700, fontSize: 13, color }}>
        {week}
      </div>
      <div style={{ padding: '14px' }}>
        {sections.map(({ key, label }) => (
          <WorkSectionForm
            key={key}
            label={label}
            sectionColor={color}
            items={form[key]}
            onChange={items => onChange(key, items)}
          />
        ))}
      </div>
    </div>
  )
}

// ── 행 조회 컴포넌트 ──────────────────────────────────────────────────────────

interface WorkSectionDetailProps {
  label: string
  color: string
  items: WorkItem[]
}

function WorkSectionDetail({ label, color, items }: WorkSectionDetailProps) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', background: 'var(--c-bg)', borderRadius: 6, border: '1px solid var(--c-border)' }}>
            <span style={{
              flexShrink: 0, fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700, marginTop: 1,
              background: TYPE_STYLE[item.type]?.bg ?? 'var(--c-thead)',
              color: TYPE_STYLE[item.type]?.color ?? 'var(--c-text-muted)',
            }}>
              {item.type}
            </span>
            <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-text)', flex: 1 }}>{item.content}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface WeekDetailBlockProps {
  week: '금주' | '차주'
  color: string
  sections: { label: string; items: WorkItem[] }[]
}

function WeekDetailBlock({ week, color, sections }: WeekDetailBlockProps) {
  const hasAny = sections.some(s => s.items.length > 0)
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color + '14', borderBottom: `1px solid ${color}22`, fontWeight: 700, fontSize: 13, color }}>
        {week}
      </div>
      <div style={{ padding: '14px' }}>
        {hasAny
          ? sections.map(({ label, items }) => (
              <WorkSectionDetail key={label} label={label} color={color} items={items} />
            ))
          : <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>내용 없음</div>
        }
      </div>
    </div>
  )
}

// ── PPT 행 렌더 ───────────────────────────────────────────────────────────────

function PrintSectionRows({ items, color }: { items: WorkItem[]; color: string }) {
  if (!items.length) return null
  return (
    <>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
          <span style={{
            flexShrink: 0, fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700, marginTop: 1,
            background: item.type === '중점' ? color + '20' : '#f0f0f0',
            color: item.type === '중점' ? color : '#888',
          }}>
            {item.type}
          </span>
          <span style={{ fontSize: 11, lineHeight: 1.5, color: '#333' }}>{item.content}</span>
        </div>
      ))}
    </>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function WeeklyReportPage() {
  const qc = useQueryClient()
  const { user } = useAuth()

  const [selected, setSelected] = useState<WeeklyReport | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<WeeklyReport | null>(null)
  const [form, setForm] = useState<WeeklyFormState>(emptyFormState())
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

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(emptyFormState()) }

  const openEdit = (item: WeeklyReport) => {
    setEditing(item)
    setForm(reportToForm(item))
    setShowForm(true); setSelected(null)
  }

  const setSection = (key: ContentKey, items: WorkItem[]) =>
    setForm(f => ({ ...f, [key]: items }))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const d = formToRequest(form)
    if (editing) updateMut.mutate({ id: editing.id, d })
    else createMut.mutate(d)
  }

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
              <button onClick={() => window.print()}
                style={{ padding: '7px 18px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                🖨 인쇄 / PDF
              </button>
              <button onClick={() => setPrintOpen(false)}
                style={{ padding: '7px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
                닫기
              </button>
            </div>
          </div>

          {thisWeekItems.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', paddingTop: 60, fontSize: 14 }}>이번 주 등록된 보고서가 없습니다.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {thisWeekItems.map(report => {
                const tw = {
                  work:     parseItems(report.thisWeekWork),
                  proposal: parseItems(report.thisWeekProposal),
                  etc:      parseItems(report.thisWeekEtc),
                }
                const nw = {
                  work:     parseItems(report.nextWeekWork),
                  proposal: parseItems(report.nextWeekProposal),
                  etc:      parseItems(report.nextWeekEtc),
                }
                return (
                  <div key={report.id} style={{ pageBreakInside: 'avoid', border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ padding: '10px 18px', background: '#1976d2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>{report.author}</span>
                      <span style={{ fontSize: 12, opacity: 0.85 }}>{fmtWeek(report.weekStart, report.weekEnd)}</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                      {/* 금주 */}
                      <div style={{ padding: '14px 18px', borderRight: '1px solid #eee' }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#1976d2', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #1976d230' }}>금주</div>
                        {tw.work.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', marginBottom: 3, textTransform: 'uppercase' }}>수행</div><PrintSectionRows items={tw.work} color="#1976d2" /></>}
                        {tw.proposal.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', margin: '6px 0 3px', textTransform: 'uppercase' }}>제안</div><PrintSectionRows items={tw.proposal} color="#1976d2" /></>}
                        {tw.etc.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', margin: '6px 0 3px', textTransform: 'uppercase' }}>기타</div><PrintSectionRows items={tw.etc} color="#1976d2" /></>}
                      </div>
                      {/* 차주 */}
                      <div style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, fontSize: 12, color: '#4caf50', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #4caf5030' }}>차주</div>
                        {nw.work.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', marginBottom: 3, textTransform: 'uppercase' }}>수행</div><PrintSectionRows items={nw.work} color="#4caf50" /></>}
                        {nw.proposal.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', margin: '6px 0 3px', textTransform: 'uppercase' }}>제안</div><PrintSectionRows items={nw.proposal} color="#4caf50" /></>}
                        {nw.etc.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', margin: '6px 0 3px', textTransform: 'uppercase' }}>기타</div><PrintSectionRows items={nw.etc} color="#4caf50" /></>}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── 마스터 패널 ──────────────────────────────────────────────── */}
      <div className="master-panel" style={{ width: 280 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>주간보고</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setPrintOpen(true)} title="이번 주 전체 보고서 인쇄"
              style={{ padding: '5px 10px', background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--c-text-muted)' }}>
              🖨
            </button>
            <button onClick={() => { resetForm(); setShowForm(true); setSelected(null) }}
              style={{ padding: '6px 14px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
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
                  <div key={item.id} onClick={() => { setSelected(item); setShowForm(false) }}
                    style={{ padding: '10px 14px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${isSelected ? '#1976d2' : 'var(--c-border)'}`, background: isSelected ? '#e3f2fd' : 'var(--c-card)' }}>
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

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <WeekFormBlock week="금주" color="#1976d2" sections={WEEK_SECTIONS} form={form} onChange={setSection} />
                <WeekFormBlock week="차주" color="#4caf50" sections={NEXT_SECTIONS} form={form} onChange={setSection} />
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <WeekDetailBlock week="금주" color="#1976d2" sections={[
                { label: '수행',     items: parseItems(selected.thisWeekWork) },
                { label: '제안',     items: parseItems(selected.thisWeekProposal) },
                { label: '기타사항', items: parseItems(selected.thisWeekEtc) },
              ]} />
              <WeekDetailBlock week="차주" color="#4caf50" sections={[
                { label: '수행',     items: parseItems(selected.nextWeekWork) },
                { label: '제안',     items: parseItems(selected.nextWeekProposal) },
                { label: '기타사항', items: parseItems(selected.nextWeekEtc) },
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
