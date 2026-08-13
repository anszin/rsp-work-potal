import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { todoApi, type Todo, type SaveTodoRequest, type TodoStatus, type TodoPriority, type TodoSourceType } from '../../api/todos'
import { useAuth } from '../../context/useAuth'
import { getUsers, type UserSummary } from '../../api/users'

const COLUMNS: { status: TodoStatus; label: string; color: string }[] = [
  { status: 'TODO',        label: '대기',   color: '#718096' },
  { status: 'IN_PROGRESS', label: '진행중', color: '#3182ce' },
  { status: 'REVIEW',      label: '검토',   color: '#d69e2e' },
  { status: 'DONE',        label: '완료',   color: '#38a169' },
  { status: 'HOLD',        label: '보류',   color: '#c05621' },
]

const PRIORITY_STYLE: Record<TodoPriority, { bg: string; color: string; label: string }> = {
  HIGH:   { bg: '#FFF5F5', color: '#c53030', label: '높음' },
  MEDIUM: { bg: '#FFFAF0', color: '#c05621', label: '중간' },
  LOW:    { bg: '#F0FFF4', color: '#276749', label: '낮음' },
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
  dueDate: '',
  sourceType: 'SELF',
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
    dueDate: todo.dueDate ?? '',
    sourceType: todo.sourceType ?? 'SELF',
    sourceId: todo.sourceId ?? undefined,
    keyTaskId: todo.keyTaskId ?? undefined,
    assignee: todo.assignee,
  }
}

export default function TodoPage() {
  const qc = useQueryClient()
  const { user } = useAuth()
  const isManager = ['ADMIN', 'MANAGER'].includes(user?.role ?? '')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Todo | null>(null)
  const [form, setForm] = useState<SaveTodoRequest>(emptyForm())
  const [dragging, setDragging] = useState<number | null>(null)
  const [detail, setDetail] = useState<Todo | null>(null)

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: todoApi.list,
  })

  const { data: users = [] } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: getUsers,
    enabled: isManager,
  })

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
              <span style={{ fontWeight: 600, fontSize: 13, color: col.color }}>{col.label}</span>
              <span style={{ fontSize: 12, color: '#a0aec0', marginLeft: 6 }}>{grouped[col.status].length}</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 0', flex: 1, overflowY: 'auto' }}>
              {grouped[col.status].map(todo => (
                <TodoCard
                  key={todo.id}
                  todo={todo}
                  showAssignee={isManager}
                  onDetail={() => setDetail(todo)}
                  onEdit={() => openEdit(todo)}
                  onDelete={() => { if (confirm(`"${todo.title}" 삭제할까요?`)) deleteMut.mutate(todo.id) }}
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

      {/* 상세 팝업 */}
      {detail && (
        <div style={styles.overlay} onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div style={{ ...styles.modal, maxWidth: 440 }}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{detail.title}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setDetail(null); openEdit(detail) }} style={{ ...styles.cancelBtn, fontSize: 12, padding: '4px 10px' }}>수정</button>
                <button onClick={() => setDetail(null)} style={styles.closeBtn}>✕</button>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge label={COLUMNS.find(c => c.status === detail.status)?.label ?? detail.status} color={COLUMNS.find(c => c.status === detail.status)?.color ?? '#718096'} />
                {detail.priority && <Badge label={PRIORITY_STYLE[detail.priority].label} color={PRIORITY_STYLE[detail.priority].color} />}
                {detail.sourceType && detail.sourceType !== 'SELF' && <Badge label={SOURCE_LABELS[detail.sourceType]} color='#2B6CB0' />}
              </div>
              {isManager && <Row label="담당자" value={detail.assignee} />}
              {detail.dueDate && <Row label="마감일" value={formatDate(detail.dueDate) ?? ''} warn={detail.status !== 'DONE' && detail.status !== 'HOLD' && isPast(detail.dueDate)} />}
              {detail.description && (
                <div>
                  <div style={{ fontSize: 11, color: '#a0aec0', marginBottom: 4 }}>설명</div>
                  <div style={{ fontSize: 13, color: '#2d3748', whiteSpace: 'pre-wrap', lineHeight: 1.6, background: 'var(--bg-input, #f7fafc)', padding: '10px 12px', borderRadius: 6 }}>
                    {detail.description}
                  </div>
                </div>
              )}
              <div style={{ fontSize: 11, color: '#a0aec0', marginTop: 4 }}>
                등록 {detail.createdAt?.slice(0, 10)}
                {detail.updatedAt && ` · 수정 ${detail.updatedAt.slice(0, 10)}`}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal */}
      {modalOpen && (
        <div style={styles.overlay} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>{editing ? 'Todo 수정' : 'Todo 추가'}</span>
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
                  style={{ ...styles.input, height: 72, resize: 'vertical' }}
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="상세 내용"
                />
              </label>

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
                    <option value="HIGH">높음</option>
                    <option value="MEDIUM">중간</option>
                    <option value="LOW">낮음</option>
                  </select>
                </label>

                <label style={styles.label}>
                  마감일
                  <input type="date" style={styles.input} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
                </label>

                <label style={styles.label}>
                  출처
                  <select style={styles.input} value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value as TodoSourceType }))}>
                    {(Object.entries(SOURCE_LABELS) as [TodoSourceType, string][]).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </label>
              </div>

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

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
                <button type="button" onClick={closeModal} style={styles.cancelBtn}>취소</button>
                <button type="submit" style={styles.submitBtn} disabled={createMut.isPending || updateMut.isPending}>
                  {editing ? '저장' : '추가'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function TodoCard({ todo, showAssignee, onDetail, onEdit, onDelete, onDragStart, onDragEnd }: {
  todo: Todo
  showAssignee: boolean
  onDetail: () => void
  onEdit: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const pStyle = todo.priority ? PRIORITY_STYLE[todo.priority] : null
  const overdue = todo.status !== 'DONE' && todo.status !== 'HOLD' && isPast(todo.dueDate)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onDetail}
      style={{ ...styles.card, cursor: 'pointer' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, fontSize: 13, fontWeight: 500, lineHeight: 1.4, wordBreak: 'break-word' }}>
          {showAssignee && (
            <div style={{ fontSize: 10, color: '#3182ce', fontWeight: 600, marginBottom: 2 }}>{todo.assignee}</div>
          )}
          {todo.title}
        </div>
        <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button onClick={onEdit} style={styles.iconBtn} title="수정">✏️</button>
          <button onClick={onDelete} style={styles.iconBtn} title="삭제">🗑</button>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {pStyle && (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: pStyle.bg, color: pStyle.color, fontWeight: 600 }}>
            {pStyle.label}
          </span>
        )}
        {todo.sourceType && todo.sourceType !== 'SELF' && (
          <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 10, background: '#EBF8FF', color: '#2B6CB0' }}>
            {SOURCE_LABELS[todo.sourceType]}
          </span>
        )}
        {todo.description && (
          <span style={{ fontSize: 10, color: '#a0aec0' }}>📝</span>
        )}
        {todo.dueDate && (
          <span style={{ fontSize: 10, color: overdue ? '#e53e3e' : '#718096', marginLeft: 'auto' }}>
            {overdue ? '⚠ ' : ''}{formatDate(todo.dueDate)}
          </span>
        )}
      </div>
    </div>
  )
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: color + '22', color, fontWeight: 600, border: `1px solid ${color}44` }}>
      {label}
    </span>
  )
}

function Row({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
      <span style={{ fontSize: 11, color: '#a0aec0', minWidth: 48 }}>{label}</span>
      <span style={{ fontSize: 13, color: warn ? '#e53e3e' : '#2d3748' }}>{warn ? '⚠ ' : ''}{value}</span>
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
}
