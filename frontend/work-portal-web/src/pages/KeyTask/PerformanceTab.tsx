import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { todoApi, type Todo } from '../../api/todos'
import { workUnitApi, type WorkUnit } from '../../api/workUnits'
import { getUsers, type UserSummary } from '../../api/users'
import { type KeyTask } from '../../api/keyTasks'

const STATUS_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  DONE:        { bg: 'var(--c-tag-done-bg)',  text: 'var(--c-tag-done-t)',  label: '완료' },
  IN_PROGRESS: { bg: 'var(--c-tag-sys)',       text: 'var(--c-tag-sys-t)',   label: '진행중' },
  REVIEW:      { bg: '#FEFCBF',               text: '#975A16',              label: '검토' },
  TODO:        { bg: 'var(--c-tag-draft-bg)', text: 'var(--c-tag-draft-t)', label: '대기' },
  HOLD:        { bg: 'var(--c-tag-err-bg)',   text: 'var(--c-tag-err-t)',   label: '보류' },
}
const STATUS_ORDER = ['DONE', 'IN_PROGRESS', 'REVIEW', 'TODO', 'HOLD'] as const

type LinkedTodo = Todo & { workUnitId: number }

export default function PerformanceTab({ keyTasks }: { keyTasks: KeyTask[] }) {
  const { data: todos = [] } = useQuery({ queryKey: ['todos'], queryFn: todoApi.list })
  const { data: allWorkUnits = [] } = useQuery({ queryKey: ['work-units-all'], queryFn: workUnitApi.listAll })
  const { data: users = [] } = useQuery<UserSummary[]>({ queryKey: ['users'], queryFn: getUsers })
  const [selAssignee, setSelAssignee] = useState<string>('all')

  const ktMap = new Map(keyTasks.map(k => [k.id, k]))
  const wuMap = new Map<number, WorkUnit>(allWorkUnits.map(w => [w.id, w]))
  const nameOf = (u: string) => users.find(x => x.username === u)?.name ?? u

  // 현재 연도 중점과제에 속한 단위업무의 Todo만 대상
  const ktIds = new Set(keyTasks.map(k => k.id))
  const relevantWuIds = new Set(allWorkUnits.filter(w => ktIds.has(w.keyTaskId)).map(w => w.id))
  const yearTodos = todos.filter((t): t is LinkedTodo =>
    t.workUnitId != null && relevantWuIds.has(t.workUnitId)
  )

  const assignees = [...new Set(yearTodos.map(t => t.assignee))].sort()
  const targetTodos = selAssignee === 'all' ? yearTodos : yearTodos.filter(t => t.assignee === selAssignee)

  // assignee → keyTaskId → workUnitId → todos[]
  const grouped = new Map<string, Map<number, Map<number, LinkedTodo[]>>>()
  for (const todo of targetTodos) {
    const wu = wuMap.get(todo.workUnitId)
    if (!wu) continue
    if (!grouped.has(todo.assignee)) grouped.set(todo.assignee, new Map())
    const byKt = grouped.get(todo.assignee)!
    if (!byKt.has(wu.keyTaskId)) byKt.set(wu.keyTaskId, new Map())
    const byWu = byKt.get(wu.keyTaskId)!
    if (!byWu.has(todo.workUnitId)) byWu.set(todo.workUnitId, [])
    byWu.get(todo.workUnitId)!.push(todo)
  }

  const displayAssignees = selAssignee === 'all'
    ? [...grouped.keys()]
    : grouped.has(selAssignee) ? [selAssignee] : []

  return (
    <div>
      {/* 담당자 필터 */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        <button style={chip(selAssignee === 'all')} onClick={() => setSelAssignee('all')}>전체</button>
        {assignees.map(a => (
          <button key={a} style={chip(selAssignee === a)} onClick={() => setSelAssignee(a)}>
            {nameOf(a)}
          </button>
        ))}
      </div>

      {displayAssignees.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--c-text-muted)', fontSize: 14 }}>
          이 연도에 연결된 Todo가 없습니다.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {displayAssignees.map(assignee => {
          const byKt = grouped.get(assignee)!
          const allPersonTodos = [...byKt.values()].flatMap(m => [...m.values()].flat())
          const personDone = allPersonTodos.filter(t => t.status === 'DONE').length
          const personTotal = allPersonTodos.length
          const personRate = personTotal > 0 ? Math.round(personDone / personTotal * 100) : 0

          return (
            <div key={assignee} style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
              {/* 담당자 헤더 */}
              <div style={{ padding: '12px 18px', background: 'var(--c-thead)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: 15 }}>{nameOf(assignee)}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: 'var(--c-text-muted)' }}>
                  <span>중점과제 {byKt.size}개</span>
                  <span>Todo {personTotal}개</span>
                  <span style={{ fontWeight: 600, color: personRate >= 80 ? 'var(--c-tag-done-t)' : 'var(--c-text-sub)' }}>
                    완료율 {personRate}%
                  </span>
                </div>
              </div>

              {/* 중점과제별 */}
              {[...byKt.entries()].map(([ktId, byWu]) => {
                const kt = ktMap.get(ktId)
                const ktTodos = [...byWu.values()].flat()
                const ktDone = ktTodos.filter(t => t.status === 'DONE').length
                const ktTotal = ktTodos.length
                const ktRate = ktTotal > 0 ? Math.round(ktDone / ktTotal * 100) : 0

                return (
                  <div key={ktId} style={{ borderTop: '1px solid var(--c-border)' }}>
                    {/* 중점과제 행 */}
                    <div style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--c-bg)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, flex: 1, color: 'var(--c-text)' }}>
                        {kt?.taskName ?? `과제 #${ktId}`}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ width: 100, height: 6, background: 'var(--c-border)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${ktRate}%`, height: '100%', background: '#38a169', borderRadius: 3, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 12, color: 'var(--c-text-muted)', whiteSpace: 'nowrap' }}>
                          {ktDone}/{ktTotal} ({ktRate}%)
                        </span>
                      </div>
                    </div>

                    {/* 단위업무 행 */}
                    {[...byWu.entries()].map(([wuId, wuTodos]) => {
                      const wu = wuMap.get(wuId)
                      const counts = wuTodos.reduce((acc, t) => {
                        acc[t.status] = (acc[t.status] ?? 0) + 1
                        return acc
                      }, {} as Record<string, number>)

                      return (
                        <div key={wuId} style={{ padding: '7px 18px 7px 36px', borderTop: '1px solid var(--c-border-in)', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ fontSize: 12, color: 'var(--c-text-sub)', flex: 1 }}>
                            └ {wu?.title ?? `단위업무 #${wuId}`}
                          </span>
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {STATUS_ORDER.map(st => {
                              const cnt = counts[st] ?? 0
                              if (!cnt) return null
                              const b = STATUS_BADGE[st]
                              return (
                                <span key={st} style={{ fontSize: 11, padding: '2px 7px', borderRadius: 10, background: b.bg, color: b.text, fontWeight: 600 }}>
                                  {b.label} {cnt}
                                </span>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function chip(active: boolean): React.CSSProperties {
  return {
    padding: '5px 14px', borderRadius: 20, cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
    border: `1px solid ${active ? '#1a1a2e' : 'var(--c-border-in)'}`,
    background: active ? '#1a1a2e' : 'transparent',
    color: active ? '#fff' : 'var(--c-text-muted)',
  }
}
