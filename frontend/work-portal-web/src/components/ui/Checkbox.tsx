import type { ComponentProps } from 'react'
import { Checkbox as SdkCheckbox } from 'rsp-react-design-system/shadcn'

type CheckboxProps = ComponentProps<typeof SdkCheckbox>

// RSP 디자인시스템 SDK Checkbox (base-ui)
// 네이티브와 달리 onChange(e) 대신 onCheckedChange(checked: boolean) 사용, label 지정 시 라벨 포함 렌더링
export default function Checkbox(props: CheckboxProps) {
  return <SdkCheckbox {...props} />
}
