import type { ComponentProps } from 'react'
import { Textarea as SdkTextarea } from '@lotte/rsp-react-design-system/shadcn'

type TextareaProps = ComponentProps<typeof SdkTextarea>

// RSP 디자인시스템 SDK Textarea — ref 전달 불가에 유의
// data-portal-field: 포탈 밀도 보정 + rows 동작 유지(자동 높이 해제) (index.css 참고)
export default function Textarea(props: TextareaProps) {
  return <SdkTextarea data-portal-field="textarea" {...props} />
}
