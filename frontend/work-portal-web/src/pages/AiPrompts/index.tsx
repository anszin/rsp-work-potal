import { useState, useEffect, useCallback } from 'react'
import { getPrompts, createPrompt, updatePrompt, deletePrompt, RolePrompt } from '../../api/aiApi'
import { useAuth } from '../../context/useAuth'
import {
  Button, IconButton, Input, Textarea, Modal, Tag, Panel, Loading, EmptyState, toast,
  RadioGroup, Callout, ListItem,
} from '../../components/ui'
import PageHeader from '../../components/PageHeader'

// ── 상수 ──────────────────────────────────────────────────────────────────────

const DEFAULT_ROLES = ['backend', 'android', 'frontend', 'planner']

const DEFAULT_COLORS: Record<string, string> = {
  backend: 'var(--c-chart-1)', android: 'var(--c-chart-2)', frontend: 'var(--c-chart-3)', planner: 'var(--c-chart-5)',
}
const EXTRA_COLORS = ['var(--c-chart-4)', 'var(--c-chart-6)', 'var(--c-chart-3)', 'var(--c-chart-8)', 'var(--c-chart-2)', 'var(--c-chart-5)', 'var(--c-chart-7)']

function getRoleColor(role: string, index: number): string {
  return DEFAULT_COLORS[role] ?? EXTRA_COLORS[index % EXTRA_COLORS.length]
}

const ROLE_ID_RE = /^[a-z][a-z0-9_-]{0,29}$/

// ── 배지 ──────────────────────────────────────────────────────────────────────

function VisibilityBadge({ visibility }: { visibility: 'public' | 'private' }) {
  const isPublic = visibility === 'public'
  return (
    <Tag tone={isPublic ? 'success' : 'neutral'} style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
      {isPublic ? '팀 공통' : '개인'}
    </Tag>
  )
}

// ── 삭제 확인 다이얼로그 ──────────────────────────────────────────────────────

function ConfirmDialog({ roleName, onConfirm, onCancel }: {
  roleName: string; onConfirm: () => void; onCancel: () => void
}) {
  return (
    <Modal open onClose={onCancel} title="역할 삭제" width={360}>
      <div style={{ fontSize: 13, color: 'var(--c-text-sub)', marginBottom: 20, lineHeight: 1.6 }}>
        <strong style={{ color: 'var(--c-text)' }}>{roleName}</strong> 역할과 시스템 프롬프트를 삭제합니다.<br />
        이 작업은 되돌릴 수 없습니다.
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <Button variant="outlined" size="sm" onClick={onCancel}>취소</Button>
        <Button variant="danger" size="sm" onClick={onConfirm}>삭제</Button>
      </div>
    </Modal>
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
    <Modal open onClose={onClose} title="새 역할 추가" width={480}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-muted)', display: 'block', marginBottom: 5 }}>
            역할 ID <span style={{ color: 'var(--c-tag-err-t)' }}>*</span>
            <span style={{ fontSize: 11, marginLeft: 6 }}>(영문 소문자, 예: qa, devops)</span>
          </label>
          <Input
            value={role}
            onChange={e => { setRole(e.target.value.toLowerCase()); setErrors(prev => ({ ...prev, role: '' })) }}
            placeholder="qa"
            aria-invalid={!!errors.role}
            style={{ width: '100%' }}
          />
          {errors.role && <div style={{ fontSize: 11, color: 'var(--c-tag-err-t)', marginTop: 4 }}>{errors.role}</div>}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-muted)', display: 'block', marginBottom: 5 }}>
            역할명 <span style={{ color: 'var(--c-tag-err-t)' }}>*</span>
            <span style={{ fontSize: 11, marginLeft: 6 }}>(한글 표시명, 예: QA 엔지니어)</span>
          </label>
          <Input
            value={roleName}
            onChange={e => { setRoleName(e.target.value); setErrors(prev => ({ ...prev, roleName: '' })) }}
            placeholder="QA 엔지니어"
            aria-invalid={!!errors.roleName}
            style={{ width: '100%' }}
          />
          {errors.roleName && <div style={{ fontSize: 11, color: 'var(--c-tag-err-t)', marginTop: 4 }}>{errors.roleName}</div>}
        </div>

        {/* 공개 범위 선택 */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, color: 'var(--c-text-muted)', marginBottom: 8 }}>공개 범위</div>
          <RadioGroup
            value={visibility}
            onValueChange={v => setVisibility(v as 'public' | 'private')}
            options={[
              { value: 'public',  label: '팀 공통', desc: '모든 구성원이 사용 가능' },
              { value: 'private', label: '나만 사용', desc: '본인만 사용 가능' },
            ].map(opt => ({
              value: opt.value,
              label: (
                <span>
                  <span style={{ display: 'block', fontWeight: 600 }}>{opt.label}</span>
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--c-text-muted)', marginTop: 2 }}>{opt.desc}</span>
                </span>
              ),
            }))}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={{ fontSize: 12, color: 'var(--c-text-muted)', display: 'block', marginBottom: 5 }}>
            시스템 프롬프트 <span style={{ fontSize: 11 }}>(선택, 나중에 편집 가능)</span>
          </label>
          <Textarea
            value={systemPrompt}
            onChange={e => setSystemPrompt(e.target.value)}
            placeholder="이 역할의 AI 행동 지침을 입력하세요..."
            rows={4}
            style={{ width: '100%', resize: 'vertical' }}
          />
        </div>

        {errors.submit && <div style={{ fontSize: 12, color: 'var(--c-tag-err-t)', marginBottom: 12 }}>{errors.submit}</div>}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <Button variant="outlined" size="md" onClick={onClose} disabled={saving}>취소</Button>
          <Button variant="filled" size="md" onClick={handleSubmit} disabled={saving}>
            {saving ? '추가 중...' : '추가'}
          </Button>
        </div>
    </Modal>
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
  // ── 토스트 (SDK 토스트 매니저) ─────────────────────────────────────────────

  const showToast = useCallback((message: string, type: 'success' | 'error') => {
    toast.add({ title: message, type })
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
  const activeColor = activeRole ? getRoleColor(activeRole, prompts.findIndex(p => p.role === activeRole)) : 'var(--c-chart-8)'
  const isActivePublic = activePrompt?.visibility === 'public'

  // ── 렌더 ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '24px 32px', height: 'calc(100vh - 48px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
      <PageHeader
        title="프롬프트 관리"
        description="역할별 AI 시스템 프롬프트를 편집합니다"
        style={{ flexShrink: 0 }}
      />

      {/* 2-패널 레이아웃 */}
      <div style={{ flex: 1, display: 'flex', gap: 16, overflow: 'hidden' }}>

        {/* 좌측: 역할 목록 */}
        <Panel style={{ width: 220, flexShrink: 0, gap: 0, padding: 0, overflow: 'hidden' }}>
          <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--c-border)' }}>
            <Button
              variant="outlined"
              size="md"
              onClick={() => setShowNewModal(true)}
              leadingIcon={<span style={{ fontSize: 16, lineHeight: 1 }}>+</span>}
              style={{ width: '100%' }}
            >
              새 역할 추가
            </Button>
          </div>

          <div className="portal-list" style={{ flex: 1, overflowY: 'auto' }}>
            {loading && (
              <Loading style={{ padding: 20, fontSize: 12 }} />
            )}
            {prompts.map((p, i) => {
              const color = getRoleColor(p.role, i)
              const isActive = p.role === activeRole
              const isDefault = DEFAULT_ROLES.includes(p.role)
              const canDelete = !isDefault && p.visibility === 'private'
              return (
                <ListItem
                  key={p.role}
                  selected={isActive}
                  onClick={() => handleSelect(p)}
                  title={<span style={{ color: isActive ? color : undefined }}>{p.roleName}</span>}
                  description={
                    <span style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
                      <span>{p.role}</span>
                      <VisibilityBadge visibility={p.visibility} />
                    </span>
                  }
                  actions={canDelete ? (
                    <IconButton
                      variant="text"
                      size="sm"
                      icon="×"
                      label="역할 삭제"
                      onClick={() => setDeleteTarget(p)}
                      title="삭제"
                    />
                  ) : undefined}
                />
              )
            })}
          </div>
        </Panel>

        {/* 우측: 편집 패널 */}
        <Panel style={{ flex: 1, gap: 0, padding: 0, overflow: 'hidden' }}>
          {!activePrompt ? (
            <EmptyState title="좌측에서 역할을 선택하세요" style={{ flex: 1 }} />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '20px 24px', overflow: 'hidden' }}>

              {/* 팀 공통 역할 경고 */}
              {isActivePublic && (
                <Callout tone="warning" style={{ marginBottom: 14, flexShrink: 0 }}>
                  <strong>팀 공통 역할</strong>입니다. 변경 시 모든 구성원에게 영향을 줍니다.
                </Callout>
              )}

              {/* 역할명 입력 */}
              <div style={{ marginBottom: 14, flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <Tag color={activeColor}>{activeRole}</Tag>
                  <VisibilityBadge visibility={activePrompt.visibility} />
                  {activePrompt.updatedAt && (
                    <span style={{ fontSize: 11, color: 'var(--c-text-muted)' }}>
                      수정: {new Date(activePrompt.updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="역할명"
                  style={{ width: '100%', fontWeight: 600 }}
                />
              </div>

              {/* 시스템 프롬프트 */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 12, color: 'var(--c-text-muted)' }}>시스템 프롬프트</span>
                  <span style={{ fontSize: 12, color: charCount > 8000 ? 'var(--c-tag-err-t)' : 'var(--c-text-muted)' }}>
                    {charCount.toLocaleString()}자
                  </span>
                </div>
                <Textarea
                  value={editText}
                  onChange={e => setEditText(e.target.value)}
                  placeholder={`${activePrompt.roleName} 역할의 시스템 프롬프트를 입력하세요...`}
                  style={{ flex: 1, minHeight: 400, resize: 'none', fontFamily: 'ui-monospace, Consolas, monospace' }}
                />
              </div>

              {/* 하단 버튼 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, flexShrink: 0 }}>
                <Button
                  variant="outlined"
                  size="md"
                  onClick={() => { setEditName(activePrompt.roleName); setEditText(activePrompt.systemPrompt) }}
                  disabled={!isDirty || saving}
                >되돌리기</Button>
                <Button
                  variant="filled"
                  size="md"
                  onClick={handleSave}
                  disabled={saving || !isDirty}
                  style={{ minWidth: 80 }}
                >{saving ? '저장 중...' : '저장'}</Button>
              </div>
            </div>
          )}
        </Panel>
      </div>
    </div>
  )
}
