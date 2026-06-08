import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  getDeployRequests, createDeployRequest, updateDeployRequest,
  deployRequestStatus, deleteDeployRequest,
  type DeployRequest, type RequestStatus, type DeployType, type CreateDeployRequest, type RedmineIssueRef,
} from '../../api/deployRequests'
import { getActiveSystems, getActiveSubSystems } from '../../api/systems'
import { searchRedmineIssues, type RedmineIssue } from '../../api/redmine'
import { useAuth } from '../../context/useAuth'
import StatusBadge from '../../components/StatusBadge'
import PageHeader from '../../components/PageHeader'

const DEPLOY_TYPE_LABELS: Record<DeployType, string> = {
  RELEASE: '릴리즈', HOTFIX: '핫픽스', ROLLBACK: '롤백', PATCH: '패치',
}

const STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: '임시저장', REQUESTED: '요청', APPROVED: '승인', COMPLETED: '완료', REJECTED: '반려',
}

const NEXT_STATUS: Partial<Record<RequestStatus, { label: string; next: RequestStatus; confirm?: string }[]>> = {
  DRAFT:     [{ label: '제출', next: 'REQUESTED' }],
  REQUESTED: [
    { label: '승인', next: 'APPROVED', confirm: '승인하시겠습니까?' },
    { label: '반려', next: 'REJECTED', confirm: '반려하시겠습니까?' },
  ],
  APPROVED:  [{ label: '완료', next: 'COMPLETED', confirm: '배포 완료로 처리하시겠습니까?' }],
}

const STATUS_FILTERS: { label: string; value: RequestStatus | 'ALL' }[] = [
  { label: '전체', value: 'ALL' },
  { label: '임시저장', value: 'DRAFT' },
  { label: '요청', value: 'REQUESTED' },
  { label: '승인', value: 'APPROVED' },
  { label: '완료', value: 'COMPLETED' },
  { label: '반려', value: 'REJECTED' },
]

const emptyForm: CreateDeployRequest = { systemId: 0, subSystemId: null, title: '', version: '', deployType: 'RELEASE', content: '' }

function apiError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return e.response.data.error
  return e instanceof Error ? e.message : String(e)
}

export default function DeployRequestPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<DeployRequest | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<DeployRequest | null>(null)
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'ALL'>('ALL')
  const [form, setForm] = useState<CreateDeployRequest>(emptyForm)
  const [selectedIssues, setSelectedIssues] = useState<RedmineIssueRef[]>([])
  const [issueQuery, setIssueQuery] = useState('')
  const [issueResults, setIssueResults] = useState<RedmineIssue[]>([])
  const [issueDropOpen, setIssueDropOpen] = useState(false)
  const [issueSearching, setIssueSearching] = useState(false)
  const [issueError, setIssueError] = useState<string | null>(null)
  const issueTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const issueBoxRef = useRef<HTMLDivElement>(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['deploy-requests'],
    queryFn: () => getDeployRequests(),
  })
  const { data: systems = [] } = useQuery({ queryKey: ['systems', 'active'], queryFn: getActiveSystems })
  const selectedSystem = systems.find(s => s.id === form.systemId)

  const { data: subSystems = [] } = useQuery({
    queryKey: ['subsystems', 'active', form.systemId],
    queryFn: () => getActiveSubSystems(form.systemId),
    enabled: showForm && form.systemId > 0,
  })

  useEffect(() => {
    if (!showForm) return
    const handleClick = (e: MouseEvent) => {
      if (issueBoxRef.current && !issueBoxRef.current.contains(e.target as Node)) {
        setIssueDropOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showForm])

  const handleIssueSearch = (q: string) => {
    setIssueQuery(q)
    if (!selectedSystem?.redmineProjectKey) return
    if (issueTimer.current) clearTimeout(issueTimer.current)
    if (!q.trim()) { setIssueResults([]); setIssueDropOpen(false); setIssueError(null); return }
    setIssueSearching(true)
    setIssueError(null)
    issueTimer.current = setTimeout(async () => {
      try {
        const results = await searchRedmineIssues(form.systemId, q)
        setIssueResults(results)
        setIssueDropOpen(true)
      } catch (e: any) {
        const msg = typeof e?.response?.data?.error === 'string'
          ? e.response.data.error
          : typeof e?.message === 'string'
          ? e.message
          : '검색 오류'
        setIssueError(msg)
        setIssueResults([])
        setIssueDropOpen(true)
      } finally { setIssueSearching(false) }
    }, 400)
  }

  const selectIssue = (issue: RedmineIssue) => {
    if (!selectedIssues.some(i => i.redmineIssueId === issue.id)) {
      setSelectedIssues(prev => [...prev, { redmineIssueId: issue.id, redmineIssueTitle: issue.subject }])
    }
    setIssueQuery('')
    setIssueDropOpen(false)
    setIssueResults([])
  }

  const removeIssue = (issueId: number) => {
    setSelectedIssues(prev => prev.filter(i => i.redmineIssueId !== issueId))
  }

  const invalidate = () => qc.invalidateQueries({ queryKey: ['deploy-requests'] })

  const createMut = useMutation({
    mutationFn: createDeployRequest,
    onSuccess: () => { invalidate(); closeForm() },
    onError: (e) => alert('저장 실패: ' + apiError(e)),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateDeployRequest }) => updateDeployRequest(id, data),
    onSuccess: () => { invalidate(); closeForm() },
    onError: (e) => alert('수정 실패: ' + apiError(e)),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status }: { id: number; status: RequestStatus }) => deployRequestStatus(id, status),
    onSuccess: () => { invalidate(); setDetail(null) },
    onError: (e) => alert('상태 변경 실패: ' + apiError(e)),
  })
  const deleteMut = useMutation({
    mutationFn: deleteDeployRequest,
    onSuccess: () => { invalidate(); setDetail(null) },
    onError: (e) => alert('삭제 실패: ' + apiError(e)),
  })

  const resetIssueSearch = () => { setIssueQuery(''); setIssueResults([]); setIssueDropOpen(false); setIssueError(null) }

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, systemId: systems[0]?.id ?? 0, subSystemId: null })
    setSelectedIssues([])
    resetIssueSearch()
    setShowForm(true)
    setDetail(null)
  }

  const openEdit = (r: DeployRequest) => {
    setEditing(r)
    setForm({ systemId: r.systemId, subSystemId: r.subSystemId, title: r.title, version: r.version ?? '', deployType: r.deployType ?? 'RELEASE', content: r.content ?? '', scheduledAt: r.scheduledAt ?? undefined })
    setSelectedIssues(r.redmineIssues ?? [])
    resetIssueSearch()
    setShowForm(true)
    setDetail(null)
  }

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); setSelectedIssues([]); resetIssueSearch() }

  const submit = () => {
    if (!form.title || !form.systemId) return
    const data: CreateDeployRequest = { ...form, redmineIssues: selectedIssues }
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  const handleStatus = (id: number, next: RequestStatus, confirmMsg?: string) => {
    if (confirmMsg && !confirm(confirmMsg)) return
    statusMut.mutate({ id, status: next })
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const filtered = statusFilter === 'ALL' ? requests : requests.filter(r => r.status === statusFilter)

  return (
    <div style={s.page}>
      <PageHeader
        title="배포 관리"
        action={<button style={s.btn} onClick={openCreate}>+ 새 배포 요청</button>}
      />

      {/* 등록/수정 폼 */}
      {showForm && (
        <div style={s.card}>
          <h3 style={s.formTitle}>{editing ? '배포 요청 수정' : '새 배포 요청'}</h3>
          <div style={s.formGrid}>
            <label style={s.label}>운영시스템 *</label>
            <select style={s.input} value={form.systemId} onChange={(e) => setForm({ ...form, systemId: Number(e.target.value), subSystemId: null })}>
              <option value={0}>선택</option>
              {systems.map((sys) => <option key={sys.id} value={sys.id}>{sys.name}</option>)}
            </select>
            {subSystems.length > 0 && (
              <>
                <label style={s.label}>하위시스템</label>
                <select style={s.input} value={form.subSystemId ?? 0} onChange={(e) => setForm({ ...form, subSystemId: Number(e.target.value) || null })}>
                  <option value={0}>없음</option>
                  {subSystems.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </select>
              </>
            )}
            <label style={s.label}>제목 *</label>
            <input style={s.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="배포 요청 제목" />
            <label style={s.label}>버전</label>
            <input style={s.input} value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="예: v1.2.3" />
            <label style={s.label}>배포 유형</label>
            <select style={s.input} value={form.deployType} onChange={(e) => setForm({ ...form, deployType: e.target.value as DeployType })}>
              {Object.entries(DEPLOY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <label style={s.label}>예정일시</label>
            <input style={s.input} type="datetime-local" value={form.scheduledAt?.slice(0, 16) ?? ''} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value ? e.target.value + ':00' : undefined })} />
            <label style={s.label}>레드마인 일감</label>
            <div ref={issueBoxRef} style={{ position: 'relative' }}>
              {selectedSystem?.redmineProjectKey ? (
                <>
                  {selectedIssues.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {selectedIssues.map(issue => (
                        <span key={issue.redmineIssueId} style={s.issueBadge}>
                          <span style={{ color: '#1976d2', fontWeight: 600 }}>#{issue.redmineIssueId}</span>
                          <span style={{ color: '#333', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.redmineIssueTitle}</span>
                          <button type="button" onClick={() => removeIssue(issue.redmineIssueId)} style={{ border: 'none', background: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13 }}>
                    <input
                      value={issueQuery}
                      onChange={e => handleIssueSearch(e.target.value)}
                      placeholder="일감 제목으로 검색 후 선택..."
                      style={{ flex: 1, border: 'none', outline: 'none', fontSize: 13, background: 'transparent' }}
                    />
                    {issueSearching && <span style={{ color: '#aaa', fontSize: 12 }}>검색 중...</span>}
                  </div>
                  {issueDropOpen && issueResults.length > 0 && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 6, boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, maxHeight: 220, overflowY: 'auto' }}>
                      {issueResults.map(issue => {
                        const already = selectedIssues.some(i => i.redmineIssueId === issue.id)
                        return (
                          <div key={issue.id} onClick={() => !already && selectIssue(issue)}
                            style={{ padding: '10px 12px', cursor: already ? 'default' : 'pointer', borderBottom: '1px solid #f0f0f0', fontSize: 13, opacity: already ? 0.5 : 1 }}
                            onMouseEnter={e => { if (!already) e.currentTarget.style.background = '#f5f7fa' }}
                            onMouseLeave={e => { if (!already) e.currentTarget.style.background = '' }}>
                            <span style={{ color: '#1976d2', fontWeight: 600, marginRight: 8 }}>#{issue.id}</span>
                            <span>{issue.subject}</span>
                            {issue.status && <span style={{ marginLeft: 8, fontSize: 11, color: '#888' }}>[{issue.status}]</span>}
                            {issue.assignedTo && <span style={{ marginLeft: 4, fontSize: 11, color: '#aaa' }}>· {issue.assignedTo}</span>}
                            {already && <span style={{ marginLeft: 8, fontSize: 11, color: '#38a169' }}>✓ 선택됨</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                  {issueDropOpen && issueResults.length === 0 && !issueSearching && issueQuery && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #ddd', borderRadius: 6, padding: '12px', fontSize: 13, zIndex: 100, color: issueError ? '#e53e3e' : '#aaa' }}>
                      {issueError ? `오류: ${issueError}` : '검색 결과가 없습니다'}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ padding: '8px 10px', border: '1px solid #eee', borderRadius: 6, fontSize: 12, color: '#bbb' }}>
                  시스템에 레드마인 프로젝트가 설정되지 않았습니다
                </div>
              )}
            </div>
            <label style={s.label}>내용</label>
            <textarea style={{ ...s.input, height: 100, resize: 'vertical' }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="배포 내용 및 변경사항을 입력하세요" />
          </div>
          <div style={s.formActions}>
            <button style={s.btnSecondary} onClick={closeForm}>취소</button>
            <button style={s.btn} onClick={submit}
              disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      )}

      {/* 상태 필터 탭 */}
      <div style={s.filterRow}>
        {STATUS_FILTERS.map(({ label, value }) => {
          const count = value === 'ALL' ? requests.length : requests.filter(r => r.status === value).length
          return (
            <button key={value} style={{ ...s.filterBtn, ...(statusFilter === value ? s.filterBtnActive : {}) }}
              onClick={() => setStatusFilter(value)}>
              {label} {count > 0 && <span style={s.badge}>{count}</span>}
            </button>
          )
        })}
      </div>

      {/* 목록 */}
      {isLoading ? (
        <p style={{ color: '#aaa', padding: 16 }}>로딩 중...</p>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>번호</th>
                <th style={s.th}>시스템</th>
                <th style={{ ...s.th, width: '22%' }}>제목</th>
                <th style={s.th}>버전</th>
                <th style={s.th}>유형</th>
                <th style={s.th}>요청자</th>
                <th style={s.th}>승인자</th>
                <th style={s.th}>상태</th>
                <th style={s.th}>예정일</th>
                <th style={s.th}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={s.empty}>등록된 배포 요청이 없습니다</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} style={{ ...s.tr, cursor: 'pointer', background: detail?.id === r.id ? '#f0f4ff' : undefined }}
                  onClick={() => setDetail(detail?.id === r.id ? null : r)}>
                  <td style={s.td}>{r.id}</td>
                  <td style={s.td}>
                    <span style={s.sysTag}>{r.systemCode}</span>
                    {r.subSystemName && <span style={{ ...s.sysTag, background: '#F0FFF4', color: '#276749', marginLeft: 4 }}>{r.subSystemName}</span>}
                  </td>
                  <td style={s.td}>
                    {r.title}
                    {r.redmineIssues?.length > 0 && (
                      <span>
                        {r.redmineIssues.map(i => (
                          <a key={i.redmineIssueId}
                            href={`http://54.180.246.95:3000/issues/${i.redmineIssueId}`}
                            target="_blank" rel="noreferrer"
                            onClick={e => e.stopPropagation()}
                            style={{ marginLeft: 4, fontSize: 11, color: '#1976d2', textDecoration: 'none', background: '#EBF8FF', padding: '1px 6px', borderRadius: 3 }}>
                            #{i.redmineIssueId}
                          </a>
                        ))}
                      </span>
                    )}
                  </td>
                  <td style={s.td}>{r.version ?? '-'}</td>
                  <td style={s.td}>{r.deployType ? DEPLOY_TYPE_LABELS[r.deployType] : '-'}</td>
                  <td style={s.td}>{r.requesterUsername}</td>
                  <td style={s.td}>{r.approverUsername ?? '-'}</td>
                  <td style={s.td}><StatusBadge status={r.status} /></td>
                  <td style={s.td}>{r.scheduledAt?.slice(0, 16).replace('T', ' ') ?? '-'}</td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    <div style={s.actions}>
                      {r.status === 'DRAFT' && (
                        <button style={s.btnSm} onClick={() => openEdit(r)}>수정</button>
                      )}
                      {NEXT_STATUS[r.status]?.map(({ label, next, confirm: msg }) => (
                        (isAdmin || next === 'REQUESTED') && (
                          <button key={next} style={{ ...s.btnSm, ...actionStyle(next) }}
                            onClick={() => handleStatus(r.id, next, msg)}>
                            {label}
                          </button>
                        )
                      ))}
                      {r.status === 'DRAFT' && (
                        <button style={{ ...s.btnSm, color: '#e53e3e' }}
                          onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(r.id) }}>
                          삭제
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* 상세 패널 */}
      {detail && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <span style={s.sysTag}>{detail.systemCode}</span>
              {detail.subSystemName && <span style={{ ...s.sysTag, background: '#F0FFF4', color: '#276749', marginLeft: 4 }}>{detail.subSystemName}</span>}
              <span style={{ marginLeft: 8, fontWeight: 600, fontSize: 15 }}>{detail.title}</span>
            </div>
            <button style={{ ...s.btnSecondary, fontSize: 12, padding: '4px 10px' }} onClick={() => setDetail(null)}>닫기</button>
          </div>
          <div style={s.detailGrid}>
            <span style={s.detailLabel}>레드마인</span>
            <span style={{ gridColumn: 'span 3' }}>
              {detail.redmineIssues?.length > 0 ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {detail.redmineIssues.map(i => (
                    <a key={i.redmineIssueId}
                      href={`http://54.180.246.95:3000/issues/${i.redmineIssueId}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: '#1976d2', textDecoration: 'none', fontSize: 12, background: '#EBF8FF', padding: '2px 8px', borderRadius: 4 }}>
                      #{i.redmineIssueId} {i.redmineIssueTitle}
                    </a>
                  ))}
                </div>
              ) : '-'}
            </span>
            <span style={s.detailLabel}>버전</span><span>{detail.version ?? '-'}</span>
            <span style={s.detailLabel}>배포 유형</span><span>{detail.deployType ? DEPLOY_TYPE_LABELS[detail.deployType] : '-'}</span>
            <span style={s.detailLabel}>상태</span><span>{STATUS_LABELS[detail.status]}</span>
            <span style={s.detailLabel}>요청자</span><span>{detail.requesterUsername}</span>
            <span style={s.detailLabel}>승인자</span><span>{detail.approverUsername ?? '-'}</span>
            <span style={s.detailLabel}>예정일시</span><span>{detail.scheduledAt?.slice(0, 16).replace('T', ' ') ?? '-'}</span>
            <span style={s.detailLabel}>제출일시</span><span>{detail.requestedAt?.slice(0, 16).replace('T', ' ') ?? '-'}</span>
            <span style={s.detailLabel}>승인일시</span><span>{detail.approvedAt?.slice(0, 16).replace('T', ' ') ?? '-'}</span>
            <span style={s.detailLabel}>배포완료</span><span>{detail.deployedAt?.slice(0, 16).replace('T', ' ') ?? '-'}</span>
            <span style={s.detailLabel}>등록일</span><span>{detail.createdAt?.slice(0, 10)}</span>
          </div>
          {detail.content && (
            <div style={{ marginTop: 16 }}>
              <div style={s.detailLabel}>내용</div>
              <pre style={s.contentBox}>{detail.content}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function actionStyle(status: RequestStatus): React.CSSProperties {
  if (status === 'APPROVED') return { color: '#276749', borderColor: '#276749' }
  if (status === 'REJECTED') return { color: '#9B2C2C', borderColor: '#9B2C2C' }
  if (status === 'COMPLETED') return { color: '#285E61', borderColor: '#285E61' }
  return {}
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 40px' },
  btn: { padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSecondary: { padding: '8px 16px', background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  card: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 24, marginBottom: 16 },
  formTitle: { fontSize: 15, fontWeight: 600, marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'start', marginBottom: 16 },
  formActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  label: { fontSize: 13, fontWeight: 500, color: '#555', paddingTop: 8 },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' as const },
  issueBadge: { display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4', border: '1px solid #c6f6d5', borderRadius: 4, padding: '3px 8px', fontSize: 12 },
  filterRow: { display: 'flex', gap: 6, marginBottom: 12 },
  filterBtn: { padding: '5px 12px', background: '#fff', border: '1px solid #ddd', borderRadius: 20, cursor: 'pointer', fontSize: 12, color: '#555', display: 'flex', alignItems: 'center', gap: 4 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', borderColor: '#1a1a2e' },
  badge: { background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '0 5px', fontSize: 11 },
  tableWrap: { background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  thead: { background: '#f7f8fa' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 14px', fontSize: 13 },
  sysTag: { background: '#EBF8FF', color: '#2B6CB0', padding: '2px 8px', borderRadius: 4, fontSize: 12 },
  actions: { display: 'flex', alignItems: 'center' },
  empty: { padding: '32px', textAlign: 'center' as const, color: '#aaa', fontSize: 13 },
  detailGrid: { display: 'grid', gridTemplateColumns: '80px 1fr 80px 1fr', gap: '10px 16px', fontSize: 13 },
  detailLabel: { color: '#888', fontSize: 12, fontWeight: 500 },
  contentBox: { background: '#f7f8fa', border: '1px solid #e2e8f0', borderRadius: 6, padding: '12px 16px', fontSize: 13, whiteSpace: 'pre-wrap' as const, marginTop: 8, fontFamily: 'inherit' },
}
