import type { CSSProperties, ReactNode } from 'react'
import { Item, ItemActions, ItemContent, ItemDescription, ItemTitle } from '@lotte/rsp-react-design-system/shadcn'

interface ListItemProps {
  title: ReactNode
  description?: ReactNode   // 두 번째 줄 (작성자·날짜·건수 등)
  actions?: ReactNode       // 오른쪽 끝 (삭제 IconButton, 뱃지 등) — 클릭이 행 선택으로 전파되지 않게 처리됨
  selected?: boolean
  onClick?: () => void
  style?: CSSProperties
}

// RSP 디자인시스템 SDK Item 기반 선택형 목록 행 (회의록·주간보고 목록, 대화 이력, 역할 목록 등)
export default function ListItem({ title, description, actions, selected, onClick, style }: ListItemProps) {
  return (
    <Item
      variant={selected ? 'muted' : 'default'}
      size="sm"
      data-portal-list-item=""
      data-selected={selected ? '' : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={onClick ? e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } } : undefined}
      style={style}
    >
      <ItemContent>
        <ItemTitle>{title}</ItemTitle>
        {description && <ItemDescription>{description}</ItemDescription>}
      </ItemContent>
      {actions && <ItemActions onClick={e => e.stopPropagation()}>{actions}</ItemActions>}
    </Item>
  )
}
