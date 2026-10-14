import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi, ItemType, ItemStatus, SaveInventoryRequest, InventoryItem } from '../../api/inventory'
import { Button, Input, Select, TabBar, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Textarea, Panel, Tag, Loading, EmptyState } from '../../components/ui'

const TYPE_LABEL: Record<ItemType, string> = { CONTRACT: '수주', PROPOSAL: '제안' }
const STATUS_LABEL: Record<ItemStatus, string> = {
  ACTIVE: '진행중', COMPLETED: '완료', CANCELLED: '취소', ON_HOLD: '보류',
}
const STATUS_COLOR: Record<ItemStatus, string> = {
  ACTIVE: 'var(--c-tag-sys-t)', COMPLETED: 'var(--c-tag-done-t)', CANCELLED: 'var(--c-text-muted)', ON_HOLD: 'var(--c-tag-warn-t)',
}

const emptyForm = (): SaveInventoryRequest => ({
  type: 'CONTRACT', name: '', client: '', amount: undefined,
  status: 'ACTIVE', startDate: '', endDate: '', note: '',
})

export default function InventoryPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState<'list' | 'dashboard'>('list')
  const [typeFilter, setTypeFilter] = useState<ItemType | ''>('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<InventoryItem | null>(null)
  const [form, setForm] = useState<SaveInventoryRequest>(emptyForm())

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['inventory', typeFilter],
    queryFn: () => inventoryApi.list(typeFilter || undefined).then(r => r.data),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['inventory'] })

  const createMut = useMutation({
    mutationFn: (data: SaveInventoryRequest) => inventoryApi.create(data),
    onSuccess: () => { invalidate(); resetForm() },
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveInventoryRequest }) =>
      inventoryApi.update(id, data),
    onSuccess: () => { invalidate(); resetForm() },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => inventoryApi.delete(id),
    onSuccess: invalidate,
  })

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm()) }

  const openEdit = (item: InventoryItem) => {
    setEditing(item)
    setForm({
      type: item.type, name: item.name, client: item.client ?? '',
      amount: item.amount ?? undefined, status: item.status,
      startDate: item.startDate ?? '', endDate: item.endDate ?? '', note: item.note ?? '',
    })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      ...form,
      client: form.client || undefined,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      note: form.note || undefined,
    }
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  const fmt = (n: number | null) =>
    n != null ? n.toLocaleString('ko-KR') + '원' : '-'

  const allItems = useQuery({ queryKey: ['inventory', ''], queryFn: () => inventoryApi.list(undefined).then(r => r.data) })

  return (
    <div className="page-wrap">
      <div className="deploy-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0 }}>인벤토리 (수주/제안)</h2>
          <TabBar value={tab} onChange={v => setTab(v)}
            items={[{ value: 'list', label: '목록' }, { value: 'dashboard', label: '현황' }]} />
        </div>
        {tab === 'list' && <div style={{ display: 'flex', gap: 8 }}>
          {(['', 'CONTRACT', 'PROPOSAL'] as const).map(t => (
            <Button key={t} size="md" variant={typeFilter === t ? 'filled' : 'outlined'}
              onClick={() => setTypeFilter(t)}>
              {t === '' ? '전체' : TYPE_LABEL[t]}
            </Button>
          ))}
          <Button variant="filled" onClick={() => { resetForm(); setShowForm(true) }}>+ 추가</Button>
        </div>}
      </div>

      {tab === 'dashboard' && <InventoryDashboard items={allItems.data ?? []} />}

      {tab === 'list' && <>
      {showForm && (
        <Panel style={{ display: 'block', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>{editing ? '항목 수정' : '새 항목 추가'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid-2col">
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>구분 *</span>
                <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v as ItemType }))}
                  style={{ width: '100%' }}>
                  <option value="CONTRACT">수주</option>
                  <option value="PROPOSAL">제안</option>
                </Select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>항목명 *</span>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>고객사</span>
                <Input value={form.client} onChange={e => setForm(f => ({ ...f, client: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>금액 (원)</span>
                <Input type="number" value={form.amount ?? ''} onChange={e => setForm(f => ({ ...f, amount: e.target.value ? +e.target.value : undefined }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>상태</span>
                <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v as ItemStatus }))}
                  style={{ width: '100%' }}>
                  {(Object.keys(STATUS_LABEL) as ItemStatus[]).map(s => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </Select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>시작일</span>
                <Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>종료일</span>
                <Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4, gridColumn: '1 / -1' }}>
                <span>비고</span>
                <Textarea value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} rows={2}
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

      {isLoading ? (
        <Loading />
      ) : (
        <div className="table-scroll">
        <Table style={{ background: 'var(--c-card)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <TableHeader>
            <TableRow>
              {['구분', '항목명', '고객사', '금액', '상태', '기간', '비고', ''].map(h => (
                <TableHead key={h} style={{ textAlign: 'left' }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow><TableCell colSpan={8}><EmptyState title="데이터가 없습니다." /></TableCell></TableRow>
            ) : items.map(item => (
              <TableRow key={item.id}>
                <TableCell>
                  <Tag tone={item.type === 'CONTRACT' ? 'info' : 'warning'}>
                    {TYPE_LABEL[item.type]}
                  </Tag>
                </TableCell>
                <TableCell style={{ fontWeight: 500 }}>{item.name}</TableCell>
                <TableCell style={{ color: 'var(--c-text-sub)' }}>{item.client ?? '-'}</TableCell>
                <TableCell style={{ textAlign: 'right', fontFamily: 'monospace' }}>{fmt(item.amount)}</TableCell>
                <TableCell>
                  <Tag color={STATUS_COLOR[item.status]}>
                    {STATUS_LABEL[item.status]}
                  </Tag>
                </TableCell>
                <TableCell style={{ fontSize: 12, color: 'var(--c-text-sub)' }}>
                  {item.startDate ?? '-'} ~ {item.endDate ?? '-'}
                </TableCell>
                <TableCell style={{ fontSize: 12, color: 'var(--c-text-sub)', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.note ?? '-'}</TableCell>
                <TableCell style={{ whiteSpace: 'nowrap' }}>
                  <Button variant="outlined" size="sm" onClick={() => openEdit(item)}>수정</Button>
                  <Button variant="outlined" size="sm" onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(item.id) }} style={{ color: 'var(--c-tag-err-t)', borderColor: 'color-mix(in srgb, var(--c-tag-err-t) 40%, transparent)' }}>삭제</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>
      )}
      </>}
    </div>
  )
}

function InventoryDashboard({ items }: { items: import('../../api/inventory').InventoryItem[] }) {
  const fmt = (n: number) => n.toLocaleString('ko-KR') + '원'
  const types: ItemType[] = ['CONTRACT', 'PROPOSAL']
  const statuses: ItemStatus[] = ['ACTIVE', 'COMPLETED', 'ON_HOLD', 'CANCELLED']
  const typeColors: Record<ItemType, string> = { CONTRACT: 'var(--c-tag-sys-t)', PROPOSAL: 'var(--c-tag-warn-t)' }
  const typeBg: Record<ItemType, string>    = { CONTRACT: 'var(--c-tag-sys)', PROPOSAL: 'var(--c-tag-warn-bg)' }
  const statusColors: Record<ItemStatus, string> = { ACTIVE: 'var(--c-tag-sys-t)', COMPLETED: 'var(--c-tag-done-t)', ON_HOLD: 'var(--c-tag-warn-t)', CANCELLED: 'var(--c-text-muted)' }

  const totalAmount = (t: ItemType) => items.filter(i => i.type === t).reduce((s, i) => s + (i.amount ?? 0), 0)
  const byStatus = (t: ItemType) => statuses.map(st => ({ st, count: items.filter(i => i.type === t && i.status === st).length }))

  return (
    <div>
      <div className="grid-2col" style={{ gap: 16, marginBottom: 16 }}>
        {types.map(t => {
          const typeItems = items.filter(i => i.type === t)
          return (
            <Panel key={t} style={{ display: 'block' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div>
                  <Tag color={typeColors[t]} bg={typeBg[t]}>{TYPE_LABEL[t]}</Tag>
                  <div style={{ fontSize: 28, fontWeight: 700, color: typeColors[t], marginTop: 10 }}>{typeItems.length}건</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 4 }}>총 금액</div>
                  <div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'monospace' }}>{fmt(totalAmount(t))}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' as const }}>
                {byStatus(t).filter(({ count }) => count > 0).map(({ st, count }) => (
                  <Tag key={st} color={statusColors[st]}>
                    {STATUS_LABEL[st]} {count}
                  </Tag>
                ))}
              </div>
            </Panel>
          )
        })}
      </div>
      <Panel style={{ display: 'block' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 16 }}>상태별 현황</div>
        <div className="grid-4col">
          {statuses.map(st => (
            <div key={st} style={{ background: `color-mix(in srgb, ${statusColors[st]} 7%, transparent)`, border: `1px solid color-mix(in srgb, ${statusColors[st]} 27%, transparent)`, borderRadius: 8, padding: '14px 18px' }}>
              <div style={{ fontSize: 11, color: statusColors[st], fontWeight: 600, marginBottom: 6 }}>{STATUS_LABEL[st]}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: statusColors[st] }}>{items.filter(i => i.status === st).length}</div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}
