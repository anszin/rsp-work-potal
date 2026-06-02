import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getChangeRequests, createChangeRequest, updateChangeRequest,
  changeRequestStatus, deleteChangeRequest,
  type ChangeRequest, type RequestStatus, type CreateChangeRequest,
} from '../../api/changeRequests'
import { getActiveSystems } from '../../api/systems'
import { useAuth } from '../../context/useAuth'
import StatusBadge from '../../components/StatusBadge'
import PageHeader from '../../components/PageHeader'

const NEXT_STATUS: Partial<Record<RequestStatus, { label: string; next: RequestStatus }[]>> = {
  DRAFT:     [{ label: '제출', next: 'REQUESTED' }],
  REQUESTED: [{ label: '승인', next: 'APPROVED' }, { label: '반려', next: 'REJECTED' }],
  APPROVED:  [{ label: '완료', next: 'COMPLETED' }],
}

const emptyForm: CreateChangeRequest = { systemId: 0, title: '', content: '', targetDate: '' }

export default function ChangeRequestPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [editing, setEditing] = useState<ChangeRequest | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<CreateChangeRequest>(emptyForm)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['change-requests'],
    queryFn: () => getChangeRequests(),
  })
  const { data: systems = [] } = useQuery({
    queryKey: ['systems', 'active'],
    queryFn: getActiveSystems,
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['change-requests'] })

  const createMut = useMutation({ mutationFn: createChangeRequest, onSuccess: () => { invalidate(); closeForm() } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: { id: number; data: CreateChangeRequest }) => updateChangeRequest(id, data), onSuccess: () => { invalidate(); closeForm() } })
  const statusMut = useMutation({ mutationFn: ({ id, status }: { id: number; status: RequestStatus }) => changeRequestStatus(id, status), onSuccess: invalidate })
  const deleteMut = useMutation({ mutationFn: deleteChangeRequest, onSuccess: invalidate })

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm, systemId: systems[0]?.id ?? 0 })
    setShowForm(true)
  }

  const openEdit = (r: ChangeRequest) => {
    setEditing(r)
    setForm({ systemId: r.systemId, title: r.title, content: r.content ?? '', targetDate: r.targetDate ?? '' })
    setShowForm(true)
  }

  const closeForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm) }

  const submit = () => {
    if (!form.title || !form.systemId) return
    if (editing) updateMut.mutate({ id: editing.id, data: form })
    else createMut.mutate(form)
  }

  const isAdmin = user?.role === 'ADMIN'

  return (
    <div style={s.page}>
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
            <label style={s.label}>반영 목표일</label>
            <input type="date" style={s.input} value={form.targetDate ?? ''} onChange={(e) => setForm({ ...form, targetDate: e.target.value || undefined })} />
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
                <th style={s.th}>번호</th>
                <th style={s.th}>시스템</th>
                <th style={{ ...s.th, width: '30%' }}>제목</th>
                <th style={s.th}>요청자</th>
                <th style={s.th}>상태</th>
                <th style={s.th}>반영 목표일</th>
                <th style={s.th}>생성일</th>
                <th style={s.th}>액션</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 && (
                <tr><td colSpan={8} style={s.empty}>등록된 요청이 없습니다</td></tr>
              )}
              {requests.map((r) => (
                <tr key={r.id} style={s.tr}>
                  <td style={s.td}>{r.id}</td>
                  <td style={s.td}><span style={s.sysTag}>{r.systemCode}</span></td>
                  <td style={s.td}>{r.title}</td>
                  <td style={s.td}>{r.requesterUsername}</td>
                  <td style={s.td}><StatusBadge status={r.status} /></td>
                  <td style={s.td}>{r.targetDate ?? '-'}</td>
                  <td style={s.td}>{r.createdAt?.slice(0, 10)}</td>
                  <td style={s.td}>
                    <div style={s.actions}>
                      {r.status === 'DRAFT' && (
                        <button style={s.btnSm} onClick={() => openEdit(r)}>수정</button>
                      )}
                      {NEXT_STATUS[r.status]?.map(({ label, next }) => (
                        (isAdmin || next === 'REQUESTED') && (
                          <button key={next} style={{ ...s.btnSm, ...actionStyle(next) }}
                            onClick={() => statusMut.mutate({ id: r.id, status: next })}>
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
}
