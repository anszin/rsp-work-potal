import { createContext, useState, useEffect, ReactNode } from 'react'
import { getMe, login as loginApi, LoginRequest } from '../api/auth'

interface AuthUser {
  username: string
  email: string
  role: string
}

interface AuthContextType {
  token: string | null
  user: AuthUser | null
  login: (data: LoginRequest) => Promise<void>
  logout: () => void
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<AuthUser | null>(null)

  // axios interceptor의 401 이벤트 수신 → 토큰 초기화
  useEffect(() => {
    const handle = () => {
      setToken(null)
      setUser(null)
    }
    window.addEventListener('auth:unauthorized', handle)
    return () => window.removeEventListener('auth:unauthorized', handle)
  }, [])

  // 토큰이 있으면 사용자 정보 로드
  useEffect(() => {
    if (token) {
      getMe()
        .then(setUser)
        .catch(() => {
          localStorage.removeItem('token')
          setToken(null)
        })
    }
  }, [token])

  const login = async (data: LoginRequest) => {
    const res = await loginApi(data)
    localStorage.setItem('token', res.token)
    setToken(res.token)
    setUser({ username: res.username, email: '', role: res.role })
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ token, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
