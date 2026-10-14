import { Children, Fragment, isValidElement } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import {
  Select as SdkSelect,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@lotte/rsp-react-design-system/shadcn'

type Option = { value: string; label: ReactNode; disabled?: boolean }
type OptionGroup = { label?: ReactNode; options: Option[] }

interface SelectProps {
  value?: string | number
  defaultValue?: string | number
  onValueChange?: (value: string) => void
  disabled?: boolean
  required?: boolean
  name?: string
  id?: string
  title?: string
  placeholder?: ReactNode
  style?: CSSProperties   // 트리거(필드)에 적용 — width 등 레이아웃 지정용
  className?: string
  children: ReactNode     // 기존 네이티브와 동일하게 <option>/<optgroup> 사용
}

type OptionProps = { value?: string | number; disabled?: boolean; children?: ReactNode }
type OptgroupProps = { label?: ReactNode; children?: ReactNode }

// <option> 텍스트 추출 (value 미지정 시 네이티브와 동일하게 텍스트를 값으로 사용)
function textOf(node: ReactNode): string {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(textOf).join('')
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children)
  return ''
}

// <option>/<optgroup> 자식을 SDK Select 항목 그룹으로 변환 (map 배열·Fragment 포함)
function collectGroups(children: ReactNode): OptionGroup[] {
  const groups: OptionGroup[] = [{ options: [] }]
  const walk = (nodes: ReactNode, target: OptionGroup) => {
    Children.forEach(nodes, node => {
      if (!isValidElement(node)) return
      if (node.type === Fragment) return walk((node.props as { children?: ReactNode }).children, target)
      if (node.type === 'optgroup') {
        const { label, children: groupChildren } = node.props as OptgroupProps
        const group: OptionGroup = { label, options: [] }
        groups.push(group)
        walk(groupChildren, group)
        return
      }
      if (node.type === 'option') {
        const { value, disabled, children: label } = node.props as OptionProps
        target.options.push({ value: value != null ? String(value) : textOf(label), label, disabled })
      }
    })
  }
  walk(children, groups[0])
  return groups.filter(g => g.options.length > 0)
}

// RSP 디자인시스템 SDK Select 래퍼 — 네이티브 <select> 를 최소 수정으로 대체
// onChange(e) 대신 onValueChange(value: string) 사용, 값은 항상 문자열
// data-portal-field: 포탈 밀도 보정용 (index.css 참고)
export default function Select({
  value,
  defaultValue,
  onValueChange,
  disabled,
  required,
  name,
  id,
  title,
  placeholder,
  style,
  className,
  children,
}: SelectProps) {
  const groups = collectGroups(children)
  const items = groups.flatMap(g => g.options.map(o => ({ value: o.value, label: o.label })))

  return (
    <SdkSelect
      items={items}
      value={value === undefined ? undefined : String(value)}
      defaultValue={defaultValue === undefined ? undefined : String(defaultValue)}
      onValueChange={v => onValueChange?.(v == null ? '' : String(v))}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectTrigger
        id={id}
        title={title}
        style={style}
        className={className}
        data-portal-field="select"
        // 채움 너비(100%)일 때 선택 항목 글자 길이가 grid/flex 열 너비를 밀어내지 않도록 표시 (index.css)
        data-portal-fill={style?.width === '100%' ? '' : undefined}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {groups.map((g, gi) => (
          <SelectGroup key={gi}>
            {g.label != null && <SelectLabel>{g.label}</SelectLabel>}
            {g.options.map((o, oi) => (
              <SelectItem key={`${gi}-${oi}`} value={o.value} disabled={o.disabled}>{o.label}</SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </SdkSelect>
  )
}
