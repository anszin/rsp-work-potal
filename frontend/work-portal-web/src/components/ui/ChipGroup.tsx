import type { CSSProperties, ReactNode } from 'react'
import { ToggleGroup, ToggleGroupItem } from '@lotte/rsp-react-design-system/shadcn'

interface ChipOption<T extends string> {
  value: T
  label: ReactNode
  color?: string      // 선택 시 강조색 (예: 역할별 범주형 색). 미지정 시 포탈 강조색
  disabled?: boolean
}

interface ChipGroupProps<T extends string> {
  value: T | null
  onChange: (value: T) => void
  options: ChipOption<T>[]
  allowDeselect?: boolean   // true 면 선택된 칩을 다시 눌러 해제 가능 (onChange 에 '' 전달)
  style?: CSSProperties
}

// RSP 디자인시스템 SDK ToggleGroup 기반 단일 선택 칩 묶음 (역할 필터, 범위 필터 등)
export default function ChipGroup<T extends string>({ value, onChange, options, allowDeselect, style }: ChipGroupProps<T>) {
  return (
    <ToggleGroup
      variant="outline"
      size="sm"
      spacing={1.5}
      value={value ? [value] : []}
      onValueChange={(next: unknown[]) => {
        const v = next[0] as T | undefined
        if (v) onChange(v)
        else if (allowDeselect) onChange('' as T)
      }}
      style={{ flexWrap: 'wrap', ...style }}
    >
      {options.map(o => (
        <ToggleGroupItem
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          data-portal-chip=""
          style={{ '--chip-color': o.color ?? 'var(--c-action)' } as CSSProperties}
        >
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  )
}
