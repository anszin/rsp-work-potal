import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  workUnitApi, type WorkUnit, type SaveWorkUnitRequest,
  type WorkUnitType, type WorkUnitStatus,
  WORK_UNIT_TYPE_LABELS, WORK_UNIT_STATUS_LABELS, WORK_UNIT_STATUS_COLOR,
} from '../../api/workUnits'
import { getKeyTasks } from '../../api/keyTasks'

const STATUS_ORDER: WorkUnitStatus[] = ['IN_PROGRESS', 'ON_HOLD', 'DONE']

export default function WorkUnitPage({ initialKeyTaskId, year }: { initialKeyTaskId?: number; year?: number } = {}) {
  const qc = useQueryClient()
  const selYear = year ?? new Date().getFullYear()

  const { data: allWorkUnits = [], isLoading } = useQuery({
    queryKey: ['work-units-all'],
    queryFn: workUnitApi.listAll,
  })

  const { data: keyTasks = [] } = useQuery({
    queryKey: ['key-tasks', selYear],
    queryFn: () => getKeyTasks(selYear),
  })

  const ktIds = new Set(keyTasks.map(k => k.id))
  const workUnits = allWorkUnits.filter(wu => ktIds.has(wu.keyTaskId))

  const [filterType, setFilterType] = useState<WorkUnitType | 'ALL'>('ALL')
  const [filterStatus, setFilterStatus] = useState<WorkUnitStatus | 'ALL'>('ALL')
  const [filterKeyTask, setFilterKeyTask] = useState<number | 'ALL'>(initialKeyTaskId ?? 'ALL')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<WorkUnit | null>(null)
  const [form, setForm] = useState<SaveWorkUnitRequest>(emptyForm())

  const createMut = useMutation({
    mutationFn: (data: SaveWorkUnitRequest) => workUnitApi.create(data),
    onSuccess: () => { invalidate(); closeModal() },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveWorkUnitRequest }) => workUnitApi.update(id, data),
    onSuccess: () => { invalidate(); closeModal() },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => workUnitApi.delete(id),
    onSuccess: () => invalidate(),
  })

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['work-units-all'] })
    qc.invalidateQueries({ queryKey: ['work-units'] })
  }

  function openCreate() {
    setEditing(null)
    setForm({ ...emptyForm(), keyTaskId: keyTasks[0]?.id ?? 0 })
    setModalOpen(true)
  }

  function openEdit(wu: WorkUnit) {
    setEditing(wu)
    setForm({ keyTaskId: wu.keyTaskId, title: wu.title, type: wu.type, status: wu.status, description: wu.description ?? '' })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm())
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.keyTaskId) return
    if (editing) {
      updateMut.mutate({ id: editing.id, data: form })
    } else {
      createMut.mutate(form)
    }
  }

  const keyTaskMap = Object.fromEntries(keyTasks.map(t => [t.id, t.taskName]))

  const filtered = workUnits.filter(wu =>
    (filterType === 'ALL' || wu.type === filterType) &&
    (filterStatus === 'ALL' || wu.status === filterStatus) &&
    (filterKeyTask === 'ALL' || wu.keyTaskId === filterKeyTask)
  )

  const grouped = STATUS_ORDER.reduce((acc, s) => {
    acc[s] = filtered.filter(wu => wu.status === s)
    return acc
  }, {} as Record<WorkUnitStatus, WorkUnit[]>)

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>로딩 중...</div>

  return (
    <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>단위업무</h2>
          <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>
            전체 {workUnits.length}개 · 진행중 {grouped.IN_PROGRESS.length}개 · 보류 {grouped.ON_HOLD.length}개 · 완료 {grouped.DONE.length}개
          </div>
        </div>
        <button onClick={openCreate} style={styles.addBtn}>+ 추가</button>
      </div>

      {/* 필터 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <select style={styles.filter} value={filterKeyTask} onChange={e => setFilterKeyTask(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}>
          <option value="ALL">전체 중점과제</option>
          {keyTasks.map(t => <option key={t.id} value={t.id}>{t.taskName}</option>)}
        </select>
        <select style={styles.filter} value={filterType} onChange={e => setFilterType(e.target.value as WorkUnitType | 'ALL')}>
          <option value="ALL">전체 유형</option>
          {(Object.entries(WORK_UNIT_TYPE_LABELS) as [WorkUnitType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select style={styles.filter} value={filterStatus} onChange={e => setFilterStatus(e.target.value as WorkUnitStatus | 'ALL')}>
          <option value="ALL">전체 상태</option>
          {(Object.entries(WORK_UNIT_STATUS_LABELS) as [WorkUnitStatus, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {/* 상태별 섹션 */}
      {STATUS_ORDER.map(status => (
        grouped[status].length > 0 && (
          <div key={status}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: WORK_UNIT_STATUS_COLOR[status] }}>
                {WORK_UNIT_STATUS_LABELS[status]}
              </span>
              <span style={{ fontSize: 12, color: '#a0aec0' }}>{grouped[status].length}개</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {grouped[status].map(wu => (
                <div key={wu.id} style={{ ...styles.card, borderLeft: `3px solid ${WORK_UNIT_STATUS_COLOR[wu.status]}` }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{wu.title}</span>
                        <span style={styles.badge}>{WORK_UNIT_TYPE_LABELS[wu.type]}</span>
                        {keyTaskMap[wu.keyTaskId] && (
                          <span style={{ ...styles.badge, background: '#EBF8FF', color: '#2B6CB0' }}>
                            {keyTaskMap[wu.keyTaskId]}
                          </span>
                        )}
                      </div>
                      {wu.description && (
                        <div style={{ fontSize: 12, color: '#718096', lineHeight: 1.5 }}>{wu.description}</div>
                      )}
                      <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 4 }}>
                        등록 {wu.createdAt?.slice(0, 10)}
                        {wu.updatedAt && ` · 수정 ${wu.updatedAt.slice(0, 10)}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                      <button style={styles.btnSm} onClick={() => openEdit(wu)}>수정</button>
                      <button style={{ ...styles.btnSm, color: '#e53e3e' }}
                        onClick={() => { if (confirm(`"${wu.title}" 삭제할까요?`)) deleteMut.mutate(wu.id) }}>삭제</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      ))}

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: '#a0aec0', fontSize: 14 }}>
          단위업무가 없습니다. 우측 상단 "+ 추가" 버튼으로 등록하세요.
        </div>
      )}

      {/* 추가/수정 모달 */}
      {modalOpen && (
        <div style={styles.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={styles.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{editing ? '단위업무 수정' : '단위업무 추가'}</span>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#718096' }}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={styles.label}>
                중점과제 *
                <select style={styles.input} value={form.keyTaskId} onChange={e => setForm(f => ({ ...f, keyTaskId: Number(e.target.value) }))}>
                  <option value={0} disabled>중점과제 선택</option>
                  {keyTasks.map(t => <option key={t.id} value={t.id}>{t.taskName}</option>)}
                </select>
              </label>
              <label style={styles.label}>
                이름 *
                <input style={styles.input} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} autoFocus />
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={styles.label}>
                  유형
                  <select style={styles.input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value as WorkUnitType }))}>
                    {(Object.entries(WORK_UNIT_TYPE_LABELS) as [WorkUnitType, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label style={styles.label}>
                  상태
                  <select style={styles.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as WorkUnitStatus }))}>
                    {(Object.entries(WORK_UNIT_STATUS_LABELS) as [WorkUnitStatus, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
              </div>
              <label style={styles.label}>
                설명
                <textarea style={{ ...styles.input, height: 72, resize: 'vertical' }} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} style={styles.cancelBtn}>취소</button>
                <button type="submit" style={styles.submitBtn} disabled={createMut.isPending || updateMut.isPending}>저장</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function emptyForm(): SaveWorkUnitRequest {
  return { keyTaskId: 0, title: '', type: 'PROJECT', status: 'IN_PROGRESS', description: '' }
}

const styles: Record<string, React.CSSProperties> = {
  filter: { padding: '6px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, background: 'var(--bg-card, #fff)', color: 'inherit', cursor: 'pointer' },
  card: { background: 'var(--bg-card, #fff)', border: '1px solid #e2e8f0', borderRadius: 8, padding: '12px 16px' },
  badge: { fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#F0FFF4', color: '#276749' },
  btnSm: { padding: '4px 10px', fontSize: 12, borderRadius: 5, border: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', color: '#4a5568' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--bg-card, #fff)', borderRadius: 10, padding: 24, width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)' },
  label: { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#4a5568', fontWeight: 500 },
  input: { padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0', fontSize: 13, outline: 'none', background: 'var(--bg-input, #fff)', color: 'inherit', width: '100%', boxSizing: 'border-box' },
  cancelBtn: { padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0', background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#718096' },
  submitBtn: { padding: '8px 20px', borderRadius: 6, border: 'none', background: '#6b46c1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
  addBtn: { padding: '7px 16px', borderRadius: 6, border: 'none', background: '#6b46c1', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 },
}
