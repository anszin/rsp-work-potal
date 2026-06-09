import client from './client'

export interface System {
  id: number
  code: string
  name: string
  description: string
  redmineProjectKey: string | null
  webexRoomId: string | null
  sortOrder: number
  active: boolean
  createdAt: string
}

export interface CreateSystemRequest {
  code: string
  name: string
  description?: string
  redmineProjectKey?: string
  webexRoomId?: string
  sortOrder?: number
}

export interface UpdateSystemRequest {
  name: string
  description?: string
  active?: boolean
  redmineProjectKey?: string
  webexRoomId?: string
  sortOrder?: number
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

export interface SubSystem {
  id: number
  systemId: number
  code: string
  name: string
  description: string
  active: boolean
  createdAt: string
}

export interface CreateSubSystemRequest {
  code: string
  name: string
  description?: string
}

export interface UpdateSubSystemRequest {
  name: string
  description?: string
  active?: boolean
}

export const getSubSystems = (systemId: number) =>
  client.get<SubSystem[]>(`/systems/${systemId}/subsystems`).then((r) => r.data)

export const getActiveSubSystems = (systemId: number) =>
  client.get<SubSystem[]>(`/systems/${systemId}/subsystems/active`).then((r) => r.data)

export const createSubSystem = (systemId: number, data: CreateSubSystemRequest) =>
  client.post<SubSystem>(`/systems/${systemId}/subsystems`, data).then((r) => r.data)

export const updateSubSystem = (systemId: number, subId: number, data: UpdateSubSystemRequest) =>
  client.put<SubSystem>(`/systems/${systemId}/subsystems/${subId}`, data).then((r) => r.data)

export const deleteSubSystem = (systemId: number, subId: number) =>
  client.delete(`/systems/${systemId}/subsystems/${subId}`)

export interface UserSummary {
  id: number
  username: string
  role: string
}

export const getUsers = () =>
  client.get<UserSummary[]>('/users').then((r) => r.data)
