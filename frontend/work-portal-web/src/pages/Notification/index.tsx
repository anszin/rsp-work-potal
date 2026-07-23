import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getUsers, UserSummary } from '../../api/users'
import { notificationApi } from '../../api/notifications'
import { useAuth } from '../../context/useAuth'

const TEMPLATES = [
  { label: '주간보고 제출 요청', text: '이번 주 주간보고 등록 부탁드립니다. 금일 오후 6시까지 포탈에 등록해 주세요.' },
  { label: '회의 안내', text: '팀 회의가 예정되어 있습니다. 일정 확인 후 참석 부탁드립니다.' },
  { label: '공지사항', text: '안내 드릴 사항이 있습니다. 포탈을 확인해 주세요.' },
]

export default function NotificationPage() {
  const { user } = useAuth()

  const [target, setTarget] = useState<'ALL' | 'SELECTED'>('ALL')
  const [useRoom, setUseRoom] = useState(false)
  const [selectedUsernames, setSelectedUsernames] = useState<Set<string>>(new Set())
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<{ sent: number; msg: string } | null>(null)

  const { data: users = [] } = useQuery<UserSummary[]>({
    queryKey: ['users'],
    queryFn: getUsers,
  })

  const activeMembers = users.filter(u => u.active && u.role !== 'EXTERNAL')

  const sendMut = useMutation({
    mutationFn: () => notificationApi.send({
      target,
      usernames: target === 'SELECTED' ? Array.from(selectedUsernames) : undefined,
      message,
      senderName: user?.name || user?.username,
      useRoom: target === 'ALL' ? useRoom : false,
    }),
    onSuccess: (res) => {
      setResult({ sent: res.data.sent, msg: res.data.message })
      setMessage('')
      setSelectedUsernames(new Set())
    },
    onError: () => setResult({ sent: 0, msg: '발송 실패. 웹엑스 설정을 확인하세요.' }),
  })

  const toggleUser = (username: string) => {
    setSelectedUsernames(prev => {
      const next = new Set(prev)
      if (next.has(username)) next.delete(username); else next.add(username)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedUsernames.size === activeMembers.length) {
      setSelectedUsernames(new Set())
    } else {
      setSelectedUsernames(new Set(activeMembers.map(u => u.username)))
    }
  }

  const canSend = message.trim() && (target === 'ALL' || selectedUsernames.size > 0)

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 20px' }}>
      <h2 style={{ margin: '0 0 6px', fontSize: 22 }}>공지 발송</h2>
      <p style={{ margin: '0 0 28px', fontSize: 13, color: 'var(--c-text-muted)' }}>
        웹엑스를 통해 팀원에게 공지 또는 리마인더를 발송합니다.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

        {/* 수신자 */}
        <section>
          <label style={s.sectionLabel}>수신자</label>
          <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
            {(['ALL', 'SELECTED'] as const).map(t => (
              <button key={t} onClick={() => setTarget(t)}
                style={{ ...s.toggleBtn, ...(target === t ? s.toggleBtnActive : {}) }}>
                {t === 'ALL' ? '전체 팀원' : '개별 선택'}
              </button>
            ))}
          </div>

          {target === 'ALL' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                <input type="checkbox" checked={useRoom} onChange={e => setUseRoom(e.target.checked)}
                  style={{ width: 15, height: 15, cursor: 'pointer' }} />
                개인 DM 대신 공용 룸에 발송
              </label>
              <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>
                (룸 발송은 웹엑스 room-id 설정 필요)
              </span>
            </div>
          )}

          {target === 'SELECTED' && (
            <div style={{ border: '1px solid var(--c-border)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'var(--c-thead)', borderBottom: '1px solid var(--c-border)' }}>
                <input type="checkbox"
                  checked={selectedUsernames.size === activeMembers.length && activeMembers.length > 0}
                  onChange={toggleAll} style={{ width: 15, height: 15, cursor: 'pointer' }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--c-text-sub)' }}>
                  전체 선택 ({selectedUsernames.size}/{activeMembers.length}명)
                </span>
              </div>
              <div style={{ maxHeight: 220, overflowY: 'auto' }}>
                {activeMembers.map(u => (
                  <label key={u.username} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid var(--c-border)', background: selectedUsernames.has(u.username) ? '#1976d208' : 'var(--c-card)' }}>
                    <input type="checkbox" checked={selectedUsernames.has(u.username)} onChange={() => toggleUser(u.username)}
                      style={{ width: 15, height: 15, cursor: 'pointer', flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{u.name || u.username}</div>
                      <div style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                        {u.dept && <span>{u.dept} · </span>}
                        {u.email || '이메일 없음'}
                      </div>
                    </div>
                    <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 8, background: 'var(--c-thead)', color: 'var(--c-text-muted)', fontWeight: 600 }}>{u.role}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* 템플릿 */}
        <section>
          <label style={s.sectionLabel}>빠른 템플릿</label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {TEMPLATES.map(t => (
              <button key={t.label} onClick={() => setMessage(t.text)}
                style={{ fontSize: 12, padding: '5px 12px', border: '1px solid var(--c-border)', borderRadius: 16, background: 'var(--c-card)', color: 'var(--c-text)', cursor: 'pointer' }}>
                {t.label}
              </button>
            ))}
          </div>
        </section>

        {/* 메시지 */}
        <section>
          <label style={s.sectionLabel}>메시지 *</label>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="팀원에게 전달할 내용을 입력하세요..."
            rows={6}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 8, border: '1px solid var(--c-border-in)', fontSize: 14, background: 'var(--c-bg)', color: 'var(--c-text)', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7, boxSizing: 'border-box' }}
          />
          <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 6 }}>
            발송 시 앞에 <code style={{ background: 'var(--c-thead)', padding: '1px 4px', borderRadius: 3 }}>📢 [업무 포탈 공지]</code> 헤더가 자동으로 붙습니다.
          </div>
        </section>

        {/* 발송 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={() => { setResult(null); sendMut.mutate() }}
            disabled={!canSend || sendMut.isPending}
            style={{ padding: '10px 28px', background: canSend ? '#1976d2' : 'var(--c-border)', color: canSend ? '#fff' : 'var(--c-text-muted)', border: 'none', borderRadius: 8, cursor: canSend ? 'pointer' : 'not-allowed', fontSize: 14, fontWeight: 700 }}>
            {sendMut.isPending ? '발송 중...' : '🚀 웹엑스 발송'}
          </button>
          {result && (
            <div style={{ fontSize: 13, color: result.sent > 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
              {result.sent > 0 ? `✅ ${result.sent}명에게 발송 완료` : `❌ ${result.msg}`}
            </div>
          )}
        </div>

        {/* 자동 알림 안내 */}
        <section style={{ padding: '16px 18px', background: 'var(--c-thead)', borderRadius: 10, border: '1px solid var(--c-border)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>⏰ 자동 알림 (코드 설정)</div>
          <div style={{ fontSize: 12, color: 'var(--c-text-muted)', lineHeight: 1.8 }}>
            <div>• <strong>매주 금요일 오전 9시</strong> — 주간보고 미제출자에게 웹엑스 DM 자동 발송</div>
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--c-text-muted)' }}>
              스케줄 변경은 백엔드 <code>WeeklyReportReminderScheduler</code>의 cron 표현식을 수정하세요.
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

const s = {
  sectionLabel: {
    display: 'block' as const,
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 10,
    color: 'var(--c-text)',
  },
  toggleBtn: {
    padding: '7px 18px',
    border: '1px solid var(--c-border)',
    borderRadius: 20,
    background: 'var(--c-card)',
    color: 'var(--c-text-muted)',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  },
  toggleBtnActive: {
    background: '#1976d2',
    color: '#fff',
    border: '1px solid #1976d2',
    fontWeight: 700,
  },
}
