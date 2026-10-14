import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { todoApi, type Todo, type SaveTodoRequest, type TodoStatus, type TodoPriority, type TodoSourceType } from '../../api/todos'
import { useAuth } from '../../context/useAuth'
import { getUsers, type UserSummary } from '../../api/users'
import { getKeyTasks } from '../../api/keyTasks'
import { workUnitApi } from '../../api/workUnits'
import { Button, IconButton, Input, Modal, Select, Textarea, Tag, Panel, Loading, EmptyState, Checkbox } from '../../components/ui'
import PageHeader from '../../components/PageHeader'

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
  workLogs: [],
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
    workLogs: todo.workLogs ?? [],
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

  if (isLoading) return <Loading style={{ padding: 40 }} />

  return (
    <div style={{ padding: 24, height: '100%', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <PageHeader
        title="To-Do"
        description={<>
          총 {todos.length}개 · 완료 {grouped.DONE.length}개
          {grouped.HOLD.length > 0 && <span style={{ color: 'var(--c-tag-warn-t)', marginLeft: 8 }}>· 보류 {grouped.HOLD.length}개</span>}
        </>}
        actions={<Button variant="filled" onClick={openCreate}>+ 추가</Button>}
        style={{ marginBottom: 4 }}
      />

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
                <EmptyState title="없음" style={{ padding: '24px 0' }} />
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {modalOpen && (
        <Modal open onClose={closeModal} width={860} dismissible showCloseButton={false}>
            <div style={styles.modalHeader}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 16 }}>{editing ? 'To-Do 수정' : 'To-Do 추가'}</span>
                {readOnly && (
                  <Tag tone="neutral">
                    관련자 (읽기 전용)
                  </Tag>
                )}
              </div>
              <IconButton variant="text" icon="✕" label="닫기" onClick={closeModal} />
            </div>
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>

                {/* ── 왼쪽: 기본 정보 ── */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label style={styles.label}>
                    제목 <span style={{ color: 'var(--c-tag-err-t)' }}>*</span>
                    <Input
                      value={form.title}
                      onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Todo 제목"
                      autoFocus
                      disabled={readOnly}
                    />
                  </label>

                  <label style={styles.label}>
                    설명
                    <Textarea
                      style={{ height: 100, resize: 'vertical' }}
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
                      <Select
                        style={{ width: '100%' }}
                        value={filterKeyTaskId ?? ''}
                        onValueChange={v => {
                          setFilterKeyTaskId(v ? Number(v) : undefined)
                          setForm(f => ({ ...f, workUnitId: undefined }))
                        }}
                        disabled={readOnly}
                      >
                        <option value="">전체</option>
                        {keyTasks.map(t => <option key={t.id} value={t.id}>{t.taskName}</option>)}
                      </Select>
                    </label>
                    <label style={styles.label}>
                      단위업무
                      <Select
                        style={{ width: '100%' }}
                        value={form.workUnitId ?? ''}
                        onValueChange={v => {
                          const wuId = v ? Number(v) : undefined
                          const wu = allWorkUnits.find(w => w.id === wuId)
                          if (wu && !filterKeyTaskId) setFilterKeyTaskId(wu.keyTaskId)
                          setForm(f => ({ ...f, workUnitId: wuId }))
                        }}
                        disabled={readOnly}
                      >
                        <option value="">선택 안 함</option>
                        {filteredWorkUnits.map(w => <option key={w.id} value={w.id}>{w.title}</option>)}
                      </Select>
                    </label>
                  </div>

                  {/* 상태 · 우선순위 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <label style={styles.label}>
                      상태
                      <Select style={{ width: '100%' }} value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as TodoStatus }))} disabled={readOnly}>
                        {COLUMNS.map(c => <option key={c.status} value={c.status}>{c.label}</option>)}
                      </Select>
                    </label>
                    <label style={styles.label}>
                      우선순위
                      <Select style={{ width: '100%' }} value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v as TodoPriority }))} disabled={readOnly}>
                        <option value="HIGH">상</option>
                        <option value="MEDIUM">중</option>
                        <option value="LOW">하</option>
                      </Select>
                    </label>
                  </div>

                  {/* 담당자 · 요청유형 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    {isManager && (
                      <label style={styles.label}>
                        담당자
                        <Select
                          style={{ width: '100%' }}
                          value={form.assignee ?? ''}
                          onValueChange={v => setForm(f => ({ ...f, assignee: v || undefined }))}
                        >
                          <option value="">본인</option>
                          {users.filter(u => u.active).map(u => (
                            <option key={u.username} value={u.username}>
                              {u.name ?? u.username}{u.dept ? ` (${u.dept})` : ''}
                            </option>
                          ))}
                        </Select>
                      </label>
                    )}
                    <label style={styles.label}>
                      요청유형
                      <Select style={{ width: '100%' }} value={form.sourceType} onValueChange={v => setForm(f => ({ ...f, sourceType: v as TodoSourceType }))} disabled={readOnly}>
                        {(Object.entries(SOURCE_LABELS) as [TodoSourceType, string][]).map(([k, v]) => (
                          <option key={k} value={k}>{v}</option>
                        ))}
                      </Select>
                    </label>
                  </div>

                  {/* 시작일 · 목표일 · 완료일 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                    <label style={styles.label}>
                      <span>시작일 <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 400 }}>(실제)</span></span>
                      <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} disabled={readOnly} />
                    </label>
                    <label style={styles.label}>
                      목표일
                      <Input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} disabled={readOnly} />
                    </label>
                    <label style={styles.label}>
                      <span>완료일 <span style={{ fontSize: 11, color: 'var(--c-text-muted)', fontWeight: 400 }}>(실제)</span></span>
                      <Input type="date" value={form.completedDate} onChange={e => setForm(f => ({ ...f, completedDate: e.target.value }))} disabled={readOnly} />
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
                        <Checkbox checked={item.done}
                          onCheckedChange={() => setForm(f => {
                            const items = [...(f.checkItems ?? [])]
                            items[i] = { ...items[i], done: !items[i].done }
                            return { ...f, checkItems: items }
                          })}
                          disabled={readOnly}
                          style={{ flexShrink: 0 }}
                        />
                        <Input
                          style={{ textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--c-text-muted)' : undefined }}
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
                        <Input
                          style={{ width: 80, flexShrink: 0 }}
                          value={link.label}
                          onChange={e => setForm(f => {
                            const links = [...(f.links ?? [])]
                            links[i] = { ...links[i], label: e.target.value }
                            return { ...f, links }
                          })}
                          placeholder="이름"
                          disabled={readOnly}
                        />
                        <Input
                          style={{ flex: 1 }}
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

                  {/* 업무 로그 */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <span style={{ ...styles.label, flexDirection: 'row', gap: 6 }}>
                        업무 로그
                        {(form.workLogs?.length ?? 0) > 0 && (
                          <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{form.workLogs!.length}건</span>
                        )}
                      </span>
                      {!readOnly && (
                        <Button variant="text" size="sm" type="button"
                          onClick={() => {
                            const today = new Date().toISOString().slice(0, 10)
                            setForm(f => ({ ...f, workLogs: [{ date: today, content: '' }, ...(f.workLogs ?? [])] }))
                          }}>
                          + 오늘 기록
                        </Button>
                      )}
                    </div>
                    {(form.workLogs ?? []).length === 0 && (
                      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', padding: '6px 0' }}>진행 내용을 기록하세요</div>
                    )}
                    {(form.workLogs ?? []).map((log, i) => (
                      <div key={i} style={{ marginBottom: 8, background: 'var(--c-thead)', borderRadius: 6, padding: '8px 10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-sub)' }}>{log.date}</span>
                          {!readOnly && (
                            <IconButton variant="text" size="sm" icon="✕" label="제거"
                              onClick={() => setForm(f => ({ ...f, workLogs: (f.workLogs ?? []).filter((_, idx) => idx !== i) }))} />
                          )}
                        </div>
                        <Textarea
                          style={{ height: 60, resize: 'vertical' }}
                          value={log.content}
                          onChange={e => setForm(f => {
                            const logs = [...(f.workLogs ?? [])]
                            logs[i] = { ...logs[i], content: e.target.value }
                            return { ...f, workLogs: logs }
                          })}
                          placeholder="오늘 진행한 내용"
                          disabled={readOnly}
                        />
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
                            <Button
                              key={u.username}
                              type="button"
                              size="xs"
                              variant={selected ? 'filled' : 'outlined'}
                              onClick={() => setForm(f => {
                                const cols = f.collaborators ?? []
                                return { ...f, collaborators: selected ? cols.filter(c => c !== u.username) : [...cols, u.username] }
                              })}
                            >
                              {u.name ?? u.username}
                            </Button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 이미지 URL */}
                  <label style={styles.label}>
                    이미지 URL
                    <Input
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
                  <Button type="button" variant="outlined"
                    style={{ color: 'var(--c-tag-err-t)', borderColor: 'var(--c-tag-err-t)' }}
                    onClick={() => { if (confirm(`"${editing.title}" 삭제할까요?`)) { deleteMut.mutate(editing.id); closeModal() } }}>
                    삭제
                  </Button>
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
        </Modal>
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
    <Panel
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onDetail}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'block',
        padding: '10px 12px',
        cursor: 'pointer',
        opacity: faded ? 0.45 : 1,
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.12)' : undefined,
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
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 3 }}>
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
          <Tag tone="danger">
            지연
          </Tag>
        )}
        {typeBadge && (
          <Tag color={typeBadge.color} bg={typeBadge.bg}>
            {typeBadge.label}
          </Tag>
        )}
        {todo.priority && (
          <Tag tone={todo.priority === 'HIGH' ? 'danger' : 'neutral'}>
            {PRIORITY_LABEL[todo.priority]}
          </Tag>
        )}
        {todo.sourceType && todo.sourceType !== 'SELF' && (
          <Tag tone="info">
            {SOURCE_LABELS[todo.sourceType]}
          </Tag>
        )}
        {(todo.workLogs?.length ?? 0) > 0 && (
          <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>📝 {todo.workLogs!.length}</span>
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
    </Panel>
  )
}


const styles: Record<string, React.CSSProperties> = {
  addBtn: {
    background: 'var(--c-action)', color: 'var(--rsp-color-text-on-primary)', border: 'none',
    padding: '8px 16px', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  colHeader: {
    padding: '10px 12px', borderRadius: '6px 6px 0 0',
    background: 'var(--c-thead)', borderLeft: '1px solid var(--c-border)',
    borderRight: '1px solid var(--c-border)',
  },
  iconBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    fontSize: 12, padding: '2px 3px', opacity: 0.5, lineHeight: 1,
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
  cancelBtn: {
    padding: '8px 16px', borderRadius: 6, border: '1px solid var(--c-border)',
    background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--c-text-muted)',
  },
  submitBtn: {
    padding: '8px 20px', borderRadius: 6, border: 'none',
    background: 'var(--c-action)', color: 'var(--rsp-color-text-on-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600,
  },
  deleteBtn: {
    padding: '8px 14px', borderRadius: 6, border: '1px solid var(--c-tag-err-t)',
    background: 'transparent', cursor: 'pointer', fontSize: 13, color: 'var(--c-tag-err-t)',
  },
}
