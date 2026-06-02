import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getChangeRequests, createChangeRequest, updateChangeRequest,
  changeRequestStatus, deleteChangeRequest, uploadAttachment,
  type ChangeRequest, type RequestStatus, type CreateChangeRequest,
} from '../../api/changeRequests'
import { getActiveSystems, getManagedSystemIds } from '../../api/systems'
import { useAuth } from '../../context/useAuth'
import StatusBadge from '../../components/StatusBadge'
import PageHeader from '../../components/PageHeader'

const NEXT_STATUS: Partial<Record<RequestStatus, { label: string; next: RequestStatus }[]>> = {
  DRAFT:     [{ label: '제출', next: 'REQUESTED' }],
  REQUESTED: [{ label: '승인', next: 'APPROVED' }, { label: '반려', next: 'REJECTED' }],
  APPROVED:  [{ label: '완료', next: 'COMPLETED' }],
}

const emptyForm: CreateChangeRequest = { systemId: 0, title: '', content: '', requesterDept: '', requesterName: '', targetDate: '', attachmentLink: '' }

export default function ChangeRequestPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<ChangeRequest | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateChangeRequest>(emptyForm)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [rejectModal, setRejectModal] = useState<{ id: number } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['change-requests'],
    queryFn: () => getChangeRequests(),
  })
  const { data: systems = [] } = useQuery({
    queryKey: ['systems', 'active'],
    queryFn: getActiveSystems,
  })
  const { data: managedSystemIds = [] } = useQuery({
    queryKey: ['systems', 'managed'],
    queryFn: getManagedSystemIds,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['change-requests'] })

  const createMut = useMutation({
    mutationFn: createChangeRequest,
    onSuccess: async (created) => {
      if (pendingFile) {
        try { await uploadAttachment(created.id, pendingFile) }
        catch { alert('변경 요청은 저장됐으나 파일 첨부에 실패했습니다.') }
      }
      invalidate(); closeForm()
    }
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: CreateChangeRequest }) => updateChangeRequest(id, data),
    onSuccess: async (updated) => {
      if (pendingFile) {
        try { await uploadAttachment(updated.id, pendingFile) }
        catch { alert('수정은 저장됐으나 파일 첨부에 실패했습니다.') }
      }
      invalidate(); closeForm()
    }
  })
  const statusMut = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: number; status: RequestStatus; rejectionReason?: string }) =>
      changeRequestStatus(id, status, rejectionReason),
    onSuccess: invalidate,
  })
  const deleteMut = useMutation({ mutationFn: deleteChangeRequest, onSuccess: invalidate })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, systemId: systems[0]?.id ?? 0 })
    setShowForm(true)
  }

  const openEdit = (r: ChangeRequest) => {
    setEditing(r)
    setForm({ systemId: r.systemId, title: r.title, content: r.content ?? '', requesterDept: r.requesterDept ?? '', requesterName: r.requesterName ?? '', targetDate: r.targetDate ?? '', attachmentLink: r.attachmentLink ?? '' })
    setPendingFile(null)
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm); setPendingFile(null); if (fileRef.current) fileRef.current.value = '' }

  const submit = () => {
    if (!form.title || !form.systemId) return
    const data = { ...form, targetDate: form.targetDate || undefined }
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  const isAdmin = user?.role === 'ADMIN'
  const canManage = (systemId: number) => isAdmin || managedSystemIds.includes(systemId)

  const submitReject = () => {
    if (!rejectReason.trim()) return alert('반려 사유를 입력해주세요.')
    statusMut.mutate({ id: rejectModal!.id, status: 'REJECTED', rejectionReason: rejectReason })
    setRejectModal(null)
    setRejectReason('')
  }

  return (
    <div style={s.page}>
      {rejectModal && (
        <div style={s.overlay}>
          <div style={s.modal}>
            <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>반려 사유 입력</h3>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="반려 사유를 입력하세요"
              rows={4}
              style={{ width: '100%', padding: '8px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
              <button style={s.btnSecondary} onClick={() => setRejectModal(null)}>취소</button>
              <button style={{ ...s.btn, background: '#e53e3e' }} onClick={submitReject}>반려 확정</button>
            </div>
          </div>
        </div>
      )}
      <PageHeader
        title="변경 관리"
        action={<button style={s.btn} onClick={openCreate}>+ 새 요청</button>}
      />

      {showForm && (
        <div style={s.formBox}>
          <h3 style={s.formTitle}>{editing ? '요청 수정' : '새 변경 관리'}</h3>
          <div style={s.formGrid}>
            <label style={s.label}>운영시스템</label>
            <select style={s.input} value={form.systemId} onChange={(e) => setForm({ ...form, systemId: Number(e.target.value) })}>
              <option value={0}>선택</option>
              {systems.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <label style={s.label}>제목</label>
            <input style={s.input} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="변경 관리 제목" />
            <label style={s.label}>요청부서</label>
            <input style={s.input} value={form.requesterDept ?? ''} onChange={(e) => setForm({ ...form, requesterDept: e.target.value })} placeholder="요청 부서명" />
            <label style={s.label}>요청자명</label>
            <input style={s.input} value={form.requesterName ?? ''} onChange={(e) => setForm({ ...form, requesterName: e.target.value })} placeholder="요청자 이름" />
            <label style={s.label}>반영 목표일</label>
            <input type="date" style={s.input} value={form.targetDate ?? ''} onChange={(e) => setForm({ ...form, targetDate: e.target.value || undefined })} />
            <label style={s.label}>링크 첨부</label>
            <input style={s.input} value={form.attachmentLink ?? ''} onChange={(e) => setForm({ ...form, attachmentLink: e.target.value })} placeholder="https://..." />
            <label style={s.label}>파일 첨부</label>
            <input ref={fileRef} type="file" style={s.input} onChange={(e) => setPendingFile(e.target.files?.[0] ?? null)} />
            <label style={s.label}>내용</label>
            <textarea style={{ ...s.input, height: 100, resize: 'vertical' }} value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="변경 내용을 입력하세요" />
          </div>
          <div style={s.formActions}>
            <button style={s.btnSecondary} onClick={closeForm}>취소</button>
            <button style={s.btn} onClick={submit}>저장</button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p style={{ color: '#aaa' }}>로딩 중...</p>
      ) : (
        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr style={s.thead}>
                <th style={s.th}>요청번호</th>
                <th style={s.th}>시스템</th>
                <th style={s.th}>요청부서</th>
                <th style={s.th}>요청자</th>
                <th style={{ ...s.th, width: '25%' }}>제목</th>
                <th style={s.th}>상태</th>
                <th style={s.th}>반영 목표일</th>
                <th style={s.th}>첨부</th>
                <th style={s.th}>생성일</th>
                <th style={s.th}>액션</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={10} style={s.empty}>등록된 요청이 없습니다</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r.id} style={s.tr}>
                  <td style={{ ...s.td, fontWeight: 600, color: '#1a1a2e', whiteSpace: 'nowrap' }}>{r.requestNo ?? '-'}</td>
                  <td style={s.td}><span style={s.sysTag}>{r.systemCode}</span></td>
                  <td style={s.td}>{r.requesterDept ?? '-'}</td>
                  <td style={s.td}>{r.requesterName ?? r.requesterUsername}</td>
                  <td style={s.td}>{r.title}</td>
                  <td style={s.td}>
                    <StatusBadge status={r.status} />
                    {r.status === 'REJECTED' && r.rejectionReason && (
                      <div style={{ fontSize: 11, color: '#e53e3e', marginTop: 2 }} title={r.rejectionReason}>
                        사유: {r.rejectionReason.length > 20 ? r.rejectionReason.slice(0, 20) + '…' : r.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td style={s.td}>{r.targetDate ?? '-'}</td>
                  <td style={s.td}>
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {r.hasAttachment && (
                        <a href={`/api/change-requests/${r.id}/attachment`} style={{ fontSize: 12, color: '#1976d2' }}>📎 파일</a>
                      )}
                      {r.attachmentLink && (
                        <a href={r.attachmentLink} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: '#7b1fa2' }}>🔗 링크</a>
                      )}
                      {!r.hasAttachment && !r.attachmentLink && <span style={{ color: '#ccc', fontSize: 12 }}>-</span>}
                    </div>
                  </td>
                  <td style={s.td}>{r.createdAt?.slice(0, 10)}</td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      {r.status === 'DRAFT' && (
                        <button style={s.btnSm} onClick={() => openEdit(r)}>수정</button>
                      )}
                      {NEXT_STATUS[r.status]?.map(({ label, next }) => {
                        if (next === 'REQUESTED') return (
                          <button key={next} style={{ ...s.btnSm, ...actionStyle(next) }}
                            onClick={() => statusMut.mutate({ id: r.id, status: next })}>
                            {label}
                          </button>
                        )
                        if (canManage(r.systemId)) return (
                          <button key={next} style={{ ...s.btnSm, ...actionStyle(next) }}
                            onClick={() => {
                              if (next === 'REJECTED') { setRejectModal({ id: r.id }); setRejectReason('') }
                              else statusMut.mutate({ id: r.id, status: next })
                            }}>
                            {label}
                          </button>
                        )
                        return null
                      })}
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
    </div>
  )
}

function actionStyle(status: RequestStatus): React.CSSProperties {
  if (status === 'APPROVED') return { color: '#276749' }
  if (status === 'REJECTED') return { color: '#9B2C2C' }
  if (status === 'COMPLETED') return { color: '#285E61' }
  return {}
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '32px 40px' },
  btn: { padding: '8px 16px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  btnSecondary: { padding: '8px 16px', background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 6, cursor: 'pointer', fontSize: 13 },
  btnSm: { padding: '3px 10px', background: 'transparent', border: '1px solid #ddd', borderRadius: 4, cursor: 'pointer', fontSize: 12, marginRight: 4 },
  formBox: { background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: '24px', marginBottom: 24 },
  formTitle: { fontSize: 15, fontWeight: 600, marginBottom: 16 },
  formGrid: { display: 'grid', gridTemplateColumns: '100px 1fr', gap: '12px 16px', alignItems: 'center', marginBottom: 16 },
  formActions: { display: 'flex', gap: 8, justifyContent: 'flex-end' },
  label: { fontSize: 13, fontWeight: 500, color: '#555' },
  input: { padding: '8px 10px', border: '1px solid #ddd', borderRadius: 6, fontSize: 13, width: '100%' },
  tableWrap: { background: '#fff', borderRadius: 8, border: '1px solid #e2e8f0', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse' as const },
  thead: { background: '#f7f8fa' },
  th: { padding: '10px 14px', textAlign: 'left' as const, fontSize: 12, fontWeight: 600, color: '#555', borderBottom: '1px solid #e2e8f0' },
  tr: { borderBottom: '1px solid #f0f0f0' },
  td: { padding: '10px 14px', fontSize: 13 },
  sysTag: { background: '#EBF8FF', color: '#2B6CB0', padding: '2px 8px', borderRadius: 4, fontSize: 12 },
  actions: { display: 'flex', alignItems: 'center' },
  empty: { padding: '32px', textAlign: 'center' as const, color: '#aaa', fontSize: 13 },
  overlay: { position: 'fixed' as const, inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: 8, padding: 24, width: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.2)' },
}
