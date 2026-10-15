import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { chat, AiRole } from '../../api/aiApi'
import { aiConfig } from '../../config/aiConfig'
import { useAuth } from '../../context/useAuth'
import { Button, IconButton, Input, ChipGroup } from '../ui'

const ROLES: { value: AiRole; label: string; color: string }[] = [
  { value: 'backend',  label: '백엔드',    color: 'var(--c-chart-1)' },
  { value: 'android',  label: '안드로이드', color: 'var(--c-chart-2)' },
  { value: 'frontend', label: '프론트엔드', color: 'var(--c-chart-3)' },
  { value: 'planner',  label: '기획',      color: 'var(--c-chart-5)' },
]

interface WMsg {
  id: number
  from: 'user' | 'ai'
  text: string
  streaming?: boolean
}

let _wseq = 0

export default function AiChatWidget() {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [role, setRole] = useState<AiRole>('backend')
  const [messages, setMessages] = useState<WMsg[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  // SDK Input 은 ref 전달 불가 → 감싼 div 에서 input 을 찾아 포커스
  const inputWrapRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputWrapRef.current?.querySelector('input')?.focus(), 100)
  }, [open])

  // AI 비활성화 또는 비로그인 시 렌더링 안 함 (훅 규칙: 모든 훅 호출 이후에 반환)
  if (!aiConfig.enabled || !user) return null

  const selectedColor = ROLES.find(r => r.value === role)?.color ?? 'var(--c-chart-1)'

  const send = () => {
    const text = input.trim()
    if (!text || loading) return

    setInput('')
    setLoading(true)

    const userMsg: WMsg = { id: ++_wseq, from: 'user', text }
    const aiId = ++_wseq
    const aiMsg: WMsg = { id: aiId, from: 'ai', text: '', streaming: true }
    setMessages(prev => [...prev, userMsg, aiMsg])

    const memberId = user.username
    abortRef.current = chat(
      text, role, memberId, null,
      () => {},
      (token) => setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, text: m.text + token } : m
      )),
      () => {
        setLoading(false)
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, streaming: false } : m
        ))
      },
      (err) => {
        setLoading(false)
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, text: `오류: ${err.message}`, streaming: false } : m
        ))
      },
    )
  }

  const handleClose = () => {
    abortRef.current?.abort()
    setLoading(false)
    setOpen(false)
  }

  const goToFullPage = () => {
    handleClose()
    navigate('/ai')
  }

  return (
    <>
      {/* 채팅 팝업 */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 80, right: 24, zIndex: 1000,
          width: 360, height: 480,
          background: 'var(--c-card)', borderRadius: 14,
          border: '1px solid var(--c-border)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {/* 팝업 헤더 */}
          <div style={{
            padding: '12px 16px', background: 'var(--rsp-color-neutral-900)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ color: 'var(--rsp-color-neutral-0)', fontWeight: 600, fontSize: 14 }}>AI 어시스턴트</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {/* 어두운 헤더 배경 위라 글자색만 유지 */}
              <Button variant="text" size="xs" onClick={goToFullPage} style={{ color: 'var(--rsp-color-neutral-400)' }}>
                전체화면
              </Button>
              <IconButton variant="text" size="sm" icon="×" label="닫기" onClick={handleClose} style={{ color: 'var(--rsp-color-neutral-400)' }} />
            </div>
          </div>

          {/* 역할 탭 */}
          <div style={{
            display: 'flex', padding: '8px 10px', gap: 4,
            borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg)',
          }}>
            <ChipGroup
              value={role}
              onChange={setRole}
              options={ROLES.map(r => ({ value: r.value, label: r.label, color: r.color }))}
            />
          </div>

          {/* 메시지 영역 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--c-text-muted)', fontSize: 13, marginTop: 40 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>⚡</div>
                무엇이든 물어보세요
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.from === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%', padding: '8px 12px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
                  background: msg.from === 'user' ? selectedColor : 'var(--c-bg)',
                  color: msg.from === 'user' ? 'var(--rsp-color-text-on-primary)' : 'var(--c-text)',
                  border: msg.from === 'ai' ? '1px solid var(--c-border)' : 'none',
                  borderTopRightRadius: msg.from === 'user' ? 2 : 10,
                  borderTopLeftRadius: msg.from === 'ai' ? 2 : 10,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>
                  {msg.text}
                  {msg.streaming && (
                    <span className="ai-cursor" style={{
                      display: 'inline-block', width: 2, height: '1em',
                      background: selectedColor, marginLeft: 2, verticalAlign: 'text-bottom',
                    }} />
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* 입력창 */}
          <div style={{
            padding: '10px 12px', borderTop: '1px solid var(--c-border)',
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <div ref={inputWrapRef} style={{ flex: 1 }}>
              <Input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') send() }}
                placeholder="질문 입력..."
              />
            </div>
            {loading ? (
              <Button
                variant="danger"
                size="sm"
                onClick={() => { abortRef.current?.abort(); setLoading(false) }}
              >
                중지
              </Button>
            ) : (
              <Button variant="filled" size="sm" onClick={send} disabled={!input.trim()}>
                전송
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 플로팅 버튼 */}
      {/* 어두운 셸 색상은 테마와 무관한 중립 프리미티브 유지 */}
      <IconButton
        variant="filled"
        size="lg"
        icon={open ? '×' : '⚡'}
        label={open ? 'AI 닫기' : 'AI 어시스턴트 열기'}
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1001,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? 'var(--rsp-color-neutral-700)' : 'var(--rsp-color-neutral-900)',
          border: `2px solid ${open ? 'var(--rsp-color-neutral-500)' : selectedColor}`,
          color: 'var(--rsp-color-neutral-0)', fontSize: 22,
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        }}
      />
    </>
  )
}
