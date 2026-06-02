import client from './client'

export interface System {
  id: number
  code: string
  name: string
  description: string
  active: boolean
  createdAt: string
}

export interface CreateSystemRequest {
  code: string
  name: string
  description?: string
}

export interface UpdateSystemRequest {
  name: string
  description?: string
  active?: boolean
}

export interface SystemManager {
  id: number
  userId: number
  username: string
  assignedAt: string
}

export const getSystems = () =>
  client.get<System[]>('/systems').then((r) => r.data)

export const getActiveSystems = () =>
  client.get<System[]>('/systems/active').then((r) => r.data)

export const getManagedSystemIds = () =>
  client.get<number[]>('/systems/managed').then((r) => r.data)

export const createSystem = (data: CreateSystemRequest) =>
  client.post<System>('/systems', data).then((r) => r.data)

export const updateSystem = (id: number, data: UpdateSystemRequest) =>
  client.put<System>(`/systems/${id}`, data).then((r) => r.data)

export const deleteSystem = (id: number) =>
  client.delete(`/systems/${id}`)

export const getSystemManagers = (systemId: number) =>
  client.get<SystemManager[]>(`/systems/${systemId}/managers`).then((r) => r.data)

export const addSystemManager = (systemId: number, userId: number) =>
  client.post<SystemManager>(`/systems/${systemId}/managers`, { userId }).then((r) => r.data)

export const removeSystemManager = (systemId: number, userId: number) =>
  client.delete(`/systems/${systemId}/managers/${userId}`)

export interface UserSummary {
  id: number
  username: string
  role: string
}

export const getUsers = () =>
  client.get<UserSummary[]>('/users').then((r) => r.data)
