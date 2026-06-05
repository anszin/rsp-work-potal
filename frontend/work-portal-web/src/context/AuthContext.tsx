import { createContext, useState, useEffect, ReactNode } from 'react'
import { getMe, login as loginApi, LoginRequest } from '../api/auth'
import { getMenuPermissions } from '../api/users'

interface AuthUser {
  username: string
  name: string
  dept: string
  email: string
  role: string
  mustChangePassword: boolean
}

interface AuthContextType {
  token: string | null
  user: AuthUser | null
  menuPermissions: Record<string, boolean> // menuKey → enabled (for current user's role)
  login: (data: LoginRequest) => Promise<{ mustChangePassword: boolean }>
  logout: () => void
  refreshMe: () => Promise<void>
}

export const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'))
  const [user, setUser] = useState<AuthUser | null>(null)
  const [menuPermissions, setMenuPermissions] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const handle = () => { setToken(null); setUser(null); setMenuPermissions({}) }
    window.addEventListener('auth:unauthorized', handle)
    return () => window.removeEventListener('auth:unauthorized', handle)
  }, [])

  const loadMenuPerms = async (role: string) => {
    try {
      const all = await getMenuPermissions()
      const map: Record<string, boolean> = {}
      all.filter(p => p.role === role).forEach(p => { map[p.menuKey] = p.enabled })
      setMenuPermissions(map)
    } catch { setMenuPermissions({}) }
  }

  const refreshMe = async () => {
    const me = await getMe()
    setUser({ username: me.username, name: me.name, dept: me.dept, email: me.email, role: me.role, mustChangePassword: me.mustChangePassword })
    await loadMenuPerms(me.role)
  }

  useEffect(() => {
    if (token) {
      refreshMe().catch(() => { localStorage.removeItem('token'); setToken(null) })
    }
  }, [token])

  const login = async (data: LoginRequest) => {
    const res = await loginApi(data)
    localStorage.setItem('token', res.token)
    setToken(res.token)
    setUser({ username: res.username, name: '', dept: '', email: '', role: res.role, mustChangePassword: res.mustChangePassword })
    await loadMenuPerms(res.role)
    return { mustChangePassword: res.mustChangePassword }
  }

  const logout = () => {
    localStorage.removeItem('token')
    setToken(null)
    setUser(null)
    setMenuPermissions({})
  }

  return (
    <AuthContext.Provider value={{ token, user, menuPermissions, login, logout, refreshMe }}>
      {children}
    </AuthContext.Provider>
  )
}
