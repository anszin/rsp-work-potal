import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { financeApi, FinanceCategory, SaveFinanceRequest, FinanceRecord } from '../../api/finance'

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
  })
  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: number; data: SaveFinanceRequest }) =>
      financeApi.update(id, data),
    onSuccess: () => { invalidate(); resetForm() },
  })
  const deleteMut = useMutation({
    mutationFn: (id: number) => financeApi.delete(id),
    onSuccess: invalidate,
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
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <h2 style={{ margin: 0 }}>손익 관리</h2>
          <div style={{ display: 'flex', gap: 4 }}>
            {(['list', 'dashboard'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '5px 14px', border: '1px solid var(--c-border-in)', borderRadius: 20, cursor: 'pointer', fontSize: 12, background: tab === t ? '#1a1a2e' : 'var(--c-card)', color: tab === t ? '#fff' : 'var(--c-text-sub)' }}>
                {t === 'list' ? '월별 내역' : '연간 현황'}
              </button>
            ))}
          </div>
        </div>
        <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--c-border-in)', fontSize: 14 }}>
          {years.map(y => <option key={y} value={y}>{y}년</option>)}
        </select>
      </div>

      {tab === 'dashboard' && <FinanceDashboard summary={summary} year={selectedYear} />}

      {tab === 'list' && <>
      {/* 월별 요약 바 */}
      <div style={{ background: 'var(--c-card)', borderRadius: 8, padding: 16, marginBottom: 20, boxShadow: '0 1px 4px rgba(0,0,0,0.08)', overflowX: 'auto' }}>
        <div style={{ display: 'flex', gap: 4, minWidth: 700 }}>
          {summary.map(s => (
            <button key={s.month}
              onClick={() => setSelectedMonth(s.month)}
              style={{
                flex: 1, padding: '10px 4px', borderRadius: 6, border: '2px solid',
                borderColor: selectedMonth === s.month ? '#1976d2' : 'var(--c-border)',
                background: selectedMonth === s.month ? '#e3f2fd' : 'var(--c-bg)',
                cursor: 'pointer', fontSize: 11, textAlign: 'center',
              }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{MONTHS[s.month - 1]}</div>
              <div style={{ color: '#2196f3' }}>{fmt(s.revenue / 10000)}만</div>
              <div style={{ color: '#f44336' }}>{fmt(s.expense / 10000)}만</div>
              <div style={{ color: s.profit >= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                {s.profit >= 0 ? '+' : ''}{fmt(s.profit / 10000)}만
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* 선택 월 요약 카드 */}
      {currentSummary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
          {[
            { label: '매출', value: currentSummary.revenue, color: '#1976d2' },
            { label: '지출', value: currentSummary.expense, color: '#f44336' },
            { label: '손익', value: currentSummary.profit, color: currentSummary.profit >= 0 ? '#4caf50' : '#f44336' },
          ].map(card => (
            <div key={card.label} style={{ background: 'var(--c-card)', borderRadius: 8, padding: '16px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
              <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 4 }}>{selectedYear}년 {selectedMonth}월 {card.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: card.color, fontFamily: 'monospace' }}>
                {fmt(card.value)}원
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 상세 내역 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {MONTHS.map((m, i) => (
            <button key={i + 1} onClick={() => setSelectedMonth(i + 1)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid',
                borderColor: selectedMonth === i + 1 ? '#1976d2' : 'var(--c-border-in)',
                background: selectedMonth === i + 1 ? '#1976d2' : 'var(--c-card)',
                color: selectedMonth === i + 1 ? '#fff' : 'var(--c-text)',
                cursor: 'pointer', fontSize: 12,
              }}>{m}</button>
          ))}
        </div>
        <button onClick={() => { resetForm(); setShowForm(true) }}
          style={{ padding: '6px 16px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
          + 추가
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--c-bg)', border: '1px solid var(--c-border-in)', borderRadius: 8, padding: 20, marginBottom: 20 }}>
          <h3 style={{ margin: '0 0 16px' }}>{editing ? '내역 수정' : '새 내역 추가'}</h3>
          <form onSubmit={handleSubmit}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>구분 *</span>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as FinanceCategory }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--c-border-in)' }}>
                  <option value="REVENUE">매출</option>
                  <option value="EXPENSE">지출</option>
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>항목명 *</span>
                <input value={form.itemName} onChange={e => setForm(f => ({ ...f, itemName: e.target.value }))}
                  required style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--c-border-in)' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>금액 (원) *</span>
                <input type="number" min={0} value={form.amount || ''} onChange={e => setForm(f => ({ ...f, amount: +e.target.value }))}
                  required style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--c-border-in)' }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span>비고</span>
                <input value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  style={{ padding: '8px', borderRadius: 4, border: '1px solid var(--c-border-in)' }} />
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button type="submit"
                style={{ padding: '8px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}>
                {editing ? '수정' : '저장'}
              </button>
              <button type="button" onClick={resetForm}
                style={{ padding: '8px 20px', background: 'var(--c-card)', border: '1px solid var(--c-border-in)', borderRadius: 6, cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {isLoading ? <p>로딩 중...</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse', background: 'var(--c-card)', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <thead>
            <tr style={{ background: 'var(--c-thead)' }}>
              {['구분', '항목명', '금액', '비고', '등록일', ''].map(h => (
                <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontWeight: 600, fontSize: 13, borderBottom: '1px solid var(--c-border)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: 'var(--c-text-muted)' }}>데이터가 없습니다.</td></tr>
            ) : records.map(rec => (
              <tr key={rec.id} style={{ borderBottom: '1px solid var(--c-border-in)' }}>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 12,
                    background: rec.category === 'REVENUE' ? '#e3f2fd' : '#ffebee',
                    color: rec.category === 'REVENUE' ? '#1565c0' : '#c62828',
                  }}>{CATEGORY_LABEL[rec.category]}</span>
                </td>
                <td style={{ padding: '10px 14px', fontWeight: 500 }}>{rec.itemName}</td>
                <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600,
                  color: rec.category === 'REVENUE' ? '#1565c0' : '#c62828' }}>
                  {rec.category === 'REVENUE' ? '+' : '-'}{fmt(rec.amount)}원
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--c-text-sub)' }}>{rec.note ?? '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--c-text-muted)' }}>
                  {new Date(rec.createdAt).toLocaleDateString('ko-KR')}
                </td>
                <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(rec)}
                    style={{ marginRight: 6, padding: '4px 10px', fontSize: 12, border: '1px solid #90caf9', borderRadius: 4, background: '#e3f2fd', color: '#1565c0', cursor: 'pointer' }}>
                    수정
                  </button>
                  <button onClick={() => { if (confirm('삭제하시겠습니까?')) deleteMut.mutate(rec.id) }}
                    style={{ padding: '4px 10px', fontSize: 12, border: '1px solid #ef9a9a', borderRadius: 4, background: '#ffebee', color: '#c62828', cursor: 'pointer' }}>
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 16 }}>
        {[
          { label: `${year}년 총 매출`, value: totalRevenue, color: '#1976d2' },
          { label: `${year}년 총 지출`, value: totalExpense, color: '#f44336' },
          { label: `${year}년 총 손익`, value: totalProfit,  color: totalProfit >= 0 ? '#4caf50' : '#f44336' },
        ].map(card => (
          <div key={card.label} style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, padding: '20px 24px' }}>
            <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 8 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: card.color, fontFamily: 'monospace' }}>
              {totalProfit < 0 && card.label.includes('손익') ? '-' : ''}{fmt(Math.abs(card.value))}원
            </div>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 8, padding: 20 }}>
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--c-text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.06em', marginBottom: 16 }}>월별 매출 / 지출</div>
        {summary.length === 0 ? <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>데이터 없음</p> : (
          <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 14 }}>
            {summary.map(m => (
              <div key={m.month}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 5, color: 'var(--c-text-sub)' }}>
                  <span style={{ fontWeight: 600 }}>{m.month}월</span>
                  <span style={{ color: m.profit >= 0 ? '#4caf50' : '#f44336', fontWeight: 600 }}>
                    손익 {m.profit >= 0 ? '+' : ''}{fmt(m.profit)}원
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 3 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#1976d2', width: 24 }}>매출</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--c-bg)' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: '#1976d2', width: `${(m.revenue / maxVal) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', minWidth: 80, textAlign: 'right' as const }}>{fmt(m.revenue)}원</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: '#f44336', width: 24 }}>지출</span>
                    <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--c-bg)' }}>
                      <div style={{ height: '100%', borderRadius: 4, background: '#f44336', width: `${(m.expense / maxVal) * 100}%` }} />
                    </div>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', minWidth: 80, textAlign: 'right' as const }}>{fmt(m.expense)}원</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
