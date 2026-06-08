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

export const fetchRedmineIssues = (systemId: number, q: string, status = 'open', offset = 0) =>
  client.get<RedmineIssueListResult>('/redmine/issues', { params: { systemId, q, status, offset } }).then(r => r.data)
