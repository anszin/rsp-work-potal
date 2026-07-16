import { aiConfig } from '../config/aiConfig'

export type AiRole = 'backend' | 'android' | 'frontend' | 'planner'

export interface RagSource {
  sourcePath: string
  content: string
  sourceType: 'GITHUB' | 'GITLAB'
}

export interface ConversationSummary {
  id: number
  title: string
  role: string
  createdAt: string
  updatedAt: string
}

export interface ConversationMessage {
  id: number
  conversationId: number
  role: 'user' | 'assistant'
  content: string
  sources?: RagSource[]
  createdAt: string
}

export interface AgentStep {
  tool: string
  input?: string
  status: 'running' | 'done' | 'error'
  summary?: string
}

export function agentChat(
  message: string,
  role: string,
  memberId: string,
  conversationId: number | null,
  onStep: (step: AgentStep) => void,
  onAnswer: (markdown: string) => void,
  onDone: (conversationId: number) => void,
  onError?: (err: Error) => void,
): AbortController {
  const ctrl = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(`${aiConfig.apiUrl}/api/agent/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, role, memberId, conversationId }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`AI 에이전트 오류: ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('스트림을 읽을 수 없습니다')

      const decoder = new TextDecoder()
      let buffer = ''
      let eventType = ''
      let dataLines: string[] = []

      const dispatch = () => {
        if (!dataLines.length) return
        const raw = dataLines.join('\n')
        const data = raw.startsWith(' ') ? raw.slice(1) : raw
        const type = eventType
        dataLines = []
        eventType = ''

        if (!data || data === '[DONE]') return

        try {
          const json = JSON.parse(data)
          const resolvedType = type || String(json?.type ?? '')

          if (resolvedType === 'step') {
            onStep({ tool: json.tool, input: json.input, status: json.status, summary: json.summary })
          } else if (resolvedType === 'answer') {
            onAnswer(String(json.data ?? ''))
          } else if (resolvedType === 'done') {
            if (json.conversationId != null) onDone(Number(json.conversationId))
          }
        } catch { /* JSON 파싱 실패 무시 */ }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trimEnd()
          if (!trimmed) { dispatch(); continue }
          if (trimmed.startsWith('event:')) {
            eventType = trimmed.slice(6).trim()
          } else if (trimmed.startsWith('data:')) {
            dataLines.push(trimmed.slice(5))
          }
        }
      }
      dispatch()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError?.(err as Error)
      }
    }
  })()

  return ctrl
}

export function chat(
  message: string,
  role: string,
  memberId: string,
  conversationId: number | null,
  onSources: (sources: RagSource[]) => void,
  onToken: (token: string) => void,
  onDone: (conversationId: number) => void,
  onError?: (err: Error) => void,
): AbortController {
  const ctrl = new AbortController()

  ;(async () => {
    try {
      const res = await fetch(`${aiConfig.apiUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, role, memberId, conversationId }),
        signal: ctrl.signal,
      })
      if (!res.ok) throw new Error(`AI 서버 오류: ${res.status}`)

      const reader = res.body?.getReader()
      if (!reader) throw new Error('스트림을 읽을 수 없습니다')

      const decoder = new TextDecoder()
      let buffer = ''
      let eventType = ''
      let dataLines: string[] = []

      const dispatch = () => {
        if (!dataLines.length) return
        const raw = dataLines.join('\n')
        // SSE 스펙: data: 다음 공백 하나 제거
        const data = raw.startsWith(' ') ? raw.slice(1) : raw
        const type = eventType
        dataLines = []
        eventType = ''

        if (!data || data === '[DONE]') return

        console.debug('[SSE]', { type, data })

        try {
          const json = JSON.parse(data)
          // event: 필드 없을 때 JSON 내부 type 필드 폴백
          const resolvedType = type || String(json?.type ?? '')

          if (resolvedType === 'sources') {
            const src = json?.sources ?? json?.data ?? json
            onSources(Array.isArray(src) ? src : [src])
          } else if (resolvedType === 'token') {
            const token = json?.token ?? json?.content ?? json?.text ?? json?.data
            if (token != null) onToken(String(token))
          } else if (resolvedType === 'done') {
            const convId = json?.conversationId ?? json?.data?.conversationId
            if (convId != null) onDone(Number(convId))
          }
        } catch {
          // JSON 아닌 경우 token 이벤트의 평문 처리
          if (type === 'token') onToken(data)
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trimEnd()

          if (!trimmed) {
            dispatch()
            continue
          }

          if (trimmed.startsWith('event:')) {
            eventType = trimmed.slice(6).trim()
          } else if (trimmed.startsWith('data:')) {
            dataLines.push(trimmed.slice(5))
          }
        }
      }
      // 스트림 종료 후 남은 이벤트 처리
      dispatch()
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        onError?.(err as Error)
      }
    }
  })()

  return ctrl
}

export async function getConversations(memberId: string): Promise<ConversationSummary[]> {
  const res = await fetch(`${aiConfig.apiUrl}/api/conversations?memberId=${encodeURIComponent(memberId)}`)
  if (!res.ok) throw new Error(`대화 목록 조회 오류: ${res.status}`)
  return res.json()
}

export async function getMessages(conversationId: number): Promise<ConversationMessage[]> {
  const res = await fetch(`${aiConfig.apiUrl}/api/conversations/${conversationId}/messages`)
  if (!res.ok) throw new Error(`메시지 조회 오류: ${res.status}`)
  return res.json()
}

export async function deleteConversation(conversationId: number): Promise<void> {
  const res = await fetch(`${aiConfig.apiUrl}/api/conversations/${conversationId}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`대화 삭제 오류: ${res.status}`)
}

// ── 문서 관리 ──────────────────────────────────────────────────────────────────

export type DocScope = 'shared' | 'backend' | 'android' | 'frontend' | 'planner'

export interface AiDocument {
  id: number
  filename: string
  originalFilename: string
  fileSize: number
  scope: DocScope
  uploaderId: string
  chunkCount: number
  status: string
  createdAt: string
}

export function uploadDocument(
  file: File,
  scope: DocScope,
  uploaderId: string,
  onProgress?: (percent: number) => void,
): Promise<AiDocument> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    form.append('file', file)
    form.append('scope', scope)
    form.append('uploaderId', uploaderId)

    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${aiConfig.apiUrl}/api/documents/upload`)

    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
      })
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) }
        catch { reject(new Error('응답 파싱 오류')) }
      } else {
        reject(new Error(`업로드 오류: ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('네트워크 오류'))
    xhr.send(form)
  })
}

export async function getDocuments(role: string): Promise<AiDocument[]> {
  const res = await fetch(`${aiConfig.apiUrl}/api/documents?role=${encodeURIComponent(role)}`)
  if (!res.ok) throw new Error(`문서 목록 조회 오류: ${res.status}`)
  return res.json()
}

export async function deleteDocument(id: number): Promise<void> {
  const res = await fetch(`${aiConfig.apiUrl}/api/documents/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`문서 삭제 오류: ${res.status}`)
}

// ── 프롬프트 관리 ─────────────────────────────────────────────────────────────

export interface RolePrompt {
  id: number
  role: string
  roleName: string
  systemPrompt: string
  visibility: 'public' | 'private'
  ownerId: string
  updatedAt: string
}

export async function getPrompts(memberId?: string): Promise<RolePrompt[]> {
  const query = memberId ? `?memberId=${encodeURIComponent(memberId)}` : ''
  const res = await fetch(`${aiConfig.apiUrl}/api/prompts${query}`)
  if (!res.ok) throw new Error(`프롬프트 조회 오류: ${res.status}`)
  return res.json()
}

export async function createPrompt(
  role: string,
  roleName: string,
  systemPrompt: string,
  visibility: 'public' | 'private',
  ownerId: string,
): Promise<RolePrompt> {
  const res = await fetch(`${aiConfig.apiUrl}/api/prompts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role, roleName, systemPrompt, visibility, ownerId }),
  })
  if (!res.ok) throw new Error(`프롬프트 생성 오류: ${res.status}`)
  return res.json()
}

export async function updatePrompt(role: string, roleName: string, systemPrompt: string): Promise<void> {
  const res = await fetch(`${aiConfig.apiUrl}/api/prompts/${role}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ roleName, systemPrompt }),
  })
  if (!res.ok) throw new Error(`프롬프트 저장 오류: ${res.status}`)
}

export async function deletePrompt(role: string): Promise<void> {
  const res = await fetch(`${aiConfig.apiUrl}/api/prompts/${role}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`프롬프트 삭제 오류: ${res.status}`)
}

// ── 지식베이스 현황 ───────────────────────────────────────────────────────────

export type SourceType = 'GITHUB' | 'GITLAB' | 'UPLOAD'

export interface KnowledgeSource {
  sourceType?: SourceType
  source_type?: SourceType
  repo: string | null
  chunkCount?: number
  chunk_count?: number
  lastUpdated?: string
  last_updated?: string
}

export interface KnowledgeStats {
  totalChunks?: number
  total_chunks?: number
  sources: KnowledgeSource[]
}

export interface KnowledgeFile {
  sourcePath: string
  chunkCount: number
}

export async function getKnowledgeStats(): Promise<KnowledgeStats> {
  const res = await fetch(`${aiConfig.apiUrl}/api/knowledge/stats`)
  if (!res.ok) throw new Error(`지식베이스 통계 조회 오류: ${res.status}`)
  return res.json()
}

export async function getKnowledgeFiles(
  params: { repo: string; sourceType?: never } | { sourceType: string; repo?: never }
): Promise<KnowledgeFile[]> {
  const query = params.repo
    ? `repo=${encodeURIComponent(params.repo)}`
    : `sourceType=${encodeURIComponent(params.sourceType!)}`
  const res = await fetch(`${aiConfig.apiUrl}/api/knowledge/files?${query}`)
  if (!res.ok) throw new Error(`파일 목록 조회 오류: ${res.status}`)
  return res.json()
}
