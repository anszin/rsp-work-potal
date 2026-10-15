import type { CSSProperties, ReactNode } from 'react'
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@lotte/rsp-react-design-system/shadcn'

export type CalloutTone = 'info' | 'success' | 'warning' | 'danger'

const TONE: Record<CalloutTone, { bg: string; color: string; Icon: typeof Info }> = {
  info:    { bg: 'var(--c-tag-sys)',     color: 'var(--c-tag-sys-t)',  Icon: Info },
  success: { bg: 'var(--c-tag-done-bg)', color: 'var(--c-tag-done-t)', Icon: CircleCheck },
  warning: { bg: 'var(--c-tag-warn-bg)', color: 'var(--c-tag-warn-t)', Icon: TriangleAlert },
  danger:  { bg: 'var(--c-tag-err-bg)',  color: 'var(--c-tag-err-t)',  Icon: CircleAlert },
}

interface CalloutProps {
  tone?: CalloutTone
  title?: ReactNode
  children?: ReactNode   // 설명 본문
  style?: CSSProperties
}

// RSP 디자인시스템 SDK Alert 기반 안내·경고 박스 (설정 안내, 오늘 점검 현황, 자동 알림 안내 등)
export default function Callout({ tone = 'info', title, children, style }: CalloutProps) {
  const { bg, color, Icon } = TONE[tone]
  return (
    <Alert data-portal-callout="" style={{ background: bg, color, borderColor: `color-mix(in srgb, ${color} 25%, transparent)`, ...style }}>
      <Icon />
      {title && <AlertTitle>{title}</AlertTitle>}
      {children && <AlertDescription style={{ color }}>{children}</AlertDescription>}
    </Alert>
  )
}
