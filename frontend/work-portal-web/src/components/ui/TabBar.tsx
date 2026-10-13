import type { CSSProperties, ReactNode } from 'react'
import { TabsList, TabsRoot, TabsTrigger } from 'rsp-react-design-system/shadcn'

interface TabItem<T extends string> {
  value: T
  label: ReactNode
  disabled?: boolean
}

interface TabBarProps<T extends string> {
  value: T
  onChange: (value: T) => void
  items: TabItem<T>[]
  variant?: 'line' | 'default'   // line: 밑줄 탭(기본), default: 세그먼트형
  style?: CSSProperties
}

// RSP 디자인시스템 SDK Tabs 래퍼 — 탭 목록만 렌더링, 패널은 기존처럼 value 로 조건부 렌더링
export default function TabBar<T extends string>({ value, onChange, items, variant = 'line', style }: TabBarProps<T>) {
  return (
    <TabsRoot value={value} onValueChange={v => onChange(v as T)} style={style}>
      <TabsList variant={variant} data-portal-tabs="">
        {items.map(item => (
          <TabsTrigger key={item.value} value={item.value} disabled={item.disabled}>{item.label}</TabsTrigger>
        ))}
      </TabsList>
    </TabsRoot>
  )
}
