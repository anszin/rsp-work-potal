import { createContext, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

export const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'light',
  toggle: () => {},
})

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() =>
    (localStorage.getItem('theme') as Theme) ?? 'light'
  )

  useEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', theme)
    // RSP 디자인시스템 SDK 다크모드: rsp 토큰은 data-rsp-theme, shadcn 토큰은 .dark 클래스 기준
    root.setAttribute('data-rsp-theme', theme)
    root.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme(t => (t === 'light' ? 'dark' : 'light'))

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}
