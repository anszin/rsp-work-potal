import { aiConfig } from '../../config/aiConfig'
import { useAuth } from '../../context/useAuth'

export default function AiGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!aiConfig.enabled) return null
  if (user?.role === 'EXTERNAL') return null
  return <>{children}</>
}
