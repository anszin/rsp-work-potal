import client from './client'

export type TodoStatus = 'TODO' | 'IN_PROGRESS' | 'HOLD' | 'REVIEW' | 'DONE'
export type TodoPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type TodoSourceType = 'SELF' | 'CHANGE_REQUEST' | 'DEPLOY' | 'EXTERNAL'

export interface CheckItem {
  text: string
  done: boolean
}

export interface TodoLink {
  label: string
  url: string
}

export interface Todo {
  id: number
  title: string
  description: string | null
  status: TodoStatus
  priority: TodoPriority | null
  startDate: string | null
  dueDate: string | null
  completedDate: string | null
  sourceType: TodoSourceType | null
  sourceId: number | null
  workUnitId: number | null
  assignee: string
  createdAt: string
  updatedAt: string | null
  checkItems: CheckItem[]
  links: TodoLink[]
  imageUrl: string | null
  collaborators: string[]
}

export interface SaveTodoRequest {
  title: string
  description?: string
  status?: TodoStatus
  priority?: TodoPriority
  startDate?: string
  dueDate?: string
  completedDate?: string
  sourceType?: TodoSourceType
  sourceId?: number
  workUnitId?: number
  assignee?: string
  checkItems?: CheckItem[]
  links?: TodoLink[]
  imageUrl?: string
  collaborators?: string[]
}

export const todoApi = {
  list: () => client.get<Todo[]>('/todos').then(r => r.data),
  create: (data: SaveTodoRequest) => client.post<Todo>('/todos', data).then(r => r.data),
  update: (id: number, data: SaveTodoRequest) => client.put<Todo>(`/todos/${id}`, data).then(r => r.data),
  delete: (id: number) => client.delete(`/todos/${id}`),
}
