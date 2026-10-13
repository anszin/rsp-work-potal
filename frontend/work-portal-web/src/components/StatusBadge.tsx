import { Badge } from 'rsp-react-design-system/shadcn'
import type { RequestStatus } from '../api/changeRequests'

const config: Record<RequestStatus, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: '초안', color: 'var(--c-tag-draft-t)',  bg: 'var(--c-tag-draft-bg)' },
  REQUESTED: { label: '요청', color: 'var(--c-tag-sys-t)',    bg: 'var(--c-tag-sys)' },
  APPROVED:  { label: '승인', color: 'var(--c-tag-pri-t)',    bg: 'var(--c-tag-pri-bg)' },
  COMPLETED: { label: '완료', color: 'var(--c-tag-done-t)',   bg: 'var(--c-tag-done-bg)' },
  REJECTED:  { label: '반려', color: 'var(--c-tag-err-t)',    bg: 'var(--c-tag-err-bg)' },
}

// SDK Badge 형태(크기·라운드)에 포탈 상태 색상 토큰 적용
export default function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, color, bg } = config[status] ?? { label: status, color: 'var(--c-tag-draft-t)', bg: 'var(--c-tag-draft-bg)' }
  return (
    <Badge variant="secondary" style={{ color, background: bg }}>
      {label}
    </Badge>
  )
}
