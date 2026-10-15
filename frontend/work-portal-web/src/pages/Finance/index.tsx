import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { financeApi, FinanceCategory, SaveFinanceRequest, FinanceRecord } from '../../api/finance'
import { Button, Input, Select, TabBar, Table, TableBody, TableCell, TableHead, TableHeader, TableRow, Panel, Tag, Loading, EmptyState } from '../../components/ui'
import PageHeader from '../../components/PageHeader'

function apiError(e: unknown): string {
  if (axios.isAxiosError(e) && e.response?.data?.error) return e.response.data.error
  if (axios.isAxiosError(e) && e.response?.data?.message) return e.response.data.message
  return e instanceof Error ? e.message : String(e)
}

const CATEGORY_LABEL: Record<FinanceCategory, string> = { REVENUE: '매출', EXPENSE: '지출' }
const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']

const emptyForm = (year: number, month: number): SaveFinanceRequest => ({
  year, month, category: 'REVENUE', itemName: '', amount: 0, note: '',
})

export default function FinancePage() {
  const qc = useQueryClient()
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth() + 1

  const [tab, setTab] = useState<'list' | 'dashboard'>('list')
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<FinanceRecord | null>(null)
  const [form, setForm] = useState<SaveFinanceRequest>(emptyForm(currentYear, currentMonth))

  const { data: years = [] } = useQuery({
    queryKey: ['finance-years'],
    queryFn: () => financeApi.years().then(r => r.data),
  })

  const { data: summary = [] } = useQuery({
    queryKey: ['finance-summary', selectedYear],
    queryFn: () => financeApi.summary(selectedYear).then(r => r.data),
  })

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['finance-records', selectedYear, selectedMonth],
    queryFn: () => financeApi.list(selectedYear, selectedMonth).then(r => r.data),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['finance-records'] })
    qc.invalidateQueries({ queryKey: ['finance-summary'] })
    qc.invalidateQueries({ queryKey: ['finance-years'] })
  }

  const createMut = useMutation({
    mutationFn: (data: SaveFinanceRequest) => financeApi.create(data),
    onSuccess: () => { invalidate(); resetForm() },
    onError: (e: unknown) => alert('저장 실패: ' + apiError(e)),
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveFinanceRequest }) =>
      financeApi.update(id, data),
    onSuccess: () => { invalidate(); resetForm() },
    onError: (e: unknown) => alert('수정 실패: ' + apiError(e)),
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => financeApi.delete(id),
    onSuccess: invalidate,
    onError: (e: unknown) => alert('삭제 실패: ' + apiError(e)),
  })

  const resetForm = () => { setShowForm(false); setEditing(null); setForm(emptyForm(selectedYear, selectedMonth)) }

  const openEdit = (rec: FinanceRecord) => {
    setEditing(rec)
    setForm({ year: rec.year, month: rec.month, category: rec.category, itemName: rec.itemName, amount: rec.amount, note: rec.note ?? '' })
    setShowForm(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const data = { ...form, note: form.note || undefined }
    if (editing) updateMut.mutate({ id: editing.id, data })
    else createMut.mutate(data)
  }

  const fmt = (n: number) => n.toLocaleString('ko-KR')

  const currentSummary = summary.find(s => s.month === selectedMonth)

  return (
    <div className="page-wrap">
      <PageHeader
        title="손익 관리"
        extra={<TabBar value={tab} onChange={v => setTab(v)}
          items={[{ value: 'list', label: '월별 내역' }, { value: 'dashboard', label: '연간 현황' }]} />}
        actions={
          <Select value={selectedYear} onValueChange={v => setSelectedYear(+v)}>
            {years.map(y => <option key={y} value={y}>{y}년</option>)}
          </Select>
        }
      />

      {tab === 'dashboard' && <FinanceDashboard summary={summary} year={selectedYear} />}

      {tab === 'list' && <>
      {/* 월별 요약 바 */}
      <Panel style={{ display: 'block', marginBottom: 20, overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4, minWidth: 700 }}>
          {summary.map(s => (
            <Panel key={s.month}
              role="button" tabIndex={0} aria-pressed={selectedMonth === s.month}
              onClick={() => setSelectedMonth(s.month)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedMonth(s.month) } }}
              style={{
                flex: 1, padding: '10px 4px', gap: 0, cursor: 'pointer', fontSize: 11, textAlign: 'center',
                ...(selectedMonth === s.month ? { borderColor: 'var(--c-action)', background: 'var(--c-row-sel)' } : {}),
              }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{MONTHS[s.month - 1]}</div>
              <div style={{ color: 'var(--c-action)' }}>{fmt(s.revenue / 10000)}만</div>
              <div style={{ color: 'var(--c-tag-err-t)' }}>{fmt(s.expense / 10000)}만</div>
              <div style={{ color: s.profit >= 0 ? 'var(--c-tag-done-t)' : 'var(--c-tag-err-t)', fontWeight: 600 }}>
                {s.profit >= 0 ? '+' : ''}{fmt(s.profit / 10000)}만
              </div>
            </Panel>
          ))}
        </div>
      </Panel>

      {/* 선택 월 요약 카드 */}
      {currentSummary && (
        <div className="grid-3col" style={{ marginBottom: 20 }}>
          {[
            { label: '매출', value: currentSummary.revenue, color: 'var(--c-action)' },
            { label: '지출', value: currentSummary.expense, color: 'var(--c-tag-err-t)' },
            { label: '손익', value: currentSummary.profit, color: currentSummary.profit >= 0 ? 'var(--c-tag-done-t)' : 'var(--c-tag-err-t)' },
          ].map(card => (
            <Panel key={card.label} style={{ display: 'block' }}>
              <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 4 }}>{selectedYear}년 {selectedMonth}월 {card.label}</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: card.color, fontFamily: 'monospace' }}>
                {fmt(card.value)}원
              </div>
            </Panel>
          ))}
        </div>
      )}

      {/* 상세 내역 */}
      <div className="deploy-header" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {MONTHS.map((m, i) => (
            <Button key={i + 1} size="md" variant={selectedMonth === i + 1 ? 'filled' : 'outlined'}
              onClick={() => setSelectedMonth(i + 1)}>{m}</Button>
          ))}
        </div>
        <Button variant="filled" onClick={() => { resetForm(); setShowForm(true) }}>+ 추가</Button>
      </div>

      {showForm && (
        <Panel style={{ display: 'block', marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>{editing ? '내역 수정' : '새 내역 추가'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="grid-2col">
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>구분 *</span>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as FinanceCategory }))}
                  style={{ width: '100%' }}>
                  <option value="REVENUE">매출</option>
                  <option value="EXPENSE">지출</option>
                </Select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>항목명 *</span>
                <Input value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
                  required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>금액 (원) *</span>
                <Input type="number" min={0} step={1} value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: Math.floor(+e.target.value) }))}
                  required />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>비고</span>
                <Input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
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
              {['구분', '항목명', '금액', '비고', '등록일', ''].map(h => (
                <TableHead key={h} style={{ textAlign: 'left' }}>{h}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {records.length === 0 ? (
              <TableRow><TableCell colSpan={6}><EmptyState title="데이터가 없습니다." /></TableCell></TableRow>
            ) : records.map(rec => (
              <TableRow key={rec.id}>
                <TableCell>
                  <Tag tone={rec.category === 'REVENUE' ? 'info' : 'danger'}>{CATEGORY_LABEL[rec.category]}</Tag>
                </TableCell>
                <TableCell style={{ fontWeight: 500 }}>{rec.itemName}</TableCell>
                <TableCell style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600,
                  color: rec.category === 'REVENUE' ? 'var(--c-action)' : 'var(--c-tag-err-t)' }}>
                  {rec.category === 'REVENUE' ? '+' : '-'}{fmt(rec.amount)}원
                </TableCell>
                <TableCell style={{ fontSize: 12, color: 'var(--c-text-sub)' }}>{rec.note ?? '-'}</TableCell>
                <TableCell style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                  {new Date(rec.createdAt).toLocaleDateString('ko-KR')}
                </TableCell>
                <TableCell style={{ whiteSpace: 'nowrap' }}>
                  <Button variant="outlined" size="sm" onClick={() => openEdit(rec)}>수정</Button>
                  <Button variant="danger" size="sm" onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(rec.id) }}>삭제</Button>
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

function FinanceDashboard({ summary, year }: { summary: import('../../api/finance').MonthlySummary[], year: number }) {
  const fmt = (n: number) => n.toLocaleString('ko-KR')
  const totalRevenue = summary.reduce((s, m) => s + m.revenue, 0)
  const totalExpense = summary.reduce((s, m) => s + m.expense, 0)
  const totalProfit  = totalRevenue - totalExpense
  const maxVal = Math.max(...summary.map(m => Math.max(m.revenue, m.expense)), 1)

  return (
    <div>
      <div className="grid-3col" style={{ gap: 16, marginBottom: 16 }}>
        {[
          { label: `${year}년 총 매출`, value: totalRevenue, color: 'var(--c-action)' },
          { label: `${year}년 총 지출`, value: totalExpense, color: 'var(--c-tag-err-t)' },
          { label: `${year}년 총 손익`, value: totalProfit,  color: totalProfit >= 0 ? 'var(--c-tag-done-t)' : 'var(--c-tag-err-t)' },
        ].map(card => (
          <Panel key={card.label} style={{ display: 'block' }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color, fontFamily: 'monospace' }}>
              {totalProfit < 0 && card.label.includes('손익') ? '-' : ''}{fmt(Math.abs(card.value))}원
            </div>
          </Panel>
        ))}
      </div>
      <Panel style={{ display: 'block' }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 16 }}>월별 매출 / 지출</div>
        {summary.length === 0 ? <EmptyState title="데이터 없음" /> : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {summary.map(m => (
              <div key={m.month}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, color: 'var(--c-text-sub)' }}>
                  <span style={{ fontWeight: 600 }}>{m.month}월</span>
                  <span style={{ color: m.profit >= 0 ? 'var(--c-tag-done-t)' : 'var(--c-tag-err-t)', fontWeight: 600 }}>
                    손익 {m.profit >= 0 ? '+' : ''}{fmt(m.profit)}원
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--c-action)', width: 24 }}>매출</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--c-bg)' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: 'var(--rsp-color-secondary-500)', width: `${(m.revenue / maxVal) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', minWidth: 80, textAlign: 'right' as const }}>{fmt(m.revenue)}원</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--c-tag-err-t)', width: 24 }}>지출</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--c-bg)' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: 'var(--rsp-color-error-500)', width: `${(m.expense / maxVal) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', minWidth: 80, textAlign: 'right' as const }}>{fmt(m.expense)}원</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  )
}
