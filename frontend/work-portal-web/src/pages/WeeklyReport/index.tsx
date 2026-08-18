import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { weeklyApi, WeeklyReport, SaveWeeklyRequest } from '../../api/reports'
import { getKeyTasks, KeyTask } from '../../api/keyTasks'
import { workUnitApi, WorkUnit } from '../../api/workUnits'
import { useAuth } from '../../context/useAuth'

// ── 업무 아이템 ───────────────────────────────────────────────────────────────

interface WorkItem {
  id: string
  type: string        // keyTask.kpi 또는 '기타' (구형 '중점' 포함)
  content: string
  keyTaskId?: number
  keyTaskName?: string
  workUnitId?: number
  workUnitName?: string
}

function itemBadge(item: WorkItem): { bg: string; color: string; label: string } {
  if (item.workUnitId) return { bg: '#1976d218', color: '#1976d2', label: item.workUnitName || item.type || '단위업무' }
  if (item.keyTaskId) return { bg: '#1976d218', color: '#1976d2', label: item.type || '중점' }
  return { bg: 'var(--c-thead)', color: 'var(--c-text-muted)', label: '기타' }
}

type ContentKey =
  | 'thisWeekWork' | 'thisWeekProposal' | 'thisWeekEtc'
  | 'nextWeekWork' | 'nextWeekProposal' | 'nextWeekEtc'

// ── 직렬화 헬퍼 ───────────────────────────────────────────────────────────────

function newItem(): WorkItem {
  return { id: Math.random().toString(36).slice(2), type: '기타', content: '' }
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
  nextWeekStart: string
  nextWeekEnd: string
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

function fmtShort(start: string, end: string) {
  const s = new Date(start), e = new Date(end)
  return `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}`
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10)
}

function weekLabel(weekStart: string) {
  const mon = new Date(weekStart)
  const thu = getThursday(mon)
  return `${thu.getMonth() + 1}월 ${Math.ceil(thu.getDate() / 7)}주차`
}

function getPastWeeks(n: number): { weekStart: string; weekEnd: string; label: string; weekLabel: string }[] {
  const result = []
  const today = new Date()
  const day = today.getDay()
  for (let i = 0; i < n; i++) {
    const mon = new Date(today)
    mon.setDate(today.getDate() - (day === 0 ? 6 : day - 1) - i * 7)
    const fri = new Date(mon); fri.setDate(mon.getDate() + 4)
    const thu = getThursday(mon)
    const wl = `${thu.getMonth() + 1}월 ${Math.ceil(thu.getDate() / 7)}주차`
    result.push({
      weekStart: mon.toISOString().slice(0, 10),
      weekEnd: fri.toISOString().slice(0, 10),
      label: i === 0 ? `이번 주 (${wl})` : `${i}주 전 (${wl})`,
      weekLabel: wl,
    })
  }
  return result
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
  const ws = weekStart ?? cur.weekStart
  const we = weekEnd ?? cur.weekEnd
  return {
    title: `${label ?? cur.label} 주간보고`,
    weekStart: ws, weekEnd: we,
    nextWeekStart: addDays(ws, 7), nextWeekEnd: addDays(we, 7),
    thisWeekWork: [], thisWeekProposal: [], thisWeekEtc: [],
    nextWeekWork: [], nextWeekProposal: [], nextWeekEtc: [],
  }
}

function reportToForm(item: WeeklyReport): WeeklyFormState {
  return {
    title: item.title, weekStart: item.weekStart, weekEnd: item.weekEnd,
    nextWeekStart: addDays(item.weekStart, 7), nextWeekEnd: addDays(item.weekEnd, 7),
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

// ── KPI 커스텀 드롭다운 ───────────────────────────────────────────────────────

function KpiSelect({ value, onChange, keyTasks, workUnits }: {
  value: string; onChange: (v: string) => void; keyTasks: KeyTask[]; workUnits: WorkUnit[]
}) {
  const [open, setOpen] = useState(false)

  const selectedWuId = value.startsWith('wu:') ? parseInt(value.slice(3)) : null
  const selectedWu = selectedWuId != null ? workUnits.find(w => w.id === selectedWuId) : null
  const isLinked = !!selectedWu
  const shortLabel = selectedWu
    ? (selectedWu.title.length > 8 ? selectedWu.title.slice(0, 8) + '…' : selectedWu.title)
    : '기타'

  // workUnit을 keyTaskId별로 그룹화
  const wuByKt = new Map<number, WorkUnit[]>()
  for (const wu of workUnits) {
    if (!wuByKt.has(wu.keyTaskId)) wuByKt.set(wu.keyTaskId, [])
    wuByKt.get(wu.keyTaskId)!.push(wu)
  }

  const wuRowStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 12px 7px 24px', cursor: 'pointer', fontSize: 13,
    display: 'flex', alignItems: 'center', gap: 6,
    background: active ? '#1976d20a' : 'transparent',
    color: active ? '#1976d2' : 'var(--c-text)',
    fontWeight: active ? 600 : 400,
  })

  const groupHeaderStyle: React.CSSProperties = {
    padding: '5px 12px', fontSize: 11, fontWeight: 700,
    color: 'var(--c-text-muted)', background: 'var(--c-thead)',
    borderTop: '1px solid var(--c-border-in)', display: 'flex', alignItems: 'center', gap: 5,
  }

  return (
    <div style={{ position: 'relative', flexShrink: 0, width: 88 }}>
      {open && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setOpen(false)} />}
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', padding: '5px 7px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
          border: `1px solid ${isLinked ? '#1976d255' : 'var(--c-border-in)'}`,
          background: isLinked ? '#1976d218' : 'var(--c-thead)',
          color: isLinked ? '#1976d2' : 'var(--c-text-muted)',
          fontWeight: isLinked ? 700 : 400,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
          overflow: 'hidden',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, textAlign: 'left' }}>{shortLabel}</span>
        <span style={{ fontSize: 8, opacity: 0.5, flexShrink: 0 }}>▼</span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 3px)', left: 0, zIndex: 100,
          background: 'var(--c-card)', border: '1px solid var(--c-border-in)',
          borderRadius: 7, boxShadow: '0 4px 16px rgba(0,0,0,0.18)',
          minWidth: 360, maxHeight: 320, overflowY: 'auto',
        }}>
          {/* 기타 */}
          <div onClick={() => { onChange(''); setOpen(false) }}
            style={{ ...wuRowStyle(!value), paddingLeft: 12, borderBottom: '1px solid var(--c-border-in)' }}>
            <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: 'var(--c-thead)', color: 'var(--c-text-muted)', fontWeight: 600 }}>기타</span>
          </div>
          {/* 중점과제 그룹헤더 → 단위업무 항목 */}
          {keyTasks.map(kt => {
            const wus = wuByKt.get(kt.id) ?? []
            if (wus.length === 0) return null
            return (
              <div key={kt.id}>
                <div style={groupHeaderStyle}>
                  {kt.kpi && (
                    <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: '#1976d215', color: '#1976d2', fontWeight: 700 }}>{kt.kpi}</span>
                  )}
                  <span>{kt.taskName}</span>
                </div>
                {wus.map(wu => (
                  <div key={wu.id} onClick={() => { onChange(`wu:${wu.id}`); setOpen(false) }}
                    style={wuRowStyle(value === `wu:${wu.id}`)}>
                    <span style={{ fontSize: 11, opacity: 0.35, marginRight: 2 }}>└</span>
                    <span>{wu.title}</span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 행 입력 컴포넌트 ──────────────────────────────────────────────────────────

function WorkSectionForm({ label, sectionColor, items, onChange, keyTasks = [], workUnits = [] }: {
  label: string; sectionColor: string; items: WorkItem[]; onChange: (items: WorkItem[]) => void; keyTasks?: KeyTask[]; workUnits?: WorkUnit[]
}) {
  const add = () => onChange([...items, newItem()])
  const update = (idx: number, next: WorkItem) => onChange(items.map((it, i) => i === idx ? next : it))
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx))

  const selectTask = (idx: number, val: string) => {
    if (!val) {
      update(idx, { ...items[idx], type: '기타', keyTaskId: undefined, keyTaskName: undefined, workUnitId: undefined, workUnitName: undefined })
    } else if (val.startsWith('wu:')) {
      const wuId = parseInt(val.slice(3))
      const wu = workUnits.find(w => w.id === wuId)
      const kt = wu ? keyTasks.find(k => k.id === wu.keyTaskId) : undefined
      if (wu) update(idx, { ...items[idx], type: kt?.kpi || '단위업무', keyTaskId: kt?.id, keyTaskName: kt?.taskName, workUnitId: wu.id, workUnitName: wu.title })
    }
  }

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
            <div key={item.id} style={{ display: 'flex', gap: 5, alignItems: 'flex-start' }}>
              <KpiSelect
                value={item.workUnitId ? `wu:${item.workUnitId}` : ''}
                onChange={v => selectTask(i, v)}
                keyTasks={keyTasks}
                workUnits={workUnits}
              />
              <textarea value={item.content} onChange={e => { update(i, { ...item, content: e.target.value }); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                onFocus={e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
                placeholder="업무 내용 입력..." rows={1}
                style={{ flex: 1, padding: '5px 9px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 13, background: 'var(--c-bg)', color: 'var(--c-text)', outline: 'none', resize: 'none', overflow: 'hidden', lineHeight: 1.6, fontFamily: 'inherit', minHeight: 30 }} />
              <button type="button" onClick={() => remove(i)}
                style={{ flexShrink: 0, width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 16, lineHeight: 1, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6, marginTop: 4 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function WeekFormBlock({ week, color, sections, form, onChange, onDateChange, keyTasks, workUnits }: {
  week: '금주' | '차주'; color: string; sections: { key: ContentKey; label: string }[]
  form: WeeklyFormState; onChange: (key: ContentKey, items: WorkItem[]) => void
  onDateChange: (start: string, end: string) => void; keyTasks: KeyTask[]; workUnits: WorkUnit[]
}) {
  const isThis = week === '금주'
  const startVal = isThis ? form.weekStart : form.nextWeekStart
  const endVal   = isThis ? form.weekEnd   : form.nextWeekEnd
  const dateInput: React.CSSProperties = {
    padding: '3px 6px', borderRadius: 5, border: `1px solid ${color}55`,
    background: color + '10', color, fontSize: 12, width: 110,
  }
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10 }}>
      <div style={{ padding: '8px 14px', background: color + '14', borderBottom: `1px solid ${color}22`, display: 'flex', alignItems: 'center', gap: 10, borderRadius: '10px 10px 0 0' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color, flexShrink: 0 }}>{week}</span>
        <input type="date" value={startVal} onChange={e => onDateChange(e.target.value, endVal)} style={dateInput} />
        <span style={{ fontSize: 12, color, opacity: 0.5 }}>~</span>
        <input type="date" value={endVal} onChange={e => onDateChange(startVal, e.target.value)} style={dateInput} />
      </div>
      <div style={{ padding: '14px' }}>
        {sections.map(({ key, label }) => (
          <WorkSectionForm key={key} label={label} sectionColor={color} items={form[key]} onChange={items => onChange(key, items)} keyTasks={keyTasks} workUnits={workUnits} />
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
        {items.map((item, i) => {
          const { bg, color: badgeColor, label: badgeLabel } = itemBadge(item)
          return (
            <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', background: 'var(--c-bg)', borderRadius: 6, border: '1px solid var(--c-border)' }}>
              <span style={{ flexShrink: 0, fontSize: 10, padding: '2px 7px', borderRadius: 10, fontWeight: 700, marginTop: 2, background: bg, color: badgeColor, maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {badgeLabel}
              </span>
              <span style={{ fontSize: 13, lineHeight: 1.6, color: 'var(--c-text-sub)', whiteSpace: 'pre-wrap' }}>{item.content}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function WeekDetailBlock({ week, color, sections, dateRange }: { week: '금주' | '차주'; color: string; sections: { label: string; items: WorkItem[] }[]; dateRange?: string }) {
  const hasAny = sections.some(s => s.items.length > 0)
  return (
    <div style={{ border: `1px solid ${color}33`, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: color + '14', borderBottom: `1px solid ${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color }}>{week}</span>
        {dateRange && <span style={{ fontSize: 11, color, opacity: 0.65 }}>{dateRange}</span>}
      </div>
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
        <WeekDetailBlock week="금주" color="#1976d2" dateRange={fmtShort(report.weekStart, report.weekEnd)} sections={[
          { label: '수행', items: parseItems(report.thisWeekWork) },
          { label: '제안', items: parseItems(report.thisWeekProposal) },
          { label: '기타사항', items: parseItems(report.thisWeekEtc) },
        ]} />
        <WeekDetailBlock week="차주" color="#4caf50" dateRange={fmtShort(addDays(report.weekStart, 7), addDays(report.weekEnd, 7))} sections={[
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

function ReportForm({ form, setForm, isConsolidated, isEditing, onSubmit, onCancel, saving, keyTasks, workUnits, pastReports }: {
  form: WeeklyFormState; setForm: React.Dispatch<React.SetStateAction<WeeklyFormState>>
  isConsolidated: boolean; isEditing: boolean; onSubmit: (e: React.FormEvent) => void; onCancel: () => void; saving: boolean; keyTasks: KeyTask[]; workUnits: WorkUnit[]; pastReports?: WeeklyReport[]
}) {
  const setSection = (key: ContentKey, items: WorkItem[]) => setForm(f => ({ ...f, [key]: items }))
  const setThisWeekDates = (start: string, end: string) => setForm(f => ({ ...f, weekStart: start, weekEnd: end }))
  const setNextWeekDates = (start: string, end: string) => setForm(f => ({ ...f, nextWeekStart: start, nextWeekEnd: end }))
  const [copySourceId, setCopySourceId] = useState('')

  const copyFromReport = (reportId: string) => {
    setCopySourceId(reportId)
    if (!reportId || !pastReports) return
    const source = pastReports.find(r => String(r.id) === reportId)
    if (!source) return
    setForm(f => ({
      ...f,
      thisWeekWork:     parseItems(source.nextWeekWork),
      thisWeekProposal: parseItems(source.nextWeekProposal),
      thisWeekEtc:      parseItems(source.nextWeekEtc),
    }))
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isConsolidated && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#7c3aed18', color: '#7c3aed', fontWeight: 700, border: '1px solid #7c3aed33' }}>통합</span>}
          <h3 style={{ margin: 0 }}>{isConsolidated ? '통합 주간보고' : (isEditing ? '주간보고 수정' : '새 주간보고 작성')}</h3>
        </div>
        {!isEditing && !isConsolidated && pastReports && pastReports.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)', flexShrink: 0 }}>📋 이전 보고서 차주</span>
            <select value={copySourceId} onChange={e => copyFromReport(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #1976d255', background: 'var(--c-bg)', color: '#1976d2', cursor: 'pointer' }}>
              <option value="">주차 선택...</option>
              {pastReports.map(r => (
                <option key={r.id} value={String(r.id)}>{weekLabel(r.weekStart)}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: 'var(--c-text-muted)', flexShrink: 0 }}>→ 금주 복사</span>
          </div>
        )}
      </div>
      <form onSubmit={onSubmit}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>제목 *</span>
          <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required
            style={{ padding: '8px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14, background: 'var(--c-bg)', color: 'var(--c-text)' }} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <WeekFormBlock week="금주" color="#1976d2" sections={WEEK_SECTIONS} form={form} onChange={setSection} onDateChange={setThisWeekDates} keyTasks={keyTasks} workUnits={workUnits} />
          <WeekFormBlock week="차주" color="#4caf50" sections={NEXT_SECTIONS} form={form} onChange={setSection} onDateChange={setNextWeekDates} keyTasks={keyTasks} workUnits={workUnits} />
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

// ── 통합보고서 좌우 분할 에디터 ──────────────────────────────────────────────────

const SECTION_KEYS: ContentKey[] = [
  'thisWeekWork', 'thisWeekProposal', 'thisWeekEtc',
  'nextWeekWork', 'nextWeekProposal', 'nextWeekEtc',
]
const SECTION_LABELS: Record<ContentKey, string> = {
  thisWeekWork: '금주 수행', thisWeekProposal: '금주 제안', thisWeekEtc: '금주 기타',
  nextWeekWork: '차주 수행', nextWeekProposal: '차주 제안', nextWeekEtc: '차주 기타',
}
const SECTION_COLOR: Record<ContentKey, string> = {
  thisWeekWork: '#1976d2', thisWeekProposal: '#1976d2', thisWeekEtc: '#1976d2',
  nextWeekWork: '#4caf50', nextWeekProposal: '#4caf50', nextWeekEtc: '#4caf50',
}

function ConsolidatedEditor({ weekLbl, individualReports, existing, pastConsolidated, onSave, onCancel }: {
  weekLbl: string
  individualReports: WeeklyReport[]
  existing?: WeeklyReport
  pastConsolidated?: WeeklyReport[]
  onSave: (form: WeeklyFormState) => void
  onCancel: () => void
}) {
  const [conForm, setConForm] = useState<WeeklyFormState>(() =>
    existing ? reportToForm(existing) : emptyFormState(
      individualReports[0]?.weekStart,
      individualReports[0]?.weekEnd,
      weekLbl,
    )
  )
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(individualReports.map(r => r.author)))
  // 추가된 원본 항목 키 추적 (reportId_sec_itemId)
  const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set())

  const toggleExpand = (author: string) =>
    setExpanded(prev => { const next = new Set(prev); next.has(author) ? next.delete(author) : next.add(author); return next })

  const addItem = (reportId: number, sec: ContentKey, item: WorkItem, _author: string) => {
    const key = `${reportId}_${sec}_${item.id}`
    if (addedKeys.has(key)) return
    setAddedKeys(prev => new Set([...prev, key]))
    const added: WorkItem = { ...item, id: Math.random().toString(36).slice(2) }
    setConForm(f => ({ ...f, [sec]: [...f[sec], added] }))
  }

  const removeItem = (sec: ContentKey, itemId: string) =>
    setConForm(f => ({ ...f, [sec]: f[sec].filter(i => i.id !== itemId) }))

  const updateItem = (sec: ContentKey, itemId: string, content: string) =>
    setConForm(f => ({ ...f, [sec]: f[sec].map(i => i.id === itemId ? { ...i, content } : i) }))

  const totalRight = SECTION_KEYS.reduce((acc, sec) => acc + conForm[sec].length, 0)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: 'var(--c-bg)' }}>

      {/* 상단 헤더 */}
      <div style={{ padding: '10px 20px', background: 'var(--c-card)', borderBottom: '2px solid #7c3aed33', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#7c3aed18', color: '#7c3aed', fontWeight: 700, border: '1px solid #7c3aed33' }}>통합</span>
          <span style={{ fontSize: 16, fontWeight: 700 }}>{weekLbl} 통합 주간보고 편집</span>
          {pastConsolidated && pastConsolidated.length > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)', flexShrink: 0 }}>📋 이전 통합본 차주</span>
              <select defaultValue="" onChange={e => {
                if (!e.target.value) return
                const src = pastConsolidated.find(r => String(r.id) === e.target.value)
                if (!src) return
                setConForm(f => ({
                  ...f,
                  thisWeekWork:     [...f.thisWeekWork,     ...parseItems(src.nextWeekWork)],
                  thisWeekProposal: [...f.thisWeekProposal, ...parseItems(src.nextWeekProposal)],
                  thisWeekEtc:      [...f.thisWeekEtc,      ...parseItems(src.nextWeekEtc)],
                }))
                e.target.value = ''
              }}
                style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid #7c3aed55', background: 'var(--c-bg)', color: '#7c3aed', cursor: 'pointer' }}>
                <option value="">주차 선택...</option>
                {pastConsolidated.map(r => (
                  <option key={r.id} value={String(r.id)}>{weekLabel(r.weekStart)}</option>
                ))}
              </select>
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)', flexShrink: 0 }}>→ 금주 추가</span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={{ padding: '7px 16px', background: 'var(--c-card)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', fontSize: 13 }}>취소</button>
          <button onClick={() => onSave(conForm)} disabled={totalRight === 0}
            style={{ padding: '7px 20px', background: totalRight > 0 ? '#7c3aed' : '#ccc', color: '#fff', border: 'none', borderRadius: 6, cursor: totalRight > 0 ? 'pointer' : 'not-allowed', fontWeight: 600, fontSize: 13 }}>
            저장 ({totalRight}개)
          </button>
        </div>
      </div>

      {/* 좌우 분할 본문 */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', overflow: 'hidden' }}>

        {/* ── 왼쪽: 개인 보고서 ── */}
        <div style={{ overflowY: 'auto', borderRight: '2px solid var(--c-border)', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--c-text-muted)', marginBottom: 10, letterSpacing: '0.05em' }}>
            개인 보고서 ({individualReports.length}명)
          </div>
          {individualReports.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-text-muted)', fontSize: 14 }}>이 주차에 제출된 개인 보고서가 없습니다.</div>
          ) : individualReports.map(report => {
            const isExp = expanded.has(report.author)
            const reportItemCount = SECTION_KEYS.reduce((acc, sec) => acc + parseItems(report[sec as keyof WeeklyReport] as string).length, 0)
            const addedCount = SECTION_KEYS.reduce((acc, sec) =>
              acc + parseItems(report[sec as keyof WeeklyReport] as string).filter(item => addedKeys.has(`${report.id}_${sec}_${item.id}`)).length, 0)

            return (
              <div key={report.id} style={{ marginBottom: 8, border: '1px solid var(--c-border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '8px 12px', background: 'var(--c-thead)', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                  onClick={() => toggleExpand(report.author)}>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: 13 }}>{report.author}</span>
                  {addedCount > 0 && (
                    <span style={{ fontSize: 11, padding: '1px 6px', borderRadius: 8, background: '#7c3aed18', color: '#7c3aed', fontWeight: 700 }}>{addedCount}/{reportItemCount} 추가됨</span>
                  )}
                  <span style={{ fontSize: 10, color: 'var(--c-text-muted)' }}>{isExp ? '▲' : '▼'}</span>
                </div>

                {isExp && (
                  <div style={{ padding: '10px 12px' }}>
                    {SECTION_KEYS.map(sec => {
                      const items = parseItems(report[sec as keyof WeeklyReport] as string)
                      if (!items.length) return null
                      return (
                        <div key={sec} style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: SECTION_COLOR[sec], marginBottom: 4 }}>{SECTION_LABELS[sec]}</div>
                          {items.map(item => {
                            const key = `${report.id}_${sec}_${item.id}`
                            const isAdded = addedKeys.has(key)
                            const { bg, color: badgeColor, label: badgeLabel } = itemBadge(item)
                            return (
                              <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: isAdded ? '#f0fdf4' : 'var(--c-bg)', border: `1px solid ${isAdded ? '#22c55e44' : 'var(--c-border)'}` }}>
                                <span style={{ flexShrink: 0, fontSize: 10, padding: '1px 5px', borderRadius: 8, fontWeight: 700, marginTop: 2, background: bg, color: badgeColor }}>{badgeLabel}</span>
                                <span style={{ flex: 1, fontSize: 12, lineHeight: 1.5, color: 'var(--c-text)', whiteSpace: 'pre-wrap' }}>{item.content}</span>
                                <button onClick={() => addItem(report.id, sec, item, report.author)} disabled={isAdded}
                                  style={{ flexShrink: 0, padding: '2px 9px', fontSize: 12, border: 'none', borderRadius: 4, cursor: isAdded ? 'default' : 'pointer', background: isAdded ? '#22c55e22' : '#7c3aed', color: isAdded ? '#16a34a' : '#fff', fontWeight: 700, minWidth: 32 }}>
                                  {isAdded ? '✓' : '+'}
                                </button>
                              </div>
                            )
                          })}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* ── 오른쪽: 통합 보고서 ── */}
        <div style={{ overflowY: 'auto', padding: '14px 16px' }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#7c3aed', marginBottom: 6, letterSpacing: '0.05em' }}>통합 보고서 (편집 중)</div>
          <input value={conForm.title} onChange={e => setConForm(f => ({ ...f, title: e.target.value }))}
            style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14, fontWeight: 600, background: 'var(--c-bg)', color: 'var(--c-text)', marginBottom: 12, boxSizing: 'border-box' }} />

          {(['금주', '차주'] as const).map(week => {
            const color = week === '금주' ? '#1976d2' : '#4caf50'
            const secKeys: ContentKey[] = week === '금주'
              ? ['thisWeekWork', 'thisWeekProposal', 'thisWeekEtc']
              : ['nextWeekWork', 'nextWeekProposal', 'nextWeekEtc']
            return (
              <div key={week} style={{ marginBottom: 12, border: `1px solid ${color}33`, borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ padding: '7px 12px', background: color + '12', fontWeight: 700, fontSize: 13, color, borderBottom: `1px solid ${color}22` }}>{week}</div>
                <div style={{ padding: '10px 12px' }}>
                  {secKeys.map(sec => {
                    const items = conForm[sec]
                    return (
                      <div key={sec} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color, marginBottom: 4 }}>{SECTION_LABELS[sec]}</div>
                        {items.length === 0 ? (
                          <div style={{ fontSize: 12, color: 'var(--c-text-muted)', fontStyle: 'italic', padding: '3px 0' }}>없음 — 왼쪽에서 + 버튼으로 추가</div>
                        ) : items.map(item => {
                          const { bg, color: badgeColor, label: badgeLabel } = itemBadge(item)
                          return (
                            <div key={item.id} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', padding: '5px 7px', borderRadius: 6, marginBottom: 3, background: 'var(--c-bg)', border: '1px solid var(--c-border-in)' }}>
                              <span style={{ flexShrink: 0, fontSize: 10, padding: '1px 5px', borderRadius: 8, fontWeight: 700, marginTop: 3, background: bg, color: badgeColor }}>{badgeLabel}</span>
                              <textarea value={item.content}
                                onChange={e => updateItem(sec, item.id, e.target.value)}
                                onInput={e => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = t.scrollHeight + 'px' }}
                                ref={el => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}
                                style={{ flex: 1, fontSize: 12, lineHeight: 1.6, color: 'var(--c-text)', background: 'transparent', border: 'none', outline: 'none', resize: 'none', overflow: 'hidden', fontFamily: 'inherit', padding: 0, minHeight: 20 }} />
                              <button onClick={() => removeItem(sec, item.id)}
                                style={{ flexShrink: 0, width: 22, height: 22, border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 16, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.7, marginTop: 1 }}>×</button>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── PPT 인쇄 ─────────────────────────────────────────────────────────────────

function PrintSectionRows({ items }: { items: WorkItem[] }) {
  if (!items.length) return null
  return (
    <>
      {items.map((item, i) => (
        <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'flex-start' }}>
          {item.keyTaskId && (
            <span style={{ flexShrink: 0, fontSize: 9, padding: '1px 5px', borderRadius: 8, fontWeight: 700, marginTop: 1, background: '#1976d220', color: '#1976d2', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              📌 {item.keyTaskName}
            </span>
          )}
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
  const [writeMenuOpen, setWriteMenuOpen] = useState(false)
  const [editorConfig, setEditorConfig] = useState<{ weekStart: string; weekEnd: string; weekLabel: string; existing?: WeeklyReport } | null>(null)
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
  const { data: allKeyTasks = [] } = useQuery({
    queryKey: ['key-tasks', new Date().getFullYear()],
    queryFn: () => getKeyTasks(new Date().getFullYear()),
  })
  const { data: allWorkUnits = [] } = useQuery({
    queryKey: ['work-units'],
    queryFn: () => workUnitApi.listAll(),
  })
  // 팀 과제 제외, 담당부서/담당자 레벨 과제만 표시
  const keyTasks = allKeyTasks.filter(kt => kt.taskLevel === '담당부서' || kt.taskLevel === '담당자')
  // 드롭다운용 단위업무 (위 keyTasks에 속하는 것만)
  const ktIds = new Set(keyTasks.map(k => k.id))
  const workUnits = allWorkUnits.filter(wu => ktIds.has(wu.keyTaskId))

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

  const handleEditorSave = (conForm: WeeklyFormState) => {
    const d = formToRequest(conForm)
    if (editorConfig?.existing) updateMut.mutate({ id: editorConfig.existing.id, d })
    else createConsMut.mutate(d)
    setEditorConfig(null)
  }

  // 본인의 개인 보고서 목록 (주차 선택 복사용, 최신순)
  const myPastReports = myReports
    .filter(r => r.reportType === 'INDIVIDUAL' && r.author === user?.username)
    .sort((a, b) => b.weekStart.localeCompare(a.weekStart))

  // ── 선택된 주의 팀원 보고서 (overview용, 이미 myReports에 매니저라면 전원 있음)
  const weekReports = myReports.filter(r => r.weekStart === selectedWeek)

  return (
    <div className="master-detail page-wrap">
      {/* ── 통합보고서 좌우 분할 에디터 ──────────────────────────────── */}
      {editorConfig && (
        <ConsolidatedEditor
          weekLbl={editorConfig.weekLabel}
          individualReports={myReports.filter(r => r.weekStart === editorConfig.weekStart && r.reportType === 'INDIVIDUAL')}
          existing={editorConfig.existing}
          pastConsolidated={consolidated.filter(r => r.weekStart < editorConfig.weekStart).sort((a, b) => b.weekStart.localeCompare(a.weekStart))}
          onSave={handleEditorSave}
          onCancel={() => setEditorConfig(null)}
        />
      )}

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
                          {tw.work.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', marginBottom: 3 }}>수행</div><PrintSectionRows items={tw.work} /></>}
                          {tw.proposal.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', margin: '6px 0 3px' }}>제안</div><PrintSectionRows items={tw.proposal} /></>}
                          {tw.etc.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#1976d2', margin: '6px 0 3px' }}>기타</div><PrintSectionRows items={tw.etc} /></>}
                        </div>
                        <div style={{ padding: '14px 18px' }}>
                          <div style={{ fontWeight: 700, fontSize: 12, color: '#4caf50', marginBottom: 8, paddingBottom: 4, borderBottom: '1px solid #4caf5030' }}>차주</div>
                          {nw.work.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', marginBottom: 3 }}>수행</div><PrintSectionRows items={nw.work} /></>}
                          {nw.proposal.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', margin: '6px 0 3px' }}>제안</div><PrintSectionRows items={nw.proposal} /></>}
                          {nw.etc.length > 0 && <><div style={{ fontSize: 10, fontWeight: 700, color: '#4caf50', margin: '6px 0 3px' }}>기타</div><PrintSectionRows items={nw.etc} /></>}
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
            <div style={{ position: 'relative' }}>
              {writeMenuOpen && <div style={{ position: 'fixed', inset: 0, zIndex: 99 }} onClick={() => setWriteMenuOpen(false)} />}
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid #1565c0' }}>
                <button onClick={() => { setWriteMenuOpen(false); openForm({}) }}
                  style={{ padding: '6px 12px', background: '#1976d2', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                  + 작성
                </button>
                <button onClick={() => setWriteMenuOpen(o => !o)}
                  style={{ padding: '6px 10px', background: '#1976d2', color: '#fff', border: 'none', borderLeft: '2px solid rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13, lineHeight: 1 }}>
                  ⌄
                </button>
              </div>
              {writeMenuOpen && (
                <div style={{ position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 100, background: 'var(--c-card)', border: '1px solid var(--c-border-in)', borderRadius: 8, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', minWidth: 210, overflow: 'hidden' }}>
                  {getPastWeeks(5).map((w, i) => (
                    <div key={w.weekStart} onClick={() => { setWriteMenuOpen(false); openForm({ weekStart: w.weekStart, weekEnd: w.weekEnd, weekLabel: w.weekLabel }) }}
                      style={{ padding: '10px 14px', cursor: 'pointer', fontSize: 13, borderBottom: '1px solid var(--c-border-in)', color: i === 0 ? '#1976d2' : 'var(--c-text)', fontWeight: i === 0 ? 600 : 400, background: 'transparent' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--c-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      {w.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                                    {isMine && <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: '#1976d222', color: '#1976d2', fontWeight: 700, flexShrink: 0, marginLeft: 4 }}>Me</span>}
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
                    setEditorConfig({ weekStart: selectedWeek, weekEnd: selectedGroup?.weekEnd ?? selectedWeek, weekLabel: label })
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
            keyTasks={keyTasks}
            workUnits={workUnits}
            pastReports={myPastReports}
          />
        ) : detail.type === 'view' ? (
          <ReportDetail
            report={detail.report}
            canEdit={isManager || detail.report.author === user?.username}
            onEdit={() => {
              if (detail.report.reportType === 'CONSOLIDATED') {
                setEditorConfig({ weekStart: detail.report.weekStart, weekEnd: detail.report.weekEnd, weekLabel: weekLabel(detail.report.weekStart), existing: detail.report })
              } else {
                openForm({ editing: detail.report })
              }
            }}
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
