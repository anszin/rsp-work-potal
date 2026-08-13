import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  getKeyTasks, getKeyTaskYears, createKeyTask, updateKeyTask, deleteKeyTask,
  type KeyTask, type SaveKeyTaskRequest,
} from '../../api/keyTasks'
import { weeklyApi, type WeeklyReport } from '../../api/reports'
import {
  workUnitApi, type WorkUnit, type SaveWorkUnitRequest,
  WORK_UNIT_TYPE_LABELS, WORK_UNIT_STATUS_LABELS, WORK_UNIT_STATUS_COLOR,
  type WorkUnitType, type WorkUnitStatus,
} from '../../api/workUnits'
import WorkUnitTab from '../WorkUnit'

interface WorkItem {
  id: string
  type: '중점' | '기타'
  content: string
  keyTaskId?: number
  keyTaskName?: string
}

function parseWorkItems(raw: string | null | undefined): WorkItem[] {
  if (!raw) return []
  try { const a = JSON.parse(raw); if (Array.isArray(a)) return a } catch {}
  return []
}

function weekLabelFrom(weekStart: string): string {
  const mon = new Date(weekStart)
  const thu = new Date(mon); thu.setDate(mon.getDate() + 3)
  return `${thu.getMonth() + 1}월 ${Math.ceil(thu.getDate() / 7)}주차`
}

type LinkedEntry = { report: WeeklyReport; item: WorkItem; section: string }

const QUARTERS = [1, 2, 3, 4] as const
type Quarter = typeof QUARTERS[number]
type SelQuarter = Quarter | 'all'

const LEVELS = ['팀', '담당부서', '담당자'] as const
type TaskLevel = typeof LEVELS[number]
type SelLevel = TaskLevel | 'all'

type FormData = Omit<SaveKeyTaskRequest, 'year'>

const emptyForm = (level: TaskLevel = '팀'): FormData => ({
  taskLevel: level,
  teamName: '', assigneeName: '', kpi: '', taskName: '',
  q1Plan: '', q2Plan: '', q3Plan: '', q4Plan: '',
  q1Result: '', q2Result: '', q3Result: '', q4Result: '',
  q1Achievement: '', q2Achievement: '', q3Achievement: '', q4Achievement: '',
  q1Reason: '', q2Reason: '', q3Reason: '', q4Reason: '',
})

const LEVEL_COLOR: Record<TaskLevel, { bg: string; color: string; border: string }> = {
  '팀':     { bg: '#EBF8FF', color: '#2B6CB0', border: '#BEE3F8' },
  '담당부서': { bg: '#F0FFF4', color: '#276749', border: '#C6F6D5' },
  '담당자':  { bg: '#FFF5F5', color: '#9B2C2C', border: '#FED7D7' },
}


function currentQuarter(): Quarter {
  const m = new Date().getMonth() + 1
  if (m <= 3) return 1; if (m <= 6) return 2; if (m <= 9) return 3; return 4
}

function apiError(e: unknown) {
  if (axios.isAxiosError(e) && e.response?.data?.error) return e.response.data.error
  return e instanceof Error ? e.message : String(e)
}

function truncate(s: string | null | undefined, n = 40) {
  if (!s) return '-'
  return s.length > n ? s.slice(0, n) + '…' : s
}

function qKey(q: Quarter, suffix: string): keyof KeyTask {
  return `q${q}${suffix}` as keyof KeyTask
}

type PageTab = 'keytasks' | 'workunits'

export default function KeyTaskPage() {
  const qc = useQueryClient()
  const now = new Date().getFullYear()
  const [pageTab, setPageTab] = useState<PageTab>('keytasks')

  const { data: years = [] } = useQuery({ queryKey: ['key-task-years'], queryFn: getKeyTaskYears })
  const [selYear, setSelYear] = useState(now)
  const [selLevel, setSelLevel] = useState<SelLevel>('all')
  const [selQuarter, setSelQuarter] = useState<SelQuarter>(currentQuarter())
  const displayYears = years.includes(selYear) ? years : [selYear, ...years].sort((a, b) => b - a)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['key-tasks', selYear],
    queryFn: () => getKeyTasks(selYear),
  })

  const { data: allReports = [] } = useQuery({
    queryKey: ['weekly-reports'],
    queryFn: () => weeklyApi.list().then(r => r.data),
  })

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<KeyTask | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm())
  const [progressTask, setProgressTask] = useState<KeyTask | null>(null)
  const [workUnitTask, setWorkUnitTask] = useState<KeyTask | null>(null)
  const [wuForm, setWuForm] = useState<SaveWorkUnitRequest | null>(null)
  const [editingWu, setEditingWu] = useState<WorkUnit | null>(null)

  const { data: workUnits = [] } = useQuery({
    queryKey: ['work-units', workUnitTask?.id],
    queryFn: () => workUnitApi.listByKeyTask(workUnitTask!.id),
    enabled: !!workUnitTask,
  })

  const wuCreateMut = useMutation({
    mutationFn: (data: SaveWorkUnitRequest) => workUnitApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-units', workUnitTask?.id] }); setWuForm(null) },
  })
  const wuUpdateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveWorkUnitRequest }) => workUnitApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['work-units', workUnitTask?.id] }); setEditingWu(null); setWuForm(null) },
  })
  const wuDeleteMut = useMutation({
    mutationFn: (id: number) => workUnitApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['work-units', workUnitTask?.id] }),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['key-tasks', selYear] })
    qc.invalidateQueries({ queryKey: ['key-task-years'] })
  }

  const createMut = useMutation({
    mutationFn: (data: SaveKeyTaskRequest) => createKeyTask(data),
    onSuccess: () => { invalidate(); closeModal() },
    onError: (e) => alert('저장 실패: ' + apiError(e)),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveKeyTaskRequest }) => updateKeyTask(id, data),
    onSuccess: () => { invalidate(); closeModal() },
    onError: (e) => alert('수정 실패: ' + apiError(e)),
  })
  const deleteMut = useMutation({
    mutationFn: deleteKeyTask,
    onSuccess: () => invalidate(),
    onError: (e) => alert('삭제 실패: ' + apiError(e)),
  })

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm(selLevel !== 'all' ? selLevel : '팀'))
    setShowModal(true)
  }
  const openEdit = (t: KeyTask) => {
    setEditing(t)
    setForm({
      taskLevel: t.taskLevel ?? '팀',
      teamName: t.teamName ?? '', assigneeName: t.assigneeName ?? '',
      kpi: t.kpi ?? '', taskName: t.taskName,
      q1Plan: t.q1Plan ?? '', q2Plan: t.q2Plan ?? '', q3Plan: t.q3Plan ?? '', q4Plan: t.q4Plan ?? '',
      q1Result: t.q1Result ?? '', q2Result: t.q2Result ?? '', q3Result: t.q3Result ?? '', q4Result: t.q4Result ?? '',
      q1Achievement: t.q1Achievement ?? '', q2Achievement: t.q2Achievement ?? '', q3Achievement: t.q3Achievement ?? '', q4Achievement: t.q4Achievement ?? '',
      q1Reason: t.q1Reason ?? '', q2Reason: t.q2Reason ?? '', q3Reason: t.q3Reason ?? '', q4Reason: t.q4Reason ?? '',
    })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyForm()) }

  const f = (key: keyof FormData) => (form[key] as string) ?? ''
  const setF = (key: keyof FormData, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  const submit = () => {
    if (!form.taskName?.trim()) { alert('과제명을 입력해주세요.'); return }
    if (!form.taskLevel) { alert('구분을 선택해주세요.'); return }
    const data: SaveKeyTaskRequest = { year: selYear, ...form }
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  const isPending = createMut.isPending || updateMut.isPending
  const curLevel = (form.taskLevel ?? '팀') as TaskLevel

  // 레벨별 카운트 (전체 표시용)
  const countByLevel = (lv: TaskLevel) => tasks.filter(t => t.taskLevel === lv).length

  const displayTasks = selLevel === 'all' ? tasks : tasks.filter(t => t.taskLevel === selLevel)
  const visibleQs: Quarter[] = selQuarter === 'all' ? [...QUARTERS] : [selQuarter]

  // 컬럼 수: 구분(1) + 소속/담당자(1) + KPI(1) + 과제명(1) + quarters*4 + 액션(1)
  const totalCols = 5 + visibleQs.length * 4

  const pageTabStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 16px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
    background: active ? '#1a1a2e' : 'transparent', color: active ? '#fff' : 'var(--c-text-muted)',
  })

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 0', border: 'none',
    borderBottom: `2px solid ${active ? '#1a1a2e' : 'transparent'}`,
    background: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
  })

  const levelTabStyle = (lv: SelLevel): React.CSSProperties => {
    const active = selLevel === lv
    if (lv === 'all') return { ...tabStyle(active) }
    const c = active ? LEVEL_COLOR[lv as TaskLevel] : null
    return {
      padding: '5px 14px', border: `1px solid ${active ? (c?.border ?? '#ccc') : 'var(--c-border-in)'}`,
      borderRadius: 20, background: active ? (c?.bg ?? '#f5f5f5') : 'transparent',
      cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
      color: active ? (c?.color ?? 'inherit') : 'var(--c-text-muted)',
    }
  }

  // 모달에서 현재 레벨에 따라 레이블 표시
  const teamLabel = curLevel === '담당자' ? '소속 팀/부서' : curLevel === '담당부서' ? '부서명 *' : '팀명 *'

  // datalist 추천 목록
  const teamSuggestions = [...new Set(tasks.filter(t => t.taskLevel === curLevel).map(t => t.teamName).filter(Boolean) as string[])].sort()
  const assigneeSuggestions = [...new Set(tasks.filter(t => t.taskLevel === '담당자').map(t => t.assigneeName).filter(Boolean) as string[])].sort()

  return (
    <div className="page-wrap">
      {/* 모달 */}
      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>
                {editing ? '중점과제 수정' : '중점과제 추가'} — {selYear}년
              </h3>
              <button style={s.btnSecondary} onClick={closeModal}>✕</button>
            </div>

            {/* 구분 선택 */}
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>구분 *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {LEVELS.map(lv => {
                  const active = curLevel === lv
                  const c = LEVEL_COLOR[lv]
                  return (
                    <button
                      key={lv}
                      style={{
                        padding: '6px 18px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                        border: `1px solid ${active ? c.border : 'var(--c-border-in)'}`,
                        background: active ? c.bg : 'transparent',
                        color: active ? c.color : 'var(--c-text-muted)',
                      }}
                      onClick={() => setForm(prev => ({ ...prev, taskLevel: lv }))}
                    >{lv}</button>
                  )
                })}
              </div>
            </div>

            {/* 기본 정보 */}
            <div style={{ display: 'grid', gridTemplateColumns: curLevel === '담당자' ? '1fr 1fr 1fr 2fr' : '1fr 1fr 2fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={s.label}>{teamLabel}</label>
                <input style={s.input} list="team-list" value={f('teamName')} onChange={e => setF('teamName', e.target.value)}
                  placeholder={curLevel === '담당부서' ? '부서명 입력' : curLevel === '담당자' ? '소속 팀/부서' : '팀명 입력'} />
                <datalist id="team-list">{teamSuggestions.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              {curLevel === '담당자' && (
                <div>
                  <label style={s.label}>담당자명 *</label>
                  <input style={s.input} list="assignee-list" value={f('assigneeName')} onChange={e => setF('assigneeName', e.target.value)} placeholder="이름 입력" />
                  <datalist id="assignee-list">{assigneeSuggestions.map(a => <option key={a} value={a} />)}</datalist>
                </div>
              )}
              <div>
                <label style={s.label}>KPI</label>
                <input style={s.input} value={f('kpi')} onChange={e => setF('kpi', e.target.value)} placeholder="KPI 분류" />
              </div>
              <div>
                <label style={s.label}>과제명 *</label>
                <textarea rows={3} style={{ ...s.input, resize: 'vertical' }} value={f('taskName')} onChange={e => setF('taskName', e.target.value)} placeholder="과제명을 입력하세요" />
              </div>
            </div>

            {/* 분기별 내용 */}
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={s.mth} />
                    {QUARTERS.map(q => <th key={q} style={{ ...s.mth, textAlign: 'center', width: '22%' }}>{q}분기</th>)}
                  </tr>
                </thead>
                <tbody>
                  {([
                    { label: '목표/계획', suffix: 'Plan', multiline: true },
                    { label: '수행내역', suffix: 'Result', multiline: true },
                    { label: '달성도', suffix: 'Achievement', multiline: false },
                    { label: '미진사유', suffix: 'Reason', multiline: true },
                  ] as const).map(({ label, suffix, multiline }) => (
                    <tr key={suffix}>
                      <td style={{ ...s.mtd, fontWeight: 500, fontSize: 12, color: 'var(--c-text-sub)', whiteSpace: 'nowrap', paddingRight: 12 }}>{label}</td>
                      {QUARTERS.map(q => {
                        const key = `q${q}${suffix}` as keyof FormData
                        return (
                          <td key={q} style={s.mtd}>
                            {multiline
                              ? <textarea style={{ ...s.input, height: 72, resize: 'vertical', fontSize: 12 }} value={f(key)} onChange={e => setF(key, e.target.value)} />
                              : <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <input type="number" min={0} max={100} style={{ ...s.input, fontSize: 12, width: 70 }} value={f(key)} onChange={e => setF(key, e.target.value)} placeholder="0~100" />
                                  <span style={{ fontSize: 13, color: 'var(--c-text-sub)' }}>%</span>
                                </div>
                            }
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={s.btnSecondary} onClick={closeModal} disabled={isPending}>취소</button>
              <button style={{ ...s.btn, opacity: isPending ? 0.6 : 1 }} onClick={submit} disabled={isPending}>
                {isPending ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 업무단위 모달 */}
      {workUnitTask && (
        <div style={s.overlay} onClick={() => { setWorkUnitTask(null); setWuForm(null); setEditingWu(null) }}>
          <div style={{ ...s.modal, maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 2 }}>단위업무</div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{workUnitTask.taskName}</h3>
              </div>
              <button style={s.btnSecondary} onClick={() => { setWorkUnitTask(null); setWuForm(null); setEditingWu(null) }}>✕</button>
            </div>

            {/* 업무단위 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
              {workUnits.length === 0 && !wuForm && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 단위업무가 없습니다.</div>
              )}
              {workUnits.map(wu => (
                <div key={wu.id} style={{ border: '1px solid var(--c-border)', borderRadius: 8, padding: '10px 14px' }}>
                  {editingWu?.id === wu.id && wuForm ? (
                    <WuForm
                      form={wuForm}
                      onChange={setWuForm}
                      onSubmit={() => wuUpdateMut.mutate({ id: wu.id, data: wuForm })}
                      onCancel={() => { setEditingWu(null); setWuForm(null) }}
                      isPending={wuUpdateMut.isPending}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600 }}>{wu.title}</span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#EBF8FF', color: '#2B6CB0' }}>
                            {WORK_UNIT_TYPE_LABELS[wu.type]}
                          </span>
                          <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: WORK_UNIT_STATUS_COLOR[wu.status] + '22', color: WORK_UNIT_STATUS_COLOR[wu.status], fontWeight: 600 }}>
                            {WORK_UNIT_STATUS_LABELS[wu.status]}
                          </span>
                        </div>
                        {wu.description && <div style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{wu.description}</div>}
                      </div>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button style={s.btnSm} onClick={() => { setEditingWu(wu); setWuForm({ keyTaskId: workUnitTask.id, title: wu.title, type: wu.type, status: wu.status, description: wu.description ?? '' }) }}>수정</button>
                        <button style={{ ...s.btnSm, color: '#e53e3e' }} onClick={() => { if (confirm('삭제할까요?')) wuDeleteMut.mutate(wu.id) }}>삭제</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* 추가 폼 */}
            {wuForm && !editingWu ? (
              <WuForm
                form={wuForm}
                onChange={setWuForm}
                onSubmit={() => wuCreateMut.mutate(wuForm)}
                onCancel={() => setWuForm(null)}
                isPending={wuCreateMut.isPending}
              />
            ) : (
              !editingWu && (
                <button style={s.btn} onClick={() => setWuForm({ keyTaskId: workUnitTask.id, title: '', type: 'PROJECT', status: 'IN_PROGRESS', description: '' })}>
                  + 단위업무 추가
                </button>
              )
            )}
          </div>
        </div>
      )}

      {/* 주간 실적 모달 */}
      {progressTask && (() => {
        const SECTIONS = [
          { key: 'thisWeekWork', label: '금주 수행' }, { key: 'thisWeekProposal', label: '금주 제안' }, { key: 'thisWeekEtc', label: '금주 기타' },
          { key: 'nextWeekWork', label: '차주 수행' }, { key: 'nextWeekProposal', label: '차주 제안' }, { key: 'nextWeekEtc', label: '차주 기타' },
        ]
        const linked: LinkedEntry[] = allReports.flatMap(report =>
          SECTIONS.flatMap(({ key, label }) =>
            parseWorkItems((report as unknown as Record<string, string>)[key])
              .filter(it => it.keyTaskId === progressTask.id)
              .map(it => ({ report, item: it, section: label }))
          )
        )
        // 주차별 그룹핑
        const weekMap = new Map<string, LinkedEntry[]>()
        for (const e of linked) {
          if (!weekMap.has(e.report.weekStart)) weekMap.set(e.report.weekStart, [])
          weekMap.get(e.report.weekStart)!.push(e)
        }
        const weeks = Array.from(weekMap.keys()).sort((a, b) => b.localeCompare(a))
        return (
          <div style={s.overlay} onClick={() => setProgressTask(null)}>
            <div style={{ ...s.modal, maxWidth: 680 }} onClick={e => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
                <div>
                  <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 4 }}>주간 실적 — {progressTask.kpi || progressTask.taskLevel}</div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{progressTask.taskName}</h3>
                </div>
                <button style={s.btnSecondary} onClick={() => setProgressTask(null)}>✕</button>
              </div>
              {linked.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--c-text-muted)', fontSize: 14 }}>
                  연결된 주간 실적이 없습니다.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {weeks.map(ws => (
                    <div key={ws} style={{ border: '1px solid var(--c-border)', borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', background: 'var(--c-thead)', fontWeight: 700, fontSize: 13, color: '#1976d2' }}>
                        {weekLabelFrom(ws)}
                      </div>
                      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {weekMap.get(ws)!.map((e, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', background: 'var(--c-bg)', borderRadius: 6, border: '1px solid var(--c-border-in)' }}>
                            <span style={{ flexShrink: 0, fontSize: 10, padding: '1px 6px', borderRadius: 8, background: '#1976d212', color: '#1976d2', fontWeight: 700, marginTop: 2 }}>{e.section}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 2 }}>{e.report.author}</div>
                              <div style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.item.content}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* 헤더 */}
      <div className="deploy-header" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>중점과제</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPageTab('keytasks')} style={pageTabStyle(pageTab === 'keytasks')}>중점과제</button>
            <button onClick={() => setPageTab('workunits')} style={pageTabStyle(pageTab === 'workunits')}>단위업무</button>
          </div>
          {pageTab === 'keytasks' && (
            <div style={{ display: 'flex', gap: 16 }}>
              {displayYears.map(y => (
                <button key={y} onClick={() => setSelYear(y)} style={tabStyle(selYear === y)}>{y}년</button>
              ))}
            </div>
          )}
        </div>
        {pageTab === 'keytasks' && <button style={s.btn} onClick={openCreate}>+ 과제 추가</button>}
      </div>

      {pageTab === 'workunits' && <WorkUnitTab />}

      {/* 레벨 탭 */}
      {pageTab === 'keytasks' && <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, padding: '12px 16px', background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8 }}>
        <button style={{ ...levelTabStyle('all'), padding: '5px 14px', border: '1px solid var(--c-border-in)', borderRadius: 20 }} onClick={() => setSelLevel('all')}>
          전체 <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginLeft: 4 }}>{tasks.length}</span>
        </button>
        <span style={{ color: 'var(--c-border-in)', fontSize: 16 }}>|</span>
        {LEVELS.map(lv => (
          <button key={lv} style={levelTabStyle(lv)} onClick={() => setSelLevel(lv)}>
            {lv} <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>{countByLevel(lv)}</span>
          </button>
        ))}
      </div>

      {pageTab === 'keytasks' && <>
      {/* 분기 탭 */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, borderBottom: '1px solid var(--c-border)' }}>
        <button onClick={() => setSelQuarter('all')} style={tabStyle(selQuarter === 'all')}>전체</button>
        {QUARTERS.map(q => (
          <button key={q} onClick={() => setSelQuarter(q)} style={tabStyle(selQuarter === q)}>
            {q}분기{q === currentQuarter() ? ' ●' : ''}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: 'auto', background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: selQuarter === 'all' ? 1500 : 800 }}>
          <thead>
            {selQuarter === 'all' ? (
              <>
                <tr style={{ background: 'var(--c-thead)' }}>
                  <th style={s.th} rowSpan={2}>구분</th>
                  <th style={s.th} rowSpan={2}>소속/담당자</th>
                  <th style={s.th} rowSpan={2}>KPI</th>
                  <th style={{ ...s.th, minWidth: 260 }} rowSpan={2}>과제명</th>
                  <th style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>목표/계획</th>
                  <th style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>수행내역</th>
                  <th style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>달성도</th>
                  <th style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>미진사유</th>
                  <th style={s.th} rowSpan={2}>액션</th>
                </tr>
                <tr style={{ background: 'var(--c-thead)' }}>
                  {[...QUARTERS, ...QUARTERS, ...QUARTERS, ...QUARTERS].map((q, i) => (
                    <th key={i} style={{ ...s.th, fontWeight: 400, fontSize: 11, color: 'var(--c-text-muted)', minWidth: 110, ...(q === 1 ? { borderLeft: s.sep.borderLeft } : {}) }}>{q}분기</th>
                  ))}
                </tr>
              </>
            ) : (
              <tr style={{ background: 'var(--c-thead)' }}>
                <th style={s.th}>구분</th>
                <th style={s.th}>소속/담당자</th>
                <th style={s.th}>KPI</th>
                <th style={{ ...s.th, minWidth: 260 }}>과제명</th>
                <th style={{ ...s.th, minWidth: 160, borderLeft: s.sep.borderLeft }}>{selQuarter}분기 목표/계획</th>
                <th style={{ ...s.th, minWidth: 160, borderLeft: s.sep.borderLeft }}>{selQuarter}분기 수행내역</th>
                <th style={{ ...s.th, minWidth: 80, borderLeft: s.sep.borderLeft }}>달성도</th>
                <th style={{ ...s.th, minWidth: 160, borderLeft: s.sep.borderLeft }}>미진사유</th>
                <th style={s.th}>액션</th>
              </tr>
            )}
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={totalCols} style={s.empty}>로딩 중...</td></tr>}
            {!isLoading && displayTasks.length === 0 && (
              <tr><td colSpan={totalCols} style={s.empty}>
                {tasks.length === 0 ? '등록된 과제가 없습니다.' : `${selLevel} 레벨 과제가 없습니다.`}
              </td></tr>
            )}
            {displayTasks.map(t => {
              const lv = (t.taskLevel ?? '팀') as TaskLevel
              const c = LEVEL_COLOR[lv] ?? LEVEL_COLOR['팀']
              return (
                <tr key={t.id} style={s.tr}>
                  <td style={{ ...s.td, whiteSpace: 'nowrap' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10, background: c.bg, color: c.color, border: `1px solid ${c.border}` }}>
                      {lv}
                    </span>
                  </td>
                  <td style={{ ...s.td, fontSize: 12, minWidth: 90 }}>
                    {lv === '담당자' ? (
                      <>
                        {t.assigneeName && <div style={{ fontWeight: 600 }}>{t.assigneeName}</div>}
                        {t.teamName && <div style={{ color: 'var(--c-text-muted)', fontSize: 11, marginTop: 2 }}>{t.teamName}</div>}
                        {!t.assigneeName && !t.teamName && <span style={{ color: 'var(--c-text-muted)' }}>-</span>}
                      </>
                    ) : (
                      <>
                        {t.teamName && <div style={{ fontWeight: 500 }}>{t.teamName}</div>}
                        {!t.teamName && <span style={{ color: 'var(--c-text-muted)' }}>-</span>}
                      </>
                    )}
                  </td>
                  <td style={{ ...s.td, color: 'var(--c-text-sub)', fontSize: 12 }}>{t.kpi ?? '-'}</td>
                  <td style={{ ...s.td, fontWeight: 500, minWidth: 260, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>{t.taskName}</td>
                  {visibleQs.map((q, i) => <td key={`plan-${q}`} style={{ ...s.td, ...(i === 0 ? s.sep : {}) }}><pre style={s.cell}>{truncate(t[qKey(q, 'Plan')] as string)}</pre></td>)}
                  {visibleQs.map((q, i) => <td key={`result-${q}`} style={{ ...s.td, ...(i === 0 ? s.sep : {}) }}><pre style={s.cell}>{truncate(t[qKey(q, 'Result')] as string)}</pre></td>)}
                  {visibleQs.map((q, i) => (
                    <td key={`ach-${q}`} style={{ ...s.td, textAlign: 'center', ...(i === 0 ? s.sep : {}) }}>
                      {t[qKey(q, 'Achievement')]
                        ? <span style={s.achBadge}>{t[qKey(q, 'Achievement')] as string}%</span>
                        : <span style={{ color: 'var(--c-text-muted)', fontSize: 12 }}>-</span>}
                    </td>
                  ))}
                  {visibleQs.map((q, i) => <td key={`reason-${q}`} style={{ ...s.td, ...(i === 0 ? s.sep : {}) }}><pre style={s.cell}>{truncate(t[qKey(q, 'Reason')] as string)}</pre></td>)}
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <button style={{ ...s.btnSm, color: '#1976d2', borderColor: '#90caf9' }} onClick={() => setProgressTask(t)}>실적</button>
                      <button style={{ ...s.btnSm, color: '#6b46c1', borderColor: '#d6bcfa' }} onClick={() => { setWorkUnitTask(t); setWuForm(null); setEditingWu(null) }}>단위업무</button>
                      <button style={s.btnSm} onClick={() => openEdit(t)}>수정</button>
                      <button style={{ ...s.btnSm, color: '#e53e3e' }}
                        onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(t.id) }}>삭제</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      </>}
    </div>
  )
}

function WuForm({ form, onChange, onSubmit, onCancel, isPending }: {
  form: SaveWorkUnitRequest
  onChange: (f: SaveWorkUnitRequest) => void
  onSubmit: () => void
  onCancel: () => void
  isPending: boolean
}) {
  return (
    <div style={{ border: '1px dashed #a0aec0', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input
        style={wuInput}
        placeholder="업무단위명 *"
        value={form.title}
        onChange={e => onChange({ ...form, title: e.target.value })}
        autoFocus
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <select style={wuInput} value={form.type} onChange={e => onChange({ ...form, type: e.target.value as WorkUnitType })}>
          {(Object.entries(WORK_UNIT_TYPE_LABELS) as [WorkUnitType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select style={wuInput} value={form.status} onChange={e => onChange({ ...form, status: e.target.value as WorkUnitStatus })}>
          {(Object.entries(WORK_UNIT_STATUS_LABELS) as [WorkUnitStatus, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <textarea
        style={{ ...wuInput, height: 56, resize: 'vertical' }}
        placeholder="설명 (선택)"
        value={form.description ?? ''}
        onChange={e => onChange({ ...form, description: e.target.value })}
      />
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button style={{ padding: '6px 14px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', fontSize: 13 }} onClick={onCancel}>취소</button>
        <button
          style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: '#6b46c1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          onClick={onSubmit}
          disabled={isPending || !form.title.trim()}
        >저장</button>
      </div>
    </div>
  )
}

const wuInput: React.CSSProperties = {
  padding: '7px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
  fontSize: 13, outline: 'none', background: 'var(--c-bg, #fff)', color: 'inherit', width: '100%', boxSizing: 'border-box',
}

const s: Record<string, React.CSSProperties> = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--c-card)', borderRadius: 10, padding: 28, width: '90vw', maxWidth: 920, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' },
  btn: { padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSecondary: { padding: '8px 16px', background: 'var(--c-card)', color: 'var(--c-text-sub)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid var(--c-border-in)', borderRadius: 4, cursor: 'pointer', fontSize: 12 },
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--c-text-sub)', marginBottom: 6 },
  input: { padding: '8px 10px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box', background: 'var(--c-input-bg)', color: 'var(--c-text)' },
  mth: { padding: '8px 10px', fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', textAlign: 'left', borderBottom: '1px solid var(--c-border-in)', whiteSpace: 'nowrap' },
  mtd: { padding: '6px 4px', verticalAlign: 'top' },
  th: { padding: '10px 12px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', border: '1px solid var(--c-border-in)', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid var(--c-border-in)' },
  td: { padding: '10px 12px', fontSize: 13, verticalAlign: 'top', borderLeft: '1px solid var(--c-border-in)' },
  cell: { margin: 0, fontFamily: 'inherit', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--c-text)' },
  achBadge: { fontSize: 12, background: '#EBF8FF', color: '#2B6CB0', padding: '2px 8px', borderRadius: 4, fontWeight: 600 },
  empty: { padding: 40, textAlign: 'center', color: 'var(--c-text-muted)', fontSize: 13 },
  sep: { borderLeft: '1px solid var(--c-border)' },
}
