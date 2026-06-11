import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  getDeployRequests, createDeployRequest, updateDeployRequest,
  deployRequestStatus, deleteDeployRequest, syncRedmine,
  type DeployRequest, type RequestStatus, type DeployType, type DeployScope, type CreateDeployRequest, type RedmineIssueRef,
} from '../../api/deployRequests'
import { getActiveSystems, getActiveSubSystems, getManagedSystemIds } from '../../api/systems'
import { fetchRedmineIssuesAll, fetchRedmineTrackers, type RedmineIssue, type RedmineTrackerConfig } from '../../api/redmine'
import { useAuth } from '../../context/useAuth'
import StatusBadge from '../../components/StatusBadge'
import PageHeader from '../../components/PageHeader'

const DEPLOY_TYPE_LABELS: Record<DeployType, string> = {
  RELEASE: '릴리즈', HOTFIX: '핫픽스', ROLLBACK: '롤백', PATCH: '패치',
}
const DEPLOY_SCOPE_LABELS: Record<DeployScope, string> = {
  FULL: '전점', PARTIAL: '일부점',
}
const NEXT_STATUS: Partial<Record<RequestStatus, { label: string; next: RequestStatus }[]>> = {
  DRAFT:     [{ label: '제출', next: 'REQUESTED' }],
  REQUESTED: [{ label: '승인', next: 'APPROVED' }, { label: '반려', next: 'REJECTED' }],
  APPROVED:  [{ label: '완료', next: 'COMPLETED' }],
}
const STATUS_FILTERS: { label: string; value: RequestStatus | 'ALL' }[] = [
  { label: '전체', value: 'ALL' },
  { label: '임시저장', value: 'DRAFT' },
  { label: '요청', value: 'REQUESTED' },
  { label: '승인', value: 'APPROVED' },
  { label: '완료', value: 'COMPLETED' },
  { label: '반려', value: 'REJECTED' },
]

const emptyForm: CreateDeployRequest = { systemId: 0, subSystemId: null, title: '', version: '', deployType: 'RELEASE', deployScope: 'FULL', deployTarget: '', content: '' }

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

  // 액션 코멘트 모달
  const [actionModal, setActionModal] = useState<{ id: number; next: RequestStatus } | null>(null)
  const [actionComment, setActionComment] = useState('')

  // 일감 선택 모달
  const [showPicker, setShowPicker] = useState(false)
  const [pickerTrackerId, setPickerTrackerId] = useState<number | undefined>(undefined)
  const [pickerStatus, setPickerStatus] = useState('')
  const [pickerQuery, setPickerQuery] = useState('')
  const [pickerDraft, setPickerDraft] = useState<RedmineIssueRef[]>([])
  const [pickerAllIssues, setPickerAllIssues] = useState<RedmineIssue[]>([])
  const [pickerAllTotal, setPickerAllTotal] = useState(0)
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerFetchError, setPickerFetchError] = useState<string | null>(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['deploy-requests'],
    queryFn: () => getDeployRequests(),
  })
  const { data: systems = [] } = useQuery({ queryKey: ['systems', 'active'], queryFn: getActiveSystems })
  const { data: managedSystemIds = [] } = useQuery({ queryKey: ['systems', 'managed'], queryFn: getManagedSystemIds })
  const selectedSystem = systems.find(s => s.id === form.systemId)

  const { data: subSystems = [] } = useQuery({
    queryKey: ['subsystems', 'active', form.systemId],
    queryFn: () => getActiveSubSystems(form.systemId),
    enabled: showForm && form.systemId > 0,
  })

  const { data: trackerConfigs = [] } = useQuery<RedmineTrackerConfig[]>({
    queryKey: ['redmine-trackers'],
    queryFn: fetchRedmineTrackers,
  })

  const pickerStatusOptions = pickerTrackerId
    ? (trackerConfigs.find(t => t.id === pickerTrackerId)?.statuses ?? [])
    : trackerConfigs.flatMap(t => t.statuses).filter((s, i, a) => a.findIndex(x => x.id === s.id) === i)

  useEffect(() => {
    if (!showPicker || !form.systemId) return
    setPickerAllIssues([])
    setPickerAllTotal(0)
    setPickerFetchError(null)
    setPickerLoading(true)
    fetchRedmineIssuesAll(form.systemId, 0)
      .then(result => {
        setPickerAllIssues(result.issues)
        setPickerAllTotal(result.totalCount)
      })
      .catch(e => setPickerFetchError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setPickerLoading(false))
  }, [showPicker, form.systemId])

  const loadMoreAllIssues = () => {
    if (pickerLoading || pickerAllIssues.length >= pickerAllTotal) return
    setPickerLoading(true)
    fetchRedmineIssuesAll(form.systemId, pickerAllIssues.length)
      .then(result => setPickerAllIssues(prev => [...prev, ...result.issues]))
      .catch(e => setPickerFetchError(e instanceof Error ? e.message : '조회 실패'))
      .finally(() => setPickerLoading(false))
  }

  const filteredIssues = pickerAllIssues.filter(issue => {
    if (!trackerConfigs.some(t => t.id === issue.trackerId)) return false
    if (pickerTrackerId && issue.trackerId !== pickerTrackerId) return false
    if (pickerStatus) {
      const n = Number(pickerStatus)
      if (!isNaN(n) && issue.statusId !== n) return false
    }
    if (pickerQuery) {
      const q = pickerQuery.trim().toLowerCase()
      if (!issue.subject.toLowerCase().includes(q) && !String(issue.id).includes(q)) return false
    }
    return true
  })

  const togglePickerIssue = (issue: RedmineIssue) => {
    setPickerDraft(prev =>
      prev.some(i => i.redmineIssueId === issue.id)
        ? prev.filter(i => i.redmineIssueId !== issue.id)
        : [...prev, { redmineIssueId: issue.id, redmineIssueTitle: issue.subject }]
    )
  }

  const openPicker = () => {
    setPickerDraft([...selectedIssues])
    setPickerTrackerId(undefined)
    setPickerStatus('')
    setPickerQuery('')
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
    mutationFn: ({ id, status, comment }: { id: number; status: RequestStatus; comment?: string }) => deployRequestStatus(id, status, comment),
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
    setForm({ systemId: r.systemId, subSystemId: r.subSystemId, title: r.title, version: r.version ?? '', deployType: r.deployType ?? 'RELEASE', deployScope: r.deployScope ?? 'FULL', deployTarget: r.deployTarget ?? '', content: r.content ?? '', scheduledAt: r.scheduledAt ?? undefined })
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

  const ACTION_MODAL_CONFIG: Partial<Record<RequestStatus, { title: string; btnLabel: string; btnColor: string; required: boolean }>> = {
    APPROVED:  { title: '승인 처리', btnLabel: '승인 확정', btnColor: '#276749', required: false },
    REJECTED:  { title: '반려 처리', btnLabel: '반려 확정', btnColor: '#e53e3e', required: true },
    COMPLETED: { title: '완료 처리', btnLabel: '완료 확정', btnColor: '#285E61', required: false },
  }

  const submitActionModal = () => {
    const cfg = ACTION_MODAL_CONFIG[actionModal!.next]
    if (cfg?.required && !actionComment.trim()) return alert('사유를 입력해주세요.')
    statusMut.mutate({ id: actionModal!.id, status: actionModal!.next, comment: actionComment.trim() || undefined })
    setActionModal(null)
    setActionComment('')
  }

  const handleStatus = (id: number, next: RequestStatus) => {
    if (next === 'REQUESTED') { statusMut.mutate({ id, status: next }); return }
    setActionModal({ id, next })
    setActionComment('')
  }

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const filtered = statusFilter === 'ALL' ? requests : requests.filter(r => r.status === statusFilter)

  return (
    <div style={s.page}>
      {/* 액션 코멘트 모달 */}
      {actionModal && (() => {
        const cfg = ACTION_MODAL_CONFIG[actionModal.next]!
        return (
          <div style={s.overlay} onClick={() => setActionModal(null)}>
            <div style={s.modal} onClick={e => e.stopPropagation()}>
              <h3 style={{ margin: '0 0 6px', fontSize: 16 }}>{cfg.title}</h3>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--c-text-muted)' }}>
                {cfg.required ? '사유를 입력하세요 (필수)' : '첨언을 입력하세요 (선택)'}
              </p>
              <textarea
                value={actionComment}
                onChange={e => setActionComment(e.target.value)}
                placeholder={cfg.required ? '사유를 입력하세요' : '첨언 (없으면 비워두세요)'}
                rows={4}
                style={{ width: '100%', padding: '8px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box', background: 'var(--c-input-bg)', color: 'var(--c-text)' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <button style={s.btnSecondary} onClick={() => setActionModal(null)}>취소</button>
                <button style={{ ...s.btn, background: cfg.btnColor }} onClick={submitActionModal}>{cfg.btnLabel}</button>
              </div>
            </div>
          </div>
        )
      })()}

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
            <label style={s.label}>배포 범위</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <select style={{ ...s.input, width: 'auto' }} value={form.deployScope ?? 'FULL'} onChange={(e) => setForm({ ...form, deployScope: e.target.value as DeployScope, deployTarget: e.target.value === 'FULL' ? '' : form.deployTarget })}>
                {Object.entries(DEPLOY_SCOPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              {form.deployScope === 'PARTIAL' && (
                <input style={{ ...s.input, flex: 1 }} value={form.deployTarget ?? ''} onChange={(e) => setForm({ ...form, deployTarget: e.target.value })} placeholder="대상 점포 (예: 강남점, 홍대점)" />
              )}
            </div>
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
                          <span style={{ color: 'var(--c-text)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.redmineIssueTitle}</span>
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
                <div style={{ padding: '8px 10px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 12, color: 'var(--c-text-muted)' }}>
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
        <p style={{ color: 'var(--c-text-muted)', padding: 16 }}>로딩 중...</p>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>번호</th>
                <th style={s.th}>시스템</th>
                <th style={{ ...s.th, width: '20%' }}>제목</th>
                <th style={s.th}>버전</th>
                <th style={s.th}>유형</th>
                <th style={s.th}>범위</th>
                <th style={s.th}>요청자</th>
                <th style={s.th}>승인자</th>
                <th style={s.th}>상태</th>
                <th style={s.th}>예정일</th>
                <th style={s.th}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={11} style={s.empty}>등록된 배포 요청이 없습니다</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} style={{ ...s.tr, cursor: 'pointer', background: detail?.id === r.id ? 'var(--c-row-sel)' : undefined }}
                  onClick={() => setDetail(detail?.id === r.id ? null : r)}>
                  <td style={{ ...s.td, fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap' }}>{r.deployNo ?? '-'}</td>
                  <td style={s.td}>
                    <span style={s.sysTag}>{r.systemName}</span>
                    {r.subSystemName && <span style={{ ...s.sysTag, background: 'var(--c-tag-sub)', color: 'var(--c-tag-sub-t)', marginLeft: 4 }}>{r.subSystemName}</span>}
                  </td>
                  <td style={s.td}>{r.title}</td>
                  <td style={s.td}>{r.version ?? '-'}</td>
                  <td style={s.td}>{r.deployType ? DEPLOY_TYPE_LABELS[r.deployType] : '-'}</td>
                  <td style={s.td}>
                    {r.deployScope ? (
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                        background: r.deployScope === 'FULL' ? 'var(--c-tag-sys)' : 'var(--c-tag-sub)',
                        color: r.deployScope === 'FULL' ? 'var(--c-tag-sys-t)' : 'var(--c-tag-sub-t)',
                      }}>{DEPLOY_SCOPE_LABELS[r.deployScope]}</span>
                    ) : '-'}
                  </td>
                  <td style={s.td}>{r.requesterUsername}</td>
                  <td style={s.td}>{r.approverUsername ?? '-'}</td>
                  <td style={s.td}><StatusBadge status={r.status} /></td>
                  <td style={s.td}>{r.scheduledAt?.slice(0, 16).replace('T', ' ') ?? '-'}</td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    <div style={s.actions}>
                      {r.status === 'DRAFT' && (
                        <button style={s.btnSm} onClick={() => openEdit(r)}>수정</button>
                      )}
                      {NEXT_STATUS[r.status]?.map(({ label, next }) => {
                        const isManagedSystem = managedSystemIds.includes(r.systemId)
                        const isRelease = r.deployType === 'RELEASE'
                        const canAct =
                          (next === 'APPROVED' || next === 'REJECTED') ? (isAdmin || (!isRelease && isManagedSystem)) :
                          (next === 'REQUESTED' || next === 'COMPLETED') ? (isManagedSystem || isAdmin) :
                          false
                        return canAct && (
                          <button key={next} style={{ ...s.btnSm, ...actionStyle(next) }}
                            onClick={() => handleStatus(r.id, next)}>
                            {label}
                          </button>
                        )
                      })}
                      {(r.status === 'DRAFT' || isAdmin) && (
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
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <span style={s.sysTag}>{detail.systemName}</span>
                {detail.subSystemName && <span style={{ ...s.sysTag, background: 'var(--c-tag-sub)', color: 'var(--c-tag-sub-t)' }}>{detail.subSystemName}</span>}
                {detail.deployNo && <span style={{ fontSize: 12, color: 'var(--c-text-muted)', fontWeight: 500 }}>{detail.deployNo}</span>}
                {detail.deployType && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{DEPLOY_TYPE_LABELS[detail.deployType]}</span>}
                {detail.deployScope && (
                  <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                    background: detail.deployScope === 'FULL' ? 'var(--c-tag-sys)' : 'var(--c-tag-sub)',
                    color: detail.deployScope === 'FULL' ? 'var(--c-tag-sys-t)' : 'var(--c-tag-sub-t)' }}>
                    {DEPLOY_SCOPE_LABELS[detail.deployScope]}{detail.deployScope === 'PARTIAL' && detail.deployTarget ? ` (${detail.deployTarget})` : ''}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--c-text)' }}>{detail.title}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <StatusBadge status={detail.status} />
              <button style={{ ...s.btnSecondary, fontSize: 12, padding: '4px 10px' }} onClick={() => setDetail(null)}>닫기</button>
            </div>
          </div>

          {/* 타임라인 */}
          <DeployTimeline detail={detail} />

          {/* 정보 섹션 2열 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}>배포 정보</div>
              <InfoRow label="버전" value={detail.version ?? '-'} />
              <InfoRow label="배포 유형" value={detail.deployType ? DEPLOY_TYPE_LABELS[detail.deployType] : '-'} />
              <InfoRow label="배포 범위" value={
                detail.deployScope ? (
                  <>{DEPLOY_SCOPE_LABELS[detail.deployScope]}{detail.deployScope === 'PARTIAL' && detail.deployTarget && <span style={{ marginLeft: 6, color: 'var(--c-text-muted)', fontSize: 12 }}>({detail.deployTarget})</span>}</>
                ) : '-'
              } />
              <InfoRow label="예정일시" value={detail.scheduledAt?.slice(0, 16).replace('T', ' ') ?? '-'} />
            </div>
            <div style={s.infoSection}>
              <div style={s.infoSectionTitle}>담당자 · 일정</div>
              <InfoRow label="요청자" value={detail.requesterUsername} />
              <InfoRow label="승인자" value={detail.approverUsername ?? '-'} />
              <InfoRow label="등록일" value={detail.createdAt?.slice(0, 10)} />
            </div>
          </div>

          {/* 첨언 / 반려 사유 */}
          {(detail.actionComment || detail.rejectionReason) && (
            <div style={{ marginTop: 14 }}>
              <div style={s.infoSectionTitle}>{detail.status === 'REJECTED' ? '반려 사유' : '첨언'}</div>
              <pre style={s.contentBox}>{detail.actionComment || detail.rejectionReason}</pre>
            </div>
          )}

          {/* 내용 */}
          {detail.content && (
            <div style={{ marginTop: 14 }}>
              <div style={s.infoSectionTitle}>내용</div>
              <pre style={s.contentBox}>{detail.content}</pre>
            </div>
          )}

          {/* 레드마인 */}
          {(detail.redmineIssues?.length > 0 || detail.redmineSyncStatus) && (
            <div style={{ marginTop: 14 }}>
              <div style={s.infoSectionTitle}>레드마인 일감</div>
              {detail.redmineIssues?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: detail.redmineSyncStatus ? 10 : 0 }}>
                  {detail.redmineIssues.map(i => (
                    <a key={i.redmineIssueId}
                      href={`http://54.180.246.95:3000/issues/${i.redmineIssueId}`}
                      target="_blank" rel="noreferrer"
                      style={{ color: '#1976d2', textDecoration: 'none', fontSize: 12, background: 'var(--c-tag-sys)', padding: '3px 10px', borderRadius: 4 }}>
                      #{i.redmineIssueId} {i.redmineIssueTitle}
                    </a>
                  ))}
                </div>
              )}
              {detail.redmineSyncStatus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {detail.redmineSyncStatus === 'SYNCED' && <span style={{ fontSize: 12, color: '#276749', background: '#F0FFF4', border: '1px solid #C6F6D5', padding: '2px 8px', borderRadius: 4 }}>버전 동기화 완료</span>}
                  {detail.redmineSyncStatus === 'FAILED' && (
                    <>
                      <span style={{ fontSize: 12, color: '#9B2C2C', background: '#FFF5F5', border: '1px solid #FED7D7', padding: '2px 8px', borderRadius: 4 }}>버전 동기화 실패</span>
                      <button style={{ ...s.btnSm, color: '#C05621', borderColor: '#C05621', marginRight: 0 }}
                        onClick={() => syncMut.mutate(detail.id)} disabled={syncMut.isPending}>
                        {syncMut.isPending ? '재시도 중...' : '재시도'}
                      </button>
                    </>
                  )}
                  {detail.redmineSyncStatus === 'SKIPPED' && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>미설정 (프로젝트키 또는 버전 없음)</span>}
                </div>
              )}
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
            <div style={{ ...s.modalFilter, flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <select
                  value={pickerTrackerId ?? ''}
                  onChange={e => {
                    setPickerTrackerId(e.target.value ? Number(e.target.value) : undefined)
                    setPickerStatus('')
                  }}
                  style={{ ...s.input, margin: 0, width: 'auto', minWidth: 100 }}
                >
                  <option value="">전체 유형</option>
                  {trackerConfigs.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <select
                  value={pickerStatus}
                  onChange={e => setPickerStatus(e.target.value)}
                  style={{ ...s.input, margin: 0, width: 'auto', minWidth: 100 }}
                >
                  <option value="">전체 상태</option>
                  {pickerStatusOptions.map(st => (
                    <option key={st.id} value={String(st.id)}>{st.name}</option>
                  ))}
                </select>
                <input
                  value={pickerQuery}
                  onChange={e => setPickerQuery(e.target.value)}
                  placeholder="제목으로 검색..."
                  style={{ ...s.input, flex: 1, margin: 0 }}
                />
              </div>
            </div>
            <div style={s.modalBody}>
              {pickerAllIssues.length === 0 && pickerLoading ? (
                <div style={s.modalEmpty}>불러오는 중...</div>
              ) : pickerFetchError ? (
                <div style={{ ...s.modalEmpty, color: '#e53e3e' }}>오류: {pickerFetchError}</div>
              ) : filteredIssues.length === 0 ? (
                <div style={s.modalEmpty}>일감이 없습니다</div>
              ) : (
                <>
                  <div style={{ padding: '6px 20px', fontSize: 12, color: 'var(--c-text-muted)', background: 'var(--c-bg)', borderBottom: '1px solid var(--c-thead)' }}>
                    {filteredIssues.length}개 표시{pickerAllIssues.length < pickerAllTotal ? ` (서버 ${pickerAllTotal}개 중 ${pickerAllIssues.length}개 로드됨)` : ''}
                  </div>
                  {filteredIssues.map(issue => {
                    const checked = pickerDraft.some(i => i.redmineIssueId === issue.id)
                    return (
                      <div key={issue.id} onClick={() => togglePickerIssue(issue)}
                        style={{ ...s.issueRow, background: checked ? '#f0fdf4' : undefined }}>
                        <div style={{ ...s.issueCheck, borderColor: checked ? '#38a169' : '#cbd5e0', background: checked ? '#38a169' : 'var(--c-card)' }}>
                          {checked && <span style={{ color: '#fff', fontSize: 11, lineHeight: 1 }}>✓</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: '#1976d2', fontWeight: 600, marginRight: 8, fontSize: 13 }}>#{issue.id}</span>
                          <span style={{ fontSize: 13 }}>{issue.subject}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {issue.trackerName && (
                            <span style={{ fontSize: 11, color: '#1976d2', background: '#e3f2fd', padding: '2px 6px', borderRadius: 3 }}>{issue.trackerName}</span>
                          )}
                          {issue.statusName && (
                            <span style={{ fontSize: 11, color: 'var(--c-text-sub)', background: 'var(--c-thead)', padding: '2px 6px', borderRadius: 3 }}>{issue.statusName}</span>
                          )}
                          {issue.assignedTo && (
                            <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{issue.assignedTo}</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {pickerAllIssues.length < pickerAllTotal && (
                    <div style={{ padding: '12px 20px', textAlign: 'center' }}>
                      <button onClick={loadMoreAllIssues} disabled={pickerLoading} style={s.btnOutline}>
                        {pickerLoading ? '불러오는 중...' : `더 불러오기 (${pickerAllTotal - pickerAllIssues.length}개 남음)`}
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
            <div style={s.modalFooter}>
              <span style={{ fontSize: 13, color: 'var(--c-text-muted)' }}>
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
  btnSecondary: { padding: '8px 16px', background: 'var(--c-card)', color: 'var(--c-text-sub)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnOutline: { padding: '6px 14px', background: 'var(--c-card)', color: '#1976d2', border: '1px dashed #1976d2', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid var(--c-border-in)', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  card: { background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, padding: 24, marginBottom: 16 },
  formTitle: { fontSize: 15, fontWeight: 600, marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'start', marginBottom: 16 },
  formActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--c-text-sub)', paddingTop: 8 },
  input: { padding: '8px 10px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' as const, background: 'var(--c-input-bg)', color: 'var(--c-text)' },
  issueBadge: { display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4', border: '1px solid #c6f6d5', borderRadius: 4, padding: '3px 8px', fontSize: 12 },
  filterRow: { display: 'flex', gap: 6, marginBottom: 12 },
  filterBtn: { padding: '5px 12px', background: 'var(--c-card)', border: '1px solid var(--c-border-in)', borderRadius: 20, cursor: 'pointer', fontSize: 12, color: 'var(--c-text-sub)', display: 'flex', alignItems: 'center', gap: 4 },
  filterBtnActive: { background: '#1a1a2e', color: '#fff', borderColor: '#1a1a2e' },
  badge: { background: 'rgba(255,255,255,0.25)', borderRadius: 10, padding: '0 5px', fontSize: 11 },
  tableWrap: { background: 'var(--c-card)', borderRadius: 8, border: '1px solid var(--c-border)', overflow: 'hidden', marginBottom: 16 },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  thead: { background: 'var(--c-thead)' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: 12, fontWeight: 600, color: 'var(--c-text-sub)', borderBottom: '1px solid var(--c-border)' },
  tr: { borderBottom: '1px solid var(--c-thead)' },
  td: { padding: '10px 14px', fontSize: 13 },
  sysTag: { background: 'var(--c-tag-sys)', color: 'var(--c-tag-sys-t)', padding: '2px 8px', borderRadius: 4, fontSize: 12 },
  actions: { display: 'flex', alignItems: 'center' },
  empty: { padding: '32px', textAlign: 'center' as const, color: 'var(--c-text-muted)', fontSize: 13 },
  detailGrid: { display: 'grid', gridTemplateColumns: '80px 1fr 80px 1fr', gap: '10px 16px', fontSize: 13 },
  detailLabel: { color: 'var(--c-text-muted)', fontSize: 12, fontWeight: 500 },
  infoSection: { background: 'var(--c-bg)', borderRadius: 8, padding: '14px 16px' },
  infoSectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 10 },
  contentBox: { background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '12px 16px', fontSize: 13, whiteSpace: 'pre-wrap' as const, marginTop: 8, fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  modal: { background: 'var(--c-card)', borderRadius: 12, width: 720, maxWidth: '90vw', maxHeight: '85vh', display: 'flex', flexDirection: 'column' as const, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalHeader: { padding: '16px 20px', borderBottom: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalClose: { border: 'none', background: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--c-text-muted)', lineHeight: 1, padding: 4 },
  modalFilter: { padding: '12px 20px', borderBottom: '1px solid var(--c-thead)', display: 'flex', gap: 10, alignItems: 'center' },
  tabBtn: { padding: '5px 14px', border: '1px solid var(--c-border-in)', borderRadius: 20, cursor: 'pointer', fontSize: 12, background: 'var(--c-card)', color: 'var(--c-text-sub)' },
  tabBtnActive: { background: '#1a1a2e', color: '#fff', borderColor: '#1a1a2e' },
  modalBody: { flex: 1, overflowY: 'auto' as const },
  modalEmpty: { padding: 32, textAlign: 'center' as const, color: 'var(--c-text-muted)', fontSize: 13 },
  issueRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--c-thead)', cursor: 'pointer' },
  issueCheck: { width: 18, height: 18, borderRadius: 4, border: '2px solid #cbd5e0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  modalFooter: { padding: '12px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
}

function DeployTimeline({ detail }: { detail: import('../../api/deployRequests').DeployRequest }) {
  const isRejected = detail.status === 'REJECTED'
  const req = detail.requesterUsername
  const apr = detail.approverUsername

  type Step = { label: string; ts: string | null; done: boolean; rejected?: boolean; person?: string | null }
  const steps: Step[] = isRejected
    ? [
        { label: '초안',   ts: detail.createdAt,   done: true,  person: req },
        { label: '요청',   ts: detail.requestedAt, done: true,  person: req },
        { label: '반려',   ts: null,               done: false, rejected: true, person: apr },
      ]
    : [
        { label: '초안',   ts: detail.createdAt,   done: true,  person: req },
        { label: '요청',   ts: detail.requestedAt, done: ['REQUESTED','APPROVED','COMPLETED'].includes(detail.status), person: req },
        { label: '승인',   ts: detail.approvedAt,  done: ['APPROVED','COMPLETED'].includes(detail.status), person: apr },
        { label: '완료',   ts: detail.deployedAt,  done: detail.status === 'COMPLETED', person: apr },
      ]

  const fmtTs = (ts: string | null) => ts ? ts.slice(0, 10) + '\n' + ts.slice(11, 16) : ''

  return (
    <div style={{ background: 'var(--c-bg)', borderRadius: 8, padding: '20px 32px', display: 'flex', alignItems: 'flex-start' }}>
      {steps.map((step, idx) => {
        const nextStep = steps[idx + 1]
        const lineColor = nextStep?.rejected ? '#e53e3e' : (nextStep?.done ? '#1a1a2e' : 'var(--c-border)')
        const circleColor = step.rejected ? '#e53e3e' : step.done ? '#1a1a2e' : 'transparent'
        const circleBorder = step.done || step.rejected ? 'none' : '2px solid var(--c-border)'
        const textColor = step.rejected ? '#e53e3e' : step.done ? 'var(--c-text)' : 'var(--c-text-muted)'
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', flex: idx < steps.length - 1 ? 1 : 'initial' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: circleColor, border: circleBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: step.done || step.rejected ? '#fff' : 'var(--c-text-muted)', fontWeight: 700, flexShrink: 0 }}>
                {step.rejected ? '✕' : step.done ? '✓' : idx + 1}
              </div>
              <div style={{ fontSize: 12, fontWeight: 600, color: textColor, marginTop: 7, whiteSpace: 'nowrap' }}>{step.label}</div>
              <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 3, textAlign: 'center', whiteSpace: 'pre', lineHeight: 1.5 }}>{fmtTs(step.ts)}</div>
              {step.person && step.done && (
                <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 4, textAlign: 'center', fontStyle: 'italic' }}>{step.person}</div>
              )}
            </div>
            {idx < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: lineColor, marginTop: 14, marginLeft: -2, marginRight: -2 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--c-border-in)', alignItems: 'flex-start' }}>
      <span style={{ fontSize: 12, color: 'var(--c-text-muted)', fontWeight: 500, minWidth: 60, flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--c-text)' }}>{value}</span>
    </div>
  )
}
