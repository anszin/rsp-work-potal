import client from './client'

export interface KeyTask {
  id: number
  year: number
  taskLevel: string | null
  teamName: string | null
  assigneeName: string | null
  kpi: string | null
  taskName: string
  q1Plan: string | null; q2Plan: string | null; q3Plan: string | null; q4Plan: string | null
  q1Result: string | null; q2Result: string | null; q3Result: string | null; q4Result: string | null
  q1Achievement: string | null; q2Achievement: string | null; q3Achievement: string | null; q4Achievement: string | null
  q1Reason: string | null; q2Reason: string | null; q3Reason: string | null; q4Reason: string | null
  sortOrder: number | null
  createdAt: string
  updatedAt: string | null
}

export interface SaveKeyTaskRequest {
  year: number
  taskLevel?: string
  teamName?: string
  assigneeName?: string
  kpi?: string
  taskName: string
  q1Plan?: string; q2Plan?: string; q3Plan?: string; q4Plan?: string
  q1Result?: string; q2Result?: string; q3Result?: string; q4Result?: string
  q1Achievement?: string; q2Achievement?: string; q3Achievement?: string; q4Achievement?: string
  q1Reason?: string; q2Reason?: string; q3Reason?: string; q4Reason?: string
  sortOrder?: number
}

export const getKeyTasks = (year: number) =>
  client.get<KeyTask[]>('/key-tasks', { params: { year } }).then(r => r.data)

export const getKeyTaskYears = () =>
  client.get<number[]>('/key-tasks/years').then(r => r.data)

export const createKeyTask = (data: SaveKeyTaskRequest) =>
  client.post<KeyTask>('/key-tasks', data).then(r => r.data)

export const updateKeyTask = (id: number, data: SaveKeyTaskRequest) =>
  client.put<KeyTask>(`/key-tasks/${id}`, data).then(r => r.data)

export const deleteKeyTask = (id: number) =>
  client.delete(`/key-tasks/${id}`)
