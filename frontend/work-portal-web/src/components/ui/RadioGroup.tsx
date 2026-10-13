import type { CSSProperties, ReactNode } from 'react'
import { RadioGroup as SdkRadioGroup, RadioGroupItem } from 'rsp-react-design-system/shadcn'

interface RadioOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface RadioGroupProps {
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  options: RadioOption[]
  disabled?: boolean
  direction?: 'row' | 'column'   // 기본 row
  style?: CSSProperties
}

// RSP 디자인시스템 SDK RadioGroup 래퍼 — 옵션 배열로 라디오 묶음 렌더링
export default function RadioGroup({
  value,
  defaultValue,
  onValueChange,
  options,
  disabled,
  direction = 'row',
  style,
}: RadioGroupProps) {
  return (
    <SdkRadioGroup
      value={value}
      defaultValue={defaultValue}
      onValueChange={v => onValueChange?.(String(v))}
      disabled={disabled}
      style={{ display: 'flex', flexDirection: direction, gap: direction === 'row' ? 16 : 8, width: 'auto', ...style }}
    >
      {options.map(o => (
        <label
          key={o.value}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: o.disabled || disabled ? 'not-allowed' : 'pointer', opacity: o.disabled ? 0.5 : 1 }}
        >
          <RadioGroupItem value={o.value} disabled={o.disabled} />
          {o.label}
        </label>
      ))}
    </SdkRadioGroup>
  )
}
