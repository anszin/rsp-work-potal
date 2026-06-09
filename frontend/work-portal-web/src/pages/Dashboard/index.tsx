import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import client from '../../api/client'
import { financeApi, MonthlySummary } from '../../api/finance'
import { inventoryApi } from '../../api/inventory'
import { meetingApi, dailyCheckApi, DailyCheckReport } from '../../api/reports'

const today = new Date().toISOString().slice(0, 10)
const currentYear = new Date().getFullYear()
const currentMonth = new Date().getMonth() + 1

const MONTHS = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
const STATUS_COLOR: Record<string, string> = { NORMAL: '#4caf50', WARNING: '#ff9800', CRITICAL: '#f44336' }
const STATUS_LABEL: Record<string, string> = { NORMAL: '정상', WARNING: '주의', CRITICAL: '위험' }
const REQ_STATUS_COLOR: Record<string, string> = {
  DRAFT: '#9e9e9e', REQUESTED: '#2196f3', APPROVED: '#4caf50', COMPLETED: '#00bcd4', REJECTED: '#f44336',
}
const REQ_STATUS_LABEL: Record<string, string> = {
  DRAFT: '초안', REQUESTED: '요청', APPROVED: '승인', COMPLETED: '완료', REJECTED: '반려',
}

function StatCard({ label, value, sub, color, onClick }: {
  label: string; value: string | number; sub?: string; color?: string; onClick?: () => void
}) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--c-card)', borderRadius: 10, padding: '18px 22px',
      boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: onClick ? 'pointer' : 'default',
      borderLeft: `4px solid ${color || '#1976d2'}`,
      transition: 'box-shadow 0.15s',
    }}
      onMouseEnter={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)')}
      onMouseLeave={e => onClick && ((e.currentTarget as HTMLDivElement).style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)')}
    >
      <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, color: color || '#1976d2', fontFamily: 'monospace' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function BarChart({ data }: { data: MonthlySummary[] }) {
  const maxVal = Math.max(...data.flatMap(d => [d.revenue, d.expense]), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 120, padding: '0 4px' }}>
      {data.map(d => {
        const revH = Math.round((d.revenue / maxVal) * 100)
        const expH = Math.round((d.expense / maxVal) * 100)
        const isCurrent = d.month === currentMonth
        return (
          <div key={d.month} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
            <div style={{ width: '100%', display: 'flex', alignItems: 'flex-end', gap: 1, height: 100 }}>
              <div style={{ flex: 1, height: revH + '%', background: isCurrent ? '#1976d2' : '#90caf9', borderRadius: '2px 2px 0 0', minHeight: d.revenue > 0 ? 2 : 0 }} title={`매출 ${(d.revenue/10000).toLocaleString()}만`} />
              <div style={{ flex: 1, height: expH + '%', background: isCurrent ? '#f44336' : '#ef9a9a', borderRadius: '2px 2px 0 0', minHeight: d.expense > 0 ? 2 : 0 }} title={`지출 ${(d.expense/10000).toLocaleString()}만`} />
            </div>
            <div style={{ fontSize: 10, color: isCurrent ? '#1976d2' : 'var(--c-text-muted)', fontWeight: isCurrent ? 700 : 400 }}>
              {MONTHS[d.month - 1].replace('월', '')}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function DashboardPage() {
  const { user, menuPermissions } = useAuth()
  const navigate = useNavigate()
  const can = (key: string) => menuPermissions[key] !== false

  const { data: summary = [] } = useQuery({
    queryKey: ['finance-summary', currentYear],
    queryFn: () => financeApi.summary(currentYear).then(r => r.data),
  })

  const { data: inventory = [] } = useQuery({
    queryKey: ['inventory'],
    queryFn: () => inventoryApi.list().then(r => r.data),
  })

  const { data: changeRequests = [] } = useQuery({
    queryKey: ['change-requests'],
    queryFn: () => client.get<any[]>('/api/change-requests').then(r => r.data),
  })

  const { data: deployRequests = [] } = useQuery({
    queryKey: ['deploy-requests'],
    queryFn: () => client.get<any[]>('/api/deploy-requests').then(r => r.data),
  })

  const { data: todayChecks = [] } = useQuery({
    queryKey: ['daily-checks', today],
    queryFn: () => dailyCheckApi.list(today).then(r => r.data),
  })

  const { data: meetings = [] } = useQuery({
    queryKey: ['meeting-minutes'],
    queryFn: () => meetingApi.list().then(r => r.data),
  })

  const { data: systems = [] } = useQuery({
    queryKey: ['systems'],
    queryFn: () => client.get<any[]>('/api/systems').then(r => r.data),
  })

  const thisMonthSummary = summary.find(s => s.month === currentMonth) ?? { revenue: 0, expense: 0, profit: 0 }
  const activeContracts = inventory.filter(i => i.type === 'CONTRACT' && i.status === 'ACTIVE')
  const pendingChanges = changeRequests.filter(r => ['DRAFT', 'REQUESTED', 'APPROVED'].includes(r.status))
  const pendingDeploys = deployRequests.filter(r => ['DRAFT', 'REQUESTED', 'APPROVED'].includes(r.status))

  const fmt = (n: number) => {
    if (Math.abs(n) >= 100000000) return (n / 100000000).toFixed(1) + '억'
    if (Math.abs(n) >= 10000) return Math.round(n / 10000) + '만'
    return n.toLocaleString()
  }

  return (
    <div style={{ padding: '28px 36px', background: 'var(--c-bg)', minHeight: '100vh' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>종합 대시보드</h2>
        <div style={{ fontSize: 13, color: 'var(--c-text-muted)', marginTop: 4 }}>
          안녕하세요, {user?.username}님 · {new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
        </div>
      </div>

      {/* 요약 카드 */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${[can('finance'), can('inventory'), can('change_requests'), can('deploys')].filter(Boolean).length}, 1fr)`, gap: 14, marginBottom: 20 }}>
        {can('finance') && (
          <StatCard
            label={`${currentMonth}월 손익`}
            value={(thisMonthSummary.profit >= 0 ? '+' : '') + fmt(thisMonthSummary.profit) + '원'}
            sub={`매출 ${fmt(thisMonthSummary.revenue)} / 지출 ${fmt(thisMonthSummary.expense)}`}
            color={thisMonthSummary.profit >= 0 ? '#4caf50' : '#f44336'}
            onClick={() => navigate('/finance')}
          />
        )}
        {can('inventory') && (
          <StatCard
            label="진행 중 수주"
            value={activeContracts.length + '건'}
            sub={activeContracts.reduce((s, i) => s + (i.amount ?? 0), 0) > 0
              ? fmt(activeContracts.reduce((s, i) => s + (i.amount ?? 0), 0)) + '원' : '금액 미정'}
            color="#1976d2"
            onClick={() => navigate('/inventory')}
          />
        )}
        {can('change_requests') && (
          <StatCard
            label="미결 변경관리"
            value={pendingChanges.length + '건'}
            sub={`전체 ${changeRequests.length}건`}
            color="#ff9800"
            onClick={() => navigate('/requests')}
          />
        )}
        {can('deploys') && (
          <StatCard
            label="미결 배포요청"
            value={pendingDeploys.length + '건'}
            sub={`전체 ${deployRequests.length}건`}
            color="#9c27b0"
            onClick={() => navigate('/deploys')}
          />
        )}
      </div>

      {/* 중단: 차트 + 일일점검 */}
      {(can('finance') || can('daily_check')) && (
      <div style={{ display: 'grid', gridTemplateColumns: can('finance') && can('daily_check') ? '1fr 380px' : '1fr', gap: 14, marginBottom: 20 }}>
        {/* 월별 손익 차트 */}
        {can('finance') && <div style={{ background: 'var(--c-card)', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{currentYear}년 월별 손익</div>
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--c-text-muted)' }}>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#1976d2', borderRadius: 2, marginRight: 4 }} />매출</span>
              <span><span style={{ display: 'inline-block', width: 8, height: 8, background: '#f44336', borderRadius: 2, marginRight: 4 }} />지출</span>
            </div>
          </div>
          <BarChart data={summary} />
          <div style={{ marginTop: 14, display: 'flex', gap: 20, fontSize: 12, color: 'var(--c-text-sub)', borderTop: '1px solid var(--c-thead)', paddingTop: 12 }}>
            {['revenue', 'expense', 'profit'].map(key => {
              const total = summary.reduce((s, d) => s + (d as any)[key], 0)
              const labels: Record<string, string> = { revenue: '연간 누적 매출', expense: '연간 누적 지출', profit: '연간 누적 손익' }
              return (
                <div key={key}>
                  <span style={{ color: 'var(--c-text-muted)' }}>{labels[key]}: </span>
                  <span style={{ fontWeight: 600, color: key === 'profit' ? (total >= 0 ? '#4caf50' : '#f44336') : 'var(--c-text)' }}>
                    {(total >= 0 && key === 'profit' ? '+' : '')}{fmt(total)}원
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* 오늘 일일점검 */}
        {can('daily_check') && <div style={{ background: 'var(--c-card)', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>오늘 점검 현황</div>
            <button onClick={() => navigate('/reports/daily')}
              style={{ fontSize: 12, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              전체보기 →
            </button>
          </div>
          {systems.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 시스템이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {systems.map((sys: any) => {
                const check = todayChecks.find((c: DailyCheckReport) => c.systemId === sys.id)
                return (
                  <div key={sys.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '8px 12px', borderRadius: 6,
                    background: check ? STATUS_COLOR[check.status] + '11' : 'var(--c-bg)',
                    border: '1px solid ' + (check ? STATUS_COLOR[check.status] + '44' : 'var(--c-thead)'),
                  }}>
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{sys.name}</div>
                      {check?.note && <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{check.note}</div>}
                    </div>
                    {check ? (
                      <span style={{
                        padding: '3px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600,
                        background: STATUS_COLOR[check.status] + '22', color: STATUS_COLOR[check.status],
                      }}>{STATUS_LABEL[check.status]}</span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>미점검</span>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {todayChecks.length > 0 && todayChecks.every((c: DailyCheckReport) => c.status === 'NORMAL') && (
            <div style={{ marginTop: 12, fontSize: 12, color: '#4caf50', fontWeight: 600, textAlign: 'center' }}>
              ✓ 모든 시스템 정상 운영 중
            </div>
          )}
        </div>}
      </div>
      )}

      {/* 시스템별 배포 현황 */}
      {can('deploys') && systems.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>시스템별 배포 현황</div>
            <button onClick={() => navigate('/deploys')}
              style={{ fontSize: 12, color: '#9c27b0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
              전체보기 →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {systems.map((sys: any) => {
              const sysDeploys: any[] = deployRequests.filter((r: any) => r.systemId === sys.id)
              const thisMonthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`
              const lastMonth = currentMonth === 1 ? 12 : currentMonth - 1
              const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear
              const lastMonthKey = `${lastMonthYear}-${String(lastMonth).padStart(2, '0')}`
              const thisMonthCount = sysDeploys.filter(r => r.createdAt?.slice(0, 7) === thisMonthKey).length
              const lastMonthCount = sysDeploys.filter(r => r.createdAt?.slice(0, 7) === lastMonthKey).length
              const statusCounts: Record<string, number> = {}
              sysDeploys.forEach(r => { statusCounts[r.status] = (statusCounts[r.status] || 0) + 1 })
              const recent = [...sysDeploys].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
              const pendingCount = (statusCounts['REQUESTED'] || 0) + (statusCounts['APPROVED'] || 0)
              const trendIcon = thisMonthCount > lastMonthCount ? '↑' : thisMonthCount < lastMonthCount ? '↓' : '━'
              const trendColor = thisMonthCount > lastMonthCount ? '#4caf50' : thisMonthCount < lastMonthCount ? '#f44336' : 'var(--c-text-muted)'
              return (
                <div key={sys.id} onClick={() => navigate('/deploys')} style={{
                  background: 'var(--c-card)', borderRadius: 10, padding: '16px 20px',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.08)', cursor: 'pointer',
                  borderTop: `3px solid ${pendingCount > 0 ? '#9c27b0' : 'var(--c-border)'}`,
                  transition: 'box-shadow 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.12)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.08)')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{sys.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{sys.code}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#9c27b0' }}>{thisMonthCount}건</div>
                      <div style={{ fontSize: 11, color: trendColor, marginTop: 2 }}>
                        전달 {lastMonthCount}건 {trendIcon}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' as const }}>
                    {([
                      { key: 'DRAFT',     label: '초안', color: '#9e9e9e' },
                      { key: 'REQUESTED', label: '요청', color: '#2196f3' },
                      { key: 'APPROVED',  label: '승인', color: '#4caf50' },
                      { key: 'COMPLETED', label: '완료', color: '#00bcd4' },
                      { key: 'REJECTED',  label: '반려', color: '#f44336' },
                    ] as const).map(({ key, label, color }) =>
                      statusCounts[key] > 0 && (
                        <span key={key} style={{
                          fontSize: 11, padding: '2px 8px', borderRadius: 10,
                          background: color + '22', color,
                        }}>
                          {label} {statusCounts[key]}
                        </span>
                      )
                    )}
                    {sysDeploys.length === 0 && (
                      <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>배포 내역 없음</span>
                    )}
                  </div>

                  {recent && (
                    <div style={{
                      fontSize: 12, color: 'var(--c-text-muted)',
                      borderTop: '1px solid var(--c-thead)', paddingTop: 8,
                      display: 'flex', justifyContent: 'space-between', gap: 8,
                    }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const, flex: 1 }}>
                        {recent.version ? `${recent.version} · ` : ''}{recent.title}
                      </span>
                      <span style={{ flexShrink: 0, color: 'var(--c-text-muted)' }}>{recent.createdAt?.slice(0, 10)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 하단: 최근 요청 + 최근 회의록 */}
      {(can('change_requests') || can('deploys') || can('meeting_minutes') || can('inventory')) && (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        {/* 최근 변경/배포 요청 */}
        {(can('change_requests') || can('deploys')) && <div style={{ background: 'var(--c-card)', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>최근 요청</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {can('change_requests') && <button onClick={() => navigate('/requests')}
                style={{ fontSize: 12, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                변경관리 →
              </button>}
              {can('deploys') && <button onClick={() => navigate('/deploys')}
                style={{ fontSize: 12, color: '#9c27b0', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                배포요청 →
              </button>}
            </div>
          </div>
          {changeRequests.length === 0 && deployRequests.length === 0 ? (
            <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 요청이 없습니다.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {[
                ...changeRequests.map(r => ({ ...r, _type: '변경' })),
                ...deployRequests.map(r => ({ ...r, _type: '배포' })),
              ]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 6)
                .map(r => (
                  <div key={r._type + r.id} style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '7px 10px', borderRadius: 6, background: 'var(--c-bg)', border: '1px solid var(--c-thead)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      <span style={{
                        padding: '1px 6px', borderRadius: 4, fontSize: 11,
                        background: r._type === '변경' ? '#e3f2fd' : '#f3e5f5',
                        color: r._type === '변경' ? '#1565c0' : '#6a1b9a',
                        flexShrink: 0,
                      }}>{r._type}</span>
                      <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span>
                    </div>
                    <span style={{
                      padding: '2px 8px', borderRadius: 10, fontSize: 11, flexShrink: 0, marginLeft: 8,
                      background: (REQ_STATUS_COLOR[r.status] || '#9e9e9e') + '22',
                      color: REQ_STATUS_COLOR[r.status] || '#9e9e9e',
                    }}>{REQ_STATUS_LABEL[r.status] || r.status}</span>
                  </div>
                ))}
            </div>
          )}
        </div>}

        {/* 최근 회의록 + 인벤토리 */}
        {(can('meeting_minutes') || can('inventory')) && <div style={{ background: 'var(--c-card)', borderRadius: 10, padding: '18px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.08)' }}>
          {can('meeting_minutes') && <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>최근 회의록</div>
              <button onClick={() => navigate('/reports/meeting')}
                style={{ fontSize: 12, color: '#1976d2', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                전체보기 →
              </button>
            </div>
            {meetings.length === 0 ? (
              <p style={{ color: 'var(--c-text-muted)', fontSize: 13 }}>등록된 회의록이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {meetings.slice(0, 5).map((m: any) => (
                  <div key={m.id} onClick={() => navigate('/reports/meeting')}
                    style={{
                      padding: '10px 12px', borderRadius: 6, background: 'var(--c-bg)',
                      border: '1px solid var(--c-thead)', cursor: 'pointer',
                    }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ fontWeight: 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{m.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginLeft: 8, flexShrink: 0 }}>{m.meetingDate}</div>
                    </div>
                    {m.attendees && (
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 3 }}>참석: {m.attendees}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>}

          {/* 인벤토리 요약 */}
          {can('inventory') && <div style={{ marginTop: can('meeting_minutes') ? 16 : 0, paddingTop: can('meeting_minutes') ? 14 : 0, borderTop: can('meeting_minutes') ? '1px solid var(--c-thead)' : 'none' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: 'var(--c-text-sub)' }}>인벤토리 현황</div>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { label: '수주', type: 'CONTRACT', color: '#1565c0', bg: '#e3f2fd' },
                { label: '제안', type: 'PROPOSAL', color: '#e65100', bg: '#fff3e0' },
              ].map(({ label, type, color, bg }) => {
                const active = inventory.filter(i => i.type === type && i.status === 'ACTIVE')
                const total = inventory.filter(i => i.type === type)
                return (
                  <div key={type} onClick={() => navigate('/inventory')}
                    style={{ flex: 1, padding: '10px 12px', borderRadius: 8, background: bg, cursor: 'pointer' }}>
                    <div style={{ fontSize: 11, color, marginBottom: 2 }}>{label}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color }}>{active.length}<span style={{ fontSize: 12, fontWeight: 400 }}>건 진행</span></div>
                    <div style={{ fontSize: 11, color: color + 'aa' }}>전체 {total.length}건</div>
                  </div>
                )
              })}
            </div>
          </div>}
        </div>}
      </div>
      )}
    </div>
  )
}
