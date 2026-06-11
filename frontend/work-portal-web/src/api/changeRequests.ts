import client from './client'

export type RequestStatus = 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED'
export type RedmineSyncStatus = 'SYNCED' | 'FAILED' | 'SKIPPED'

export interface RedmineIssueRef {
  redmineIssueId: number
  redmineIssueTitle: string
}

export interface ChangeRequest {
  id: number
  requestNo: string | null
  systemId: number
  systemCode: string
  systemName: string
  subSystemId: number | null
  subSystemName: string | null
  title: string
  content: string
  requesterUsername: string
  requesterDept: string | null
  requesterName: string | null
  status: RequestStatus
  targetDate: string | null
  attachmentLink: string | null
  attachmentOriginalName: string | null
  hasAttachment: boolean
  rejectionReason: string | null
  actionComment: string | null
  requestedAt: string | null
  approvedAt: string | null
  completedAt: string | null
  createdAt: string
  redmineIssues: RedmineIssueRef[]
  redmineSyncStatus: RedmineSyncStatus | null
}

export interface CreateChangeRequest {
  systemId: number
  subSystemId?: number | null
  title: string
  content?: string
  requesterDept?: string
  requesterName?: string
  targetDate?: string
  attachmentLink?: string
  attachmentFilename?: string
  attachmentContent?: string // base64
}

const readFileAsBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve((reader.result as string).split(',')[1])
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

export const buildPayload = async (data: CreateChangeRequest, file: File | null): Promise<CreateChangeRequest> => {
  if (!file) return data
  const base64 = await readFileAsBase64(file)
  return { ...data, attachmentFilename: file.name, attachmentContent: base64 }
}

export const deleteAttachment = (id: number) =>
  client.delete(`/change-requests/${id}/attachment`)

export const getChangeRequests = (params?: { systemId?: number; status?: RequestStatus }) =>
  client.get<ChangeRequest[]>('/change-requests', { params }).then((r) => r.data)

export const getChangeRequest = (id: number) =>
  client.get<ChangeRequest>(`/change-requests/${id}`).then((r) => r.data)

export const createChangeRequest = (data: CreateChangeRequest) =>
  client.post<ChangeRequest>('/change-requests', data).then((r) => r.data)

export const updateChangeRequest = (id: number, data: CreateChangeRequest) =>
  client.put<ChangeRequest>(`/change-requests/${id}`, data).then((r) => r.data)

export const changeRequestStatus = (id: number, status: RequestStatus, comment?: string) =>
  client.patch<ChangeRequest>(`/change-requests/${id}/status`, { status, comment }).then((r) => r.data)

export const deleteChangeRequest = (id: number) =>
  client.delete(`/change-requests/${id}`)

export const syncRedmineForCR = (id: number) =>
  client.post<ChangeRequest>(`/change-requests/${id}/sync-redmine`).then(r => r.data)

export const downloadAttachment = async (id: number, filename: string) => {
  const res = await client.get(`/change-requests/${id}/attachment`, { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
