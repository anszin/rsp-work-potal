import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  chat,
  getConversations, getMessages, deleteConversation, getDocuments, getPrompts,
  RagSource, ConversationSummary, ConversationMessage,
} from '../../api/aiApi'
import { useAuth } from '../../context/useAuth'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const DEFAULT_ROLE_LIST: RoleItem[] = [
  { value: 'backend',  label: '백엔드',    color: '#1976d2' },
  { value: 'android',  label: '안드로이드', color: '#4caf50' },
  { value: 'frontend', label: '프론트엔드', color: '#ff9800' },
  { value: 'planner',  label: '기획',      color: '#9c27b0' },
]

const EXTRA_COLORS = ['#e91e63', '#00bcd4', '#ff5722', '#795548', '#009688', '#673ab7', '#3f51b5']

const DEFAULT_COLORS: Record<string, string> = {
  backend: '#1976d2', android: '#4caf50', frontend: '#ff9800', planner: '#9c27b0',
}

function getRoleColor(role: string, index: number): string {
  return DEFAULT_COLORS[role] ?? EXTRA_COLORS[index % EXTRA_COLORS.length]
}

const SAMPLE_QUESTIONS = [
  '소켓 데몬 연결 오류 해결 방법',
  'Spring Boot JPA N+1 문제 해결',
  'Android POS 단말기 통신 흐름',
  'React 상태관리 패턴 추천',
]

interface RoleItem { value: string; label: string; color: string; visibility?: 'public' | 'private' }

interface Message {
  id: number
  from: 'user' | 'ai'
  text: string
  sources?: RagSource[]
  streaming?: boolean
  error?: boolean
  createdAt?: string
}

let _seq = 0

// ── 날짜 포맷 ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  if (now.toDateString() === d.toDateString())
    return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })
}

function formatTime(iso?: string): string {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// ── 코드블록 ──────────────────────────────────────────────────────────────────

function CodeBlockWrapper({ lang, children }: { lang: string; children: React.ReactNode }) {
  const [copied, setCopied] = useState(false)
  const preRef = useRef<HTMLPreElement>(null)

  const copy = () => {
    navigator.clipboard.writeText(preRef.current?.textContent ?? '').then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div style={{ margin: '10px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid #2d3748' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 14px', background: '#161b2e' }}>
        <span style={{ fontSize: 11, color: '#718096', fontFamily: 'monospace' }}>{lang || 'code'}</span>
        <button onClick={copy} style={{ fontSize: 11, color: copied ? '#4caf50' : '#a0aec0', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <pre ref={preRef} style={{ margin: 0, padding: '12px 16px', overflowX: 'auto', background: '#1a1a2e', fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, color: '#e2e8f0' }}>
        {children}
      </pre>
    </div>
  )
}

const MD_COMPONENTS = {
  pre({ children }: any) {
    const child = children as React.ReactElement
    const cls: string = child?.props?.className ?? ''
    const lang = /language-(\w+)/.exec(cls)?.[1] ?? ''
    return <CodeBlockWrapper lang={lang}>{children}</CodeBlockWrapper>
  },
  code({ className, children, ...props }: any) {
    if (!className) {
      return (
        <code style={{ background: 'var(--c-thead)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: '0.88em' }} {...props}>
          {children}
        </code>
      )
    }
    return (
      <code className={className} style={{ fontFamily: 'monospace', fontSize: 13, lineHeight: 1.6, color: '#e2e8f0' }} {...props}>
        {children}
      </code>
    )
  },
}

// ── 참조 소스 ─────────────────────────────────────────────────────────────────

function SourceList({ sources }: { sources?: RagSource[] }) {
  if (!sources?.length) return null
  return (
    <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--c-border)' }}>
      <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginBottom: 6 }}>참조 소스</div>
      {sources.map((src, i) => {
        const url = src.sourceType === 'GITHUB'
          ? `https://github.com/${src.sourcePath}`
          : `http://210.93.169.131:7805/${src.sourcePath}`
        const fileName = src.sourcePath.split('/').pop() || src.sourcePath
        return (
          <div key={i} style={{ fontSize: 12, color: 'var(--c-text-sub)', padding: '3px 0', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
            <span style={{ color: 'var(--c-text-muted)', flexShrink: 0 }}>{i + 1}.</span>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title={src.sourcePath}
              style={{ color: src.sourceType === 'GITHUB' ? '#1976d2' : '#e65100', textDecoration: 'none', wordBreak: 'break-all' }}
            >
              {fileName}
            </a>
          </div>
        )
      })}
    </div>
  )
}

// ── 대화 사이드바 ─────────────────────────────────────────────────────────────

interface SidebarProps {
  conversations: ConversationSummary[]
  current: number | null
  loading: boolean
  roleMap: Record<string, RoleItem>
  onNew: () => void
  onSelect: (conv: ConversationSummary) => void
  onDelete: (id: number) => void
  open: boolean
  onClose: () => void
}

function ConversationSidebar({ conversations, current, loading, roleMap, open, onNew, onSelect, onDelete, onClose }: SidebarProps) {
  return (
    <div className={`ai-conv-drawer${open ? ' open' : ''}`}>
      <div style={{ padding: '14px 12px 10px', borderBottom: '1px solid var(--c-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--c-text)' }}>대화 이력</span>
        <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>×</button>
      </div>
      <div style={{ padding: '10px', borderBottom: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <button
          onClick={() => { onNew(); onClose() }}
          style={{
            width: '100%', padding: '8px 12px', borderRadius: 6, fontSize: 13,
            cursor: 'pointer', border: '1px solid var(--c-border)',
            background: 'var(--c-bg)', color: 'var(--c-text)',
            display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
          }}
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> 새 대화
        </button>
        <Link
          to="/ai/documents"
          onClick={onClose}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 6, fontSize: 13, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text)', textDecoration: 'none', fontWeight: 500 }}
        >
          <span>📁</span> 문서 관리
        </Link>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {loading && conversations.length === 0 && (
          <div style={{ padding: '20px 12px', fontSize: 12, color: 'var(--c-text-muted)', textAlign: 'center' }}>불러오는 중...</div>
        )}
        {!loading && conversations.length === 0 && (
          <div style={{ padding: '20px 12px', fontSize: 12, color: 'var(--c-text-muted)', textAlign: 'center' }}>대화 내역 없음</div>
        )}
        {conversations.map(conv => {
          const selected = conv.id === current
          const ri = roleMap[conv.role]
          const color = ri?.color ?? '#888'
          const label = ri?.label ?? conv.role
          return (
            <div
              key={conv.id}
              onClick={() => { onSelect(conv); onClose() }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '9px 10px', cursor: 'pointer',
                borderLeft: `3px solid ${selected ? color : 'transparent'}`,
                background: selected ? 'var(--c-bg)' : 'transparent',
                transition: 'background 0.1s',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: selected ? 600 : 400, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.title || '새 대화'}
                </div>
                <div style={{ display: 'flex', gap: 5, marginTop: 3, alignItems: 'center' }}>
                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: color + '22', color, fontWeight: 600 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{formatDate(conv.updatedAt)}</span>
                </div>
              </div>
              <button
                onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
                style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 4, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--c-text-muted)', fontSize: 14, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.6 }}
                title="삭제"
              >×</button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AiChatPage() {
  const { user } = useAuth()
  const memberId = user?.username ?? ''

  const [roleList, setRoleList] = useState<RoleItem[]>(DEFAULT_ROLE_LIST)
  const [role, setRole] = useState<string>('backend')
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [convLoading, setConvLoading] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [currentConvId, setCurrentConvId] = useState<number | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [docCount, setDocCount] = useState<number | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const roleMap: Record<string, RoleItem> = Object.fromEntries(roleList.map(r => [r.value, r]))
  const selectedRole: RoleItem = roleMap[role] ?? { value: role, label: role, color: '#888' }
  const convIndex = currentConvId ? conversations.findIndex(c => c.id === currentConvId) + 1 : null

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── 역할 목록 동적 로드 ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!memberId) return
    getPrompts(memberId)
      .then(list => {
        setRoleList(list.map((p, i) => ({
          value: p.role,
          label: p.roleName,
          color: getRoleColor(p.role, i),
          visibility: p.visibility,
        })))
      })
      .catch(() => { /* fallback: DEFAULT_ROLE_LIST 유지 */ })
  }, [memberId])

  // ── 대화 목록 로드 ──────────────────────────────────────────────────────────

  const loadConversations = useCallback(async () => {
    if (!memberId) return
    try {
      setConvLoading(true)
      const list = await getConversations(memberId)
      setConversations(list)
    } catch (e) {
      console.error('[AI] conversations 조회 실패:', e)
    } finally {
      setConvLoading(false)
    }
  }, [memberId])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── 참조 문서 수 ────────────────────────────────────────────────────────────

  useEffect(() => {
    getDocuments(role).then(docs => setDocCount(docs.length)).catch(() => setDocCount(null))
  }, [role])

  // ── 대화 선택 ───────────────────────────────────────────────────────────────

  const handleSelectConversation = async (conv: ConversationSummary) => {
    if (loading) return
    setSidebarOpen(false)
    setCurrentConvId(conv.id)
    setRole(conv.role)
    setMessages([])
    setMessagesLoading(true)
    try {
      const msgs = await getMessages(conv.id)
      setMessages(msgs.map((m: ConversationMessage) => ({
        id: m.id,
        from: m.role === 'user' ? 'user' as const : 'ai' as const,
        text: m.content,
        sources: m.sources,
        streaming: false,
        createdAt: m.createdAt,
      })))
    } catch { setMessages([]) }
    finally { setMessagesLoading(false) }
  }

  // ── 새 대화 ─────────────────────────────────────────────────────────────────

  const handleNewConversation = useCallback(() => {
    if (loading) return
    setCurrentConvId(null)
    setMessages([])
    setInput('')
    setSidebarOpen(false)
  }, [loading])

  // ── 대화 삭제 ───────────────────────────────────────────────────────────────

  const handleDeleteConversation = async (convId: number) => {
    try {
      await deleteConversation(convId)
      if (currentConvId === convId) handleNewConversation()
      setConversations(prev => prev.filter(c => c.id !== convId))
    } catch { }
  }

  // ── 역할 변경 (새 대화 시작) ────────────────────────────────────────────────

  const handleRoleChange = useCallback((newRole: string) => {
    if (newRole === role) return
    setRole(newRole)
    setCurrentConvId(null)
    setMessages([])
  }, [role])

  // ── 메시지 전송 ─────────────────────────────────────────────────────────────

  const sendMessage = useCallback(() => {
    const text = input.trim()
    if (!text || loading || !memberId) return

    setInput('')
    setLoading(true)

    const now = new Date().toISOString()
    const userMsg: Message = { id: ++_seq, from: 'user', text, createdAt: now }
    const aiId = ++_seq
    const aiMsg: Message = { id: aiId, from: 'ai', text: '', streaming: true }
    setMessages(prev => [...prev, userMsg, aiMsg])

    abortRef.current = chat(
      text, role, memberId, currentConvId,
      (sources) => {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, sources } : m))
      },
      (token) => {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: m.text + token } : m))
      },
      (convId) => {
        setCurrentConvId(convId)
        setLoading(false)
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, streaming: false, createdAt: new Date().toISOString() } : m
        ))
        loadConversations()
      },
      (err) => {
        setLoading(false)
        setMessages(prev => prev.map(m =>
          m.id === aiId ? { ...m, text: `오류: ${err.message}`, error: true, streaming: false } : m
        ))
      },
    )

    textareaRef.current?.focus()
  }, [input, loading, role, currentConvId, memberId, loadConversations])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleStop = () => {
    abortRef.current?.abort()
    setLoading(false)
    setMessages(prev => prev.map(m => m.streaming ? { ...m, streaming: false } : m))
  }

  const handleClear = () => {
    if (loading) handleStop()
    setMessages([])
  }

  // ── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px 32px 0', overflow: 'hidden' }}>
      {sidebarOpen && (
        <div className="ai-conv-backdrop" onClick={() => setSidebarOpen(false)} />
      )}

      <ConversationSidebar
        conversations={conversations}
        current={currentConvId}
        loading={convLoading}
        roleMap={roleMap}
        open={sidebarOpen}
        onNew={handleNewConversation}
        onSelect={handleSelectConversation}
        onDelete={handleDeleteConversation}
        onClose={() => setSidebarOpen(false)}
      />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* 헤더 */}
        <div style={{ marginBottom: 14, flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>AI 어시스턴트</h2>
              <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 2 }}>
                {currentConvId && convIndex && convIndex > 0 ? (
                  <span>
                    <span style={{ color: selectedRole.color, fontWeight: 600 }}>{selectedRole.label}</span>
                    {' · '}{convIndex}번째 대화
                  </span>
                ) : '클라우드 POS 플랫폼 도메인 전문 AI'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => setSidebarOpen(v => !v)}
                style={{ fontSize: 12, padding: '5px 11px', borderRadius: 6, cursor: 'pointer', border: '1px solid var(--c-border)', background: sidebarOpen ? 'var(--c-thead)' : 'var(--c-card)', color: 'var(--c-text)', display: 'flex', alignItems: 'center', gap: 5 }}
              >
                🕐 대화 이력
              </button>
              <button onClick={handleClear} style={{ fontSize: 12, color: 'var(--c-text-muted)', background: 'none', border: '1px solid var(--c-border)', borderRadius: 6, padding: '5px 10px', cursor: 'pointer' }}>
                초기화
              </button>
            </div>
          </div>

          {/* 역할 탭 — 동적 (팀 공통 / 내 역할 그룹 구분) */}
          {(() => {
            const publicRoles = roleList.filter(r => r.visibility !== 'private')
            const privateRoles = roleList.filter(r => r.visibility === 'private')
            const RoleBtn = (r: RoleItem) => (
              <button key={r.value} onClick={() => handleRoleChange(r.value)} style={{
                padding: '6px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer',
                border: `1.5px solid ${role === r.value ? r.color : 'var(--c-border)'}`,
                background: role === r.value ? r.color + '18' : 'var(--c-card)',
                color: role === r.value ? r.color : 'var(--c-text-muted)',
                fontWeight: role === r.value ? 600 : 400,
                transition: 'all 0.15s',
              }}>
                {r.label}
              </button>
            )
            return (
              <div style={{ display: 'flex', gap: 6, marginTop: 12, flexWrap: 'wrap', alignItems: 'center' }}>
                {publicRoles.length > 0 && (
                  <>
                    <span style={{ fontSize: 10, color: 'var(--c-text-muted)', marginRight: 2 }}>팀 공통</span>
                    {publicRoles.map(RoleBtn)}
                  </>
                )}
                {publicRoles.length > 0 && privateRoles.length > 0 && (
                  <span style={{ color: 'var(--c-border)', fontSize: 16, lineHeight: 1, margin: '0 2px' }}>|</span>
                )}
                {privateRoles.length > 0 && (
                  <>
                    <span style={{ fontSize: 10, color: 'var(--c-text-muted)', marginRight: 2 }}>내 역할</span>
                    {privateRoles.map(RoleBtn)}
                  </>
                )}
              </div>
            )
          })()}
        </div>

        {/* 메시지 영역 */}
        <div style={{
          flex: 1, overflowY: 'auto', marginBottom: 10,
          background: 'var(--c-card)', borderRadius: 10,
          border: '1px solid var(--c-border)',
          padding: messages.length || messagesLoading ? '16px' : 0,
        }}>
          {messagesLoading ? (
            <div style={{ height: '100%', minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--c-text-muted)' }}>
              <div className="ai-spinner" style={{ width: 28, height: 28, border: '3px solid var(--c-border)', borderTopColor: selectedRole.color, borderRadius: '50%', animation: 'ai-spin 0.7s linear infinite' }} />
              <div style={{ fontSize: 13 }}>이전 대화 불러오는 중...</div>
            </div>
          ) : messages.length === 0 ? (
            <div style={{ height: '100%', minHeight: 180, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--c-text-muted)', padding: 32 }}>
              <div style={{ fontSize: 36 }}>⚡</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--c-text-sub)' }}>무엇이든 물어보세요</div>
              <div style={{ fontSize: 12, textAlign: 'center', maxWidth: 300, lineHeight: 1.7 }}>
                <strong style={{ color: selectedRole.color }}>{selectedRole.label}</strong> 역할로 질문하세요.
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'center', marginTop: 6 }}>
                {SAMPLE_QUESTIONS.map(q => (
                  <button key={q} onClick={() => { setInput(q); textareaRef.current?.focus() }} style={{ fontSize: 11, padding: '5px 10px', borderRadius: 14, border: '1px solid var(--c-border)', background: 'var(--c-bg)', color: 'var(--c-text-sub)', cursor: 'pointer' }}>
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {messages.map(msg => (
                <div key={msg.id} style={{ display: 'flex', flexDirection: msg.from === 'user' ? 'row-reverse' : 'row', gap: 8, alignItems: 'flex-start' }}>
                  <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: msg.from === 'user' ? selectedRole.color : '#1a1a2e', color: '#fff' }}>
                    {msg.from === 'user' ? 'ME' : 'AI'}
                  </div>
                  <div style={{ maxWidth: '82%', padding: '9px 13px', borderRadius: 10, background: msg.from === 'user' ? selectedRole.color + '18' : 'var(--c-bg)', border: `1px solid ${msg.from === 'user' ? selectedRole.color + '44' : 'var(--c-border)'}`, color: msg.error ? '#f44336' : 'var(--c-text)', fontSize: 14, lineHeight: 1.7, borderTopRightRadius: msg.from === 'user' ? 2 : 10, borderTopLeftRadius: msg.from === 'ai' ? 2 : 10 }}>
                    {msg.from === 'ai' ? (
                      msg.streaming ? (
                        <span style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{msg.text}</span>
                      ) : (
                        <div className="ai-markdown">
                          <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      )
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                    )}
                    {msg.streaming && (
                      <span className="ai-cursor" style={{ display: 'inline-block', width: 2, height: '1em', background: selectedRole.color, marginLeft: 2, verticalAlign: 'text-bottom' }} />
                    )}
                    {msg.sources && <SourceList sources={msg.sources} />}
                    {msg.createdAt && !msg.streaming && (
                      <div style={{ fontSize: 10, color: 'var(--c-text-muted)', marginTop: 5, textAlign: msg.from === 'user' ? 'left' : 'right', opacity: 0.7 }}>
                        {formatTime(msg.createdAt)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* 문서 수 표시 */}
        {docCount !== null && docCount > 0 && (
          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '5px 12px', marginBottom: 6, background: 'var(--c-card)', borderRadius: 8, border: '1px solid var(--c-border)', fontSize: 12 }}>
            <span style={{ color: 'var(--c-text-muted)' }}>
              <span style={{ marginRight: 5 }}>📄</span>
              참조 가능 문서 <strong style={{ color: 'var(--c-text)' }}>{docCount}개</strong>
            </span>
            <Link to="/ai/documents" style={{ fontSize: 11, color: '#1976d2', textDecoration: 'none' }}>관리 →</Link>
          </div>
        )}

        {/* 입력창 */}
        <div style={{ flexShrink: 0, background: 'var(--c-card)', borderRadius: 10, border: '1px solid var(--c-border)', padding: '10px 14px', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`${selectedRole.label} 관련 질문 입력... (Enter 전송 / Shift+Enter 줄바꿈)`}
              rows={3}
              style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--c-text)', fontSize: 14, lineHeight: 1.6, padding: 0, fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
              {loading ? (
                <button onClick={handleStop} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: 'pointer', background: '#f44336', color: '#fff', border: 'none', fontWeight: 600 }}>중지</button>
              ) : (
                <button onClick={sendMessage} disabled={!input.trim()} style={{ padding: '7px 14px', borderRadius: 8, fontSize: 13, cursor: input.trim() ? 'pointer' : 'default', background: input.trim() ? selectedRole.color : 'var(--c-border)', color: input.trim() ? '#fff' : 'var(--c-text-muted)', border: 'none', fontWeight: 600, transition: 'background 0.15s' }}>전송</button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
