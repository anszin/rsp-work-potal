import type { CSSProperties, ReactNode } from 'react'
import { X } from 'lucide-react'
import { Badge } from '@lotte/rsp-react-design-system/shadcn'

export type TagTone = 'info' | 'success' | 'danger' | 'warning' | 'purple' | 'teal' | 'neutral'

// 톤별 포탈 태그 토큰 (배경 / 글자) — 다크모드 자동 대응
const TONE: Record<TagTone, { bg: string; color: string }> = {
  info:    { bg: 'var(--c-tag-sys)',      color: 'var(--c-tag-sys-t)' },
  success: { bg: 'var(--c-tag-done-bg)',  color: 'var(--c-tag-done-t)' },
  danger:  { bg: 'var(--c-tag-err-bg)',   color: 'var(--c-tag-err-t)' },
  warning: { bg: 'var(--c-tag-warn-bg)',  color: 'var(--c-tag-warn-t)' },
  purple:  { bg: 'var(--c-tag-pri-bg)',   color: 'var(--c-tag-pri-t)' },
  teal:    { bg: 'var(--c-tag-teal-bg)',  color: 'var(--c-tag-teal-t)' },
  neutral: { bg: 'var(--c-tag-draft-bg)', color: 'var(--c-tag-draft-t)' },
}

interface TagProps {
  tone?: TagTone
  color?: string        // tone 대신 임의 색 지정 (글자색, 예: 범주형 var(--c-chart-N))
  bg?: string           // 임의 배경색 (미지정 시 color 13% 틴트)
  title?: string
  onRemove?: () => void // 지정 시 오른쪽에 제거(×) 버튼 표시 — 선택된 항목 칩 등
  removeLabel?: string  // 제거 버튼 aria-label (기본 '제거')
  style?: CSSProperties
  children: ReactNode
}

// RSP 디자인시스템 SDK Badge 기반 태그/뱃지 — 상태·유형·레벨 등 알약형 라벨, 제거 가능한 선택 칩
export default function Tag({ tone = 'neutral', color, bg, title, onRemove, removeLabel = '제거', style, children }: TagProps) {
  const t = TONE[tone]
  const fg = color ?? t.color
  const background = bg ?? (color ? `color-mix(in srgb, ${color} 13%, transparent)` : t.bg)
  return (
    <Badge variant="secondary" title={title} style={{ color: fg, background, ...style }}>
      {children}
      {onRemove && (
        <button type="button" className="portal-tag-remove" aria-label={removeLabel} onClick={onRemove}>
          <X />
        </button>
      )}
    </Badge>
  )
}
