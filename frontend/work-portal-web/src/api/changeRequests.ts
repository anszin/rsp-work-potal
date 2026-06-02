import client from './client'

export type RequestStatus = 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED'

export interface ChangeRequest {
  id: number
  requestNo: string | null
  systemId: number
  systemCode: string
  systemName: string
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
  requestedAt: string | null
  approvedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface CreateChangeRequest {
  systemId: number
  title: string
  content?: string
  requesterDept?: string
  requesterName?: string
  targetDate?: string
  attachmentLink?: string
}

export const uploadAttachment = (id: number, file: File) =>
  client.post<ChangeRequest>(
    `/change-requests/${id}/attachment?filename=${encodeURIComponent(file.name)}`,
    file,
    { headers: { 'Content-Type': 'application/octet-stream' } }
  ).then((r) => r.data)

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

export const changeRequestStatus = (id: number, status: RequestStatus, rejectionReason?: string) =>
  client.patch<ChangeRequest>(`/change-requests/${id}/status`, { status, rejectionReason }).then((r) => r.data)

export const deleteChangeRequest = (id: number) =>
  client.delete(`/change-requests/${id}`)
