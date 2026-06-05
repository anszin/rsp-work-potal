import client from './client'

export type UserRole = 'ADMIN' | 'MANAGER' | 'MEMBER' | 'EXTERNAL'

export interface UserSummary {
  id: number
  username: string
  name: string | null
  dept: string | null
  email: string | null
  role: UserRole
  active: boolean
  mustChangePassword: boolean
  tempPassword: string | null
  createdAt: string
}

export interface CreateUserRequest {
  username: string
  name?: string
  dept?: string
  email?: string
  role: UserRole
}

export interface UpdateUserRequest {
  name?: string
  dept?: string
  email?: string
  role?: UserRole
  active?: boolean
}

export const getUsers = () =>
  client.get<UserSummary[]>('/users').then((r) => r.data)

export const createUser = (data: CreateUserRequest) =>
  client.post<UserSummary>('/users', data).then((r) => r.data)

export const updateUser = (id: number, data: UpdateUserRequest) =>
  client.put<UserSummary>(`/users/${id}`, data).then((r) => r.data)

export const deleteUser = (id: number) =>
  client.delete(`/users/${id}`)

export interface MenuPermission {
  role: string
  menuKey: string
  enabled: boolean
}

export const getMenuPermissions = () =>
  client.get<MenuPermission[]>('/menu-permissions').then((r) => r.data)

export const updateMenuPermissions = (data: MenuPermission[]) =>
  client.put('/menu-permissions', data)
