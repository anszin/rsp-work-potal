import client from './client'

export type RequestStatus = 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED'

export interface ChangeRequest {
  id: number
  systemId: number
  systemCode: string
  systemName: string
  title: string
  content: string
  requesterUsername: string
  status: RequestStatus
  requestedAt: string | null
  approvedAt: string | null
  completedAt: string | null
  createdAt: string
}

export interface CreateChangeRequest {
  systemId: number
  title: string
  content?: string
}

export const getChangeRequests = (params?: { systemId?: number; status?: RequestStatus }) =>
  client.get<ChangeRequest[]>('/change-requests', { params }).then((r) => r.data)

export const getChangeRequest = (id: number) =>
  client.get<ChangeRequest>(`/change-requests/${id}`).then((r) => r.data)

export const createChangeRequest = (data: CreateChangeRequest) =>
  client.post<ChangeRequest>('/change-requests', data).then((r) => r.data)

export const updateChangeRequest = (id: number, data: CreateChangeRequest) =>
  client.put<ChangeRequest>(`/change-requests/${id}`, data).then((r) => r.data)

export const changeRequestStatus = (id: number, status: RequestStatus) =>
  client.patch<ChangeRequest>(`/change-requests/${id}/status`, { status }).then((r) => r.data)

export const deleteChangeRequest = (id: number) =>
  client.delete(`/change-requests/${id}`)
