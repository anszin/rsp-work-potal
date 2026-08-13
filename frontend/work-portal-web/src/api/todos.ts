import client from './client'

export type TodoStatus = 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE'
export type TodoPriority = 'HIGH' | 'MEDIUM' | 'LOW'
export type TodoSourceType = 'SELF' | 'CHANGE_REQUEST' | 'DEPLOY' | 'EXTERNAL'

export interface Todo {
  id: number
  title: string
  description: string | null
  status: TodoStatus
  priority: TodoPriority | null
  dueDate: string | null
  sourceType: TodoSourceType | null
  sourceId: number | null
  keyTaskId: number | null
  assignee: string
  createdAt: string
  updatedAt: string | null
}

export interface SaveTodoRequest {
  title: string
  description?: string
  status?: TodoStatus
  priority?: TodoPriority
  dueDate?: string
  sourceType?: TodoSourceType
  sourceId?: number
  keyTaskId?: number
}

export const todoApi = {
  list: () => client.get<Todo[]>('/todos').then(r => r.data),
  create: (data: SaveTodoRequest) => client.post<Todo>('/todos', data).then(r => r.data),
  update: (id: number, data: SaveTodoRequest) => client.put<Todo>(`/todos/${id}`, data).then(r => r.data),
  delete: (id: number) => client.delete(`/todos/${id}`),
}
