import client from './client'

export type RequestStatus = 'DRAFT' | 'REQUESTED' | 'APPROVED' | 'COMPLETED' | 'REJECTED'
export type DeployType = 'RELEASE' | 'HOTFIX' | 'ROLLBACK' | 'PATCH'
export type DeployScope = 'FULL' | 'PARTIAL'
export type RedmineSyncStatus = 'SYNCED' | 'FAILED' | 'SKIPPED'

export interface RedmineIssueRef {
  redmineIssueId: number
  redmineIssueTitle: string | null
}

export interface DeployRequest {
  id: number
  deployNo: string | null
  systemId: number
  systemCode: string
  systemName: string
  subSystemId: number | null
  subSystemName: string | null
  redmineIssues: RedmineIssueRef[]
  title: string
  version: string | null
  deployType: DeployType | null
  deployScope: DeployScope | null
  deployTarget: string | null
  content: string | null
  requesterUsername: string
  approverUsername: string | null
  status: RequestStatus
  rejectionReason: string | null
  actionComment: string | null
  scheduledAt: string | null
  requestedAt: string | null
  approvedAt: string | null
  deployedAt: string | null
  redmineSyncStatus: RedmineSyncStatus | null
  createdAt: string
}

export interface CreateDeployRequest {
  systemId: number
  subSystemId?: number | null
  title: string
  version?: string
  deployType?: DeployType
  deployScope?: DeployScope
  deployTarget?: string
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

export const deployRequestStatus = (id: number, status: RequestStatus, comment?: string) =>
  client.patch<DeployRequest>(`/deploy-requests/${id}/status`, { status, comment }).then((r) => r.data)

export const syncRedmine = (id: number) =>
  client.post<DeployRequest>(`/deploy-requests/${id}/sync-redmine`).then(r => r.data)

export const deleteDeployRequest = (id: number) =>
  client.delete(`/deploy-requests/${id}`)
