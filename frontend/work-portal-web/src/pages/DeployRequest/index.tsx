import { useState, useEffect, useRef, Fragment } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  getDeployRequests, createDeployRequest, updateDeployRequest,
  deployRequestStatus, deleteDeployRequest, syncRedmine,
  getDeploySteps, completeDeployStep,
  type DeployRequest, type RequestStatus, type DeployType, type DeployScope, type CreateDeployRequest, type RedmineIssueRef,
} from '../../api/deployRequests'
import { getActiveSystems, getActiveSubSystems, getManagedSystemIds } from '../../api/systems'
import { fetchRedmineIssuesAll, fetchRedmineTrackers, type RedmineIssue, type RedmineTrackerConfig } from '../../api/redmine'
import { useAuth } from '../../context/useAuth'
import StatusBadge from '../../components/StatusBadge'
import PageHeader from '../../components/PageHeader'
import { Button, Callout, Checkbox, EmptyState, Input, Loading, Modal, Panel, Select, TabBar, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Tag, Textarea } from '../../components/ui'
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis,
  ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent, type ChartConfig,
} from '@lotte/rsp-react-design-system/shadcn'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ReferenceLine } from 'recharts'

const DEPLOY_TYPE_LABELS: Record<DeployType, string> = {
  RELEASE: '릴리즈', HOTFIX: '핫픽스', ROLLBACK: '롤백', PATCH: '패치',
}
const DEPLOY_SCOPE_LABELS: Record<DeployScope, string> = {
  FULL: '전점', PARTIAL: '일부점',
}
const DEPLOY_TYPE_BADGE: Record<DeployType, { bg: string; color: string }> = {
  RELEASE:  { bg: 'var(--c-tag-sys)',      color: 'var(--c-tag-sys-t)' },
  HOTFIX:   { bg: 'var(--c-tag-err-bg)',   color: 'var(--c-tag-err-t)' },
  ROLLBACK: { bg: 'var(--c-tag-warn-bg)',  color: 'var(--c-tag-warn-t)' },
  PATCH:    { bg: 'var(--c-tag-draft-bg)', color: 'var(--c-tag-draft-t)' },
}
const DEPLOY_SCOPE_BADGE: Record<DeployScope, { bg: string; color: string }> = {
  FULL:    { bg: 'var(--c-tag-done-bg)', color: 'var(--c-tag-done-t)' },
  PARTIAL: { bg: 'var(--c-tag-pri-bg)',  color: 'var(--c-tag-pri-t)' },
}
const DEPLOY_TYPE_GUIDE: Record<DeployType, string> = {
  RELEASE: '정기 계획 배포. 신규 기능·개선사항이 포함된 버전을 배포할 때 사용합니다.',
  HOTFIX:  '장애·긴급 버그 수정 배포. 운영 중 발생한 문제를 즉시 수정할 때 사용합니다.',
  ROLLBACK: '이전 버전으로 되돌리기. 배포 후 문제 발생 시 직전 안정 버전으로 복구할 때 사용합니다.',
  PATCH:   '소규모 수정 배포. 설정 변경·데이터 픽스 등 코드 변경이 최소한인 경우 사용합니다.',
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

const PAGE_SIZES = [10, 20, 50]

const emptyForm: CreateDeployRequest = { systemId: 0, subSystemId: null, title: '', version: '', deployType: 'RELEASE', deployScope: 'FULL', deployTarget: '', content: '' }

function apiError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return e.response.data.error
  return e instanceof Error ? e.message : String(e)
}

export default function DeployRequestPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'list' | 'dashboard'>('list')
  const [editing, setEditing] = useState<DeployRequest | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [detail, setDetail] = useState<DeployRequest | null>(null)
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'ALL'>('ALL')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
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
    const trackerConfig = trackerConfigs.find(t => t.id === issue.trackerId)
    if (!trackerConfig) return false
    if (pickerTrackerId && issue.trackerId !== pickerTrackerId) return false
    if (pickerStatus) {
      const n = Number(pickerStatus)
      if (!isNaN(n) && issue.statusId !== n) return false
    } else {
      if (!trackerConfig.statuses.some(s => s.id === issue.statusId)) return false
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

  const { data: deploySteps = [], refetch: refetchSteps } = useQuery({
    queryKey: ['deploy-steps', detail?.id],
    queryFn: () => getDeploySteps(detail!.id),
    enabled: !!detail && detail.status === 'APPROVED',
  })

  const completeStepMut = useMutation({
    mutationFn: completeDeployStep,
    onSuccess: (result) => {
      refetchSteps()
      if (result.allCompleted) invalidate()
    },
    onError: (e) => alert('완료 처리 실패: ' + apiError(e)),
  })

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

  const openCreate = (prefill?: Partial<CreateDeployRequest>) => {
    setEditing(null)
    setForm({ ...emptyForm, systemId: systems[0]?.id ?? 0, subSystemId: null, ...prefill })
    setSelectedIssues(prefill?.redmineIssues ?? [])
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
    APPROVED:  { title: '승인 처리', btnLabel: '승인 확정', btnColor: 'var(--rsp-color-success-500)', required: false },
    REJECTED:  { title: '반려 처리', btnLabel: '반려 확정', btnColor: 'var(--rsp-color-error-500)', required: true },
    COMPLETED: { title: '완료 처리', btnLabel: '완료 확정', btnColor: 'var(--rsp-color-primary-600)', required: false },
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
  const topLevelFiltered = filtered.filter(r => !r.parentDrId)
  const childrenOf = (id: number) => requests.filter(r => r.parentDrId === id)

  const totalPages = Math.max(1, Math.ceil(topLevelFiltered.length / pageSize))
  const safePage = Math.min(page, totalPages)
  const pagedTopLevel = topLevelFiltered.slice((safePage - 1) * pageSize, safePage * pageSize)

  // 필터/페이지 크기 변경 시 1페이지로 리셋
  useEffect(() => { setPage(1) }, [statusFilter, pageSize])

  // URL ?no= 쿼리파라미터로 특정 배포 건 자동 선택
  const autoSelectDone = useRef(false)
  useEffect(() => {
    if (autoSelectDone.current || requests.length === 0) return
    const no = new URLSearchParams(window.location.search).get('no')
    if (!no) return
    const found = requests.find(r => r.deployNo === no)
    if (found) { setDetail(found); autoSelectDone.current = true }
  }, [requests])

  return (
    <div className="page-wrap">
      {/* 액션 코멘트 모달 */}
      {actionModal && (() => {
        const cfg = ACTION_MODAL_CONFIG[actionModal.next]!
        return (
          <Modal open onClose={() => setActionModal(null)} title={cfg.title} width={440} dismissible>
              <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--c-text-muted)' }}>
                {cfg.required ? '사유를 입력하세요 (필수)' : '첨언을 입력하세요 (선택)'}
              </p>
              <Textarea
                value={actionComment}
                onChange={e => setActionComment(e.target.value)}
                placeholder={cfg.required ? '사유를 입력하세요' : '첨언 (없으면 비워두세요)'}
                rows={4}
                style={{ width: '100%', resize: 'vertical' }}
                autoFocus
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
                <Button variant="outlined" onClick={() => setActionModal(null)}>취소</Button>
                <Button variant="filled" style={{ background: cfg.btnColor }} onClick={submitActionModal}>{cfg.btnLabel}</Button>
              </div>
          </Modal>
        )
      })()}

      <PageHeader
        title="배포 관리"
        extra={<TabBar value={tab} onChange={v => setTab(v)}
          items={[{ value: 'list', label: '목록' }, { value: 'dashboard', label: '현황' }]} />}
        actions={tab === 'list' && <Button variant="filled" onClick={() => openCreate()}>+ 새 배포 요청</Button>}
      />

      {tab === 'dashboard' && <DeployDashboard requests={requests.filter(r => !r.parentDrId)} />}

      {tab === 'list' && <>
      {/* 등록/수정 폼 */}
      {showForm && (
        <Panel style={s.card}>
          <h3 style={s.formTitle}>{editing ? '배포 요청 수정' : '새 배포 요청'}</h3>
          <div style={s.formGrid}>
            <label style={s.label}>운영시스템 *</label>
            <Select style={{ width: '100%' }} value={form.systemId} onValueChange={(v) => setForm({ ...form, systemId: Number(v), subSystemId: null })}>
              <option value={0}>선택</option>
              {systems.map((sys) => <option key={sys.id} value={sys.id}>{sys.name}</option>)}
            </Select>
            {subSystems.length > 0 && (
              <>
                <label style={s.label}>하위시스템</label>
                <Select style={{ width: '100%' }} value={form.subSystemId ?? 0} onValueChange={(v) => setForm({ ...form, subSystemId: Number(v) || null })}>
                  <option value={0}>없음</option>
                  {subSystems.map((sub) => <option key={sub.id} value={sub.id}>{sub.name}</option>)}
                </Select>
              </>
            )}
            <label style={s.label}>제목 *</label>
            <div>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="예: [릴리즈] POS v1.2.3 · [핫픽스] 주문 오류 긴급수정" />
              <div style={{ marginTop: 4, fontSize: 11, color: 'var(--c-text-muted)', lineHeight: 1.6 }}>
                권장 형식: <code style={{ background: 'var(--c-bg)', padding: '1px 5px', borderRadius: 3 }}>[유형] 시스템 버전 · 변경내용</code>
              </div>
            </div>
            <label style={s.label}>버전</label>
            <Input value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} placeholder="예: v1.2.3" />
            <label style={s.label}>배포 유형</label>
            <div>
              <Select style={{ width: '100%' }} value={form.deployType} onValueChange={(v) => setForm({ ...form, deployType: v as DeployType })}>
                {Object.entries(DEPLOY_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              {form.deployType && (
                <div style={{ marginTop: 5, fontSize: 12, color: 'var(--c-text-muted)', lineHeight: 1.5 }}>
                  {DEPLOY_TYPE_GUIDE[form.deployType as DeployType]}
                </div>
              )}
            </div>
            <label style={s.label}>배포 범위</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Select value={form.deployScope ?? 'FULL'} onValueChange={(v) => setForm({ ...form, deployScope: v as DeployScope, deployTarget: v === 'FULL' ? '' : form.deployTarget })}>
                {Object.entries(DEPLOY_SCOPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              {form.deployScope === 'PARTIAL' && (
                <Input style={{ flex: 1 }} value={form.deployTarget ?? ''} onChange={(e) => setForm({ ...form, deployTarget: e.target.value })} placeholder="대상 점포 (예: 강남점, 홍대점)" />
              )}
            </div>
            <label style={s.label}>예정일시</label>
            <Input style={{ width: 210 }} type="datetime-local" value={form.scheduledAt?.slice(0, 16) ?? ''} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value ? e.target.value + ':00' : undefined })} />
            <label style={s.label}>레드마인 일감</label>
            <div>
              {selectedSystem?.redmineProjectKey ? (
                <>
                  {selectedIssues.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 6 }}>
                      {selectedIssues.map(issue => (
                        <Tag key={issue.redmineIssueId} tone="success" title={issue.redmineIssueTitle ?? undefined} removeLabel="일감 선택 해제"
                          onRemove={() => setSelectedIssues(prev => prev.filter(i => i.redmineIssueId !== issue.redmineIssueId))}>
                          <span style={{ fontWeight: 600 }}>#{issue.redmineIssueId}</span>
                          <span style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{issue.redmineIssueTitle}</span>
                        </Tag>
                      ))}
                    </div>
                  )}
                  <Button type="button" variant="outlined" onClick={openPicker}>
                    + 일감 선택
                  </Button>
                </>
              ) : (
                <Callout tone="warning">시스템에 레드마인 프로젝트가 설정되지 않았습니다</Callout>
              )}
            </div>
            <label style={s.label}>내용</label>
            <Textarea style={{ height: 100, resize: 'vertical' }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="배포 내용 및 변경사항을 입력하세요" />
          </div>
          <div style={s.formActions}>
            <Button variant="outlined" onClick={closeForm}>취소</Button>
            <Button variant="filled" onClick={submit} disabled={createMut.isPending || updateMut.isPending}>
              {createMut.isPending || updateMut.isPending ? '저장 중...' : '저장'}
            </Button>
          </div>
        </Panel>
      )}

      {/* 상태 필터 탭 */}
      <div style={s.filterRow}>
        {STATUS_FILTERS.map(({ label, value }) => {
          const topLevel = requests.filter(r => !r.parentDrId)
          const count = value === 'ALL' ? topLevel.length : topLevel.filter(r => r.status === value).length
          return (
            <Button key={value} size="md" variant={statusFilter === value ? 'filled' : 'outlined'}
              onClick={() => setStatusFilter(value)}>
              {label} {count > 0 && <span style={s.badge}>{count}</span>}
            </Button>
          )
        })}
      </div>

      {/* 목록 */}
      {isLoading ? (
        <Loading text="로딩 중..." />
      ) : (
        <Panel style={s.tableWrap}>
          <div className="table-scroll">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ ...s.th, paddingLeft: 20 }}>번호</TableHead>
                <TableHead style={{ ...s.th, minWidth: 80, whiteSpace: 'nowrap' }}>시스템</TableHead>
                <TableHead style={{ ...s.th, width: '20%' }}>제목</TableHead>
                <TableHead style={s.th}>버전</TableHead>
                <TableHead style={{ ...s.th, minWidth: 56, whiteSpace: 'nowrap' }}>유형</TableHead>
                <TableHead style={{ ...s.th, minWidth: 56, whiteSpace: 'nowrap' }}>범위</TableHead>
                <TableHead style={s.th}>요청자</TableHead>
                <TableHead style={s.th}>승인자</TableHead>
                <TableHead style={{ ...s.th, whiteSpace: 'nowrap' }}>상태</TableHead>
                <TableHead style={s.th}>예정일</TableHead>
                <TableHead style={s.th}>액션</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagedTopLevel.length === 0 && (
                <TableRow><TableCell colSpan={11}><EmptyState title="등록된 배포 요청이 없습니다" /></TableCell></TableRow>
              )}
              {pagedTopLevel.map((r) => {
                const children = childrenOf(r.id)
                const renderRow = (row: DeployRequest, isChild: boolean) => (
                  <TableRow key={row.id}
                    style={{ cursor: 'pointer', background: detail?.id === row.id ? 'var(--c-row-sel)' : isChild ? 'var(--c-bg)' : undefined }}
                    onClick={() => setDetail(detail?.id === row.id ? null : row)}>
                    {/* 하위(전점) 배포 행은 들여쓰기로 계층 표시 */}
                    <TableCell style={{ fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap', paddingLeft: isChild ? 36 : 20 }}>
                      {isChild && <span style={{ color: 'var(--c-text-muted)', marginRight: 4 }}>↳</span>}
                      {row.deployNo ?? '-'}
                    </TableCell>
                    <TableCell>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Tag tone="info">{row.systemName}</Tag>
                        {row.subSystemName && <SubTag name={row.subSystemName} />}
                      </div>
                    </TableCell>
                    <TableCell>{row.title}</TableCell>
                    <TableCell>{row.version ?? '-'}</TableCell>
                    <TableCell>
                      {row.deployType ? (
                        <Tag {...DEPLOY_TYPE_BADGE[row.deployType]}>{DEPLOY_TYPE_LABELS[row.deployType]}</Tag>
                      ) : '-'}
                    </TableCell>
                    <TableCell>
                      {row.deployScope ? (
                        <Tag {...DEPLOY_SCOPE_BADGE[row.deployScope]}>{DEPLOY_SCOPE_LABELS[row.deployScope]}</Tag>
                      ) : '-'}
                    </TableCell>
                    <TableCell>{row.requesterUsername}</TableCell>
                    <TableCell>{row.approverUsername ?? '-'}</TableCell>
                    <TableCell style={{ whiteSpace: 'nowrap' }}><StatusBadge status={row.status} /></TableCell>
                    <TableCell><ScheduledCell scheduledAt={row.scheduledAt} rowStatus={row.status} /></TableCell>
                    <TableCell onClick={e => e.stopPropagation()}>
                      <div style={s.actions}>
                        {(row.status === 'DRAFT' || (row.status === 'COMPLETED' && isAdmin)) && (
                          <Button variant="outlined" size="xs" onClick={() => openEdit(row)}>수정</Button>
                        )}
                        {NEXT_STATUS[row.status]?.map(({ label, next }) => {
                          const isManagedSystem = managedSystemIds.includes(row.systemId)
                          const isRelease = row.deployType === 'RELEASE'
                          const canAct =
                            (next === 'APPROVED' || next === 'REJECTED') ? (isAdmin || (!isRelease && isManagedSystem)) :
                            (next === 'REQUESTED' || next === 'COMPLETED') ? (isManagedSystem || isAdmin) :
                            false
                          return canAct && (
                            <Button key={next} variant={next === 'REJECTED' ? 'danger' : 'outlined'} size="xs" style={actionStyle(next)}
                              onClick={() => handleStatus(row.id, next)}>
                              {label}
                            </Button>
                          )
                        })}
                        {row.status === 'COMPLETED' && row.deployScope === 'PARTIAL' && !requests.some(x => x.parentDrId === row.id) && (
                          <Button variant="outlined" size="xs" style={{ color: 'var(--c-tag-teal-t)', borderColor: 'var(--c-tag-teal-t)' }}
                            onClick={() => openCreate({ systemId: row.systemId, subSystemId: row.subSystemId ?? undefined, title: row.title, version: row.version ?? '', deployType: row.deployType ?? 'RELEASE', deployScope: 'FULL', content: row.content ?? '', redmineIssues: row.redmineIssues, parentDrId: row.id })}>
                            전점 배포
                          </Button>
                        )}
                        {(row.status === 'DRAFT' || isAdmin) && (
                          <Button variant="danger" size="xs"
                            onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(row.id) }}>
                            삭제
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
                return (
                  <Fragment key={r.id}>
                    {renderRow(r, false)}
                    {children.map(child => renderRow(child, true))}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
          </div>

        {/* 페이지네이션 바 */}
        {topLevelFiltered.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 16px', borderTop: '1px solid var(--c-border)',
            background: 'var(--c-card)', flexWrap: 'wrap', gap: 8,
          }}>
            {/* 좌측: 건수 + 페이지 크기 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12, color: 'var(--c-text-muted)' }}>
              <span>총 {topLevelFiltered.length}건</span>
              <span style={{ color: 'var(--c-border)' }}>|</span>
              <span>페이지당</span>
              <Select
                value={pageSize}
                onValueChange={v => setPageSize(Number(v))}
              >
                {PAGE_SIZES.map(n => <option key={n} value={n}>{n}건</option>)}
              </Select>
            </div>

            {/* 우측: 페이지 버튼 (SDK Pagination) */}
            <Pagination style={{ margin: 0, width: 'auto', justifyContent: 'flex-end' }}>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious href="#" text="이전"
                    aria-disabled={safePage === 1}
                    style={safePage === 1 ? disabledLinkStyle : undefined}
                    onClick={e => { e.preventDefault(); if (safePage > 1) setPage(safePage - 1) }} />
                </PaginationItem>
                {buildPageNums(safePage, totalPages).map((item, i) =>
                  item === '...' ? (
                    <PaginationItem key={`ellipsis-${i}`}><PaginationEllipsis /></PaginationItem>
                  ) : (
                    <PaginationItem key={item}>
                      <PaginationLink href="#" isActive={item === safePage}
                        onClick={e => { e.preventDefault(); setPage(item) }}>
                        {item}
                      </PaginationLink>
                    </PaginationItem>
                  )
                )}
                <PaginationItem>
                  <PaginationNext href="#" text="다음"
                    aria-disabled={safePage === totalPages}
                    style={safePage === totalPages ? disabledLinkStyle : undefined}
                    onClick={e => { e.preventDefault(); if (safePage < totalPages) setPage(safePage + 1) }} />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Panel>
      )}

      {/* 상세 패널 */}
      {detail && (
        <Panel style={s.card}>
          {/* 헤더 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                <Tag tone="info">{detail.systemName}</Tag>
                {detail.subSystemName && <SubTag name={detail.subSystemName} />}
                {detail.deployNo && <span style={{ fontSize: 12, color: 'var(--c-text-muted)', fontWeight: 500 }}>{detail.deployNo}</span>}
                {detail.deployType && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>{DEPLOY_TYPE_LABELS[detail.deployType]}</span>}
                {detail.deployScope && (
                  <Tag {...SCOPE_TAG[detail.deployScope]}>
                    {DEPLOY_SCOPE_LABELS[detail.deployScope]}{detail.deployScope === 'PARTIAL' && detail.deployTarget ? ` (${detail.deployTarget})` : ''}
                  </Tag>
                )}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--c-text)' }}>{detail.title}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
              <StatusBadge status={detail.status} />
              <Button variant="outlined" size="xs" onClick={() => setDetail(null)}>닫기</Button>
            </div>
          </div>

          {/* 타임라인 */}
          <DeployTimeline detail={detail} />

          {/* 정보 섹션 2열 */}
          <div className="deploy-info-grid">
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

          {/* 배포 경로 */}
          {(() => {
            const parent = detail.parentDrId ? requests.find(r => r.id === detail.parentDrId) : null
            const children = requests.filter(r => r.parentDrId === detail.id)
            if (!parent && children.length === 0) return null
            const chain: { dr: DeployRequest; isCurrent: boolean }[] = [
              ...(parent ? [{ dr: parent, isCurrent: false }] : []),
              { dr: detail, isCurrent: true },
              ...children.map(c => ({ dr: c, isCurrent: false })),
            ]
            return (
              <div style={{ marginTop: 14 }}>
                <div style={s.infoSectionTitle}>배포 경로</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 8, flexWrap: 'wrap' }}>
                  {chain.map(({ dr, isCurrent }, idx) => (
                    <Fragment key={dr.id}>
                      {idx > 0 && (
                        <div style={{ padding: '0 10px', color: 'var(--c-text-muted)', fontSize: 16, flexShrink: 0 }}>→</div>
                      )}
                      <Panel
                        role={isCurrent ? undefined : 'button'}
                        tabIndex={isCurrent ? undefined : 0}
                        onClick={() => !isCurrent && setDetail(dr)}
                        onKeyDown={e => { if (!isCurrent && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setDetail(dr) } }}
                        style={{
                          padding: '8px 14px', gap: 4, flexShrink: 0,
                          cursor: isCurrent ? 'default' : 'pointer',
                          ...(isCurrent ? { borderColor: 'var(--c-action)', background: 'var(--c-row-sel)' } : {}),
                        }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: isCurrent ? 'var(--c-text)' : 'var(--c-text-muted)' }}>
                            {dr.deployNo ?? `DR#${dr.id}`}
                          </span>
                          {isCurrent && <Tag color="var(--rsp-color-text-on-primary)" bg="var(--c-action)">현재</Tag>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {dr.deployScope && (
                            <Tag {...SCOPE_TAG[dr.deployScope]}>{DEPLOY_SCOPE_LABELS[dr.deployScope]}</Tag>
                          )}
                          {dr.deployTarget && <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{dr.deployTarget}</span>}
                          <StatusBadge status={dr.status} />
                        </div>
                      </Panel>
                    </Fragment>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* 첨언 / 반려 사유 */}
          {(detail.actionComment || detail.rejectionReason) && (
            <div style={{ marginTop: 14 }}>
              <div style={s.infoSectionTitle}>{detail.status === 'REJECTED' ? '반려 사유' : '첨언'}</div>
              <Panel style={s.contentPanel}><pre style={s.contentPre}>{detail.actionComment || detail.rejectionReason}</pre></Panel>
            </div>
          )}

          {/* 내용 */}
          {detail.content && (
            <div style={{ marginTop: 14 }}>
              <div style={s.infoSectionTitle}>내용</div>
              <Panel style={s.contentPanel}><pre style={s.contentPre}>{detail.content}</pre></Panel>
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
                      style={{ textDecoration: 'none' }}>
                      <Tag tone="info" style={{ cursor: 'pointer' }}>#{i.redmineIssueId} {i.redmineIssueTitle}</Tag>
                    </a>
                  ))}
                </div>
              )}
              {detail.redmineSyncStatus && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {detail.redmineSyncStatus === 'SYNCED' && <Tag tone="success">버전 동기화 완료</Tag>}
                  {detail.redmineSyncStatus === 'FAILED' && (
                    <>
                      <Tag tone="danger">버전 동기화 실패</Tag>
                      <Button variant="outlined" size="xs" style={{ color: 'var(--c-tag-warn-t)', borderColor: 'var(--c-tag-warn-t)' }}
                        onClick={() => syncMut.mutate(detail.id)} disabled={syncMut.isPending}>
                        {syncMut.isPending ? '재시도 중...' : '재시도'}
                      </Button>
                    </>
                  )}
                  {detail.redmineSyncStatus === 'SKIPPED' && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>미설정 (프로젝트키 또는 버전 없음)</span>}
                </div>
              )}
            </div>
          )}

          {/* 배포 단계 */}
          {detail.status === 'APPROVED' && deploySteps.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={s.infoSectionTitle}>배포 단계</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                {deploySteps.map((step, idx) => (
                  <Panel key={step.id} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    padding: '10px 14px',
                    ...(step.status === 'DONE' ? { background: 'var(--c-tag-done-bg)', borderColor: 'transparent' } : { background: 'var(--c-bg)' }),
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: step.status === 'DONE' ? 'var(--rsp-color-success-500)' : 'var(--c-card)',
                      border: step.status === 'DONE' ? 'none' : '2px solid var(--c-border-in)',
                      fontSize: 12, fontWeight: 700, color: step.status === 'DONE' ? 'var(--rsp-color-text-on-primary)' : 'var(--c-text-muted)',
                    }}>
                      {step.status === 'DONE' ? '✓' : idx + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <span style={{ fontSize: 13, fontWeight: 500 }}>{step.serverName}</span>
                      {step.status === 'DONE' && step.completedBy && (
                        <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginLeft: 8 }}>
                          {step.completedBy} · {step.completedAt?.slice(0, 16).replace('T', ' ')}
                        </span>
                      )}
                    </div>
                    {step.status === 'PENDING' && (isAdmin || managedSystemIds.includes(detail.systemId)) && (
                      <Button variant="outlined" size="xs" style={{ color: 'var(--c-tag-done-t)', borderColor: 'var(--c-tag-done-t)' }}
                        onClick={() => completeStepMut.mutate(step.id)}
                        disabled={completeStepMut.isPending}
                      >
                        배포 완료
                      </Button>
                    )}
                  </Panel>
                ))}
              </div>
            </div>
          )}
        </Panel>
      )}

      </>}

      {/* 일감 선택 모달 */}
      {showPicker && (
        <Modal open onClose={() => setShowPicker(false)} title="레드마인 일감 선택" width={720} dismissible>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ ...s.modalFilter, flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <Select
                  value={pickerTrackerId ?? ''}
                  onValueChange={v => {
                    setPickerTrackerId(v ? Number(v) : undefined)
                    setPickerStatus('')
                  }}
                  style={{ margin: 0, minWidth: 100 }}
                >
                  <option value="">전체 유형</option>
                  {trackerConfigs.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </Select>
                <Select
                  value={pickerStatus}
                  onValueChange={v => setPickerStatus(v)}
                  style={{ margin: 0, minWidth: 100 }}
                >
                  <option value="">전체 상태</option>
                  {pickerStatusOptions.map(st => (
                    <option key={st.id} value={String(st.id)}>{st.name}</option>
                  ))}
                </Select>
                <Input
                  value={pickerQuery}
                  onChange={e => setPickerQuery(e.target.value)}
                  placeholder="제목으로 검색..."
                  style={{ flex: 1, margin: 0 }}
                />
              </div>
            </div>
            <div style={s.modalBody}>
              {pickerAllIssues.length === 0 && pickerLoading ? (
                <Loading />
              ) : pickerFetchError ? (
                <div style={{ padding: 20 }}><Callout tone="danger">오류: {pickerFetchError}</Callout></div>
              ) : filteredIssues.length === 0 ? (
                <EmptyState title="일감이 없습니다" />
              ) : (
                <>
                  <div style={{ padding: '6px 20px', fontSize: 12, color: 'var(--c-text-muted)', background: 'var(--c-bg)', borderBottom: '1px solid var(--c-thead)' }}>
                    {filteredIssues.length}개 표시{pickerAllIssues.length < pickerAllTotal ? ` (서버 ${pickerAllTotal}개 중 ${pickerAllIssues.length}개 로드됨)` : ''}
                  </div>
                  {filteredIssues.map(issue => {
                    const checked = pickerDraft.some(i => i.redmineIssueId === issue.id)
                    return (
                      <div key={issue.id} onClick={() => togglePickerIssue(issue)}
                        style={{ ...s.issueRow, background: checked ? 'var(--c-tag-done-bg)' : undefined }}>
                        {/* 시각적 상태만 표시 — 클릭은 행(onClick)에서 1회 토글 */}
                        <Checkbox checked={checked} tabIndex={-1} aria-hidden style={{ pointerEvents: 'none', flexShrink: 0 }} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{ color: 'var(--c-action)', fontWeight: 600, marginRight: 8, fontSize: 13 }}>#{issue.id}</span>
                          <span style={{ fontSize: 13 }}>{issue.subject}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                          {issue.trackerName && (
                            <Tag tone="info">{issue.trackerName}</Tag>
                          )}
                          {issue.statusName && (
                            <Tag color="var(--c-text-sub)" bg="var(--c-thead)">{issue.statusName}</Tag>
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
                      <Button variant="outlined" onClick={loadMoreAllIssues} disabled={pickerLoading}>
                        {pickerLoading ? '불러오는 중...' : `더 불러오기 (${pickerAllTotal - pickerAllIssues.length}개 남음)`}
                      </Button>
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
                <Button variant="outlined" onClick={() => setShowPicker(false)}>취소</Button>
                <Button variant="filled" onClick={confirmPicker}>
                  선택 완료 {pickerDraft.length > 0 && `(${pickerDraft.length}개)`}
                </Button>
              </div>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}

// ── 페이지네이션 헬퍼 ────────────────────────────────────────────────────────

function buildPageNums(current: number, total: number): (number | '...')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let p = Math.max(2, current - 1); p <= Math.min(total - 1, current + 1); p++) pages.push(p)
  if (current < total - 2) pages.push('...')
  pages.push(total)
  return pages
}

// 페이지 이동 불가(처음/끝) 상태의 이전/다음 링크
const disabledLinkStyle: React.CSSProperties = { pointerEvents: 'none', opacity: 0.4 }

const SUB_COLORS = [
  { bg: 'var(--c-tag-sys)', text: 'var(--c-tag-sys-t)' },
  { bg: 'var(--c-tag-pri-bg)', text: 'var(--c-tag-pri-t)' },
  { bg: 'var(--c-tag-done-bg)', text: 'var(--c-tag-done-t)' },
  { bg: 'var(--c-tag-warn-bg)', text: 'var(--c-tag-warn-t)' },
  { bg: 'var(--c-tag-err-bg)', text: 'var(--c-tag-err-t)' },
  { bg: 'var(--c-tag-teal-bg)', text: 'var(--c-tag-teal-t)' },
  { bg: 'var(--c-tag-draft-bg)', text: 'var(--c-tag-draft-t)' },
  { bg: 'color-mix(in srgb, var(--c-chart-7) 15%, transparent)', text: 'var(--c-chart-7)' },
]
// 하위시스템 태그 — 이름 해시로 색상 고정
function SubTag({ name }: { name: string }) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  const { bg, text } = SUB_COLORS[Math.abs(hash) % SUB_COLORS.length]
  return <Tag color={text} bg={bg} style={{ marginLeft: 4 }}>{name}</Tag>
}

// 상세/배포경로의 범위 태그 색상 (전점 / 일부점)
const SCOPE_TAG: Record<DeployScope, { bg: string; color: string }> = {
  FULL:    { bg: 'var(--c-tag-sys)', color: 'var(--c-tag-sys-t)' },
  PARTIAL: { bg: 'var(--c-tag-sub)', color: 'var(--c-tag-sub-t)' },
}

function actionStyle(status: RequestStatus): React.CSSProperties {
  if (status === 'APPROVED') return { color: 'var(--c-tag-done-t)', borderColor: 'var(--c-tag-done-t)' }
  if (status === 'COMPLETED') return { color: 'var(--c-tag-teal-t)', borderColor: 'var(--c-tag-teal-t)' }
  return {}
}

function ScheduledCell({ scheduledAt, rowStatus }: { scheduledAt: string | null | undefined; rowStatus: RequestStatus }) {
  if (!scheduledAt) return <span style={{ color: 'var(--c-text-muted)' }}>-</span>
  const date = new Date(scheduledAt)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(date); target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const isDone = rowStatus === 'COMPLETED' || rowStatus === 'REJECTED'
  let label: string, bg: string, color: string
  if (isDone || diff < 0) {
    label = diff < 0 ? `D+${Math.abs(diff)}` : '완료'
    bg = 'var(--c-tag-draft-bg)'; color = 'var(--c-tag-draft-t)'
  } else if (diff === 0) {
    label = 'D-day'
    bg = 'var(--c-tag-err-bg)'; color = 'var(--c-tag-err-t)'
  } else if (diff <= 3) {
    label = `D-${diff}`
    bg = 'var(--c-tag-warn-bg)'; color = 'var(--c-tag-warn-t)'
  } else {
    label = `D-${diff}`
    bg = 'var(--c-tag-sys)'; color = 'var(--c-tag-sys-t)'
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 3 }}>
      <span style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{mm}/{dd}</span>
      <Tag color={color} bg={bg}>{label}</Tag>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  btn: { padding: '8px 16px', background: 'var(--c-action)', color: 'var(--rsp-color-text-on-primary)', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSecondary: { padding: '8px 16px', background: 'var(--c-card)', color: 'var(--c-text-sub)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnOutline: { padding: '6px 14px', background: 'var(--c-card)', color: 'var(--c-action)', border: '1px dashed var(--c-action)', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid var(--c-border-in)', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  card: { display: 'block', padding: 24, marginBottom: 16 },
  formTitle: { fontSize: 16, fontWeight: 600, marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'start', marginBottom: 16 },
  formActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--c-text-sub)', paddingTop: 8 },
  filterRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  badge: { background: 'color-mix(in srgb, var(--rsp-color-text-on-primary) 25%, transparent)', borderRadius: 10, padding: '0 5px', fontSize: 11 },
  tableWrap: { display: 'block', padding: 0, overflow: 'hidden', marginBottom: 16 },
  th: { textAlign: 'left' as const },
  actions: { display: 'flex', alignItems: 'center' },
  detailGrid: { display: 'grid', gridTemplateColumns: '80px 1fr 80px 1fr', gap: '10px 16px', fontSize: 13 },
  detailLabel: { color: 'var(--c-text-muted)', fontSize: 12, fontWeight: 500 },
  infoSection: { background: 'var(--c-bg)', borderRadius: 8, padding: '14px 16px' },
  infoSectionTitle: { fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 10 },
  contentPanel: { background: 'var(--c-bg)', padding: '12px 16px', marginTop: 8 },
  contentPre: { margin: 0, fontSize: 13, whiteSpace: 'pre-wrap' as const, fontFamily: 'inherit' },
  modalFilter: { padding: '12px 20px', borderBottom: '1px solid var(--c-thead)', display: 'flex', gap: 10, alignItems: 'center' },
  tabBtn: { padding: '5px 14px', border: '1px solid var(--c-border-in)', borderRadius: 20, cursor: 'pointer', fontSize: 12, background: 'var(--c-card)', color: 'var(--c-text-sub)' },
  tabBtnActive: { background: 'var(--c-action)', color: 'var(--rsp-color-text-on-primary)', borderColor: 'var(--c-action)' },
  modalBody: { flex: 1, overflowY: 'auto' as const },
  issueRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--c-thead)', cursor: 'pointer' },
  modalFooter: { padding: '12px 20px', borderTop: '1px solid var(--c-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
}

const MONTHS_KR = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const STATUSES: RequestStatus[] = ['DRAFT','REQUESTED','APPROVED','COMPLETED','REJECTED']
const STATUS_LABELS: Record<RequestStatus, string> = { DRAFT:'임시저장', REQUESTED:'요청', APPROVED:'승인', COMPLETED:'완료', REJECTED:'반려' }
const STATUS_COLORS: Record<RequestStatus, string> = { DRAFT:'var(--c-text-muted)', REQUESTED:'var(--c-tag-sys-t)', APPROVED:'var(--c-tag-done-t)', COMPLETED:'var(--c-tag-teal-t)', REJECTED:'var(--c-tag-err-t)' }
const STATUS_BG: Record<RequestStatus, string>     = { DRAFT:'var(--c-thead)', REQUESTED:'var(--c-tag-sys)', APPROVED:'var(--c-tag-done-bg)', COMPLETED:'var(--c-tag-teal-bg)', REJECTED:'var(--c-tag-err-bg)' }
const TYPE_LABELS: Record<string, string>  = { RELEASE:'릴리즈', HOTFIX:'핫픽스', ROLLBACK:'롤백', PATCH:'패치' }
const TYPE_COLORS: Record<string, string>  = { RELEASE:'var(--c-tag-sys-t)', HOTFIX:'var(--c-tag-err-t)', ROLLBACK:'var(--c-tag-warn-t)', PATCH:'var(--c-tag-done-t)' }

function DeployDashboard({ requests }: { requests: import('../../api/deployRequests').DeployRequest[] }) {
  const now = new Date()
  const [selYear, setSelYear] = useState(now.getFullYear())
  const [selMonth, setSelMonth] = useState<number | 'all'>('all')
  const [selSystem, setSelSystem] = useState<string | null>(null)

  const years = [...new Set([now.getFullYear(), ...requests.map(r => new Date(r.createdAt).getFullYear())])].sort((a, b) => b - a)

  const inPeriod = (r: import('../../api/deployRequests').DeployRequest) => {
    const d = new Date(r.createdAt)
    if (d.getFullYear() !== selYear) return false
    if (selMonth !== 'all' && d.getMonth() + 1 !== selMonth) return false
    return true
  }
  const filtered = requests.filter(inPeriod)

  const SYS_COLORS = ['var(--c-chart-1)','var(--c-chart-4)','var(--c-chart-3)','var(--c-chart-2)','var(--c-chart-5)','var(--c-chart-7)','var(--c-chart-6)','var(--c-chart-8)']
  const systemsInYear = [...new Set(requests.filter(r => new Date(r.createdAt).getFullYear() === selYear).map(r => r.systemName))].sort()
  const systemMonthlyData = systemsInYear.map((sysName, si) => ({
    name: sysName,
    color: SYS_COLORS[si % SYS_COLORS.length],
    counts: Array.from({ length: 12 }, (_, i) => {
      const m = i + 1
      return requests.filter(r => r.systemName === sysName && r.status === 'COMPLETED' && new Date(r.createdAt).getFullYear() === selYear && new Date(r.createdAt).getMonth() + 1 === m).length
    })
  }))

  const bySystem = Object.entries(filtered.reduce((acc, r) => { acc[r.systemName] = (acc[r.systemName] || 0) + 1; return acc }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])
  const byType   = Object.entries(filtered.reduce((acc, r) => { if (r.deployType) acc[r.deployType] = (acc[r.deployType] || 0) + 1; return acc }, {} as Record<string, number>)).sort((a, b) => b[1] - a[1])

  // 시스템 선택 시 하위 시스템별 드릴다운
  const bySubSystem = selSystem
    ? Object.entries(
        filtered
          .filter(r => r.systemName === selSystem)
          .reduce((acc, r) => {
            const key = r.subSystemName ?? '(공통)'
            acc[key] = (acc[key] || 0) + 1
            return acc
          }, {} as Record<string, number>)
      ).sort((a, b) => b[1] - a[1])
    : []
  const drillData = selSystem ? bySubSystem : bySystem
  const maxDrill  = Math.max(...drillData.map(([, n]) => n), 1)

  return (
    <div>
      {/* 필터 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <Select value={selYear} onValueChange={v => { setSelYear(Number(v)); setSelMonth('all') }}>
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </Select>
        <Select value={selMonth} onValueChange={v => setSelMonth(v === 'all' ? 'all' : Number(v))}>
          <option value="all">전체 월</option>
          {MONTHS_KR.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
        </Select>
        {selMonth !== 'all' && (
          <Button variant="text" size="xs" onClick={() => setSelMonth('all')}>✕ 초기화</Button>
        )}
        <span style={{ fontSize: 13, color: 'var(--c-text-muted)', marginLeft: 4 }}>총 {filtered.length}건</span>
      </div>

      {/* 상태 카드 */}
      <div className="deploy-stat-grid">
        <Panel style={{ display: 'block', padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 6, fontWeight: 600 }}>전체</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{filtered.length}</div>
        </Panel>
        {STATUSES.map(s => (
          <Panel key={s} style={{ display: 'block', padding: '16px 20px', background: STATUS_BG[s], borderColor: 'transparent' }}>
            <div style={{ fontSize: 11, color: STATUS_COLORS[s], marginBottom: 6, fontWeight: 600 }}>{STATUS_LABELS[s]}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: STATUS_COLORS[s] }}>{filtered.filter(r => r.status === s).length}</div>
          </Panel>
        ))}
      </div>

      {/* 월별 시스템별 완료 현황 */}
      {systemMonthlyData.length > 0 && (
        <Panel style={{ display: 'block', padding: 20, marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 14 }}>
            월별 시스템별 배포 완료 현황 ({selYear}년)
          </div>
          <SystemMonthlyLineChart systems={systemMonthlyData} selMonth={selMonth} onClickMonth={m => setSelMonth(selMonth === m ? 'all' : m)} />
        </Panel>
      )}

      {/* 시스템별 + 유형별 */}
      <div className="deploy-chart-grid">
        <Panel style={{ display: 'block', padding: 20 }}>
          {/* 헤더 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {selSystem && (
                <Button variant="outlined" size="xs" onClick={() => setSelSystem(null)}>← 전체</Button>
              )}
              <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                {selSystem ? `${selSystem} · 하위 시스템` : `시스템별`}
                {selMonth !== 'all' ? ` (${selMonth}월)` : ''}
              </span>
            </div>
            {/* 시스템 선택 드롭다운 */}
            <Select
              value={selSystem ?? ''}
              onValueChange={v => setSelSystem(v || null)}
            >
              <option value="">전체 시스템</option>
              {bySystem.map(([name]) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </Select>
          </div>

          {drillData.length === 0 ? (
            <EmptyState title="데이터 없음" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {drillData.map(([name, count], i) => {
                const barColor = selSystem
                  ? SYS_COLORS[i % SYS_COLORS.length]
                  : 'var(--c-action)'
                const isClickable = !selSystem
                return (
                  <div
                    key={name}
                    onClick={() => isClickable && setSelSystem(name)}
                    style={{ cursor: isClickable ? 'pointer' : 'default' }}
                    title={isClickable ? `${name} 하위 시스템 보기` : undefined}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                      <span style={{ color: isClickable ? 'var(--c-text)' : 'var(--c-text-sub)' }}>
                        {name}
                        {isClickable && <span style={{ fontSize: 11, color: 'var(--c-text-muted)', marginLeft: 5 }}>▶</span>}
                      </span>
                      <span style={{ fontWeight: 600 }}>{count}건</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: 'var(--c-bg)' }}>
                      <div style={{ height: '100%', borderRadius: 3, background: barColor, width: `${(count / maxDrill) * 100}%`, transition: 'width 0.3s' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
        <Panel style={{ display: 'block', padding: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 16 }}>
            배포 유형별{selMonth !== 'all' ? ` (${selMonth}월)` : ''}
          </div>
          {byType.length === 0 ? <EmptyState title="데이터 없음" /> : (
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {byType.map(([type, count]) => (
                <div key={type} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Tag color={TYPE_COLORS[type]}>{TYPE_LABELS[type] ?? type}</Tag>
                  <span style={{ fontWeight: 700, fontSize: 24 }}>{count}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}


function SystemMonthlyLineChart({
  systems, selMonth, onClickMonth,
}: {
  systems: { name: string; color: string; counts: number[] }[]
  selMonth: number | 'all'
  onClickMonth: (m: number) => void
}) {
  // 시스템명은 CSS 변수명으로 쓸 수 없으므로 sys0, sys1 ... 키 사용 (라벨에 시스템명)
  const config: ChartConfig = Object.fromEntries(
    systems.map((sys, i) => [`sys${i}`, { label: sys.name, color: sys.color }])
  )
  // 월별 행 데이터: { label: '1월', sys0: n, sys1: n, ... }
  const data = Array.from({ length: 12 }, (_, i) => {
    const row: Record<string, string | number> = { label: `${i + 1}월` }
    systems.forEach((sys, si) => { row[`sys${si}`] = sys.counts[i] })
    return row
  })

  return (
    <ChartContainer config={config} style={{ width: '100%', height: 210, aspectRatio: 'auto' }}>
      <LineChart
        data={data}
        margin={{ top: 12, right: 16, bottom: 0, left: -12 }}
        cursor="pointer"
        onClick={state => {
          // 클릭한 위치의 월 선택/해제
          if (state?.activeTooltipIndex == null) return
          const idx = Number(state.activeTooltipIndex)
          if (!isNaN(idx)) onClickMonth(idx + 1)
        }}
      >
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          interval={0}
          tick={p => {
            // 선택된 월 라벨 강조
            const isSelected = selMonth === p.index + 1
            return (
              <text x={p.x} y={p.y} dy={12} textAnchor="middle" fontSize={10}
                fill={isSelected ? 'var(--c-text)' : 'var(--c-text-muted)'}
                fontWeight={isSelected ? 700 : 400}>
                {p.payload.value}
              </text>
            )
          }}
        />
        <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={9} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        {selMonth !== 'all' && (
          <ReferenceLine x={`${selMonth}월`} stroke="var(--c-text)" strokeDasharray="3 3" strokeOpacity={0.3} />
        )}
        {systems.map((_, i) => (
          <Line
            key={i}
            dataKey={`sys${i}`}
            type="linear"
            stroke={`var(--color-sys${i})`}
            strokeWidth={2}
            strokeOpacity={0.85}
            isAnimationActive={false}
            // 0건인 달은 점 생략 (기존 SVG 차트 동작 유지)
            dot={p => p.value > 0
              ? <circle key={p.index} cx={p.cx} cy={p.cy} r={3.5} fill={`var(--color-sys${i})`} fillOpacity={0.9} />
              : null}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
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
        const lineColor = nextStep?.rejected ? 'var(--rsp-color-error-500)' : (nextStep?.done ? 'var(--c-action)' : 'var(--c-border)')
        const circleColor = step.rejected ? 'var(--rsp-color-error-500)' : step.done ? 'var(--c-action)' : 'transparent'
        const circleBorder = step.done || step.rejected ? 'none' : '2px solid var(--c-border)'
        const textColor = step.rejected ? 'var(--c-tag-err-t)' : step.done ? 'var(--c-text)' : 'var(--c-text-muted)'
        return (
          <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', flex: idx < steps.length - 1 ? 1 : 'initial' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 70 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: circleColor, border: circleBorder, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: step.done || step.rejected ? 'var(--rsp-color-text-on-primary)' : 'var(--c-text-muted)', fontWeight: 700, flexShrink: 0 }}>
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
