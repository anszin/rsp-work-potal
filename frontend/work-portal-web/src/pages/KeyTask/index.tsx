import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  getKeyTasks, getKeyTaskYears, createKeyTask, updateKeyTask, deleteKeyTask,
  type KeyTask, type SaveKeyTaskRequest,
} from '../../api/keyTasks'

const QUARTERS = [1, 2, 3, 4] as const
type Quarter = typeof QUARTERS[number]
type SelQuarter = Quarter | 'all'

type FormData = Omit<SaveKeyTaskRequest, 'year'>

const emptyForm: FormData = {
  kpi: '', taskName: '',
  q1Plan: '', q2Plan: '', q3Plan: '', q4Plan: '',
  q1Result: '', q2Result: '', q3Result: '', q4Result: '',
  q1Achievement: '', q2Achievement: '', q3Achievement: '', q4Achievement: '',
  q1Reason: '', q2Reason: '', q3Reason: '', q4Reason: '',
}

function currentQuarter(): Quarter {
  const m = new Date().getMonth() + 1
  if (m <= 3) return 1
  if (m <= 6) return 2
  if (m <= 9) return 3
  return 4
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

export default function KeyTaskPage() {
  const qc = useQueryClient()
  const now = new Date().getFullYear()

  const { data: years = [] } = useQuery({ queryKey: ['key-task-years'], queryFn: getKeyTaskYears })
  const [selYear, setSelYear] = useState(now)
  const [selQuarter, setSelQuarter] = useState<SelQuarter>(currentQuarter())
  const displayYears = years.includes(selYear) ? years : [selYear, ...years].sort((a, b) => b - a)

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['key-tasks', selYear],
    queryFn: () => getKeyTasks(selYear),
  })

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<KeyTask | null>(null)
  const [form, setForm] = useState<FormData>(emptyForm)

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

  const openCreate = () => { setEditing(null); setForm(emptyForm); setShowModal(true) }
  const openEdit = (t: KeyTask) => {
    setEditing(t)
    setForm({
      kpi: t.kpi ?? '', taskName: t.taskName,
      q1Plan: t.q1Plan ?? '', q2Plan: t.q2Plan ?? '', q3Plan: t.q3Plan ?? '', q4Plan: t.q4Plan ?? '',
      q1Result: t.q1Result ?? '', q2Result: t.q2Result ?? '', q3Result: t.q3Result ?? '', q4Result: t.q4Result ?? '',
      q1Achievement: t.q1Achievement ?? '', q2Achievement: t.q2Achievement ?? '', q3Achievement: t.q3Achievement ?? '', q4Achievement: t.q4Achievement ?? '',
      q1Reason: t.q1Reason ?? '', q2Reason: t.q2Reason ?? '', q3Reason: t.q3Reason ?? '', q4Reason: t.q4Reason ?? '',
    })
    setShowModal(true)
  }
  const closeModal = () => { setShowModal(false); setEditing(null); setForm(emptyForm) }

  const f = (key: keyof FormData) => (form[key] as string) ?? ''
  const setF = (key: keyof FormData, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  const submit = () => {
    if (!form.taskName?.trim()) { alert('과제명을 입력해주세요.'); return }
    const data: SaveKeyTaskRequest = { year: selYear, ...form }
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  const isPending = createMut.isPending || updateMut.isPending
  const visibleQs: Quarter[] = selQuarter === 'all' ? [...QUARTERS] : [selQuarter]
  const totalCols = 2 + visibleQs.length * 4 + 1 // KPI + 과제명 + (plan+result+ach+reason)*Q + 액션

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '4px 0', border: 'none',
    borderBottom: `2px solid ${active ? '#1a1a2e' : 'transparent'}`,
    background: 'none', cursor: 'pointer', fontSize: 13,
    fontWeight: active ? 600 : 400,
    color: active ? 'var(--c-text)' : 'var(--c-text-muted)',
  })

  return (
    <div style={s.page}>
      {/* 모달 */}
      {showModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{editing ? '중점과제 수정' : '중점과제 추가'} — {selYear}년</h3>
              <button style={s.btnSecondary} onClick={closeModal}>✕</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, marginBottom: 20 }}>
              <div>
                <label style={s.label}>KPI</label>
                <input style={s.input} value={f('kpi')} onChange={e => setF('kpi', e.target.value)} placeholder="KPI 분류" />
              </div>
              <div>
                <label style={s.label}>과제명 *</label>
                <textarea rows={5} style={{ ...s.input, resize: 'vertical' }} value={f('taskName')} onChange={e => setF('taskName', e.target.value)} placeholder="과제명을 입력하세요" />
              </div>
            </div>
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
                                  <input type="number" min={0} max={100} style={{ ...s.input, fontSize: 12, width: '70px' }} value={f(key)} onChange={e => setF(key, e.target.value)} placeholder="0~100" />
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

      {/* 헤더 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>중점과제</h2>
          <div style={{ display: 'flex', gap: 16 }}>
            {displayYears.map(y => (
              <button key={y} onClick={() => setSelYear(y)} style={tabStyle(selYear === y)}>{y}년</button>
            ))}
          </div>
        </div>
        <button style={s.btn} onClick={openCreate}>+ 행 추가</button>
      </div>

      {/* 분기 탭 */}
      <div style={{ display: 'flex', gap: 20, marginBottom: 16, borderBottom: '1px solid var(--c-border)' }}>
        <button onClick={() => setSelQuarter('all')} style={tabStyle(selQuarter === 'all')}>전체</button>
        {QUARTERS.map(q => (
          <button key={q} onClick={() => setSelQuarter(q)} style={tabStyle(selQuarter === q)}>
            {q}분기{selQuarter !== 'all' && q === currentQuarter() ? ' ●' : ''}
          </button>
        ))}
      </div>

      {/* 테이블 */}
      <div style={{ overflowX: 'auto', background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: selQuarter === 'all' ? 1400 : 700 }}>
          <thead>
            {selQuarter === 'all' ? (
              <>
                <tr style={{ background: 'var(--c-thead)' }}>
                  <th style={s.th} rowSpan={2}>KPI</th>
                  <th style={{ ...s.th, minWidth: 280 }} rowSpan={2}>과제명</th>
                  <th style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>분기 목표/계획</th>
                  <th style={{ ...s.th, textAlign: 'center', borderLeft: s.sep.borderLeft }} colSpan={4}>분기별 수행내역</th>
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
                <th style={s.th}>KPI</th>
                <th style={{ ...s.th, minWidth: 280 }}>과제명</th>
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
            {!isLoading && tasks.length === 0 && (
              <tr><td colSpan={totalCols} style={s.empty}>등록된 과제가 없습니다.</td></tr>
            )}
            {tasks.map(t => (
              <tr key={t.id} style={s.tr}>
                <td style={{ ...s.td, color: 'var(--c-text-sub)', fontSize: 12 }}>{t.kpi ?? '-'}</td>
                <td style={{ ...s.td, fontWeight: 500, minWidth: 280, whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: 1.6 }}>{t.taskName}</td>
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
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button style={s.btnSm} onClick={() => openEdit(t)}>수정</button>
                    <button style={{ ...s.btnSm, color: '#e53e3e' }}
                      onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(t.id) }}>삭제</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 40px' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--c-card)', borderRadius: 10, padding: 28, width: '90vw', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' },
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
  sep: { borderLeft: '2px solid var(--c-border)' },
}
