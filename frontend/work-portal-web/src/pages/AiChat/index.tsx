import { useState, useRef, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import {
  chat, agentChat,
  getConversations, getMessages, deleteConversation, getDocuments, getPrompts,
  RagSource, ConversationSummary, ConversationMessage, AgentStep,
} from '../../api/aiApi'
import { useAuth } from '../../context/useAuth'
import { Button, IconButton } from '../../components/ui'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const DEFAULT_ROLE_LIST: RoleItem[] = [
  { value: 'backend',  label: '백엔드',    color: 'var(--c-chart-1)' },
  { value: 'android',  label: '안드로이드', color: 'var(--c-chart-2)' },
  { value: 'frontend', label: '프론트엔드', color: 'var(--c-chart-3)' },
  { value: 'planner',  label: '기획',      color: 'var(--c-chart-5)' },
]

const EXTRA_COLORS = ['var(--c-chart-4)', 'var(--c-chart-6)', 'var(--c-chart-3)', 'var(--c-chart-8)', 'var(--c-chart-2)', 'var(--c-chart-5)', 'var(--c-chart-7)']

const DEFAULT_COLORS: Record<string, string> = {
  backend: 'var(--c-chart-1)', android: 'var(--c-chart-2)', frontend: 'var(--c-chart-3)', planner: 'var(--c-chart-5)',
}

// 토큰 색상에 투명도 적용 (CSS 변수는 hex 알파 접미사를 붙일 수 없음)
const withAlpha = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`

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
  steps?: AgentStep[]
}

// ── 에이전트 스텝 타임라인 ─────────────────────────────────────────────────────

const TOOL_META: Record<string, { icon: string; label: string }> = {
  search_code:      { icon: '🔍', label: '코드 검색' },
  read_file:        { icon: '📄', label: '파일 읽기' },
  list_files:       { icon: '📁', label: '파일 목록' },
  search_documents: { icon: '📚', label: '문서 검색' },
}

function getToolMeta(tool: string) {
  return TOOL_META[tool] ?? { icon: '🔧', label: tool }
}

function StepRow({ step }: { step: AgentStep }) {
  const [open, setOpen] = useState(false)
  const { icon, label } = getToolMeta(step.tool)
  const canExpand = step.status === 'done' && !!step.summary

  return (
    <div>
      <div
        onClick={() => canExpand && setOpen(v => !v)}
        style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 0', cursor: canExpand ? 'pointer' : 'default', fontSize: 12 }}
      >
        <span style={{ flexShrink: 0, width: 17, textAlign: 'center', fontSize: 13 }}>{icon}</span>
        <span style={{ flexShrink: 0, fontWeight: 600, color: 'var(--c-text-sub)', minWidth: 72 }}>{label}</span>
        <span style={{ flex: 1, color: 'var(--c-text-muted)', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={step.status === 'running' ? step.input : step.summary}>
          {step.status === 'running' ? step.input : (step.summary ?? '')}
        </span>
        {canExpand && (
          <span style={{ flexShrink: 0, fontSize: 9, color: 'var(--c-text-muted)', opacity: 0.6 }}>{open ? '▲' : '▼'}</span>
        )}
        <span style={{ flexShrink: 0, width: 18, textAlign: 'center' }}>
          {step.status === 'running' ? (
            <span style={{ display: 'inline-block', width: 11, height: 11, border: '2px solid var(--c-border)', borderTopColor: 'var(--c-action)', borderRadius: '50%', animation: 'ai-spin 0.7s linear infinite' }} />
          ) : step.status === 'done' ? (
            <span style={{ color: 'var(--c-tag-done-t)', fontWeight: 700, fontSize: 13 }}>✓</span>
          ) : (
            <span style={{ color: 'var(--c-tag-err-t)', fontSize: 13 }}>✗</span>
          )}
        </span>
      </div>
      {open && step.summary && (
        <div style={{ margin: '2px 0 4px 24px', padding: '5px 8px', background: 'var(--c-bg)', borderRadius: 6, fontSize: 11, color: 'var(--c-text-sub)', lineHeight: 1.6, borderLeft: '2px solid var(--c-border)', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
          {step.summary}
        </div>
      )}
    </div>
  )
}

function StepTimeline({ steps }: { steps: AgentStep[] }) {
  const [collapsed, setCollapsed] = useState(false)
  if (!steps.length) return null

  const running = steps.some(s => s.status === 'running')
  const doneCount = steps.filter(s => s.status === 'done').length
  const headerText = running
    ? `분석 중... (${doneCount}/${steps.length}단계)`
    : `${steps.length}단계 완료`

  return (
    <div style={{ marginBottom: 10, borderRadius: 8, border: '1px solid var(--c-border)', overflow: 'hidden' }}>
      <button
        onClick={() => setCollapsed(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px',
          background: 'var(--c-thead)', border: 'none', cursor: 'pointer',
          color: 'var(--c-text-muted)', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em',
        }}
      >
        {running ? (
          <span style={{ display: 'inline-block', width: 10, height: 10, border: '2px solid var(--c-border)', borderTopColor: 'var(--rsp-color-tertiary-500)', borderRadius: '50%', animation: 'ai-spin 0.7s linear infinite', flexShrink: 0 }} />
        ) : (
          <span style={{ color: 'var(--c-tag-done-t)', fontSize: 12 }}>✓</span>
        )}
        <span style={{ flex: 1, textAlign: 'left' }}>⚡ 에이전트 실행 — {headerText}</span>
        <span style={{ fontSize: 10, opacity: 0.55 }}>{collapsed ? '펼치기 ▼' : '접기 ▲'}</span>
      </button>
      {!collapsed && (
        <div style={{ padding: '4px 10px 8px', background: 'var(--c-thead)' }}>
          {steps.map((step, i) => <StepRow key={i} step={step} />)}
        </div>
      )}
    </div>
  )
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
    <div style={{ margin: '10px 0', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--rsp-color-neutral-800)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 14px', background: 'var(--rsp-color-neutral-800)' }}>
        <span style={{ fontSize: 11, color: 'var(--rsp-color-neutral-500)', fontFamily: 'monospace' }}>{lang || 'code'}</span>
        <button onClick={copy} style={{ fontSize: 11, color: copied ? 'var(--rsp-color-success-500)' : 'var(--rsp-color-neutral-400)', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}>
          {copied ? '✓ 복사됨' : '복사'}
        </button>
      </div>
      <pre ref={preRef} style={{ margin: 0, padding: '12px 16px', overflowX: 'auto', background: 'var(--rsp-color-neutral-900)', fontFamily: "'D2Coding', 'Consolas', 'Courier New', monospace", fontSize: 13, lineHeight: 1.5, color: 'var(--rsp-color-neutral-200)', whiteSpace: 'pre' }}>
        {children}
      </pre>
    </div>
  )
}

const CODE_FONT = "'D2Coding', 'Consolas', 'Courier New', monospace"

const MD_COMPONENTS = {
  pre({ children }: any) {
    const child = children as React.ReactElement
    const cls: string = child?.props?.className ?? ''
    const lang = /language-(\w+)/.exec(cls)?.[1] ?? ''

    // 언어 미지정: code 컴포넌트를 거치지 않고 plain <pre>로 렌더링
    // (박스 문자 ├──└── 등이 토큰화·inline 스타일에 의해 깨지는 것을 방지)
    if (!lang) {
      const rawText = child?.props?.children ?? ''
      return (
        <pre style={{
          margin: '10px 0', padding: '12px 16px',
          overflowX: 'auto', whiteSpace: 'pre',
          background: 'var(--rsp-color-neutral-900)', borderRadius: 8, border: '1px solid var(--rsp-color-neutral-800)',
          fontFamily: CODE_FONT, fontSize: 13, lineHeight: 1.5, color: 'var(--rsp-color-neutral-200)',
        }}>
          {rawText}
        </pre>
      )
    }
    return <CodeBlockWrapper lang={lang}>{children}</CodeBlockWrapper>
  },
  code({ className, children, ...props }: any) {
    if (!className) {
      // 인라인 코드
      return (
        <code style={{ background: 'var(--c-thead)', padding: '1px 5px', borderRadius: 3, fontFamily: CODE_FONT, fontSize: '0.88em' }} {...props}>
          {children}
        </code>
      )
    }
    // 언어 지정 코드블록 내부 <code> — CodeBlockWrapper의 <pre> 안에서 렌더됨
    return (
      <code className={className} style={{ fontFamily: CODE_FONT, fontSize: 13, lineHeight: 1.5, color: 'var(--rsp-color-neutral-200)' }} {...props}>
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
              style={{ color: src.sourceType === 'GITHUB' ? 'var(--c-action)' : 'var(--c-tag-warn-t)', textDecoration: 'none', wordBreak: 'break-all' }}
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
        <IconButton variant="text" size="sm" icon="×" label="닫기" onClick={onClose} />
      </div>
      <div style={{ padding: '10px', borderBottom: '1px solid var(--c-border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <Button
          variant="outlined"
          size="md"
          onClick={() => { onNew(); onClose() }}
          leadingIcon={<span style={{ fontSize: 16, lineHeight: 1 }}>+</span>}
          style={{ width: '100%' }}
        >
          새 대화
        </Button>
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
          const color = ri?.color ?? 'var(--c-chart-8)'
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
                  <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 8, background: withAlpha(color, 13), color, fontWeight: 600 }}>
                    {label}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{formatDate(conv.updatedAt)}</span>
                </div>
              </div>
              <IconButton
                variant="text"
                size="sm"
                icon="×"
                label="대화 삭제"
                onClick={e => { e.stopPropagation(); onDelete(conv.id) }}
                style={{ flexShrink: 0, opacity: 0.6 }}
                title="삭제"
              />
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
  const [agentMode, setAgentMode] = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const roleMap: Record<string, RoleItem> = Object.fromEntries(roleList.map(r => [r.value, r]))
  const selectedRole: RoleItem = roleMap[role] ?? { value: role, label: role, color: 'var(--c-chart-8)' }
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
    const aiMsg: Message = { id: aiId, from: 'ai', text: '', streaming: true, steps: agentMode ? [] : undefined }
    setMessages(prev => [...prev, userMsg, aiMsg])

    const onDone = (convId: number) => {
      setCurrentConvId(convId)
      setLoading(false)
      setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, streaming: false, createdAt: new Date().toISOString() } : m
      ))
      loadConversations()
    }
    const onError = (err: Error) => {
      setLoading(false)
      setMessages(prev => prev.map(m =>
        m.id === aiId ? { ...m, text: `오류: ${err.message}`, error: true, streaming: false } : m
      ))
    }

    if (agentMode) {
      abortRef.current = agentChat(
        text, role, memberId, currentConvId,
        (step) => {
          setMessages(prev => prev.map(m => {
            if (m.id !== aiId) return m
            const steps = m.steps ?? []
            if (step.status === 'running') {
              return { ...m, steps: [...steps, step] }
            }
            // done/error: 같은 tool의 마지막 running 스텝 업데이트
            let updated = false
            const newSteps = [...steps].reverse().map(s => {
              if (!updated && s.tool === step.tool && s.status === 'running') {
                updated = true
                return step
              }
              return s
            }).reverse()
            return { ...m, steps: updated ? newSteps : [...steps, step] }
          }))
        },
        (markdown) => {
          setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: markdown } : m))
        },
        onDone, onError,
      )
    } else {
      const onSources = (sources: RagSource[]) => {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, sources } : m))
      }
      const onToken = (token: string) => {
        setMessages(prev => prev.map(m => m.id === aiId ? { ...m, text: m.text + token } : m))
      }
      abortRef.current = chat(text, role, memberId, currentConvId, onSources, onToken, onDone, onError)
    }

    textareaRef.current?.focus()
  }, [input, loading, role, currentConvId, memberId, agentMode, loadConversations])

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
              {/* 토글 상태: ON이면 filled, OFF면 outlined */}
              <Button
                variant={agentMode ? 'filled' : 'outlined'}
                size="sm"
                onClick={() => setAgentMode(v => !v)}
                title="에이전트 모드: 도구를 순차적으로 사용하는 멀티스텝 추론"
              >
                ⚡ 에이전트 모드
              </Button>
              <Button variant="outlined" size="sm" onClick={() => setSidebarOpen(v => !v)}>
                🕐 대화 이력
              </Button>
              <Button variant="outlined" size="sm" onClick={handleClear}>
                초기화
              </Button>
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
                background: role === r.value ? withAlpha(r.color, 9) : 'var(--c-card)',
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
                  <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, background: msg.from === 'user' ? selectedRole.color : 'var(--rsp-color-neutral-900)', color: 'var(--rsp-color-text-on-primary)' }}>
                    {msg.from === 'user' ? 'ME' : 'AI'}
                  </div>
                  <div style={{ maxWidth: '82%', padding: '9px 13px', borderRadius: 10, background: msg.from === 'user' ? withAlpha(selectedRole.color, 9) : 'var(--c-bg)', border: `1px solid ${msg.from === 'user' ? withAlpha(selectedRole.color, 27) : 'var(--c-border)'}`, color: msg.error ? 'var(--c-tag-err-t)' : 'var(--c-text)', fontSize: 14, lineHeight: 1.7, borderTopRightRadius: msg.from === 'user' ? 2 : 10, borderTopLeftRadius: msg.from === 'ai' ? 2 : 10 }}>
                    {msg.from === 'ai' ? (
                      <>
                        {msg.steps && <StepTimeline steps={msg.steps} />}
                        {/* 에이전트 모드: answer 이벤트가 완성 마크다운이므로 바로 렌더 */}
                        {msg.steps != null ? (
                          msg.text ? (
                            <div className="ai-markdown">
                              <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                                {msg.text}
                              </ReactMarkdown>
                            </div>
                          ) : msg.streaming ? (
                            <span style={{ color: 'var(--c-text-muted)', fontSize: 12 }}>분석 중...</span>
                          ) : null
                        ) : msg.streaming ? (
                          <span style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{msg.text}</span>
                        ) : (
                          <div className="ai-markdown">
                            <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                              {msg.text}
                            </ReactMarkdown>
                          </div>
                        )}
                      </>
                    ) : (
                      <span style={{ whiteSpace: 'pre-wrap' }}>{msg.text}</span>
                    )}
                    {/* 일반 모드 스트리밍 커서 */}
                    {msg.streaming && msg.steps == null && (
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
            <Link to="/ai/documents" style={{ fontSize: 11, color: 'var(--c-action)', textDecoration: 'none' }}>관리 →</Link>
          </div>
        )}

        {/* 입력창 */}
        <div style={{ flexShrink: 0, background: 'var(--c-card)', borderRadius: 10, border: `1px solid ${agentMode ? 'color-mix(in srgb, var(--rsp-color-tertiary-500) 27%, transparent)' : 'var(--c-border)'}`, padding: '10px 14px', marginBottom: 20 }}>
          {agentMode && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8, padding: '5px 8px', background: 'color-mix(in srgb, var(--rsp-color-tertiary-500) 6%, transparent)', borderRadius: 6, fontSize: 11, color: 'var(--c-tag-pri-t)' }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, border: '1.5px solid color-mix(in srgb, var(--rsp-color-tertiary-500) 33%, transparent)', borderTopColor: 'var(--rsp-color-tertiary-500)', borderRadius: '50%', animation: loading ? 'ai-spin 0.7s linear infinite' : 'none', flexShrink: 0 }} />
              여러 단계로 분석합니다 (1~3분 소요)
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={agentMode ? `${selectedRole.label} 관련 질문 입력... (에이전트가 코드베이스를 분석합니다)` : `${selectedRole.label} 관련 질문 입력... (Enter 전송 / Shift+Enter 줄바꿈)`}
              rows={3}
              style={{ flex: 1, resize: 'none', border: 'none', outline: 'none', background: 'transparent', color: 'var(--c-text)', fontSize: 14, lineHeight: 1.6, padding: 0, fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
              {loading ? (
                <Button variant="outlined" size="sm" onClick={handleStop} style={{ color: 'var(--c-tag-err-t)', borderColor: 'var(--c-tag-err-t)' }}>중지</Button>
              ) : (
                <Button variant="filled" size="sm" onClick={sendMessage} disabled={!input.trim()}>전송</Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
