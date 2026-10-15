import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  getKeyTasks, getKeyTaskYears, createKeyTask, updateKeyTask, deleteKeyTask,
  type KeyTask, type SaveKeyTaskRequest,
} from '../../api/keyTasks'
import { weeklyApi, type WeeklyReport } from '../../api/reports'
import WorkUnitTab from '../WorkUnit'
import PerformanceTab from './PerformanceTab'
import {
  Button, Input, Textarea, Select, Modal, TabBar, Tag, Panel, Loading, EmptyState,
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from '../../components/ui'
import PageHeader from '../../components/PageHeader'

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
  '팀':     { bg: 'var(--c-tag-sys)', color: 'var(--c-tag-sys-t)', border: 'var(--c-tag-sys)' },
  '담당부서': { bg: 'var(--c-tag-done-bg)', color: 'var(--c-tag-done-t)', border: 'var(--c-tag-done-bg)' },
  '담당자':  { bg: 'var(--c-tag-err-bg)', color: 'var(--c-tag-err-t)', border: 'var(--c-tag-err-bg)' },
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

type PageTab = 'keytasks' | 'workunits' | 'performance'

export default function KeyTaskPage() {
  const qc = useQueryClient()
  const now = new Date().getFullYear()
  const [pageTab, setPageTab] = useState<PageTab>('keytasks')
  const [workUnitFilterId, setWorkUnitFilterId] = useState<number | undefined>(undefined)

  const { data: years = [] } = useQuery({ queryKey: ['key-task-years'], queryFn: getKeyTaskYears })
  const [selYear, setSelYear] = useState(now)
  const [selLevel, setSelLevel] = useState<SelLevel>('담당부서')
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

  // 모달에서 현재 레벨에 따라 레이블 표시
  const teamLabel = curLevel === '담당자' ? '소속 팀/부서' : curLevel === '담당부서' ? '부서명 *' : '팀명 *'

  // datalist 추천 목록
  const teamSuggestions = [...new Set(tasks.filter(t => t.taskLevel === curLevel).map(t => t.teamName).filter(Boolean) as string[])].sort()
  const assigneeSuggestions = [...new Set(tasks.filter(t => t.taskLevel === '담당자').map(t => t.assigneeName).filter(Boolean) as string[])].sort()

  return (
    <div className="page-wrap">
      {/* 모달 */}
      {showModal && (
        <Modal open onClose={closeModal} title={`${editing ? '중점과제 수정' : '중점과제 추가'} — ${selYear}년`} width={920}>
            {/* 구분 선택 */}
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>구분 *</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {LEVELS.map(lv => {
                  const active = curLevel === lv
                  return (
                    <Button
                      key={lv}
                      size="sm"
                      variant={active ? 'filled' : 'outlined'}
                      onClick={() => setForm(prev => ({ ...prev, taskLevel: lv }))}
                    >{lv}</Button>
                  )
                })}
              </div>
            </div>

            {/* 기본 정보 */}
            <div style={{ display: 'grid', gridTemplateColumns: curLevel === '담당자' ? '1fr 1fr 1fr 2fr' : '1fr 1fr 2fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={s.label}>{teamLabel}</label>
                <Input list="team-list" value={f('teamName')} onChange={e => setF('teamName', e.target.value)}
                  placeholder={curLevel === '담당부서' ? '부서명 입력' : curLevel === '담당자' ? '소속 팀/부서' : '팀명 입력'} />
                <datalist id="team-list">{teamSuggestions.map(t => <option key={t} value={t} />)}</datalist>
              </div>
              {curLevel === '담당자' && (
                <div>
                  <label style={s.label}>담당자명 *</label>
                  <Input list="assignee-list" value={f('assigneeName')} onChange={e => setF('assigneeName', e.target.value)} placeholder="이름 입력" />
                  <datalist id="assignee-list">{assigneeSuggestions.map(a => <option key={a} value={a} />)}</datalist>
                </div>
              )}
              <div>
                <label style={s.label}>KPI</label>
                <Input value={f('kpi')} onChange={e => setF('kpi', e.target.value)} placeholder="KPI 분류" />
              </div>
              <div>
                <label style={s.label}>과제명 *</label>
                <Textarea rows={3} style={{ resize: 'vertical' }} value={f('taskName')} onChange={e => setF('taskName', e.target.value)} placeholder="과제명을 입력하세요" />
              </div>
            </div>

            {/* 분기별 내용 */}
            <div style={{ overflowX: 'auto' }}>
              <Table style={{ minWidth: 700 }}>
                <TableHeader>
                  <TableRow>
                    <TableHead style={s.mth} />
                    {QUARTERS.map(q => <TableHead key={q} style={{ ...s.mth, textAlign: 'center', width: '22%' }}>{q}분기</TableHead>)}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {([
                    { label: '목표/계획', suffix: 'Plan', multiline: true },
                    { label: '수행내역', suffix: 'Result', multiline: true },
                    { label: '달성도', suffix: 'Achievement', multiline: false },
                    { label: '미진사유', suffix: 'Reason', multiline: true },
                  ] as const).map(({ label, suffix, multiline }) => (
                    <TableRow key={suffix}>
                      <TableCell style={{ ...s.mtd, fontWeight: 500, fontSize: 12, color: 'var(--c-text-sub)', whiteSpace: 'nowrap' }}>{label}</TableCell>
                      {QUARTERS.map(q => {
                        const key = `q${q}${suffix}` as keyof FormData
                        return (
                          <TableCell key={q} style={s.mtd}>
                            {multiline
                              ? <Textarea style={{ height: 72, resize: 'vertical' }} value={f(key)} onChange={e => setF(key, e.target.value)} />
                              : <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  <Input type="number" min={0} max={100} style={{ width: 70 }} value={f(key)} onChange={e => setF(key, e.target.value)} placeholder="0~100" />
                                  <span style={{ fontSize: 13, color: 'var(--c-text-sub)' }}>%</span>
                                </div>
                            }
                          </TableCell>
                        )
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
              <Button variant="outlined" onClick={closeModal} disabled={isPending}>취소</Button>
              <Button variant="filled" onClick={submit} disabled={isPending}>
                {isPending ? '저장 중...' : '저장'}
              </Button>
            </div>
        </Modal>
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
          <Modal
            open
            onClose={() => setProgressTask(null)}
            title={progressTask.taskName}
            description={`주간 실적 — ${progressTask.kpi || progressTask.taskLevel}`}
            width={680}
            dismissible
          >
              {linked.length === 0 ? (
                <EmptyState title="연결된 주간 실적이 없습니다." style={{ padding: '40px 0' }} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {weeks.map(ws => (
                    <Panel key={ws} style={{ display: 'block', padding: 0, overflow: 'hidden' }}>
                      <div style={{ padding: '8px 14px', background: 'var(--c-thead)', fontWeight: 700, fontSize: 13, color: 'var(--c-action)' }}>
                        {weekLabelFrom(ws)}
                      </div>
                      <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {weekMap.get(ws)!.map((e, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '6px 10px', background: 'var(--c-bg)', borderRadius: 6, border: '1px solid var(--c-border-in)' }}>
                            <Tag color="var(--c-action)" bg="color-mix(in srgb, var(--c-action) 7%, transparent)" style={{ flexShrink: 0, marginTop: 2 }}>{e.section}</Tag>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 2 }}>{e.report.author}</div>
                              <div style={{ fontSize: 13, color: 'var(--c-text)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{e.item.content}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </Panel>
                  ))}
                </div>
              )}
          </Modal>
        )
      })()}

      {/* 헤더 */}
      <PageHeader
        title="중점과제"
        extra={<>
          <div style={{ display: 'flex', gap: 4 }}>
            <Button size="md" variant={pageTab === 'keytasks' ? 'filled' : 'text'} onClick={() => setPageTab('keytasks')}>중점과제</Button>
            <Button size="md" variant={pageTab === 'workunits' ? 'filled' : 'text'} onClick={() => setPageTab('workunits')}>단위업무</Button>
            <Button size="md" variant={pageTab === 'performance' ? 'filled' : 'text'} onClick={() => setPageTab('performance')}>성과 현황</Button>
          </div>
          <Select
            value={selYear}
            onValueChange={v => setSelYear(Number(v))}
          >
            {displayYears.map(y => <option key={y} value={y}>{y}년</option>)}
          </Select>
        </>}
        actions={pageTab === 'keytasks' && <Button variant="filled" onClick={openCreate}>+ 과제 추가</Button>}
      />

      {pageTab === 'workunits' && <WorkUnitTab key={`${workUnitFilterId ?? 'all'}-${selYear}`} initialKeyTaskId={workUnitFilterId} year={selYear} />}
      {pageTab === 'performance' && <PerformanceTab keyTasks={tasks} />}

      {/* 레벨 탭 */}
      {pageTab === 'keytasks' && <Panel style={{ flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 16, padding: '12px 16px' }}>
        <Button size="md" variant={selLevel === 'all' ? 'filled' : 'outlined'} onClick={() => setSelLevel('all')}>
          전체 <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>{tasks.length}</span>
        </Button>
        <span style={{ color: 'var(--c-border-in)', fontSize: 16 }}>|</span>
        {LEVELS.map(lv => (
          <Button key={lv} size="md" variant={selLevel === lv ? 'filled' : 'outlined'} onClick={() => setSelLevel(lv)}>
            {lv} <span style={{ fontSize: 11, marginLeft: 4, opacity: 0.7 }}>{countByLevel(lv)}</span>
          </Button>
        ))}
      </Panel>}

      {pageTab === 'keytasks' && <>
      {/* 분기 탭 */}
      <TabBar
        style={{ marginBottom: 16 }}
        value={String(selQuarter)}
        onChange={v => setSelQuarter(v === 'all' ? 'all' : (Number(v) as Quarter))}
        items={[
          { value: 'all', label: '전체' },
          ...QUARTERS.map(q => ({ value: String(q), label: `${q}분기${q === currentQuarter() ? ' ●' : ''}` })),
        ]}
      />

      {/* 테이블 */}
      <Panel style={{ display: 'block', padding: 0, overflowX: 'auto' }}>
        <Table style={{ minWidth: selQuarter === 'all' ? 1500 : 800 }}>
          <TableHeader>
            {selQuarter === 'all' ? (
              <>
                <TableRow>
                  <TableHead style={s.th} rowSpan={2}>구분</TableHead>
                  <TableHead style={s.th} rowSpan={2}>소속/담당자</TableHead>
                  <TableHead style={s.th} rowSpan={2}>KPI</TableHead>
                  <TableHead style={{ ...s.th, minWidth: 260 }} rowSpan={2}>과제명</TableHead>
                  <TableHead style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>목표/계획</TableHead>
                  <TableHead style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>수행내역</TableHead>
                  <TableHead style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>달성도</TableHead>
                  <TableHead style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>미진사유</TableHead>
                  <TableHead style={s.th} rowSpan={2}>액션</TableHead>
                </TableRow>
                <TableRow>
                  {[...QUARTERS, ...QUARTERS, ...QUARTERS, ...QUARTERS].map((q, i) => (
                    <TableHead key={i} style={{ ...s.th, fontWeight: 400, fontSize: 11, color: 'var(--c-text-muted)', minWidth: 110, ...(q === 1 ? { borderLeft: s.sep.borderLeft } : {}) }}>{q}분기</TableHead>
                  ))}
                </TableRow>
              </>
            ) : (
              <TableRow>
                <TableHead style={s.th}>구분</TableHead>
                <TableHead style={s.th}>소속/담당자</TableHead>
                <TableHead style={s.th}>KPI</TableHead>
                <TableHead style={{ ...s.th, minWidth: 260 }}>과제명</TableHead>
                <TableHead style={{ ...s.th, minWidth: 160, borderLeft: s.sep.borderLeft }}>{selQuarter}분기 목표/계획</TableHead>
                <TableHead style={{ ...s.th, minWidth: 160, borderLeft: s.sep.borderLeft }}>{selQuarter}분기 수행내역</TableHead>
                <TableHead style={{ ...s.th, minWidth: 80, borderLeft: s.sep.borderLeft }}>달성도</TableHead>
                <TableHead style={{ ...s.th, minWidth: 160, borderLeft: s.sep.borderLeft }}>미진사유</TableHead>
                <TableHead style={s.th}>액션</TableHead>
              </TableRow>
            )}
          </TableHeader>
          <TableBody>
            {isLoading && <TableRow><TableCell colSpan={totalCols}><Loading /></TableCell></TableRow>}
            {!isLoading && displayTasks.length === 0 && (
              <TableRow><TableCell colSpan={totalCols}>
                <EmptyState title={tasks.length === 0 ? '등록된 과제가 없습니다.' : `${selLevel} 레벨 과제가 없습니다.`} />
              </TableCell></TableRow>
            )}
            {displayTasks.map(t => {
              const lv = (t.taskLevel ?? '팀') as TaskLevel
              const c = LEVEL_COLOR[lv] ?? LEVEL_COLOR['팀']
              return (
                <TableRow key={t.id}>
                  <TableCell style={{ ...s.td, whiteSpace: 'nowrap' }}>
                    <Tag color={c.color} bg={c.bg}>
                      {lv}
                    </Tag>
                  </TableCell>
                  <TableCell style={{ ...s.td, fontSize: 12, minWidth: 90 }}>
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
                  </TableCell>
                  <TableCell style={{ ...s.td, color: 'var(--c-text-sub)', fontSize: 12 }}>{t.kpi ?? '-'}</TableCell>
                  <TableCell style={{ ...s.td, fontWeight: 500, minWidth: 260, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>{t.taskName}</TableCell>
                  {visibleQs.map((q, i) => <TableCell key={`plan-${q}`} style={{ ...s.td, ...(i === 0 ? s.sep : {}) }}><pre style={s.cell}>{truncate(t[qKey(q, 'Plan')] as string)}</pre></TableCell>)}
                  {visibleQs.map((q, i) => <TableCell key={`result-${q}`} style={{ ...s.td, ...(i === 0 ? s.sep : {}) }}><pre style={s.cell}>{truncate(t[qKey(q, 'Result')] as string)}</pre></TableCell>)}
                  {visibleQs.map((q, i) => (
                    <TableCell key={`ach-${q}`} style={{ ...s.td, textAlign: 'center', ...(i === 0 ? s.sep : {}) }}>
                      {t[qKey(q, 'Achievement')]
                        ? <Tag tone="info">{t[qKey(q, 'Achievement')] as string}%</Tag>
                        : <span style={{ color: 'var(--c-text-muted)', fontSize: 12 }}>-</span>}
                    </TableCell>
                  ))}
                  {visibleQs.map((q, i) => <TableCell key={`reason-${q}`} style={{ ...s.td, ...(i === 0 ? s.sep : {}) }}><pre style={s.cell}>{truncate(t[qKey(q, 'Reason')] as string)}</pre></TableCell>)}
                  <TableCell style={s.td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      <Button variant="outlined" size="sm" onClick={() => setProgressTask(t)}>실적</Button>
                      <Button variant="outlined" size="sm" onClick={() => { setWorkUnitFilterId(t.id); setPageTab('workunits') }}>단위업무</Button>
                      <Button variant="outlined" size="sm" onClick={() => openEdit(t)}>수정</Button>
                      <Button variant="danger" size="sm"
                        onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(t.id) }}>삭제</Button>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Panel>
      </>}
    </div>
  )
}


const s: Record<string, React.CSSProperties> = {
  label: { display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--c-text-sub)', marginBottom: 6 },
  mth: { textAlign: 'left', whiteSpace: 'nowrap' },
  mtd: { verticalAlign: 'top' },
  th: { textAlign: 'left', whiteSpace: 'nowrap' },
  td: { verticalAlign: 'top' },
  cell: { margin: 0, fontFamily: 'inherit', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: 'var(--c-text)' },
  sep: { borderLeft: '1px solid var(--c-border)' },
}
