import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { todoApi, type Todo, type SaveTodoRequest, type TodoStatus, type TodoPriority, type TodoSourceType } from '../../api/todos'
import { useAuth } from '../../context/useAuth'
import { getUsers, type UserSummary } from '../../api/users'
import { getKeyTasks } from '../../api/keyTasks'
import { workUnitApi } from '../../api/workUnits'

const COLUMNS: { status: TodoStatus; label: string; color: string }[] = [
  { status: 'TODO',        label: '대기',   color: '#718096' },
  { status: 'IN_PROGRESS', label: '진행중', color: '#3182ce' },
  { status: 'REVIEW',      label: '검토',   color: '#d69e2e' },
  { status: 'DONE',        label: '완료',   color: '#38a169' },
  { status: 'HOLD',        label: '보류',   color: '#c05621' },
]

const PRIORITY_STYLE: Record<TodoPriority, { bg: string; color: string; label: string }> = {
  HIGH:   { bg: '#FFF5F5', color: '#c53030', label: '상' },
  MEDIUM: { bg: '#FFFAF0', color: '#c05621', label: '중' },
  LOW:    { bg: '#F0FFF4', color: '#276749', label: '하' },
}

const SOURCE_LABELS: Record<TodoSourceType, string> = {
  SELF:           '자체',
  CHANGE_REQUEST: '변경요청',
  DEPLOY:         '배포',
  EXTERNAL:       '외부',
}

const emptyForm = (): SaveTodoRequest => ({
  title: '',
  description: '',
  status: 'TODO',
  priority: 'MEDIUM',
  startDate: '',
  dueDate: '',
  completedDate: '',
  sourceType: 'SELF',
  keyTaskId: undefined,
  workUnitId: undefined,
})

function formatDate(d: string | null) {
  if (!d) return null
  return d.slice(0, 10)
}

function isPast(dueDate: string | null) {
  if (!dueDate) return false
  return new Date(dueDate) < new Date(new Date().toDateString())
}

function toRequest(todo: Todo): SaveTodoRequest {
  return {
    title: todo.title,
    description: todo.description ?? '',
    status: todo.status,
    priority: todo.priority ?? 'MEDIUM',
    startDate: todo.startDate ?? '',
    dueDate: todo.dueDate ?? '',
    completedDate: todo.completedDate ?? '',
    sourceType: todo.sourceType ?? 'SELF',
    sourceId: todo.sourceId ?? undefined,
    keyTaskId: todo.keyTaskId ?? undefined,
    workUnitId: todo.workUnitId ?? undefined,
    assignee: todo.assignee,
  }
}

export default function TodoPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const now = new Date().getFullYear()
  const isManager = ['ADMIN', 'MANAGER'].includes(user?.role ?? '')
  const nameOf = (username: string) => users.find(u => u.username === username)?.name ?? username
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [form, setForm] = useState<SaveTodoRequest>(emptyForm())
  const [dragging, setDragging] = useState<number | null>(null)

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: todoApi.list,
  })

  const { data: users = [] } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: isManager,
  })

  const { data: keyTasks = [] } = useQuery({
    queryKey: ['key-tasks', now],
    queryFn: () => getKeyTasks(now),
  })

  const { data: allWorkUnits = [] } = useQuery({
    queryKey: ['work-units-all'],
    queryFn: workUnitApi.listAll,
  })

  function getTypeBadge(todo: Todo): { label: string; color: string; bg: string } | null {
    if (todo.workUnitId) {
      const wu = allWorkUnits.find(w => w.id === todo.workUnitId)
      if (wu?.type === 'PROJECT')   return { label: '중점', color: '#6b46c1', bg: '#F5F0FF' }
      if (wu?.type === 'OPERATION') return { label: 'KPI',  color: '#2B6CB0', bg: '#EBF8FF' }
      return { label: '기타', color: '#718096', bg: '#EDF2F7' }
    }
    if (todo.keyTaskId) return { label: '중점', color: '#6b46c1', bg: '#F5F0FF' }
    return null
  }

  const filteredWorkUnits = form.keyTaskId
    ? allWorkUnits.filter(w => w.keyTaskId === form.keyTaskId)
    : allWorkUnits

  const createMut = useMutation({
    mutationFn: (data: SaveTodoRequest) => todoApi.create(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['todos'] }); closeModal() },
  })

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveTodoRequest }) => todoApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['todos'] }); closeModal() },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => todoApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  })

  const patchMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveTodoRequest }) => todoApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  })

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setModalOpen(true)
  }

  function openEdit(todo: Todo) {
    setEditing(todo)
    setForm(toRequest(todo))
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(emptyForm())
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    const payload = { ...form, dueDate: form.dueDate || undefined, description: form.description || undefined }
    if (editing) {
      updateMut.mutate({ id: editing.id, data: payload })
    } else {
      createMut.mutate(payload)
    }
  }

  function handleDrop(status: TodoStatus) {
    if (dragging == null) return
    const todo = todos.find(t => t.id === dragging)
    if (todo && todo.status !== status) {
      patchMut.mutate({ id: dragging, data: { ...toRequest(todo), status } })
    }
    setDragging(null)
  }

  const grouped = COLUMNS.reduce((acc, col) => {
    acc[col.status] = todos.filter(t => t.status === col.status)
    return acc
  }, {} as Record<TodoStatus, Todo[]>)

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center', color: '#718096' }}>로딩 중...</div>

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Todo</h2>
          <div style={{ fontSize: 12, color: '#718096', marginTop: 2 }}>
            총 {todos.length}개 · 완료 {grouped.DONE.length}개
            {grouped.HOLD.length > 0 && <span style={{ color: '#c05621', marginLeft: 8 }}>· 보류 {grouped.HOLD.length}개</span>}
          </div>
        </div>
        <button onClick={openCreate} style={styles.addBtn}>+ 추가</button>
      </div>

      {/* Kanban Board - 5컬럼 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, flex: 1, minHeight: 0, overflowX: 'auto' }}>
        {COLUMNS.map(col => (
          <div
            key={col.status}
            onDragOver={e => e.preventDefault()}
            onDrop={() => handleDrop(col.status)}
            style={{ display: 'flex', flexDirection: 'column', minWidth: 160 }}
          >
            <div style={{ ...styles.colHeader, borderTop: `3px solid ${col.color}` }}>
              <span style={{ fontWeight: 700, fontSize: 14, color: col.color }}>{col.label}</span>
              <span style={{ fontSize: 13, color: '#a0aec0', marginLeft: 6 }}>{grouped[col.status].length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0', flex: 1, overflowY: 'auto' }}>
              {grouped[col.status].map(todo => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  showAssignee={isManager}
                  onDetail={() => openEdit(todo)}
                  nameOf={nameOf}
                  typeBadge={getTypeBadge(todo)}
                  onDragStart={() => setDragging(todo.id)}
                  onDragEnd={() => setDragging(null)}
                />
              ))}
              {grouped[col.status].length === 0 && (
                <div style={{ textAlign: 'center', padding: '24px 0', color: '#cbd5e0', fontSize: 12 }}>없음</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div style={styles.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{editing ? 'To-Do 수정' : 'To-Do 추가'}</span>
              <button onClick={closeModal} style={styles.closeBtn}>✕</button>
            </div>
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={styles.label}>
                제목 <span style={{ color: '#e53e3e' }}>*</span>
                <input
                  style={styles.input}
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Todo 제목"
                  autoFocus
                />
              </label>

              <label style={styles.label}>
                설명
                <textarea
                  style={{ ...styles.input, height: 140, resize: 'vertical' }}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="상세 내용"
                />
              </label>

              {/* 중점과제 · 단위업무 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={styles.label}>
                  중점과제
                  <select
                    style={styles.input}
                    value={form.keyTaskId ?? ''}
                    onChange={e => setForm(f => ({ ...f, keyTaskId: e.target.value ? Number(e.target.value) : undefined, workUnitId: undefined }))}
                  >
                    <option value="">선택 안 함</option>
                    {keyTasks.map(t => <option key={t.id} value={t.id}>{t.taskName}</option>)}
                  </select>
                </label>
                <label style={styles.label}>
                  단위업무
                  <select
                    style={styles.input}
                    value={form.workUnitId ?? ''}
                    onChange={e => {
                      const wuId = e.target.value ? Number(e.target.value) : undefined
                      const wu = allWorkUnits.find(w => w.id === wuId)
                      setForm(f => ({ ...f, workUnitId: wuId, keyTaskId: wu ? wu.keyTaskId : f.keyTaskId }))
                    }}
                    disabled={filteredWorkUnits.length === 0}
                  >
                    <option value="">선택 안 함</option>
                    {filteredWorkUnits.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
                  </select>
                </label>
              </div>

              {/* 상태 · 우선순위 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label style={styles.label}>
                  상태
                  <select style={styles.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TodoStatus }))}>
                    {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
                  </select>
                </label>
                <label style={styles.label}>
                  우선순위
                  <select style={styles.input} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TodoPriority }))}>
                    <option value="HIGH">상</option>
                    <option value="MEDIUM">중</option>
                    <option value="LOW">하</option>
                  </select>
                </label>
              </div>

              {/* 담당자 · 요청유형 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                {isManager && (
                  <label style={styles.label}>
                    담당자
                    <select
                      style={styles.input}
                      value={form.assignee ?? ''}
                      onChange={e => setForm(f => ({ ...f, assignee: e.target.value || undefined }))}
                    >
                      <option value="">본인</option>
                      {users.filter(u => u.active).map(u => (
                        <option key={u.username} value={u.username}>
                          {u.name ?? u.username}{u.dept ? ` (${u.dept})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <label style={styles.label}>
                  요청유형
                  <select style={styles.input} value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value as TodoSourceType }))}>
                    {(Object.entries(SOURCE_LABELS) as [TodoSourceType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>

              {/* 시작일 · 목표일 · 완료일 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, alignItems: 'end' }}>
                <label style={styles.label}>
                  <span>시작일 <span style={{ fontSize: 10, color: '#a0aec0', fontWeight: 400 }}>(실제)</span></span>
                  <input type="date" style={styles.input} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
                </label>
                <label style={styles.label}>
                  목표일
                  <input type="date" style={styles.input} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </label>
                <label style={styles.label}>
                  <span>완료일 <span style={{ fontSize: 10, color: '#a0aec0', fontWeight: 400 }}>(실제)</span></span>
                  <input type="date" style={styles.input} value={form.completedDate} onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))} />
                </label>
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 4, alignItems: 'center' }}>
                {editing && (
                  <button type="button" style={styles.deleteBtn}
                    onClick={() => { if (confirm(`"${editing.title}" 삭제할까요?`)) { deleteMut.mutate(editing.id); closeModal() } }}>
                    삭제
                  </button>
                )}
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <button type="button" onClick={closeModal} style={styles.cancelBtn}>취소</button>
                  <button type="submit" style={styles.submitBtn} disabled={createMut.isPending || updateMut.isPending}>
                    {editing ? '저장' : '추가'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TodoCard({ todo, showAssignee, nameOf, typeBadge, onDetail, onDragStart, onDragEnd }: {
  todo: Todo
  showAssignee: boolean
  nameOf: (username: string) => string
  typeBadge?: { label: string; color: string; bg: string } | null
  onDetail: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const pColor = todo.priority === 'HIGH' ? PRIORITY_STYLE.HIGH.color : '#e2e8f0'
  const overdue = todo.status !== 'DONE' && todo.status !== 'HOLD' && isPast(todo.dueDate)
  const faded = todo.status === 'DONE' || todo.status === 'HOLD'
  const [hovered, setHovered] = useState(false)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onDetail}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...styles.card,
        cursor: 'pointer',
        borderLeft: `3px solid ${pColor}`,
        opacity: faded ? 0.45 : 1,
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, wordBreak: 'break-word' }}>
        {showAssignee && (
          <div style={{ fontSize: 11, color: '#3182ce', fontWeight: 600, marginBottom: 3 }}>{nameOf(todo.assignee)}</div>
        )}
        {todo.title}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {overdue && (
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#FFF5F5', color: '#c53030', fontWeight: 700, border: '1px solid #FED7D7' }}>
            지연
          </span>
        )}
        {typeBadge && (
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: typeBadge.bg, color: typeBadge.color, fontWeight: 700 }}>
            {typeBadge.label}
          </span>
        )}
        {todo.priority && (
          <span style={{
            fontSize: 11, padding: '2px 7px', borderRadius: 10, fontWeight: 600,
            background: todo.priority === 'HIGH' ? PRIORITY_STYLE.HIGH.bg : 'transparent',
            color: todo.priority === 'HIGH' ? PRIORITY_STYLE.HIGH.color : '#a0aec0',
            border: todo.priority === 'HIGH' ? 'none' : '1px solid #e2e8f0',
          }}>
            {PRIORITY_STYLE[todo.priority].label}
          </span>
        )}
        {todo.sourceType && todo.sourceType !== 'SELF' && (
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: '#EBF8FF', color: '#2B6CB0' }}>
            {SOURCE_LABELS[todo.sourceType]}
          </span>
        )}
        {todo.dueDate && (
          <span style={{ fontSize: 11, color: overdue ? '#e53e3e' : '#718096', marginLeft: 'auto' }}>
            {overdue ? '⚠ ' : ''}{formatDate(todo.dueDate)}
          </span>
        )}
      </div>
    </div>
  )
}


const styles: Record<string, React.CSSProperties> = {
  addBtn: {
    background: '#3182ce', color: '#fff', border: 'none',
    padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  colHeader: {
    padding: '10px 12px', borderRadius: '6px 6px 0 0',
    background: 'var(--bg-card, #f7fafc)', borderLeft: '1px solid #e2e8f0',
    borderRight: '1px solid #e2e8f0',
  },
  card: {
    background: 'var(--bg-card, #fff)', borderRadius: 6,
    border: '1px solid #e2e8f0', padding: '10px 12px',
    cursor: 'grab', boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, padding: '2px 3px', opacity: 0.5, lineHeight: 1,
  },
  overlay: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: 'var(--bg-card, #fff)', borderRadius: 10, padding: 24,
    width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: '#718096',
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: '#4a5568', fontWeight: 500,
  },
  input: {
    padding: '8px 10px', borderRadius: 6, border: '1px solid #e2e8f0',
    fontSize: 13, outline: 'none', background: 'var(--bg-input, #fff)', color: 'inherit',
    width: '100%', boxSizing: 'border-box',
  },
  cancelBtn: {
    padding: '8px 16px', borderRadius: 6, border: '1px solid #e2e8f0',
    background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#718096',
  },
  submitBtn: {
    padding: '8px 20px', borderRadius: 6, border: 'none',
    background: '#3182ce', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  deleteBtn: {
    padding: '8px 14px', borderRadius: 6, border: '1px solid #fed7d7',
    background: 'transparent', cursor: 'pointer', fontSize: 13, color: '#e53e3e',
  },
}
