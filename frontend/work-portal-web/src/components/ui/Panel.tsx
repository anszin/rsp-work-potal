import type { ComponentProps } from 'react'
import { Card } from 'rsp-react-design-system/shadcn'

type PanelProps = ComponentProps<'div'>

// RSP 디자인시스템 SDK Card 기반 패널 — 카드형 박스(요약 카드, 상세 패널, 인라인 폼 등)
// SDK Card 의 배경·라운드·테두리(ring)·그림자 사용, 패딩은 포탈 밀도(16px)로 보정 (index.css [data-portal-card])
// 기본 flex column + gap 12px. 내부 레이아웃이 다르면 style 로 display 등을 지정
export default function Panel(props: PanelProps) {
  return <Card data-portal-card="" {...props} />
}
