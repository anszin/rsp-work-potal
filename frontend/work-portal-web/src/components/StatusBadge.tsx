import type { RequestStatus } from '../api/changeRequests'
import { Tag } from './ui'
import type { TagTone } from './ui/Tag'

const config: Record<RequestStatus, { label: string; tone: TagTone }> = {
  DRAFT:     { label: '초안', tone: 'neutral' },
  REQUESTED: { label: '요청', tone: 'info' },
  APPROVED:  { label: '승인', tone: 'purple' },
  COMPLETED: { label: '완료', tone: 'success' },
  REJECTED:  { label: '반려', tone: 'danger' },
}

// 요청 상태 뱃지 — SDK Badge 기반 Tag
export default function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, tone } = config[status] ?? { label: status, tone: 'neutral' as TagTone }
  return <Tag tone={tone}>{label}</Tag>
}
