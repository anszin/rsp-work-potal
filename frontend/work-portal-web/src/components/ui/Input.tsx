import type { ComponentProps } from 'react'
import { Input as SdkInput } from '@lotte/rsp-react-design-system/shadcn'

type InputProps = ComponentProps<typeof SdkInput>

// RSP 디자인시스템 SDK Input — 텍스트·숫자·날짜·비밀번호 등 텍스트형 입력 전용
// (checkbox/radio/file/color/range 는 네이티브 input 사용, ref 전달 불가에 유의)
// data-portal-field: 포탈 밀도에 맞춘 크기 보정용 (index.css 참고)
export default function Input(props: InputProps) {
  return <SdkInput data-portal-field="input" {...props} />
}
