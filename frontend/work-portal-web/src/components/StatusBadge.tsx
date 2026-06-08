import type { RequestStatus } from '../api/changeRequests'

const config: Record<RequestStatus, { label: string; color: string; bg: string }> = {
  DRAFT:     { label: '초안',   color: 'var(--c-tag-draft-t)',  bg: 'var(--c-tag-draft-bg)' },
  REQUESTED: { label: '요청',   color: 'var(--c-tag-sys-t)',    bg: 'var(--c-tag-sys)' },
  APPROVED:  { label: '승인',   color: 'var(--c-tag-sub-t)',    bg: 'var(--c-tag-sub)' },
  COMPLETED: { label: '완료',   color: 'var(--c-tag-done-t)',   bg: 'var(--c-tag-done-bg)' },
  REJECTED:  { label: '반려',   color: 'var(--c-tag-err-t)',    bg: 'var(--c-tag-err-bg)' },
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
