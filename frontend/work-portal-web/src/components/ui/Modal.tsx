import type { CSSProperties, ReactNode } from 'react'
import { Dialog, DialogContent } from '@lotte/rsp-react-design-system/shadcn'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string                 // SDK DialogContent 제약으로 문자열만 가능
  description?: ReactNode
  width?: number | string        // 최대 너비 (기본 560)
  dismissible?: boolean          // 바깥 클릭으로 닫기 (기본 false — 입력 중 실수로 닫히는 것 방지, ESC 는 항상 동작)
  showCloseButton?: boolean      // 우상단 X 버튼 (기본 true)
  closeOnEscape?: boolean        // ESC 로 닫기 (기본 true — 임시 비밀번호 안내처럼 반드시 확인해야 하는 창은 false)
  style?: CSSProperties          // 콘텐츠 박스 추가 스타일
  children: ReactNode
}

// RSP 디자인시스템 SDK Dialog 래퍼 — 포커스 트랩·ESC 닫기·스크롤 잠금 제공
export default function Modal({
  open,
  onClose,
  title,
  description,
  width = 560,
  dismissible = false,
  showCloseButton = true,
  closeOnEscape = true,
  style,
  children,
}: ModalProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(o, details) => {
        if (o) return
        if (!closeOnEscape && details.reason === 'escape-key') return
        onClose()
      }}
      disablePointerDismissal={!dismissible}
    >
      <DialogContent
        title={title}
        description={description}
        showCloseButton={showCloseButton}
        data-portal-modal=""
        style={{ maxWidth: width, maxHeight: '90vh', overflowY: 'auto', ...style }}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}
