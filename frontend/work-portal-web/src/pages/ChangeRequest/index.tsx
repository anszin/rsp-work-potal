import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import {
  getChangeRequests, createChangeRequest, updateChangeRequest,
  changeRequestStatus, deleteChangeRequest, buildPayload, downloadAttachment, syncRedmineForCR,
  type ChangeRequest, type RequestStatus, type CreateChangeRequest,
} from '../../api/changeRequests'
import { getActiveSystems, getManagedSystemIds, getActiveSubSystems, getSystemManagers, type SystemManager } from '../../api/systems'
import { fetchRedmineTrackers, type RedmineTrackerConfig } from '../../api/redmine'
import { useAuth } from '../../context/useAuth'
import StatusBadge from '../../components/StatusBadge'

const STATUS_LABELS: Record<RequestStatus, string> = {
  DRAFT: '임시저장', REQUESTED: '요청', APPROVED: '승인', COMPLETED: '완료', REJECTED: '반려',
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

const emptyForm: CreateChangeRequest = { systemId: 0, subSystemId: null, title: '', content: '', requesterDept: '', requesterName: '', targetDate: '', attachmentLink: '', redmineTrackerId: null, redmineAssigneeId: null }

function apiError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return e.response.data.error
  return e instanceof Error ? e.message : String(e)
}

export default function ChangeRequestPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [tab, setTab] = useState<'list' | 'dashboard'>('list')
  const [editing, setEditing] = useState<ChangeRequest | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateChangeRequest>(emptyForm)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [actionModal, setActionModal] = useState<{ id: number; next: RequestStatus } | null>(null)
  const [actionComment, setActionComment] = useState('')
  const [pasteHighlight, setPasteHighlight] = useState(false)
  const [detail, setDetail] = useState<ChangeRequest | null>(null)
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'ALL'>('ALL')

  useEffect(() => {
    if (!showForm) return
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items
      if (!items) return
      for (const item of Array.from(items)) {
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile()
          if (!blob) break
          const ext = item.type.split('/')[1] ?? 'png'
          const named = new File([blob], `capture_${Date.now()}.${ext}`, { type: item.type })
          setPendingFile(named)
          if (fileRef.current) fileRef.current.value = ''
          setPasteHighlight(true)
          setTimeout(() => setPasteHighlight(false), 1200)
          break
        }
      }
    }
    window.addEventListener('paste', handlePaste)
    return () => window.removeEventListener('paste', handlePaste)
  }, [showForm])

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['change-requests'],
    queryFn: () => getChangeRequests(),
  })
  const { data: systems = [] } = useQuery({
    queryKey: ['systems', 'active'],
    queryFn: getActiveSystems,
  })
  const { data: subSystems = [] } = useQuery({
    queryKey: ['subsystems', 'active', form.systemId],
    queryFn: () => getActiveSubSystems(form.systemId),
    enabled: showForm && form.systemId > 0,
  })
  const { data: managedSystemIds = [] } = useQuery({
    queryKey: ['systems', 'managed'],
    queryFn: getManagedSystemIds,
  })
  const { data: trackerConfigs = [] } = useQuery<RedmineTrackerConfig[]>({
    queryKey: ['redmine-trackers'],
    queryFn: fetchRedmineTrackers,
  })
  const selectedSystem = systems.find(s => s.id === form.systemId)
  const { data: systemManagers = [] } = useQuery<SystemManager[]>({
    queryKey: ['system-managers', form.systemId],
    queryFn: () => getSystemManagers(form.systemId),
    enabled: showForm && form.systemId > 0,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['change-requests'] })

  const createMut = useMutation({
    mutationFn: createChangeRequest,
    onSuccess: () => { invalidate(); closeForm() },
    onError: (e: unknown) => alert('저장 실패: ' + apiError(e)),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateChangeRequest }) => updateChangeRequest(id, data),
    onSuccess: () => { invalidate(); closeForm() },
    onError: (e: unknown) => alert('수정 실패: ' + apiError(e)),
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status, comment }: { id: number; status: RequestStatus; comment?: string }) =>
      changeRequestStatus(id, status, comment),
    onSuccess: () => { invalidate(); setDetail(null) },
    onError: (e: unknown) => alert('상태 변경 실패: ' + apiError(e)),
  })
  const deleteMut = useMutation({
    mutationFn: deleteChangeRequest,
    onSuccess: () => { invalidate(); setDetail(null) },
    onError: (e: unknown) => alert('삭제 실패: ' + apiError(e)),
  })
  const syncCRMut = useMutation({
    mutationFn: syncRedmineForCR,
    onSuccess: (updated) => { invalidate(); setDetail(updated) },
    onError: (e: unknown) => alert('재동기화 실패: ' + apiError(e)),
  })

  const defaultTrackerId = (sysId: number) => {
    const sys = systems.find(s => s.id === sysId)
    return sys?.redmineProjectKey ? (trackerConfigs[0]?.id ?? null) : null
  }

  const openCreate = () => {
    setEditing(null)
    const sysId = systems[0]?.id ?? 0
    setForm({
      ...emptyForm,
      systemId: sysId,
      subSystemId: null,
      requesterName: user?.name || '',
      requesterDept: user?.dept || '',
      redmineTrackerId: defaultTrackerId(sysId),
    })
    setShowForm(true)
    setDetail(null)
  }

  const openEdit = (r: ChangeRequest) => {
    setEditing(r)
    setForm({ systemId: r.systemId, subSystemId: r.subSystemId, title: r.title, content: r.content ?? '', requesterDept: r.requesterDept ?? '', requesterName: r.requesterName ?? '', targetDate: r.targetDate ?? '', attachmentLink: r.attachmentLink ?? '', redmineTrackerId: r.redmineTrackerId ?? null, redmineAssigneeId: r.redmineAssigneeId ?? null })
    setPendingFile(null)
    setShowForm(true)
    setDetail(null)
  }

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); setPendingFile(null); if (fileRef.current) fileRef.current.value = '' }

  const submit = async () => {
    if (!form.title || !form.systemId) return
    if (selectedSystem?.redmineProjectKey && !form.redmineTrackerId) {
      alert('요청유형을 선택해주세요.')
      return
    }
    const base = { ...form, targetDate: form.targetDate || undefined }
    const data = await buildPayload(base, pendingFile)
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER'
  const canManage = (systemId: number) => isAdminOrManager || managedSystemIds.includes(systemId)

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

  const handleStatus = (r: ChangeRequest, next: RequestStatus) => {
    if (next === 'REQUESTED') { statusMut.mutate({ id: r.id, status: next }); return }
    setActionModal({ id: r.id, next })
    setActionComment('')
  }

  const isPending = createMut.isPending || updateMut.isPending

  const filtered = statusFilter === 'ALL' ? requests : requests.filter(r => r.status === statusFilter)

  return (
    <div style={s.page}>
      {/* 액션 코멘트 모달 */}
      {actionModal && (() => {
        const cfg = ACTION_MODAL_CONFIG[actionModal.next]!
        return (
          <div style={s.overlay}>
            <div style={s.modal}>
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

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>변경 관리</h2>
          <div style={{ display: 'flex', gap: 20 }}>
            {(['list', 'dashboard'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '4px 0', border: 'none', borderBottom: `2px solid ${tab === t ? '#1a1a2e' : 'transparent'}`, background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: tab === t ? 600 : 400, color: tab === t ? 'var(--c-text)' : 'var(--c-text-muted)' }}>
                {t === 'list' ? '목록' : '현황'}
              </button>
            ))}
          </div>
        </div>
        {tab === 'list' && <button style={s.btn} onClick={openCreate}>+ 새 요청</button>}
      </div>

      {tab === 'dashboard' && <ChangeRequestDashboard requests={requests} />}

      {tab === 'list' && <>
      {/* 등록/수정 폼 */}
      {showForm && (
        <div style={s.card}>
          <h3 style={s.formTitle}>{editing ? '요청 수정' : '새 변경 요청'}</h3>
          <div style={s.formGrid}>
            <label style={s.label}>운영시스템 *</label>
            <select style={s.input} value={form.systemId} onChange={(e) => {
              const sysId = Number(e.target.value)
              setForm({ ...form, systemId: sysId, subSystemId: null, redmineTrackerId: defaultTrackerId(sysId), redmineAssigneeId: null })
            }}>
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
            <input style={s.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="변경 요청 제목" />
            <label style={s.label}>요청부서</label>
            <input style={s.input} value={form.requesterDept ?? ''} onChange={(e) => setForm({ ...form, requesterDept: e.target.value })} placeholder="요청 부서명" />
            <label style={s.label}>요청자명</label>
            <input style={s.input} value={form.requesterName ?? ''} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} placeholder="요청자 이름" />
            {selectedSystem?.redmineProjectKey && (
              <>
                <label style={s.label}>요청유형 *</label>
                <select style={s.input} value={form.redmineTrackerId ?? ''} onChange={e => setForm({ ...form, redmineTrackerId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="" disabled>선택하세요</option>
                  {trackerConfigs.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
                <label style={s.label}>메인 담당자</label>
                <select style={s.input} value={form.redmineAssigneeId ?? ''} onChange={e => setForm({ ...form, redmineAssigneeId: e.target.value ? Number(e.target.value) : null })}>
                  <option value="">선택 안함</option>
                  {systemManagers.filter(m => m.redmineUserId != null).map(m => (
                    <option key={m.userId} value={m.redmineUserId!}>{m.name ?? m.username}</option>
                  ))}
                  {systemManagers.filter(m => m.redmineUserId == null).length > 0 && (
                    <optgroup label="레드마인 ID 미설정">
                      {systemManagers.filter(m => m.redmineUserId == null).map(m => (
                        <option key={m.userId} disabled>{m.name ?? m.username} (ID 없음)</option>
                      ))}
                    </optgroup>
                  )}
                </select>
              </>
            )}
            <label style={s.label}>반영 목표일</label>
            <input type="date" style={s.input} value={form.targetDate ?? ''} onChange={(e) => setForm({ ...form, targetDate: e.target.value || undefined })} />
            <label style={s.label}>링크 첨부</label>
            <input style={s.input} value={form.attachmentLink ?? ''} onChange={(e) => setForm({ ...form, attachmentLink: e.target.value })} placeholder="https://..." />
            <label style={s.label}>파일 첨부</label>
            <div>
              {editing?.hasAttachment && !pendingFile && (
                <div style={{ marginBottom: 6, fontSize: 12, color: 'var(--c-text-sub)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>현재 첨부: <strong>{editing.attachmentOriginalName ?? '파일'}</strong></span>
                  <button onClick={() => downloadAttachment(editing.id, editing.attachmentOriginalName ?? '파일')}
                    style={{ fontSize: 11, border: 'none', background: 'none', color: '#1976d2', cursor: 'pointer', padding: 0 }}>
                    다운로드
                  </button>
                  <span style={{ color: 'var(--c-text-muted)' }}>|</span>
                  <span style={{ color: 'var(--c-text-muted)', fontSize: 11 }}>새 파일 선택 시 교체됩니다</span>
                </div>
              )}
              <input ref={fileRef} type="file" style={{ ...s.input, marginBottom: 6 }}
                onChange={(e) => { setPendingFile(e.target.files?.[0] ?? null) }} />
              <div style={{
                padding: '8px 12px', border: `2px dashed ${pasteHighlight ? '#1976d2' : 'var(--c-border-in)'}`,
                borderRadius: 6, fontSize: 12, color: pasteHighlight ? '#1976d2' : 'var(--c-text-muted)',
                background: pasteHighlight ? '#e3f2fd' : 'var(--c-bg)', transition: 'all 0.3s', userSelect: 'none',
              }}>
                {pendingFile?.name.startsWith('capture_')
                  ? `📋 붙여넣기됨: ${pendingFile.name}`
                  : 'Ctrl+V 로 캡쳐 이미지 붙여넣기'}
              </div>
              {pendingFile && (
                <div style={{ marginTop: 4, fontSize: 12, color: 'var(--c-text-sub)' }}>
                  선택된 파일: <strong>{pendingFile.name}</strong>
                  <button onClick={() => { setPendingFile(null); if (fileRef.current) fileRef.current.value = '' }}
                    style={{ marginLeft: 8, fontSize: 11, border: 'none', background: 'none', color: '#e53e3e', cursor: 'pointer' }}>
                    ✕ 제거
                  </button>
                </div>
              )}
            </div>
            <label style={s.label}>내용</label>
            <textarea style={{ ...s.input, height: 100, resize: 'vertical' }} value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="변경 내용을 입력하세요" />
          </div>
          <div style={s.formActions}>
            <button style={s.btnSecondary} onClick={closeForm} disabled={isPending}>취소</button>
            <button style={{ ...s.btn, opacity: isPending ? 0.6 : 1 }} onClick={submit} disabled={isPending}>
              {isPending ? '저장 중...' : '저장'}
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
                <th style={s.th}>요청번호</th>
                <th style={s.th}>시스템</th>
                <th style={s.th}>요청부서</th>
                <th style={s.th}>요청자</th>
                <th style={{ ...s.th, width: '22%' }}>제목</th>
                <th style={s.th}>상태</th>
                <th style={s.th}>반영 목표일</th>
                <th style={s.th}>첨부</th>
                <th style={s.th}>생성일</th>
                <th style={s.th}>액션</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={10} style={s.empty}>등록된 요청이 없습니다</td></tr>
              )}
              {filtered.map((r) => (
                <tr key={r.id} style={{ ...s.tr, cursor: 'pointer', background: detail?.id === r.id ? 'var(--c-row-sel)' : undefined }}
                  onClick={() => setDetail(detail?.id === r.id ? null : r)}>
                  <td style={{ ...s.td, fontWeight: 600, color: 'var(--c-text)', whiteSpace: 'nowrap' }}>{r.requestNo ?? '-'}</td>
                  <td style={s.td}>
                    <span style={s.sysTag}>{r.systemName}</span>
                    {r.subSystemName && <span style={{ ...s.sysTag, background: 'var(--c-tag-sub)', color: 'var(--c-tag-sub-t)', marginLeft: 4 }}>{r.subSystemName}</span>}
                  </td>
                  <td style={s.td}>{r.requesterDept ?? '-'}</td>
                  <td style={s.td}>{r.requesterName ?? r.requesterUsername}</td>
                  <td style={s.td}>{r.title}</td>
                  <td style={s.td}>
                    <StatusBadge status={r.status} />
                    {r.status === 'REJECTED' && r.rejectionReason && (
                      <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 2 }}>
                        사유: {r.rejectionReason.length > 20 ? r.rejectionReason.slice(0, 20) + '…' : r.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td style={s.td}>{r.targetDate ?? '-'}</td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.hasAttachment && (
                        <button onClick={() => downloadAttachment(r.id, r.attachmentOriginalName ?? '파일')}
                          style={{ fontSize: 12, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          📎 {r.attachmentOriginalName ?? '파일'}
                        </button>
                      )}
                      {r.attachmentLink && (
                        <a href={r.attachmentLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#7b1fa2' }}>🔗 링크</a>
                      )}
                      {!r.hasAttachment && !r.attachmentLink && <span style={{ color: '#ccc', fontSize: 12 }}>-</span>}
                    </div>
                  </td>
                  <td style={s.td}>{r.createdAt?.slice(0, 10)}</td>
                  <td style={s.td} onClick={e => e.stopPropagation()}>
                    <div style={s.actions}>
                      {r.status === 'DRAFT' && (
                        <button style={s.btnSm} onClick={() => openEdit(r)}>수정</button>
                      )}
                      {NEXT_STATUS[r.status]?.map(({ label, next }) => {
                        if (next === 'REQUESTED') return (
                          <button key={next} style={{ ...s.btnSm, ...actionStyle(next) }}
                            onClick={() => handleStatus(r, next)}>{label}</button>
                        )
                        if (canManage(r.systemId)) return (
                          <button key={next} style={{ ...s.btnSm, ...actionStyle(next) }}
                            onClick={() => handleStatus(r, next)}>{label}</button>
                        )
                        return null
                      })}
                      {(r.status === 'DRAFT' || isAdminOrManager) && (
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
      {detail && tab === 'list' && (
        <div style={s.card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <span style={s.sysTag}>{detail.systemCode}</span>
              {detail.subSystemName && <span style={{ ...s.sysTag, background: 'var(--c-tag-sub)', color: 'var(--c-tag-sub-t)', marginLeft: 4 }}>{detail.subSystemName}</span>}
              <span style={{ marginLeft: 8, fontWeight: 600, fontSize: 15 }}>{detail.title}</span>
              {detail.requestNo && <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--c-text-muted)' }}>{detail.requestNo}</span>}
            </div>
            <button style={{ ...s.btnSecondary, fontSize: 12, padding: '4px 10px' }} onClick={() => setDetail(null)}>닫기</button>
          </div>
          <div style={s.detailGrid}>
            <span style={s.detailLabel}>상태</span><span>{STATUS_LABELS[detail.status]}</span>
            <span style={s.detailLabel}>요청부서</span><span>{detail.requesterDept ?? '-'}</span>
            <span style={s.detailLabel}>요청자</span><span>{detail.requesterName ?? detail.requesterUsername}</span>
            <span style={s.detailLabel}>반영 목표일</span><span>{detail.targetDate ?? '-'}</span>
            <span style={s.detailLabel}>요청일시</span><span>{detail.requestedAt?.slice(0, 16).replace('T', ' ') ?? '-'}</span>
            <span style={s.detailLabel}>승인일시</span><span>{detail.approvedAt?.slice(0, 16).replace('T', ' ') ?? '-'}</span>
            <span style={s.detailLabel}>완료일시</span><span>{detail.completedAt?.slice(0, 16).replace('T', ' ') ?? '-'}</span>
            <span style={s.detailLabel}>등록일</span><span>{detail.createdAt?.slice(0, 10)}</span>
          </div>
          {(detail.actionComment || detail.rejectionReason) && (
            <div style={{ marginTop: 12 }}>
              <div style={s.detailLabel}>{detail.status === 'REJECTED' ? '반려 사유' : '첨언'}</div>
              <pre style={s.contentBox}>{detail.actionComment || detail.rejectionReason}</pre>
            </div>
          )}
          {(detail.content) && (
            <div style={{ marginTop: 16 }}>
              <div style={s.detailLabel}>내용</div>
              <pre style={s.contentBox}>{detail.content}</pre>
            </div>
          )}
          {(detail.hasAttachment || detail.attachmentLink) && (
            <div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
              <span style={s.detailLabel}>첨부</span>
              {detail.hasAttachment && (
                <button onClick={() => downloadAttachment(detail.id, detail.attachmentOriginalName ?? '파일')}
                  style={{ fontSize: 13, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  📎 {detail.attachmentOriginalName ?? '파일'} 다운로드
                </button>
              )}
              {detail.attachmentLink && (
                <a href={detail.attachmentLink} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: '#7b1fa2' }}>🔗 링크 열기</a>
              )}
            </div>
          )}

          {/* 레드마인 일감 */}
          {(detail.redmineIssues?.length > 0 || detail.redmineSyncStatus) && (
            <div style={{ marginTop: 14 }}>
              <div style={s.detailLabel}>레드마인 일감</div>
              {detail.redmineIssues?.length > 0 && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 6, marginBottom: detail.redmineSyncStatus ? 8 : 0 }}>
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
                  {detail.redmineSyncStatus === 'SYNCED' && <span style={{ fontSize: 12, color: '#276749', background: '#F0FFF4', border: '1px solid #C6F6D5', padding: '2px 8px', borderRadius: 4 }}>일감 등록 완료</span>}
                  {detail.redmineSyncStatus === 'FAILED' && (
                    <>
                      <span style={{ fontSize: 12, color: '#9B2C2C', background: '#FFF5F5', border: '1px solid #FED7D7', padding: '2px 8px', borderRadius: 4 }}>일감 등록 실패</span>
                      <button style={{ ...s.btnSm, color: '#C05621', borderColor: '#C05621' }}
                        onClick={() => syncCRMut.mutate(detail.id)} disabled={syncCRMut.isPending}>
                        {syncCRMut.isPending ? '재시도 중...' : '재시도'}
                      </button>
                    </>
                  )}
                  {detail.redmineSyncStatus === 'SKIPPED' && <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>미설정 (레드마인 프로젝트 없음)</span>}
                </div>
              )}
            </div>
          )}
        </div>
      )}
      </>}
    </div>
  )
}

function ChangeRequestDashboard({ requests }: { requests: import('../../api/changeRequests').ChangeRequest[] }) {
  const statuses: RequestStatus[] = ['DRAFT', 'REQUESTED', 'APPROVED', 'COMPLETED', 'REJECTED']
  const statusLabels: Record<RequestStatus, string> = { DRAFT: '임시저장', REQUESTED: '요청', APPROVED: '승인', COMPLETED: '완료', REJECTED: '반려' }
  const statusColors: Record<RequestStatus, string> = { DRAFT: '#718096', REQUESTED: '#3182ce', APPROVED: '#38a169', COMPLETED: '#285E61', REJECTED: '#e53e3e' }
  const statusBg: Record<RequestStatus, string>    = { DRAFT: '#f7fafc', REQUESTED: '#ebf8ff', APPROVED: '#f0fff4', COMPLETED: '#e6fffa', REJECTED: '#fff5f5' }

  const byStatus = statuses.map(s => ({ status: s, count: requests.filter(r => r.status === s).length }))
  const bySystem = Object.entries(
    requests.reduce((acc, r) => { acc[r.systemName ?? r.systemCode] = (acc[r.systemName ?? r.systemCode] || 0) + 1; return acc }, {} as Record<string, number>)
  ).sort((a, b) => b[1] - a[1])
  const maxSys = Math.max(...bySystem.map(([, n]) => n), 1)

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 12, marginBottom: 16 }}>
        <div style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '16px 20px' }}>
          <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 6, fontWeight: 600 }}>전체</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--c-text)' }}>{requests.length}</div>
        </div>
        {byStatus.map(({ status, count }) => (
          <div key={status} style={{ background: statusBg[status], border: `1px solid ${statusColors[status]}44`, borderRadius: 8, padding: '16px 20px' }}>
            <div style={{ fontSize: 11, color: statusColors[status], marginBottom: 6, fontWeight: 600 }}>{statusLabels[status]}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: statusColors[status] }}>{count}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 16 }}>시스템별</div>
        {bySystem.length === 0 ? <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>데이터 없음</p> : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
            {bySystem.map(([name, count]) => (
              <div key={name}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 13 }}>
                  <span>{name}</span><span style={{ fontWeight: 600 }}>{count}건</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--c-bg)' }}>
                  <div style={{ height: '100%', borderRadius: 3, background: '#1a1a2e', width: `${(count / maxSys) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
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
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid var(--c-border-in)', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  card: { background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, padding: 24, marginBottom: 16 },
  formTitle: { fontSize: 15, fontWeight: 600, marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'center', marginBottom: 16 },
  formActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  label: { fontSize: 13, fontWeight: 500, color: 'var(--c-text-sub)' },
  input: { padding: '8px 10px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 13, width: '100%', boxSizing: 'border-box' as const, background: 'var(--c-input-bg)', color: 'var(--c-text)' },
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
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: 'var(--c-card)', borderRadius: 8, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
  detailGrid: { display: 'grid', gridTemplateColumns: '80px 1fr 80px 1fr', gap: '10px 16px', fontSize: 13 },
  detailLabel: { color: 'var(--c-text-muted)', fontSize: 12, fontWeight: 500 },
  contentBox: { background: 'var(--c-bg)', border: '1px solid var(--c-border)', borderRadius: 6, padding: '12px 16px', fontSize: 13, whiteSpace: 'pre-wrap' as const, marginTop: 8, fontFamily: 'inherit' },
}
