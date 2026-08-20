import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { todoApi, type Todo, type SaveTodoRequest, type TodoStatus, type TodoPriority, type TodoSourceType } from '../../api/todos'
import { useAuth } from '../../context/useAuth'
import { getUsers, type UserSummary } from '../../api/users'
import { getKeyTasks } from '../../api/keyTasks'
import { workUnitApi } from '../../api/workUnits'
import { Button, IconButton } from '../../components/ui'

const COLUMNS: { status: TodoStatus; label: string; color: string; guide: string }[] = [
  { status: 'TODO',        label: '대기',   color: 'var(--c-status-todo)',   guide: '아직 시작하지 않은 업무' },
  { status: 'IN_PROGRESS', label: '진행중', color: 'var(--c-status-prog)',   guide: '현재 작업 중인 업무' },
  { status: 'REVIEW',      label: '검토',   color: 'var(--c-status-review)', guide: '완료 후 확인·승인 대기' },
  { status: 'DONE',        label: '완료',   color: 'var(--c-status-done)',   guide: '모든 처리가 끝난 업무' },
  { status: 'HOLD',        label: '보류',   color: 'var(--c-status-hold)',   guide: '이슈·사정으로 잠시 보류된 업무' },
]

const PRIORITY_LABEL: Record<TodoPriority, string> = { HIGH: '상', MEDIUM: '중', LOW: '하' }

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
  workUnitId: undefined,
  checkItems: [],
  links: [],
  imageUrl: '',
  collaborators: [],
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
    workUnitId: todo.workUnitId ?? undefined,
    assignee: todo.assignee,
    checkItems: todo.checkItems ?? [],
    links: todo.links ?? [],
    imageUrl: todo.imageUrl ?? '',
    collaborators: todo.collaborators ?? [],
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
  const [readOnly, setReadOnly] = useState(false)
  const [form, setForm] = useState<SaveTodoRequest>(emptyForm())
  const [filterKeyTaskId, setFilterKeyTaskId] = useState<number | undefined>(undefined)
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
    if (!todo.workUnitId) return null
    const wu = allWorkUnits.find(w => w.id === todo.workUnitId)
    if (wu?.type === 'PROJECT')   return { label: '중점', color: 'var(--c-tag-pri-t)',   bg: 'var(--c-tag-pri-bg)' }
    if (wu?.type === 'OPERATION') return { label: 'KPI',  color: 'var(--c-tag-sys-t)',   bg: 'var(--c-tag-sys)' }
    if (wu?.type === 'PROPOSAL')  return { label: '제안', color: 'var(--c-tag-warn-t)',  bg: 'var(--c-tag-warn-bg)' }
    if (wu?.type === 'PLANNING')  return { label: '기획', color: 'var(--c-tag-done-t)',  bg: 'var(--c-tag-done-bg)' }
    return { label: '기타', color: 'var(--c-tag-draft-t)', bg: 'var(--c-tag-draft-bg)' }
  }

  const filteredWorkUnits = filterKeyTaskId
    ? allWorkUnits.filter(w => w.keyTaskId === filterKeyTaskId)
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
    setFilterKeyTaskId(undefined)
    setModalOpen(true)
  }

  function openEdit(todo: Todo) {
    setEditing(todo)
    setForm(toRequest(todo))
    const wu = allWorkUnits.find(w => w.id === todo.workUnitId)
    setFilterKeyTaskId(wu?.keyTaskId ?? undefined)
    setReadOnly(!isManager && todo.assignee !== user?.username)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setReadOnly(false)
    setForm(emptyForm())
    setFilterKeyTaskId(undefined)
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
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>To-Do</h2>
          <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>
            총 {todos.length}개 · 완료 {grouped.DONE.length}개
            {grouped.HOLD.length > 0 && <span style={{ color: '#c05621', marginLeft: 8 }}>· 보류 {grouped.HOLD.length}개</span>}
          </div>
        </div>
        <Button variant="filled" onClick={openCreate}>+ 추가</Button>
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
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 14, color: col.color }}>{col.label}</span>
                <span style={{ fontSize: 13, color: 'var(--c-text-muted)', marginLeft: 6 }}>{grouped[col.status].length}</span>
              </div>
              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{col.guide}</div>
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
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--c-text-muted)', fontSize: 12 }}>없음</div>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 15 }}>{editing ? 'To-Do 수정' : 'To-Do 추가'}</span>
                {readOnly && (
                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: 'var(--c-tag-draft-bg)', color: 'var(--c-tag-draft-t)', fontWeight: 500 }}>
                    관련자 (읽기 전용)
                  </span>
                )}
              </div>
              <IconButton variant="text" icon="✕" label="닫기" onClick={closeModal} />
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

                {/* ── 왼쪽: 기본 정보 ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={styles.label}>
                    제목 <span style={{ color: 'var(--c-tag-err-t)' }}>*</span>
                    <input
                      style={styles.input}
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Todo 제목"
                      autoFocus
                      disabled={readOnly}
                    />
                  </label>

                  <label style={styles.label}>
                    설명
                    <textarea
                      style={{ ...styles.input, height: 100, resize: 'vertical' }}
                      value={form.description}
                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="상세 내용"
                      disabled={readOnly}
                    />
                  </label>

                  {/* 중점과제(필터) · 단위업무 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={styles.label}>
                      <span>중점과제 <span style={{ fontWeight: 400, color: 'var(--c-text-muted)' }}>(필터)</span></span>
                      <select
                        style={styles.input}
                        value={filterKeyTaskId ?? ''}
                        onChange={e => {
                          setFilterKeyTaskId(e.target.value ? Number(e.target.value) : undefined)
                          setForm(f => ({ ...f, workUnitId: undefined }))
                        }}
                        disabled={readOnly}
                      >
                        <option value="">전체</option>
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
                          if (wu && !filterKeyTaskId) setFilterKeyTaskId(wu.keyTaskId)
                          setForm(f => ({ ...f, workUnitId: wuId }))
                        }}
                        disabled={readOnly}
                      >
                        <option value="">선택 안 함</option>
                        {filteredWorkUnits.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
                      </select>
                    </label>
                  </div>

                  {/* 상태 · 우선순위 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={styles.label}>
                      상태
                      <select style={styles.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as TodoStatus }))} disabled={readOnly}>
                        {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
                      </select>
                    </label>
                    <label style={styles.label}>
                      우선순위
                      <select style={styles.input} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as TodoPriority }))} disabled={readOnly}>
                        <option value="HIGH">상</option>
                        <option value="MEDIUM">중</option>
                        <option value="LOW">하</option>
                      </select>
                    </label>
                  </div>

                  {/* 담당자 · 요청유형 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
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
                      <select style={styles.input} value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value as TodoSourceType }))} disabled={readOnly}>
                        {(Object.entries(SOURCE_LABELS) as [TodoSourceType, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* 시작일 · 목표일 · 완료일 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <label style={styles.label}>
                      <span>시작일 <span style={{ fontSize: 10, color: 'var(--c-text-muted)', fontWeight: 400 }}>(실제)</span></span>
                      <input type="date" style={styles.input} value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} disabled={readOnly} />
                    </label>
                    <label style={styles.label}>
                      목표일
                      <input type="date" style={styles.input} value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} disabled={readOnly} />
                    </label>
                    <label style={styles.label}>
                      <span>완료일 <span style={{ fontSize: 10, color: 'var(--c-text-muted)', fontWeight: 400 }}>(실제)</span></span>
                      <input type="date" style={styles.input} value={form.completedDate} onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))} disabled={readOnly} />
                    </label>
                  </div>
                </div>

                {/* ── 오른쪽: 체크리스트 · 링크 · 이미지 ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, borderLeft: '1px solid var(--c-border)', paddingLeft: 20 }}>

                  {/* 체크리스트 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ ...styles.label, flexDirection: 'row', gap: 6 }}>
                        체크리스트
                        {(form.checkItems?.length ?? 0) > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                            {form.checkItems!.filter(c => c.done).length}/{form.checkItems!.length}
                          </span>
                        )}
                      </span>
                      {!readOnly && (
                        <Button variant="text" size="sm" type="button"
                          onClick={() => setForm(f => ({ ...f, checkItems: [...(f.checkItems ?? []), { text: '', done: false }] }))}>
                          + 항목
                        </Button>
                      )}
                    </div>
                    {(form.checkItems ?? []).length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', padding: '6px 0' }}>항목을 추가하세요</div>
                    )}
                    {(form.checkItems ?? []).map((item, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <input type="checkbox" checked={item.done}
                          onChange={() => setForm(f => {
                            const items = [...(f.checkItems ?? [])]
                            items[i] = { ...items[i], done: !items[i].done }
                            return { ...f, checkItems: items }
                          })}
                          disabled={readOnly}
                          style={{ width: 15, height: 15, flexShrink: 0, cursor: readOnly ? 'default' : 'pointer' }}
                        />
                        <input
                          style={{ ...styles.input, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--c-text-muted)' : 'inherit' }}
                          value={item.text}
                          onChange={e => setForm(f => {
                            const items = [...(f.checkItems ?? [])]
                            items[i] = { ...items[i], text: e.target.value }
                            return { ...f, checkItems: items }
                          })}
                          placeholder="항목 입력"
                          disabled={readOnly}
                        />
                        {!readOnly && (
                          <IconButton variant="text" size="sm" icon="✕" label="제거"
                            onClick={() => setForm(f => ({ ...f, checkItems: (f.checkItems ?? []).filter((_, idx) => idx !== i) }))} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 외부링크 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={styles.label}>외부링크</span>
                      {!readOnly && (
                        <Button variant="text" size="sm" type="button"
                          onClick={() => setForm(f => ({ ...f, links: [...(f.links ?? []), { label: '', url: '' }] }))}>
                          + 링크
                        </Button>
                      )}
                    </div>
                    {(form.links ?? []).length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', padding: '6px 0' }}>링크를 추가하세요</div>
                    )}
                    {(form.links ?? []).map((link, i) => (
                      <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 4, alignItems: 'center' }}>
                        <input
                          style={{ ...styles.input, width: 80, flexShrink: 0 }}
                          value={link.label}
                          onChange={e => setForm(f => {
                            const links = [...(f.links ?? [])]
                            links[i] = { ...links[i], label: e.target.value }
                            return { ...f, links }
                          })}
                          placeholder="이름"
                          disabled={readOnly}
                        />
                        <input
                          style={{ ...styles.input, flex: 1 }}
                          value={link.url}
                          onChange={e => setForm(f => {
                            const links = [...(f.links ?? [])]
                            links[i] = { ...links[i], url: e.target.value }
                            return { ...f, links }
                          })}
                          placeholder="https://..."
                          disabled={readOnly}
                        />
                        {!readOnly && (
                          <IconButton variant="text" size="sm" icon="✕" label="제거"
                            onClick={() => setForm(f => ({ ...f, links: (f.links ?? []).filter((_, idx) => idx !== i) }))} />
                        )}
                      </div>
                    ))}
                  </div>

                  {/* 관련자 */}
                  {isManager && users.length > 0 && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={styles.label}>관련자</span>
                        {(form.collaborators ?? []).length > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{form.collaborators!.length}명</span>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {users.filter(u => u.active && u.username !== form.assignee).map(u => {
                          const selected = (form.collaborators ?? []).includes(u.username)
                          return (
                            <button
                              key={u.username}
                              type="button"
                              onClick={() => setForm(f => {
                                const cols = f.collaborators ?? []
                                return { ...f, collaborators: selected ? cols.filter(c => c !== u.username) : [...cols, u.username] }
                              })}
                              style={{
                                padding: '4px 10px', borderRadius: 20, fontSize: 12, cursor: 'pointer', border: '1px solid',
                                borderColor: selected ? 'var(--c-action)' : 'var(--c-border)',
                                background: selected ? 'color-mix(in srgb, var(--c-action) 12%, transparent)' : 'transparent',
                                color: selected ? 'var(--c-action)' : 'var(--c-text-muted)',
                                fontWeight: selected ? 600 : 400,
                              }}
                            >
                              {u.name ?? u.username}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 이미지 URL */}
                  <label style={styles.label}>
                    이미지 URL
                    <input
                      style={styles.input}
                      value={form.imageUrl ?? ''}
                      onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                      placeholder="https://... (이미지 직접 링크)"
                      disabled={readOnly}
                    />
                    {form.imageUrl && (
                      <img
                        src={form.imageUrl}
                        alt="미리보기"
                        style={{ maxWidth: '100%', maxHeight: 140, borderRadius: 6, marginTop: 6, objectFit: 'contain', border: '1px solid var(--c-border)' }}
                        onError={e => (e.currentTarget.style.display = 'none')}
                      />
                    )}
                  </label>
                </div>
              </div>

              {/* ── 버튼 ── */}
              <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--c-border)', alignItems: 'center' }}>
                {!readOnly && editing && (
                  <button type="button" className="ds-btn ds-btn--outlined ds-btn--md"
                    style={{ borderColor: 'var(--c-tag-err-t)', color: 'var(--c-tag-err-t)' }}
                    onClick={() => { if (confirm(`"${editing.title}" 삭제할까요?`)) { deleteMut.mutate(editing.id); closeModal() } }}>
                    삭제
                  </button>
                )}
                <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
                  <Button type="button" variant="outlined" onClick={closeModal}>{readOnly ? '닫기' : '취소'}</Button>
                  {!readOnly && (
                    <Button type="submit" variant="filled" disabled={createMut.isPending || updateMut.isPending}>
                      {editing ? '저장' : '추가'}
                    </Button>
                  )}
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
        opacity: faded ? 0.45 : 1,
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.12)' : '0 1px 3px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-1px)' : 'none',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.5, wordBreak: 'break-word' }}>
        {showAssignee && (
          <div style={{ fontSize: 11, color: 'var(--c-status-prog)', fontWeight: 600, marginBottom: 3 }}>{nameOf(todo.assignee)}</div>
        )}
        {todo.title}
      </div>

      {/* 체크리스트 진행 바 */}
      {(todo.checkItems?.length ?? 0) > 0 && (() => {
        const total = todo.checkItems!.length
        const done = todo.checkItems!.filter(c => c.done).length
        const pct = Math.round((done / total) * 100)
        return (
          <div style={{ marginTop: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--c-text-muted)', marginBottom: 3 }}>
              <span>체크리스트</span>
              <span>{done}/{total}</span>
            </div>
            <div style={{ height: 4, borderRadius: 2, background: 'var(--c-border)' }}>
              <div style={{ height: '100%', borderRadius: 2, background: done === total ? 'var(--c-status-done)' : 'var(--c-status-prog)', width: `${pct}%`, transition: 'width 0.2s' }} />
            </div>
          </div>
        )
      })()}

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
        {overdue && (
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--c-tag-err-bg)', color: 'var(--c-tag-err-t)', fontWeight: 700, border: '1px solid var(--c-tag-err-t)' }}>
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
            background: todo.priority === 'HIGH' ? 'var(--c-tag-err-bg)' : 'transparent',
            color: todo.priority === 'HIGH' ? 'var(--c-tag-err-t)' : 'var(--c-text-muted)',
            border: todo.priority === 'HIGH' ? 'none' : '1px solid var(--c-border)',
          }}>
            {PRIORITY_LABEL[todo.priority]}
          </span>
        )}
        {todo.sourceType && todo.sourceType !== 'SELF' && (
          <span style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: 'var(--c-tag-sys)', color: 'var(--c-tag-sys-t)' }}>
            {SOURCE_LABELS[todo.sourceType]}
          </span>
        )}
        {(todo.collaborators?.length ?? 0) > 0 && (
          <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>👥 {todo.collaborators!.length}</span>
        )}
        {(todo.links?.length ?? 0) > 0 && (
          <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>🔗 {todo.links!.length}</span>
        )}
        {todo.imageUrl && (
          <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>🖼</span>
        )}
        {todo.dueDate && (
          <span style={{ fontSize: 11, color: overdue ? 'var(--c-tag-err-t)' : 'var(--c-text-muted)', marginLeft: 'auto' }}>
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
    background: 'var(--c-thead)', borderLeft: '1px solid var(--c-border)',
    borderRight: '1px solid var(--c-border)',
  },
  card: {
    background: 'var(--c-card)', borderRadius: 6,
    border: '1px solid var(--c-border)', padding: '10px 12px',
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
    background: 'var(--c-card)', borderRadius: 10, padding: 24,
    width: '100%', maxWidth: 860, maxHeight: '90vh', overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
  },
  modalHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  closeBtn: {
    background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: 'var(--c-text-muted)',
  },
  label: {
    display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, color: 'var(--c-text-sub)', fontWeight: 500,
  },
  input: {
    padding: '8px 10px', borderRadius: 6, border: '1px solid var(--c-border)',
    fontSize: 13, outline: 'none', background: 'var(--c-input-bg)', color: 'inherit',
    width: '100%', boxSizing: 'border-box',
  },
  cancelBtn: {
    padding: '8px 16px', borderRadius: 6, border: '1px solid var(--c-border)',
    background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--c-text-muted)',
  },
  submitBtn: {
    padding: '8px 20px', borderRadius: 6, border: 'none',
    background: '#3182ce', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  deleteBtn: {
    padding: '8px 14px', borderRadius: 6, border: '1px solid var(--c-tag-err-t)',
    background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--c-tag-err-t)',
  },
}
