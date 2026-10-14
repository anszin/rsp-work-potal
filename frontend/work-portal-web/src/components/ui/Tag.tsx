import type { CSSProperties, ReactNode } from 'react'
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
  style?: CSSProperties
  children: ReactNode
}

// RSP 디자인시스템 SDK Badge 기반 태그/뱃지 — 상태·유형·레벨 등 알약형 라벨
export default function Tag({ tone = 'neutral', color, bg, title, style, children }: TagProps) {
  const t = TONE[tone]
  const fg = color ?? t.color
  const background = bg ?? (color ? `color-mix(in srgb, ${color} 13%, transparent)` : t.bg)
  return (
    <Badge variant="secondary" title={title} style={{ color: fg, background, ...style }}>
      {children}
    </Badge>
  )
}
