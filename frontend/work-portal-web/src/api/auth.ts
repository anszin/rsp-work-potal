import client from './client'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  username: string
  role: string
  mustChangePassword: boolean
}

export interface MeResponse {
  username: string
  name: string
  dept: string
  email: string
  role: string
  mustChangePassword: boolean
}

export const login = (data: LoginRequest) =>
  client.post<LoginResponse>('/auth/login', data).then((r) => r.data)

export const getMe = () =>
  client.get<MeResponse>('/auth/me').then((r) => r.data)

export const changePassword = (currentPassword: string, newPassword: string) =>
  client.post('/users/change-password', { currentPassword, newPassword })
