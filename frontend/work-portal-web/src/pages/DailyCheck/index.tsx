import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dailyCheckApi, DailyCheckReport, SaveDailyCheckRequest, CheckStatus } from '../../api/reports'
import { getActiveSystems } from '../../api/systems'
import { Button, Callout, Input, Select, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea, Panel, Tag, Loading, EmptyState } from '../../components/ui'
import PageHeader from '../../components/PageHeader'

const STATUS_LABEL: Record<CheckStatus, string> = { NORMAL: '정상', WARNING: '주의', CRITICAL: '위험' }
const STATUS_COLOR: Record<CheckStatus, string> = { NORMAL: 'var(--c-tag-done-t)', WARNING: 'var(--c-tag-warn-t)', CRITICAL: 'var(--c-tag-err-t)' }

const emptyForm = (): SaveDailyCheckRequest => ({
  systemId: 0, checkDate: new Date().toISOString().slice(0, 10), status: 'NORMAL', note: '',
})

export default function DailyCheckPage() {
  const qc = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [dateFilter, setDateFilter] = useState(today)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<DailyCheckReport | null>(null)
  const [form, setForm] = useState<SaveDailyCheckRequest>(emptyForm())

  const { data: systems = [] } = useQuery({
    queryKey: ['systems-list'],
    queryFn: getActiveSystems,  // 다른 등록 폼과 동일하게 활성 시스템만 (F-FIX-001 R-001)
  })

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ['daily-checks', dateFilter],
    queryFn: () => dailyCheckApi.list(dateFilter || undefined).then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['daily-checks'] })

  const createMut = useMutation({
    mutationFn: (d: SaveDailyCheckRequest) => dailyCheckApi.create(d),
    onSuccess: () => { invalidate(); resetForm() },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, d }: { id: number; d: SaveDailyCheckRequest }) => dailyCheckApi.update(id, d),
    onSuccess: () => { invalidate(); resetForm() },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => dailyCheckApi.delete(id),
    onSuccess: invalidate,
  })

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }

  const openEdit = (r: DailyCheckReport) => {
    setEditing(r)
    setForm({ systemId: r.systemId, checkDate: r.checkDate, status: r.status, note: r.note ?? '' })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.systemId) return alert('시스템을 선택해주세요.')
    const d = { ...form, note: form.note || undefined }
    if (editing) updateMut.mutate({ id: editing.id, d })
    else createMut.mutate(d)
  }

  const hasCritical = reports.some(r => r.status === 'CRITICAL')
  const hasWarning = reports.some(r => r.status === 'WARNING')

  return (
    <div className="page-wrap">
      <PageHeader
        title="일일 점검"
        actions={<>
          <Input type="date" value={dateFilter} onChange={e => setDateFilter(e.target.value)}
            style={{ width: 'auto' }} />
          <Button size="md" variant={dateFilter ? 'outlined' : 'filled'} onClick={() => setDateFilter('')}>
            전체
          </Button>
          <Button variant="filled" onClick={() => { resetForm(); setShowForm(true) }}>+ 점검 등록</Button>
        </>}
      />

      {/* 오늘 날짜 상태 요약 */}
      {dateFilter === today && reports.length > 0 && (
        <Callout
          tone={hasCritical ? 'danger' : hasWarning ? 'warning' : 'success'}
          title={hasCritical ? '위험 시스템이 있습니다' : hasWarning ? '주의가 필요한 시스템이 있습니다' : '모든 시스템 정상'}
          style={{ marginBottom: 16 }}>
          ({reports.length}개 시스템 점검 완료)
        </Callout>
      )}

      {showForm && (
        <Panel style={{ display: 'block', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>{editing ? '점검 수정' : '점검 등록'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid-2col">
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13 }}>시스템 *</span>
                <Select value={form.systemId} onValueChange={v => setForm(f => ({ ...f, systemId: +v }))}
                  style={{ width: '100%' }}>
                  <option value={0}>-- 선택 --</option>
                  {systems.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </Select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13 }}>점검일 *</span>
                <Input type="date" value={form.checkDate} onChange={e => setForm(f => ({ ...f, checkDate: e.target.value }))}
                  required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 13 }}>상태 *</span>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as CheckStatus }))}
                  style={{ width: '100%' }}>
                  {(Object.keys(STATUS_LABEL) as CheckStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </Select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span style={{ fontSize: 13 }}>비고</span>
                <Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={3}
                  style={{ resize: 'vertical' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <Button variant="filled" type="submit">{editing ? '수정' : '저장'}</Button>
              <Button variant="outlined" type="button" onClick={resetForm}>취소</Button>
            </div>
          </form>
        </Panel>
      )}

      {isLoading ? <Loading /> : (
        <div className="table-scroll">
        <Table style={{ background: 'var(--c-card)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <TableHeader>
            <TableRow>
              {['점검일', '시스템', '상태', '비고', '점검자', '등록시간', ''].map(h => (
                <TableHead key={h} style={{ textAlign: 'left' }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow><TableCell colSpan={7}><EmptyState title="점검 데이터가 없습니다." /></TableCell></TableRow>
            ) : reports.map(r => (
              <TableRow key={r.id}>
                <TableCell>{r.checkDate}</TableCell>
                <TableCell style={{ fontWeight: 500 }}>{r.systemName}</TableCell>
                <TableCell>
                  <Tag color={STATUS_COLOR[r.status]}>
                    {STATUS_LABEL[r.status]}
                  </Tag>
                </TableCell>
                <TableCell style={{ color: 'var(--c-text-sub)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.note ?? '-'}
                </TableCell>
                <TableCell style={{ color: 'var(--c-text-sub)' }}>{r.reporter}</TableCell>
                <TableCell style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                  {new Date(r.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </TableCell>
                <TableCell style={{ whiteSpace: 'nowrap' }}>
                  <Button variant="outlined" size="sm" onClick={() => openEdit(r)}>수정</Button>
                  <Button variant="danger" size="sm" onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(r.id) }}>삭제</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
    </div>
  )
}
