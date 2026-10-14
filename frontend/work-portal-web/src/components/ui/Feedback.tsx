import type { CSSProperties, ReactNode } from 'react'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle, Spinner } from '@lotte/rsp-react-design-system/shadcn'

// 로딩 표시 — SDK Spinner + 안내 문구
export function Loading({ text = '불러오는 중...', style }: { text?: ReactNode; style?: CSSProperties }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, color: 'var(--c-text-muted)', fontSize: 13, ...style }}>
      <Spinner />
      {text}
    </div>
  )
}

// 빈 화면 안내 — SDK Empty (포탈 밀도로 패딩 축소)
export function EmptyState({ title, description, children, style }: {
  title: ReactNode
  description?: ReactNode
  children?: ReactNode   // 액션 버튼 등
  style?: CSSProperties
}) {
  return (
    <Empty style={{ padding: 20, gap: 8, ...style }}>
      <EmptyHeader>
        <EmptyTitle style={{ fontSize: 14, color: 'var(--c-text-sub)' }}>{title}</EmptyTitle>
        {description && <EmptyDescription style={{ fontSize: 12 }}>{description}</EmptyDescription>}
      </EmptyHeader>
      {children}
    </Empty>
  )
}
