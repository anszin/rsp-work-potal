import client from './client'

export type RequestStatus = 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED'
export type DeployType = 'RELEASE' | 'HOTFIX' | 'ROLLBACK' | 'PATCH'

export interface RedmineIssueRef {
  redmineIssueId: number
  redmineIssueTitle: string | null
}

export interface DeployRequest {
  id: number
  systemId: number
  systemCode: string
  systemName: string
  subSystemId: number | null
  subSystemName: string | null
  redmineIssues: RedmineIssueRef[]
  title: string
  version: string | null
  deployType: DeployType | null
  content: string | null
  requesterUsername: string
  approverUsername: string | null
  status: RequestStatus
  scheduledAt: string | null
  requestedAt: string | null
  approvedAt: string | null
  deployedAt: string | null
  createdAt: string
}

export interface CreateDeployRequest {
  systemId: number
  subSystemId?: number | null
  title: string
  version?: string
  deployType?: DeployType
  content?: string
  scheduledAt?: string
  redmineIssues?: RedmineIssueRef[]
}

export const getDeployRequests = (params?: { systemId?: number }) =>
  client.get<DeployRequest[]>('/deploy-requests', { params }).then((r) => r.data)

export const getDeployRequest = (id: number) =>
  client.get<DeployRequest>(`/deploy-requests/${id}`).then((r) => r.data)

export const createDeployRequest = (data: CreateDeployRequest) =>
  client.post<DeployRequest>('/deploy-requests', data).then((r) => r.data)

export const updateDeployRequest = (id: number, data: CreateDeployRequest) =>
  client.put<DeployRequest>(`/deploy-requests/${id}`, data).then((r) => r.data)

export const deployRequestStatus = (id: number, status: RequestStatus) =>
  client.patch<DeployRequest>(`/deploy-requests/${id}/status`, { status }).then((r) => r.data)

export const deleteDeployRequest = (id: number) =>
  client.delete(`/deploy-requests/${id}`)
