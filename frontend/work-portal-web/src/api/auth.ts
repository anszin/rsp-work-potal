import client from './client'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  token: string
  username: string
  role: string
}

export interface MeResponse {
  username: string
  email: string
  role: string
}

export const login = (data: LoginRequest) =>
  client.post<LoginResponse>('/auth/login', data).then((r) => r.data)

export const getMe = () =>
  client.get<MeResponse>('/auth/me').then((r) => r.data)
