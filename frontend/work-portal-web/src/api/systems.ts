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

export const getSystems = () =>
  client.get<System[]>('/systems').then((r) => r.data)

export const getActiveSystems = () =>
  client.get<System[]>('/systems/active').then((r) => r.data)

export const createSystem = (data: CreateSystemRequest) =>
  client.post<System>('/systems', data).then((r) => r.data)

export const updateSystem = (id: number, data: UpdateSystemRequest) =>
  client.put<System>(`/systems/${id}`, data).then((r) => r.data)

export const deleteSystem = (id: number) =>
  client.delete(`/systems/${id}`)
