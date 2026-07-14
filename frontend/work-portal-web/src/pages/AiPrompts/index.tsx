import { useState, useEffect, useCallback, useRef } from 'react'
import { getPrompts, createPrompt, updatePrompt, deletePrompt, RolePrompt } from '../../api/aiApi'
import { useAuth } from '../../context/useAuth'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const DEFAULT_ROLES = ['backend', 'android', 'frontend', 'planner']

const DEFAULT_COLORS: Record<string, string> = {
  backend: '#1976d2', android: '#4caf50', frontend: '#ff9800', planner: '#9c27b0',
}
const EXTRA_COLORS = ['#e91e63', '#00bcd4', '#ff5722', '#795548', '#009688', '#673ab7', '#3f51b5']

function getRoleColor(role: string, index: number): string {
  return DEFAULT_COLORS[role] ?? EXTRA_COLORS[index % EXTRA_COLORS.length]
}

const ROLE_ID_RE = /^[a-z][a-z0-9_-]{0,29}$/

// ── 배지 ──────────────────────────────────────────────────────────────────────

function VisibilityBadge({ visibility }: { visibility: 'public' | 'private' }) {
  const isPublic = visibility === 'public'
  return (
    <span style={{
      fontSize: 10, padding: '1px 6px', borderRadius: 8, fontWeight: 600,
      background: isPublic ? '#4caf5022' : '#78909c22',
      color: isPublic ? '#4caf50' : '#78909c',
      border: `1px solid ${isPublic ? '#4caf5044' : '#78909c44'}`,
      whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      {isPublic ? '팀 공통' : '개인'}
    </span>
  )
}

// ── 토스트 ────────────────────────────────────────────────────────────────────

interface Toast { id: number; message: string; type: 'success' | 'error' }

function ToastList({ toasts }: { toasts: Toast[] }) {
  if (!toasts.length) return null
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 600, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          padding: '11px 18px', borderRadius: 8, fontSize: 13, fontWeight: 500,
          background: t.type === 'success' ? '#4caf50' : '#f44336',
          color: '#fff', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
          animation: 'ai-toast-in 0.2s ease',
        }}>
          {t.type === 'success' ? '✓ ' : '✕ '}{t.message}
        </div>
      ))}
    </div>
  )
}

// ── 삭제 확인 다이얼로그 ──────────────────────────────────────────────────────

function ConfirmDialog({ roleName, onConfirm, onCancel }: {
  roleName: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '24px 28px', maxWidth: 360, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--c-text)' }}>역할 삭제</div>
        <div style={{ fontSize: 13, color: 'var(--c-text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
          <strong style={{ color: 'var(--c-text)' }}>{roleName}</strong> 역할과 시스템 프롬프트를 삭제합니다.<br />
          이 작업은 되돌릴 수 없습니다.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{ padding: '7px 16px', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>취소</button>
          <button onClick={onConfirm} style={{ padding: '7px 16px', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: '#f44336', border: 'none', color: '#fff', fontWeight: 600 }}>삭제</button>
        </div>
      </div>
    </div>
  )
}

// ── 새 역할 추가 모달 ─────────────────────────────────────────────────────────

interface NewRoleModalProps {
  existingRoles: string[]
  onAdd: (role: string, roleName: string, systemPrompt: string, visibility: 'public' | 'private') => Promise<void>
  onClose: () => void
}

function NewRoleModal({ existingRoles, onAdd, onClose }: NewRoleModalProps) {
  const [role, setRole] = useState('')
  const [roleName, setRoleName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [visibility, setVisibility] = useState<'public' | 'private'>('public')
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!role) e.role = '역할 ID를 입력하세요'
    else if (!ROLE_ID_RE.test(role)) e.role = '영문 소문자·숫자·_·- 만 허용 (최대 30자)'
    else if (existingRoles.includes(role)) e.role = '이미 존재하는 역할 ID입니다'
    if (!roleName.trim()) e.roleName = '역할명을 입력하세요'
    return e
  }

  const handleSubmit = async () => {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    try {
      await onAdd(role, roleName.trim(), systemPrompt, visibility)
      onClose()
    } catch (err) {
      setErrors({ submit: (err as Error).message })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)', borderRadius: 12, padding: '24px 28px', width: 480, maxWidth: '95vw', boxShadow: '0 8px 32px rgba(0,0,0,0.25)' }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 18, color: 'var(--c-text)' }}>새 역할 추가</div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-muted)', display: 'block', marginBottom: 5 }}>
            역할 ID <span style={{ color: '#f44336' }}>*</span>
            <span style={{ fontSize: 11, marginLeft: 6 }}>(영문 소문자, 예: qa, devops)</span>
          </label>
          <input
            value={role}
            onChange={e => { setRole(e.target.value.toLowerCase()); setErrors(prev => ({ ...prev, role: '' })) }}
            placeholder="qa"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
              border: `1px solid ${errors.role ? '#f44336' : 'var(--c-border)'}`,
              background: 'var(--c-bg)', color: 'var(--c-text)', boxSizing: 'border-box',
            }}
          />
          {errors.role && <div style={{ fontSize: 11, color: '#f44336', marginTop: 4 }}>{errors.role}</div>}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-muted)', display: 'block', marginBottom: 5 }}>
            역할명 <span style={{ color: '#f44336' }}>*</span>
            <span style={{ fontSize: 11, marginLeft: 6 }}>(한글 표시명, 예: QA 엔지니어)</span>
          </label>
          <input
            value={roleName}
            onChange={e => { setRoleName(e.target.value); setErrors(prev => ({ ...prev, roleName: '' })) }}
            placeholder="QA 엔지니어"
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
              border: `1px solid ${errors.roleName ? '#f44336' : 'var(--c-border)'}`,
              background: 'var(--c-bg)', color: 'var(--c-text)', boxSizing: 'border-box',
            }}
          />
          {errors.roleName && <div style={{ fontSize: 11, color: '#f44336', marginTop: 4 }}>{errors.roleName}</div>}
        </div>

        {/* 공개 범위 선택 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 8 }}>공개 범위</div>
          <div style={{ display: 'flex', gap: 10 }}>
            {([
              { value: 'public',  label: '팀 공통', desc: '모든 구성원이 사용 가능', color: '#4caf50' },
              { value: 'private', label: '나만 사용', desc: '본인만 사용 가능', color: '#78909c' },
            ] as const).map(opt => (
              <label
                key={opt.value}
                style={{
                  flex: 1, padding: '10px 12px', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${visibility === opt.value ? opt.color : 'var(--c-border)'}`,
                  background: visibility === opt.value ? opt.color + '11' : 'var(--c-bg)',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                }}
              >
                <input
                  type="radio"
                  name="visibility"
                  value={opt.value}
                  checked={visibility === opt.value}
                  onChange={() => setVisibility(opt.value)}
                  style={{ marginTop: 2, accentColor: opt.color }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: visibility === opt.value ? opt.color : 'var(--c-text)' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{opt.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-muted)', display: 'block', marginBottom: 5 }}>
            시스템 프롬프트 <span style={{ fontSize: 11 }}>(선택, 나중에 편집 가능)</span>
          </label>
          <textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="이 역할의 AI 행동 지침을 입력하세요..."
            rows={4}
            style={{
              width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
              border: '1px solid var(--c-border)',
              background: 'var(--c-bg)', color: 'var(--c-text)',
              fontFamily: 'monospace', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        {errors.submit && <div style={{ fontSize: 12, color: '#f44336', marginBottom: 12 }}>{errors.submit}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={{ padding: '8px 16px', borderRadius: 7, fontSize: 13, cursor: 'pointer', background: 'var(--c-bg)', border: '1px solid var(--c-border)', color: 'var(--c-text)' }}>취소</button>
          <button onClick={handleSubmit} disabled={saving} style={{ padding: '8px 20px', borderRadius: 7, fontSize: 13, cursor: saving ? 'default' : 'pointer', background: '#1976d2', border: 'none', color: '#fff', fontWeight: 600 }}>
            {saving ? '추가 중...' : '추가'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────────────────────────

export default function AiPromptsPage() {
  const { user } = useAuth()
  const memberId = user?.username ?? ''

  const [prompts, setPrompts] = useState<RolePrompt[]>([])
  const [loading, setLoading] = useState(true)
  const [activeRole, setActiveRole] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [editText, setEditText] = useState('')
  const [saving, setSaving] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<RolePrompt | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const toastSeq = useRef(0)

  // ── 토스트 ─────────────────────────────────────────────────────────────────

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastSeq.current
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000)
  }, [])

  // ── 데이터 로드 ─────────────────────────────────────────────────────────────

  const loadPrompts = useCallback(async () => {
    if (!memberId) return
    setLoading(true)
    try {
      const list = await getPrompts(memberId)
      setPrompts(list)
      if (list.length && !activeRole) {
        const first = list[0]
        setActiveRole(first.role)
        setEditName(first.roleName)
        setEditText(first.systemPrompt)
      }
    } catch {
      showToast('프롬프트 목록 조회에 실패했습니다', 'error')
    } finally {
      setLoading(false)
    }
  }, [memberId, activeRole, showToast])

  useEffect(() => { loadPrompts() }, [memberId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── 역할 선택 ───────────────────────────────────────────────────────────────

  const handleSelect = (p: RolePrompt) => {
    setActiveRole(p.role)
    setEditName(p.roleName)
    setEditText(p.systemPrompt)
  }

  // ── 저장 ────────────────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!activeRole || saving) return
    setSaving(true)
    try {
      await updatePrompt(activeRole, editName, editText)
      const now = new Date().toISOString()
      setPrompts(prev => prev.map(p =>
        p.role === activeRole ? { ...p, roleName: editName, systemPrompt: editText, updatedAt: now } : p
      ))
      showToast('저장되었습니다', 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // ── 역할 추가 ───────────────────────────────────────────────────────────────

  const handleAdd = async (role: string, roleName: string, systemPrompt: string, visibility: 'public' | 'private') => {
    const created = await createPrompt(role, roleName, systemPrompt, visibility, memberId)
    setPrompts(prev => [...prev, created])
    setActiveRole(created.role)
    setEditName(created.roleName)
    setEditText(created.systemPrompt)
    showToast(`'${roleName}' 역할이 추가되었습니다`, 'success')
  }

  // ── 역할 삭제 ───────────────────────────────────────────────────────────────

  const handleDelete = async () => {
    if (!deleteTarget) return
    try {
      await deletePrompt(deleteTarget.role)
      const remaining = prompts.filter(p => p.role !== deleteTarget.role)
      setPrompts(remaining)
      if (activeRole === deleteTarget.role) {
        const next = remaining[0] ?? null
        setActiveRole(next?.role ?? null)
        setEditName(next?.roleName ?? '')
        setEditText(next?.systemPrompt ?? '')
      }
      showToast(`'${deleteTarget.roleName}' 역할이 삭제되었습니다`, 'success')
    } catch (e) {
      showToast((e as Error).message, 'error')
    } finally {
      setDeleteTarget(null)
    }
  }

  // ── 파생 상태 ───────────────────────────────────────────────────────────────

  const activePrompt = prompts.find(p => p.role === activeRole) ?? null
  const isDirty = activePrompt !== null &&
    (editText !== activePrompt.systemPrompt || editName !== activePrompt.roleName)
  const charCount = editText.length
  const activeColor = activeRole ? getRoleColor(activeRole, prompts.findIndex(p => p.role === activeRole)) : '#888'
  const isActivePublic = activePrompt?.visibility === 'public'

  // ── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 32px', height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <ToastList toasts={toasts} />
      {deleteTarget && (
        <ConfirmDialog roleName={deleteTarget.roleName} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
      {showNewModal && (
        <NewRoleModal
          existingRoles={prompts.map(p => p.role)}
          onAdd={handleAdd}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {/* 헤더 */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>프롬프트 관리</h2>
        <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginTop: 3 }}>역할별 AI 시스템 프롬프트를 편집합니다</div>
      </div>

      {/* 2-패널 레이아웃 */}
      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>

        {/* 좌측: 역할 목록 */}
        <div style={{
          width: 220, flexShrink: 0,
          background: 'var(--c-card)', border: '1px solid var(--c-border)',
          borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--c-border)' }}>
            <button
              onClick={() => setShowNewModal(true)}
              style={{
                width: '100%', padding: '8px 10px', borderRadius: 7, fontSize: 13,
                cursor: 'pointer', border: '1px dashed var(--c-border)',
                background: 'var(--c-bg)', color: 'var(--c-text)',
                display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500,
              }}
            >
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> 새 역할 추가
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && (
              <div style={{ padding: '20px', fontSize: 12, color: 'var(--c-text-muted)', textAlign: 'center' }}>불러오는 중...</div>
            )}
            {prompts.map((p, i) => {
              const color = getRoleColor(p.role, i)
              const isActive = p.role === activeRole
              const isDefault = DEFAULT_ROLES.includes(p.role)
              const canDelete = !isDefault && p.visibility === 'private'
              return (
                <div
                  key={p.role}
                  onClick={() => handleSelect(p)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    padding: '10px 12px', cursor: 'pointer',
                    borderLeft: `3px solid ${isActive ? color : 'transparent'}`,
                    background: isActive ? 'var(--c-bg)' : 'transparent',
                    transition: 'background 0.1s',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: isActive ? 600 : 400,
                      color: isActive ? color : 'var(--c-text)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {p.roleName}
                    </div>
                    <div style={{ display: 'flex', gap: 5, marginTop: 3, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>{p.role}</span>
                      <VisibilityBadge visibility={p.visibility} />
                    </div>
                  </div>
                  {canDelete && (
                    <button
                      onClick={e => { e.stopPropagation(); setDeleteTarget(p) }}
                      style={{
                        flexShrink: 0, width: 20, height: 20, borderRadius: 4,
                        border: 'none', background: 'none', cursor: 'pointer',
                        color: 'var(--c-text-muted)', fontSize: 14, lineHeight: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: 0.6,
                      }}
                      title="삭제"
                    >×</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* 우측: 편집 패널 */}
        <div style={{
          flex: 1, background: 'var(--c-card)', border: '1px solid var(--c-border)',
          borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}>
          {!activePrompt ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text-muted)', fontSize: 13 }}>
              좌측에서 역할을 선택하세요
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', overflow: 'hidden' }}>

              {/* 팀 공통 역할 경고 */}
              {isActivePublic && (
                <div style={{
                  marginBottom: 14, padding: '10px 14px', borderRadius: 8, flexShrink: 0,
                  background: '#ff980011', border: '1px solid #ff980044',
                  fontSize: 12, color: '#e65100', lineHeight: 1.6,
                }}>
                  ⚠️ <strong>팀 공통 역할</strong>입니다. 변경 시 모든 구성원에게 영향을 줍니다.
                </div>
              )}

              {/* 역할명 입력 */}
              <div style={{ marginBottom: 14, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 11, padding: '2px 8px', borderRadius: 10,
                    background: activeColor + '22', color: activeColor, fontWeight: 600,
                  }}>{activeRole}</span>
                  <VisibilityBadge visibility={activePrompt.visibility} />
                  {activePrompt.updatedAt && (
                    <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                      수정: {new Date(activePrompt.updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="역할명"
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 7, fontSize: 14,
                    border: '1px solid var(--c-border)', background: 'var(--c-bg)',
                    color: 'var(--c-text)', fontWeight: 600, boxSizing: 'border-box',
                    outline: 'none',
                  }}
                  onFocus={e => (e.target.style.borderColor = activeColor)}
                  onBlur={e => (e.target.style.borderColor = 'var(--c-border)')}
                />
              </div>

              {/* 시스템 프롬프트 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>시스템 프롬프트</span>
                  <span style={{ fontSize: 12, color: charCount > 8000 ? '#f44336' : 'var(--c-text-muted)' }}>
                    {charCount.toLocaleString()}자
                  </span>
                </div>
                <textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  placeholder={`${activePrompt.roleName} 역할의 시스템 프롬프트를 입력하세요...`}
                  style={{
                    flex: 1, minHeight: 400, padding: '14px 16px',
                    borderRadius: 8, border: '1px solid var(--c-border)',
                    background: 'var(--c-bg)', color: 'var(--c-text)',
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
                    fontSize: 13, lineHeight: 1.7, resize: 'none',
                    outline: 'none', boxSizing: 'border-box',
                  }}
                  onFocus={e => (e.target.style.borderColor = activeColor)}
                  onBlur={e => (e.target.style.borderColor = 'var(--c-border)')}
                />
              </div>

              {/* 하단 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexShrink: 0 }}>
                <button
                  onClick={() => { setEditName(activePrompt.roleName); setEditText(activePrompt.systemPrompt) }}
                  disabled={!isDirty || saving}
                  style={{
                    fontSize: 13, padding: '8px 16px', borderRadius: 7,
                    cursor: isDirty ? 'pointer' : 'default',
                    border: '1px solid var(--c-border)', background: 'var(--c-bg)',
                    color: isDirty ? 'var(--c-text-sub)' : 'var(--c-text-muted)',
                    opacity: isDirty ? 1 : 0.4,
                  }}
                >되돌리기</button>
                <button
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  style={{
                    fontSize: 13, padding: '8px 24px', borderRadius: 7,
                    cursor: isDirty && !saving ? 'pointer' : 'default',
                    border: 'none', fontWeight: 600, minWidth: 80,
                    background: isDirty && !saving ? activeColor : 'var(--c-border)',
                    color: isDirty && !saving ? '#fff' : 'var(--c-text-muted)',
                    transition: 'background 0.15s',
                  }}
                >{saving ? '저장 중...' : '저장'}</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
