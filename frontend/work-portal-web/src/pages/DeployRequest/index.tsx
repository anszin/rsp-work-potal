import { useState, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  getDeployRequests, createDeployRequest, updateDeployRequest,
  deployRequestStatus, deleteDeployRequest, syncRedmine,
  type DeployRequest, type RequestStatus, type DeployType, type CreateDeployRequest, type RedmineIssueRef,
} from '../../api/deployRequests'
import { getActiveSystems, getActiveSubSystems } from '../../api/systems'
import { fetchRedmineIssues, type RedmineIssue } from '../../api/redmine'
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
  APPROVED: [{ label: '완료', next: 'COMPLETED', confirm: '배포 완료로 처리하시겠습니까?' }],
}
const STATUS_FILTERS: { label: string; value: RequestStatus | 'ALL' }[] = [
  { label: '전체', value: 'ALL' },
  { label: '임시저장', value: 'DRAFT' },
  { label: '요청', value: 'REQUESTED' },
  { label: '승인', value: 'APPROVED' },
  { label: '완료', value: 'COMPLETED' },
  { label: '반려', value: 'REJECTED' },
]
const PICKER_STATUS_TABS = [
  { label: '진행중', value: 'open' },
  { label: '완료', value: 'closed' },
  { label: '전체', value: '*' },
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

  // 일감 선택 모달
  const [showPicker, setShowPicker] = useState(false)
  const [pickerStatus, setPickerStatus] = useState('open')
  const [pickerInput, setPickerInput] = useState('')
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerDraft, setPickerDraft] = useState<RedmineIssueRef[]>([])
  const [pickerIssues, setPickerIssues] = useState<RedmineIssue[]>([])
  const [pickerTotal, setPickerTotal] = useState(0)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerFetchError, setPickerFetchError] = useState<string | null>(null)
  const pickerTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  const loadPickerIssues = useCallback(async (query: string, status: string, offset: number, append: boolean) => {
    if (!form.systemId) return
    setPickerLoading(true)
    setPickerFetchError(null)
    try {
      const result = await fetchRedmineIssues(form.systemId, query, status, offset)
      setPickerIssues(prev => append ? [...prev, ...result.issues] : result.issues)
      setPickerTotal(result.totalCount)
    } catch (e) {
      setPickerFetchError(e instanceof Error ? e.message : '조회 실패')
    } finally {
      setPickerLoading(false)
    }
  }, [form.systemId])

  useEffect(() => {
    if (showPicker && selectedSystem?.redmineProjectKey) {
      loadPickerIssues(pickerQuery, pickerStatus, 0, false)
    }
  }, [showPicker, pickerQuery, pickerStatus, loadPickerIssues, selectedSystem?.redmineProjectKey])

  const handlePickerInput = (val: string) => {
    setPickerInput(val)
    if (pickerTimer.current) clearTimeout(pickerTimer.current)
    pickerTimer.current = setTimeout(() => setPickerQuery(val), 400)
  }

  const loadMore = () => {
    loadPickerIssues(pickerQuery, pickerStatus, pickerIssues.length, true)
  }

  const togglePickerIssue = (issue: RedmineIssue) => {
    setPickerDraft(prev =>
      prev.some(i => i.redmineIssueId === issue.id)
        ? prev.filter(i => i.redmineIssueId !== issue.id)
        : [...prev, { redmineIssueId: issue.id, redmineIssueTitle: issue.subject }]
    )
  }

  const openPicker = () => {
    setPickerDraft([...selectedIssues])
    setPickerStatus('open')
    setPickerInput('')
    setPickerQuery('')
    setPickerIssues([])
    setPickerTotal(0)
    setPickerFetchError(null)
    setShowPicker(true)
  }

  const confirmPicker = () => {
    setSelectedIssues(pickerDraft)
    setShowPicker(false)
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
  const syncMut = useMutation({
    mutationFn: syncRedmine,
    onSuccess: (updated) => { invalidate(); setDetail(updated) },
    onError: (e) => alert('재동기화 실패: ' + apiError(e)),
  })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, systemId: systems[0]?.id ?? 0, subSystemId: null })
    setSelectedIssues([])
    setShowForm(true)
    setDetail(null)
  }

  const openEdit = (r: DeployRequest) => {
    setEditing(r)
    setForm({ systemId: r.systemId, subSystemId: r.subSystemId, title: r.title, version: r.version ?? '', deployType: r.deployType ?? 'RELEASE', content: r.content ?? '', scheduledAt: r.scheduledAt ?? undefined })
    setSelectedIssues(r.redmineIssues ?? [])
    setShowForm(true)
    setDetail(null)
  }

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); setSelectedIssues([]) }

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
            <div>
              {selectedSystem?.redmineProjectKey ? (
                <>
                  {selectedIssues.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {selectedIssues.map(issue => (
                        <span key={issue.redmineIssueId} style={s.issueBadge}>
                          <span style={{ color: '#1976d2', fontWeight: 600 }}>#{issue.redmineIssueId}</span>
                          <span style={{ color: '#333', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.redmineIssueTitle}</span>
                          <button type="button" onClick={() => setSelectedIssues(prev => prev.filter(i => i.redmineIssueId !== issue.redmineIssueId))}
                            style={{ border: 'none', background: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>✕</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <button type="button" onClick={openPicker} style={s.btnOutline}>
                    + 일감 선택
                  </button>
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
            <button style={s.btn} onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
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
                    <span style={s.sysTag}>{r.systemName}</span>
                    {r.subSystemName && <span style={{ ...s.sysTag, background: '#F0FFF4', color: '#276749', marginLeft: 4 }}>{r.subSystemName}</span>}
                  </td>
                  <td style={s.td}>{r.title}</td>
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
              <span style={s.sysTag}>{detail.systemName}</span>
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
            {detail.redmineSyncStatus && (
              <>
                <span style={s.detailLabel}>Redmine</span>
                <span style={{ gridColumn: 'span 3', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {detail.redmineSyncStatus === 'SYNCED' && (
                    <span style={{ fontSize: 12, color: '#276749', background: '#F0FFF4', border: '1px solid #C6F6D5', padding: '2px 8px', borderRadius: 4 }}>동기화 완료</span>
                  )}
                  {detail.redmineSyncStatus === 'FAILED' && (
                    <>
                      <span style={{ fontSize: 12, color: '#9B2C2C', background: '#FFF5F5', border: '1px solid #FED7D7', padding: '2px 8px', borderRadius: 4 }}>동기화 실패</span>
                      <button style={{ ...s.btnSm, color: '#C05621', borderColor: '#C05621', marginRight: 0 }}
                        onClick={() => syncMut.mutate(detail.id)}
                        disabled={syncMut.isPending}>
                        {syncMut.isPending ? '재시도 중...' : '재시도'}
                      </button>
                    </>
                  )}
                  {detail.redmineSyncStatus === 'SKIPPED' && (
                    <span style={{ fontSize: 12, color: '#888' }}>미설정 (프로젝트키 또는 버전 없음)</span>
                  )}
                </span>
              </>
            )}
          </div>
          {detail.content && (
            <div style={{ marginTop: 16 }}>
              <div style={s.detailLabel}>내용</div>
              <pre style={s.contentBox}>{detail.content}</pre>
            </div>
          )}
        </div>
      )}

      {/* 일감 선택 모달 */}
      {showPicker && (
        <div style={s.overlay} onClick={() => setShowPicker(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalHeader}>
              <span style={{ fontWeight: 600, fontSize: 15 }}>레드마인 일감 선택</span>
              <button onClick={() => setShowPicker(false)} style={s.modalClose}>✕</button>
            </div>
            <div style={s.modalFilter}>
              <div style={{ display: 'flex', gap: 4 }}>
                {PICKER_STATUS_TABS.map(tab => (
                  <button key={tab.value}
                    style={{ ...s.tabBtn, ...(pickerStatus === tab.value ? s.tabBtnActive : {}) }}
                    onClick={() => setPickerStatus(tab.value)}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <input
                value={pickerInput}
                onChange={e => handlePickerInput(e.target.value)}
                placeholder="제목으로 검색..."
                style={{ ...s.input, flex: 1, margin: 0 }}
              />
            </div>
            <div style={s.modalBody}>
              {pickerIssues.length === 0 && pickerLoading ? (
                <div style={s.modalEmpty}>불러오는 중...</div>
              ) : pickerFetchError ? (
                <div style={{ ...s.modalEmpty, color: '#e53e3e' }}>오류: {pickerFetchError}</div>
              ) : pickerIssues.length === 0 ? (
                <div style={s.modalEmpty}>일감이 없습니다</div>
              ) : (
                <>
                  <div style={{ padding: '6px 20px', fontSize: 12, color: '#888', background: '#fafafa', borderBottom: '1px solid #f0f0f0' }}>
                    전체 {pickerTotal}개 중 {pickerIssues.length}개 표시
                  </div>
                  {pickerIssues.map(issue => {
                    const checked = pickerDraft.some(i => i.redmineIssueId === issue.id)
                    return (
                      <div key={issue.id} onClick={() => togglePickerIssue(issue)}
                        style={{ ...s.issueRow, background: checked ? '#f0fdf4' : undefined }}>
                        <div style={{ ...s.issueCheck, borderColor: checked ? '#38a169' : '#cbd5e0', background: checked ? '#38a169' : '#fff' }}>
                          {checked && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: '#1976d2', fontWeight: 600, marginRight: 8, fontSize: 13 }}>#{issue.id}</span>
                          <span style={{ fontSize: 13 }}>{issue.subject}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {issue.status && (
                            <span style={{ fontSize: 11, color: '#666', background: '#f0f0f0', padding: '2px 6px', borderRadius: 3 }}>{issue.status}</span>
                          )}
                          {issue.assignedTo && (
                            <span style={{ fontSize: 11, color: '#999' }}>{issue.assignedTo}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {pickerIssues.length < pickerTotal && (
                    <div style={{ padding: '12px 20px', textAlign: 'center' }}>
                      <button onClick={loadMore} disabled={pickerLoading} style={s.btnOutline}>
                        {pickerLoading ? '불러오는 중...' : `더 보기 (${pickerTotal - pickerIssues.length}개 남음)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={s.modalFooter}>
              <span style={{ fontSize: 13, color: '#888' }}>
                {pickerDraft.length > 0 ? `${pickerDraft.length}개 선택됨` : '일감을 선택하세요'}
              </span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={s.btnSecondary} onClick={() => setShowPicker(false)}>취소</button>
                <button style={s.btn} onClick={confirmPicker}>
                  선택 완료 {pickerDraft.length > 0 && `(${pickerDraft.length}개)`}
                </button>
              </div>
            </div>
          </div>
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
  btnOutline: { padding: '6px 14px', background: '#fff', color: '#1976d2', border: '1px dashed #1976d2', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
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
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: '#fff', borderRadius: 12, width: 720, maxWidth: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalClose: { border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: '#999', lineHeight: 1, padding: 4 },
  modalFilter: { padding: '12px 20px', borderBottom: '1px solid #f0f0f0', display: 'flex', gap: 10, alignItems: 'center' },
  tabBtn: { padding: '5px 14px', border: '1px solid #ddd', borderRadius: 20, cursor: 'pointer', fontSize: 12, background: '#fff', color: '#555' },
  tabBtnActive: { background: '#1a1a2e', color: '#fff', borderColor: '#1a1a2e' },
  modalBody: { flex: 1, overflowY: 'auto' as const },
  modalEmpty: { padding: 32, textAlign: 'center' as const, color: '#aaa', fontSize: 13 },
  issueRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' },
  issueCheck: { width: 18, height: 18, borderRadius: 4, border: '2px solid #cbd5e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  modalFooter: { padding: '12px 20px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
}
