import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { chat, AiRole } from '../../api/aiApi'
import { aiConfig } from '../../config/aiConfig'
import { useAuth } from '../../context/useAuth'

const ROLES: { value: AiRole; label: string; color: string }[] = [
  { value: 'backend',  label: '백엔드',    color: '#1976d2' },
  { value: 'android',  label: '안드로이드', color: '#4caf50' },
  { value: 'frontend', label: '프론트엔드', color: '#ff9800' },
  { value: 'planner',  label: '기획',      color: '#9c27b0' },
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
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  // AI 비활성화 또는 비로그인 시 렌더링 안 함
  if (!aiConfig.enabled || !user) return null

  const selectedColor = ROLES.find(r => r.value === role)?.color ?? '#1976d2'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

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
            padding: '12px 16px', background: '#1a1a2e',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 16 }}>⚡</span>
              <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>AI 어시스턴트</span>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={goToFullPage} style={{
                fontSize: 11, color: '#a0aec0', background: 'none',
                border: '1px solid #2d3748', borderRadius: 4,
                padding: '3px 8px', cursor: 'pointer',
              }}>
                전체화면
              </button>
              <button onClick={handleClose} style={{
                fontSize: 16, color: '#a0aec0', background: 'none',
                border: 'none', cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
              }}>
                ×
              </button>
            </div>
          </div>

          {/* 역할 탭 */}
          <div style={{
            display: 'flex', padding: '8px 10px', gap: 4,
            borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg)',
          }}>
            {ROLES.map(r => (
              <button key={r.value} onClick={() => setRole(r.value)} style={{
                flex: 1, padding: '4px 0', borderRadius: 4, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${role === r.value ? r.color : 'transparent'}`,
                background: role === r.value ? r.color + '18' : 'transparent',
                color: role === r.value ? r.color : 'var(--c-text-muted)',
                fontWeight: role === r.value ? 600 : 400,
                transition: 'all 0.12s',
              }}>
                {r.label}
              </button>
            ))}
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
                  color: msg.from === 'user' ? '#fff' : 'var(--c-text)',
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
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send() }}
              placeholder="질문 입력..."
              style={{
                flex: 1, border: '1px solid var(--c-border)', borderRadius: 6,
                padding: '7px 10px', fontSize: 13, outline: 'none',
                background: 'var(--c-input-bg)', color: 'var(--c-text)',
              }}
            />
            {loading ? (
              <button onClick={() => { abortRef.current?.abort(); setLoading(false) }} style={{
                padding: '7px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                background: '#f44336', color: '#fff', border: 'none', fontWeight: 600,
              }}>
                중지
              </button>
            ) : (
              <button onClick={send} disabled={!input.trim()} style={{
                padding: '7px 12px', borderRadius: 6, fontSize: 12,
                cursor: input.trim() ? 'pointer' : 'default',
                background: input.trim() ? selectedColor : 'var(--c-border)',
                color: input.trim() ? '#fff' : 'var(--c-text-muted)',
                border: 'none', fontWeight: 600, transition: 'background 0.15s',
              }}>
                전송
              </button>
            )}
          </div>
        </div>
      )}

      {/* 플로팅 버튼 */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          position: 'fixed', bottom: 24, right: 24, zIndex: 1001,
          width: 52, height: 52, borderRadius: '50%',
          background: open ? '#4a5568' : '#1a1a2e',
          border: `2px solid ${open ? '#718096' : selectedColor}`,
          color: '#fff', fontSize: 22, cursor: 'pointer',
          boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.2s',
        }}
        title={open ? 'AI 닫기' : 'AI 어시스턴트 열기'}
      >
        {open ? '×' : '⚡'}
      </button>
    </>
  )
}
