import client from './client'

export interface RedmineIssue {
  id: number
  subject: string
  status: string | null
  assignedTo: string | null
}

export const searchRedmineIssues = (systemId: number, q: string, status = 'open') =>
  client.get<RedmineIssue[]>('/redmine/issues', { params: { systemId, q, status } }).then((r) => r.data)
