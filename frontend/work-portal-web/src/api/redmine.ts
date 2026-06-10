import client from './client'

export interface RedmineIssue {
  id: number
  subject: string
  status: string | null
  assignedTo: string | null
}

export interface RedmineIssueListResult {
  issues: RedmineIssue[]
  totalCount: number
}

export interface RedmineStatusConfig {
  id: number
  name: string
}

export interface RedmineTrackerConfig {
  id: number
  name: string
  statuses: RedmineStatusConfig[]
}

export const fetchRedmineTrackers = () =>
  client.get<RedmineTrackerConfig[]>('/redmine/trackers').then(r => r.data)

export const fetchRedmineIssues = (systemId: number, q: string, status = 'open', trackerId?: number, offset = 0) =>
  client.get<RedmineIssueListResult>('/redmine/issues', {
    params: { systemId, q, status, ...(trackerId ? { trackerId } : {}), offset },
  }).then(r => r.data)
