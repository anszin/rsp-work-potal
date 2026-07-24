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

function countItems(report: WeeklyReport) {
  const tw = parseItems(report.thisWeekWork).length + parseItems(report.thisWeekProposal).length + parseItems(report.thisWeekEtc).length
  const nw = parseItems(report.nextWeekWork).length + parseItems(report.nextWeekProposal).length + parseItems(report.nextWeekEtc).length
  return { tw, nw }
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

// 해당 주의 목요일 기준으로 월/주차 계산 (ISO 8601)
function getThursday(mon: Date): Date {
  const thu = new Date(mon)
  thu.setDate(mon.getDate() + 3)
  return thu
}

function currentWeekRange() {
  const today = new Date()
  const day = today.getDay()
  const mon = new Date(today)
  mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1))
  const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
  const thu = getThursday(mon)
  const weekOfMonth = Math.ceil(thu.getDate() / 7)
  return {
    weekStart: mon.toISOString().slice(0, 10),
    weekEnd: fri.toISOString().slice(0, 10),
    label: `${thu.getMonth() + 1}월 ${weekOfMonth}주차`,
  }
}

function fmtWeek(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  return `${s.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~ ${e.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
}

function weekLabel(weekStart: string) {
  const mon = new Date(weekStart)
  const thu = getThursday(mon)
  return `${thu.getMonth() + 1}월 ${Math.ceil(thu.getDate() / 7)}주차`
}

interface WeekGroup {
  weekStart: string
  weekEnd: string
  label: string
  reports: WeeklyReport[]
}

function groupByWeek(items: WeeklyReport[]): WeekGroup[] {
  const map = new Map<string, WeekGroup>()
  for (const item of items) {
    if (!map.has(item.weekStart)) {
      map.set(item.weekStart, { weekStart: item.weekStart, weekEnd: item.weekEnd, label: weekLabel(item.weekStart), reports: [] })
    }
    map.get(item.weekStart)!.reports.push(item)
  }
  return Array.from(map.values()).sort((a, b) => b.weekStart.localeCompare(a.weekStart))
}

function emptyFormState(weekStart?: string, weekEnd?: string, label?: string): WeeklyFormState {
  const cur = currentWeekRange()
  return {
    title: `${label ?? cur.label} 주간보고`,
    weekStart: weekStart ?? cur.weekStart,
    weekEnd: weekEnd ?? cur.weekEnd,
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

function WorkSectionForm({ label, sectionColor, items, onChange }: {
  label: string; sectionColor: string; items: WorkItem[]; onChange: (items: WorkItem[]) => void
}) {
  const add = () => onChange([...items, newItem()])
  const update = (idx: number, next: WorkItem) => onChange(items.map((it, i) => i === idx ? next : it))
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: sectionColor, letterSpacing: '0.03em' }}>{label}</span>
        <button type="button" onClick={add}
          style={{ fontSize: 11, padding: '2px 9px', border: `1px solid ${sectionColor}55`, borderRadius: 10, background: sectionColor + '12', color: sectionColor, cursor: 'pointer', fontWeight: 600 }}>
          + 행 추가
        </button>
      </div>
      {items.length === 0 ? (
        <div onClick={add} style={{ fontSize: 12, color: 'var(--c-text-muted)', padding: '7px 12px', background: 'var(--c-bg)', borderRadius: 6, border: '1px dashed var(--c-border)', textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}>
          + 클릭하여 추가
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((item, i) => (
            <div key={item.id} style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              <select value={item.type} onChange={e => update(i, { ...item, type: e.target.value as WorkType })}
                style={{ flexShrink: 0, padding: '4px 6px', borderRadius: 6, border: `1px solid ${TYPE_STYLE[item.type].color}55`, background: TYPE_STYLE[item.type].bg, color: TYPE_STYLE[item.type].color, fontSize: 12, fontWeight: 700, cursor: 'pointer', appearance: 'none', textAlign: 'center', width: 46 }}>
                {WORK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <textarea value={item.content} onChange={e => { update(i, { ...item, content: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                placeholder="업무 내용 입력..." rows={1}
                style={{ flex: 1, padding: '5px 9px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 13, background: 'var(--c-bg)', color: 'var(--c-text)', outline: 'none', resize: 'none', overflow: 'hidden', lineHeight: 1.6, fontFamily: 'inherit', minHeight: 30 }} />
              <button type="button" onClick={() => remove(i)}
                style={{ flexShrink: 0, width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 16, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WeekFormBlock({ week, color, sections, form, onChange }: {
  week: '금주' | '차주'; color: string; sections: { key: ContentKey; label: string }[]; form: WeeklyFormState; onChange: (key: ContentKey, items: WorkItem[]) => void
}) {
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color + '14', borderBottom: `1px solid ${color}22`, fontWeight: 700, fontSize: 13, color }}>{week}</div>
      <div style={{ padding: '14px' }}>
        {sections.map(({ key, label }) => (
          <WorkSectionForm key={key} label={label} sectionColor={color} items={form[key]} onChange={items => onChange(key, items)} />
        ))}
      </div>
    </div>
  )
}

// ── 조회 컴포넌트 ─────────────────────────────────────────────────────────────

function WorkSectionDetail({ label, color, items }: { label: string; color: string; items: WorkItem[] }) {
  if (!items.length) return null
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 6, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', background: 'var(--c-bg)', borderRadius: 6, border: '1px solid var(--c-border)' }}>
            <span style={{ flexShrink: 0, fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700, marginTop: 1, background: TYPE_STYLE[item.type]?.bg ?? 'var(--c-thead)', color: TYPE_STYLE[item.type]?.color ?? 'var(--c-text-muted)' }}>{item.type}</span>
            <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-text)', flex: 1, whiteSpace: 'pre-wrap' }}>{item.content}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WeekDetailBlock({ week, color, sections }: { week: '금주' | '차주'; color: string; sections: { label: string; items: WorkItem[] }[] }) {
  const hasAny = sections.some(s => s.items.length > 0)
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color + '14', borderBottom: `1px solid ${color}22`, fontWeight: 700, fontSize: 13, color }}>{week}</div>
      <div style={{ padding: '14px' }}>
        {hasAny
          ? sections.map(({ label, items }) => <WorkSectionDetail key={label} label={label} color={color} items={items} />)
          : <div style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>내용 없음</div>
        }
      </div>
    </div>
  )
}

// ── 보고서 상세 뷰 ────────────────────────────────────────────────────────────

function ReportDetail({ report, canEdit, onEdit, onDelete }: {
  report: WeeklyReport; canEdit: boolean; onEdit: () => void; onDelete: () => void
}) {
  const isConsolidated = report.reportType === 'CONSOLIDATED'
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            {isConsolidated && (
              <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#7c3aed18', color: '#7c3aed', fontWeight: 700, border: '1px solid #7c3aed33' }}>통합</span>
            )}
            <h2 style={{ margin: 0, fontSize: 20 }}>{report.title}</h2>
          </div>
          <div style={{ fontSize: 13, color: 'var(--c-text-sub)' }}>
            {fmtWeek(report.weekStart, report.weekEnd)}{' · '}<strong>{report.author}</strong>
          </div>
        </div>
        {canEdit && (
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onEdit} style={{ padding: '6px 14px', border: '1px solid #90caf9', borderRadius: 6, background: '#e3f2fd', color: '#1565c0', cursor: 'pointer', fontSize: 13 }}>수정</button>
            <button onClick={onDelete} style={{ padding: '6px 14px', border: '1px solid #ef9a9a', borderRadius: 6, background: '#ffebee', color: '#c62828', cursor: 'pointer', fontSize: 13 }}>삭제</button>
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <WeekDetailBlock week="금주" color="#1976d2" sections={[
          { label: '수행', items: parseItems(report.thisWeekWork) },
          { label: '제안', items: parseItems(report.thisWeekProposal) },
          { label: '기타사항', items: parseItems(report.thisWeekEtc) },
        ]} />
        <WeekDetailBlock week="차주" color="#4caf50" sections={[
          { label: '수행', items: parseItems(report.nextWeekWork) },
          { label: '제안', items: parseItems(report.nextWeekProposal) },
          { label: '기타사항', items: parseItems(report.nextWeekEtc) },
        ]} />
      </div>
    </>
  )
}

// ── 보고서 작성/수정 폼 ───────────────────────────────────────────────────────

const WEEK_SECTIONS: { key: ContentKey; label: string }[] = [
  { key: 'thisWeekWork', label: '수행' }, { key: 'thisWeekProposal', label: '제안' }, { key: 'thisWeekEtc', label: '기타사항' },
]
const NEXT_SECTIONS: { key: ContentKey; label: string }[] = [
  { key: 'nextWeekWork', label: '수행' }, { key: 'nextWeekProposal', label: '제안' }, { key: 'nextWeekEtc', label: '기타사항' },
]

function ReportForm({ form, setForm, isConsolidated, isEditing, onSubmit, onCancel, saving }: {
  form: WeeklyFormState; setForm: React.Dispatch<React.SetStateAction<WeeklyFormState>>
  isConsolidated: boolean; isEditing: boolean; onSubmit: (e: React.FormEvent) => void; onCancel: () => void; saving: boolean
}) {
  const setSection = (key: ContentKey, items: WorkItem[]) => setForm(f => ({ ...f, [key]: items }))
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
        {isConsolidated && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#7c3aed18', color: '#7c3aed', fontWeight: 700, border: '1px solid #7c3aed33' }}>통합</span>}
        <h3 style={{ margin: 0 }}>{isConsolidated ? '통합 주간보고' : (isEditing ? '주간보고 수정' : '새 주간보고 작성')}</h3>
      </div>
      <form onSubmit={onSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>제목 *</span>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14, background: 'var(--c-bg)', color: 'var(--c-text)' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>주간 시작 *</span>
            <input type="date" value={form.weekStart} onChange={e => setForm(f => ({ ...f, weekStart: e.target.value }))} required
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14, background: 'var(--c-bg)', color: 'var(--c-text)' }} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>주간 종료 *</span>
            <input type="date" value={form.weekEnd} onChange={e => setForm(f => ({ ...f, weekEnd: e.target.value }))} required
              style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14, background: 'var(--c-bg)', color: 'var(--c-text)' }} />
          </label>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <WeekFormBlock week="금주" color="#1976d2" sections={WEEK_SECTIONS} form={form} onChange={setSection} />
          <WeekFormBlock week="차주" color="#4caf50" sections={NEXT_SECTIONS} form={form} onChange={setSection} />
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          <button type="submit" disabled={saving}
            style={{ padding: '8px 20px', background: isConsolidated ? '#7c3aed' : '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontWeight: 600, opacity: saving ? 0.7 : 1 }}>
            {saving ? '저장 중...' : (isEditing ? '수정' : '저장')}
          </button>
          <button type="button" onClick={onCancel}
            style={{ padding: '8px 20px', background: 'var(--c-card)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', color: 'var(--c-text)' }}>
            취소
          </button>
        </div>
      </form>
    </>
  )
}

// ── PPT 인쇄 ─────────────────────────────────────────────────────────────────

function PrintSectionRows({ items, color }: { items: WorkItem[]; color: string }) {
  if (!items.length) return null
  return (
    <>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700, marginTop: 1, background: item.type === '중점' ? color + '20' : '#f0f0f0', color: item.type === '중점' ? color : '#888' }}>{item.type}</span>
          <span style={{ fontSize: 11, lineHeight: 1.5, color: '#333' }}>{item.content}</span>
        </div>
      ))}
    </>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

type DetailMode =
  | { type: 'none' }
  | { type: 'view'; report: WeeklyReport }
  | { type: 'form'; editing: WeeklyReport | null; isConsolidated: boolean; defaultWeekStart?: string; defaultWeekEnd?: string; defaultLabel?: string }

export default function WeeklyReportPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isManager = ['ADMIN', 'MANAGER'].includes(user?.role ?? '')

  const [masterTab, setMasterTab] = useState<'mine' | 'overview'>('mine')
  const [selectedWeek, setSelectedWeek] = useState<string>(() => currentWeekRange().weekStart)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<string>>(() => new Set([currentWeekRange().weekStart]))
  const [detail, setDetail] = useState<DetailMode>({ type: 'none' })
  const [form, setForm] = useState<WeeklyFormState>(emptyFormState())
  const [printOpen, setPrintOpen] = useState(false)

  const { data: myReports = [], isLoading } = useQuery({
    queryKey: ['weekly-reports'],
    queryFn: () => weeklyApi.list().then(r => r.data),
  })
  const { data: consolidated = [] } = useQuery({
    queryKey: ['weekly-reports-consolidated'],
    queryFn: () => weeklyApi.listConsolidated().then(r => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['weekly-reports'] })
    qc.invalidateQueries({ queryKey: ['weekly-reports-consolidated'] })
  }

  const createMut = useMutation({
    mutationFn: (d: SaveWeeklyRequest) => weeklyApi.create(d),
    onSuccess: (res) => { invalidate(); setDetail({ type: 'view', report: res.data }) },
  })
  const createConsMut = useMutation({
    mutationFn: (d: SaveWeeklyRequest) => weeklyApi.createConsolidated(d),
    onSuccess: (res) => { invalidate(); setDetail({ type: 'view', report: res.data }) },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: SaveWeeklyRequest }) => weeklyApi.update(id, d),
    onSuccess: (res) => { invalidate(); setDetail({ type: 'view', report: res.data }) },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => weeklyApi.delete(id),
    onSuccess: () => { invalidate(); setDetail({ type: 'none' }) },
  })

  const openForm = (opts: { editing?: WeeklyReport; isConsolidated?: boolean; weekStart?: string; weekEnd?: string; weekLabel?: string }) => {
    const isConsolidated = opts.isConsolidated ?? false
    if (opts.editing) {
      setForm(reportToForm(opts.editing))
    } else {
      setForm(emptyFormState(opts.weekStart, opts.weekEnd, opts.weekLabel))
    }
    setDetail({ type: 'form', editing: opts.editing ?? null, isConsolidated, defaultWeekStart: opts.weekStart, defaultWeekEnd: opts.weekEnd, defaultLabel: opts.weekLabel })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (detail.type !== 'form') return
    const d = formToRequest(form)
    if (detail.editing) updateMut.mutate({ id: detail.editing.id, d })
    else if (detail.isConsolidated) createConsMut.mutate(d)
    else createMut.mutate(d)
  }

  const { weekStart: thisWeekStart } = currentWeekRange()
  const weekGroups = groupByWeek(myReports)

  // 전체 현황 탭용 주차 목록 (내 보고서 + 현재 주차 기준)
  const allWeekStarts = Array.from(new Set([thisWeekStart, ...myReports.map(r => r.weekStart), ...consolidated.map(r => r.weekStart)])).sort((a, b) => b.localeCompare(a))

  // 선택된 주차의 통합보고서
  const weekConsolidated = consolidated.find(r => r.weekStart === selectedWeek)

  const toggleWeek = (ws: string) => setExpandedWeeks(prev => {
    const next = new Set(prev)
    if (next.has(ws)) next.delete(ws); else next.add(ws)
    return next
  })

  const saving = createMut.isPending || createConsMut.isPending || updateMut.isPending

  // ── 선택된 주의 팀원 보고서 (overview용, 이미 myReports에 매니저라면 전원 있음)
  const weekReports = myReports.filter(r => r.weekStart === selectedWeek)

  return (
    <div className="master-detail page-wrap">

      {/* ── PPT 인쇄 오버레이 ─────────────────────────────────────────── */}
      {printOpen && (() => {
        const printItems = myReports.filter(r => r.weekStart === thisWeekStart)
        return (
          <div style={{ position: 'fixed', inset: 0, background: '#fff', zIndex: 9999, overflowY: 'auto', padding: '24px 32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>주간 업무 보고</h2>
                <div style={{ fontSize: 13, color: '#555', marginTop: 3 }}>{fmtWeek(thisWeekStart, printItems[0]?.weekEnd ?? thisWeekStart)} · {printItems.length}명 제출</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => window.print()} style={{ padding: '7px 18px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>🖨 인쇄 / PDF</button>
                <button onClick={() => setPrintOpen(false)} style={{ padding: '7px 14px', background: '#fff', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>닫기</button>
              </div>
            </div>
            {printItems.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#999', paddingTop: 60, fontSize: 14 }}>이번 주 등록된 보고서가 없습니다.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                {printItems.map(report => {
                  const tw = { work: parseItems(report.thisWeekWork), proposal: parseItems(report.thisWeekProposal), etc: parseItems(report.thisWeekEtc) }
                  const nw = { work: parseItems(report.nextWeekWork), proposal: parseItems(report.nextWeekProposal), etc: parseItems(report.nextWeekEtc) }
                  return (
                    <div key={report.id} style={{ pageBreakInside: 'avoid', border: '1px solid #ddd', borderRadius: 10, overflow: 'hidden' }}>
                      <div style={{ padding: '10px 18px', background: '#1976d2', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 15 }}>{report.author}</span>
                        <span style={{ fontSize: 12, opacity: 0.85 }}>{fmtWeek(report.weekStart, report.weekEnd)}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
                        <div style={{ padding: '14px 18px', borderRight: '1px solid #eee' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: '#1976d2', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #1976d230' }}>금주</div>
                          {tw.work.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', marginBottom: 3 }}>수행</div><PrintSectionRows items={tw.work} color="#1976d2" /></>}
                          {tw.proposal.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', margin: '6px 0 3px' }}>제안</div><PrintSectionRows items={tw.proposal} color="#1976d2" /></>}
                          {tw.etc.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', margin: '6px 0 3px' }}>기타</div><PrintSectionRows items={tw.etc} color="#1976d2" /></>}
                        </div>
                        <div style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: '#4caf50', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #4caf5030' }}>차주</div>
                          {nw.work.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', marginBottom: 3 }}>수행</div><PrintSectionRows items={nw.work} color="#4caf50" /></>}
                          {nw.proposal.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', margin: '6px 0 3px' }}>제안</div><PrintSectionRows items={nw.proposal} color="#4caf50" /></>}
                          {nw.etc.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', margin: '6px 0 3px' }}>기타</div><PrintSectionRows items={nw.etc} color="#4caf50" /></>}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })()}

      {/* ── 마스터 패널 ──────────────────────────────────────────────── */}
      <div className="master-panel" style={{ width: 290 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 18 }}>주간보고</h2>
          <div style={{ display: 'flex', gap: 6 }}>
            {isManager && (
              <button onClick={() => setPrintOpen(true)} title="이번 주 전체 보고서 인쇄"
                style={{ padding: '5px 10px', background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: 'var(--c-text-muted)' }}>
                🖨
              </button>
            )}
            <button onClick={() => { setForm(emptyFormState()); setDetail({ type: 'form', editing: null, isConsolidated: false }) }}
              style={{ padding: '6px 14px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>
              + 작성
            </button>
          </div>
        </div>

        {/* 탭 (관리자만) */}
        {isManager && (
          <div style={{ display: 'flex', gap: 0, marginBottom: 14, borderBottom: '1px solid var(--c-border)' }}>
            {(['mine', 'overview'] as const).map(tab => (
              <button key={tab} onClick={() => setMasterTab(tab)}
                style={{ flex: 1, padding: '7px 0', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: masterTab === tab ? 700 : 400, color: masterTab === tab ? '#1976d2' : 'var(--c-text-muted)', borderBottom: masterTab === tab ? '2px solid #1976d2' : '2px solid transparent', marginBottom: -1 }}>
                {tab === 'mine' ? '내 보고서' : '전체 현황'}
              </button>
            ))}
          </div>
        )}

        {isLoading ? <p>로딩 중...</p> : (

          // ── 내 보고서 탭 (팀원 + 관리자 공통) ──────────────────────────
          masterTab === 'mine' || !isManager ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {weekGroups.length === 0
                ? <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 주간보고가 없습니다.</p>
                : weekGroups.map(group => {
                    const isThisWeek = group.weekStart === thisWeekStart
                    const expanded = expandedWeeks.has(group.weekStart)
                    return (
                      <div key={group.weekStart}>
                        <div onClick={() => toggleWeek(group.weekStart)}
                          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 10px', borderRadius: 7, cursor: 'pointer', background: isThisWeek ? '#1976d210' : 'var(--c-thead)', marginBottom: expanded ? 4 : 0, userSelect: 'none' }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isThisWeek ? '#1976d2' : 'var(--c-text-sub)', flex: 1 }}>
                            {group.label}
                            {isThisWeek && <span style={{ fontSize: 10, marginLeft: 5, opacity: 0.7 }}>이번 주</span>}
                          </span>
                          <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 10, background: isThisWeek ? '#1976d225' : 'var(--c-border)', color: isThisWeek ? '#1976d2' : 'var(--c-text-muted)', fontWeight: 600 }}>
                            {isManager ? `${group.reports.length}명` : group.reports.length}
                          </span>
                          <span style={{ fontSize: 10, color: 'var(--c-text-muted)', opacity: 0.6 }}>{expanded ? '▲' : '▼'}</span>
                        </div>
                        {expanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingLeft: 4, marginBottom: 6 }}>
                            {group.reports.map(item => {
                              const isMine = item.author === user?.username
                              const isSelected = detail.type === 'view' && detail.report.id === item.id
                              return (
                                <div key={item.id} onClick={() => setDetail({ type: 'view', report: item })}
                                  style={{ padding: '8px 12px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${isSelected ? '#1976d2' : 'var(--c-border)'}`, background: isSelected ? '#e3f2fd' : 'var(--c-card)' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div style={{ fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                                      {isManager ? item.author : item.title}
                                    </div>
                                    {isMine && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: '#1976d222', color: '#1976d2', fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>내것</span>}
                                  </div>
                                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {isManager ? item.title : fmtWeek(item.weekStart, item.weekEnd)}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })
              }

              {/* 팀원: 통합보고서 섹션 */}
              {!isManager && consolidated.length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--c-border)' }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 6, letterSpacing: '0.04em' }}>통합 보고서</div>
                  {consolidated.map(c => {
                    const isSelected = detail.type === 'view' && detail.report.id === c.id
                    return (
                      <div key={c.id} onClick={() => setDetail({ type: 'view', report: c })}
                        style={{ padding: '8px 12px', borderRadius: 7, cursor: 'pointer', border: `1px solid ${isSelected ? '#7c3aed' : 'var(--c-border)'}`, background: isSelected ? '#f3e8ff' : 'var(--c-card)', marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{weekLabel(c.weekStart)} · {c.author}</div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          // ── 전체 현황 탭 (관리자 전용) ───────────────────────────────
          ) : (
            <div>
              {/* 주차 선택 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
                  style={{ flex: 1, padding: '7px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 13, background: 'var(--c-bg)', color: 'var(--c-text)', cursor: 'pointer' }}>
                  {allWeekStarts.map(ws => (
                    <option key={ws} value={ws}>{weekLabel(ws)}{ws === thisWeekStart ? ' (이번 주)' : ''}</option>
                  ))}
                </select>
              </div>

              {/* 제출 현황 요약 */}
              <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 10 }}>
                제출 <strong style={{ color: weekReports.length > 0 ? '#1976d2' : 'var(--c-text-muted)' }}>{weekReports.length}명</strong>
              </div>

              {/* 팀원 목록 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {weekReports.length === 0 ? (
                  <div style={{ fontSize: 13, color: 'var(--c-text-muted)', textAlign: 'center', padding: '20px 0' }}>이 주차에 등록된 보고서가 없습니다.</div>
                ) : (
                  weekReports.map(r => {
                    const { tw, nw } = countItems(r)
                    const isSelected = detail.type === 'view' && detail.report.id === r.id
                    return (
                      <div key={r.id} onClick={() => setDetail({ type: 'view', report: r })}
                        style={{ padding: '9px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${isSelected ? '#1976d2' : 'var(--c-border)'}`, background: isSelected ? '#e3f2fd' : 'var(--c-card)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 600, fontSize: 13 }}>✅ {r.author}</span>
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 3 }}>
                          금주 {tw}건 · 차주 {nw}건
                        </div>
                      </div>
                    )
                  })
                )}
              </div>

              {/* 통합보고서 영역 */}
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--c-border)' }}>
                {weekConsolidated ? (
                  <div onClick={() => setDetail({ type: 'view', report: weekConsolidated })}
                    style={{ padding: '9px 12px', borderRadius: 8, cursor: 'pointer', border: `1px solid ${detail.type === 'view' && detail.report.id === weekConsolidated.id ? '#7c3aed' : '#7c3aed44'}`, background: detail.type === 'view' && detail.report.id === weekConsolidated.id ? '#f3e8ff' : '#7c3aed08' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: '#7c3aed18', color: '#7c3aed', fontWeight: 700 }}>통합</span>
                      <span style={{ fontWeight: 600, fontSize: 13 }}>{weekConsolidated.title}</span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 3 }}>{weekConsolidated.author} 작성</div>
                  </div>
                ) : (
                  <button onClick={() => {
                    const label = weekLabel(selectedWeek)
                    const selectedGroup = myReports.find(r => r.weekStart === selectedWeek)
                    openForm({ isConsolidated: true, weekStart: selectedWeek, weekEnd: selectedGroup?.weekEnd ?? selectedWeek, weekLabel: label })
                  }}
                    style={{ width: '100%', padding: '9px 12px', border: '1px dashed #7c3aed55', borderRadius: 8, background: 'none', cursor: 'pointer', color: '#7c3aed', fontSize: 13, fontWeight: 600, textAlign: 'center' }}>
                    📋 통합 보고서 작성
                  </button>
                )}
              </div>
            </div>
          )
        )}
      </div>

      {/* ── 디테일 패널 ──────────────────────────────────────────────── */}
      <div className="detail-panel">
        {detail.type === 'form' ? (
          <ReportForm
            form={form} setForm={setForm}
            isConsolidated={detail.isConsolidated}
            isEditing={!!detail.editing}
            onSubmit={handleSubmit}
            onCancel={() => setDetail({ type: 'none' })}
            saving={saving}
          />
        ) : detail.type === 'view' ? (
          <ReportDetail
            report={detail.report}
            canEdit={
              detail.report.reportType === 'CONSOLIDATED'
                ? isManager
                : detail.report.author === user?.username
            }
            onEdit={() => openForm({ editing: detail.report, isConsolidated: detail.report.reportType === 'CONSOLIDATED' })}
            onDelete={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(detail.report.id) }}
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60%', color: 'var(--c-text-muted)', fontSize: 15 }}>
            목록에서 주간보고를 선택하거나 새로 작성하세요
          </div>
        )}
      </div>
    </div>
  )
}
