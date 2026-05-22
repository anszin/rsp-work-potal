import type { RequestStatus } from '../api/changeRequests'

const config: Record<RequestStatus, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: '초안',   color: '#718096', bg: '#EDF2F7' },
  REQUESTED: { label: '요청',   color: '#2B6CB0', bg: '#EBF8FF' },
  APPROVED:  { label: '승인',   color: '#276749', bg: '#F0FFF4' },
  COMPLETED: { label: '완료',   color: '#285E61', bg: '#E6FFFA' },
  REJECTED:  { label: '반려',   color: '#9B2C2C', bg: '#FFF5F5' },
}

export default function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, color, bg } = config[status] ?? { label: status, color: '#333', bg: '#eee' }
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 10px',
      borderRadius: 12,
      fontSize: 12,
      fontWeight: 600,
      color,
      background: bg,
    }}>
      {label}
    </span>
  )
}
