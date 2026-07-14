import { aiConfig } from '../../config/aiConfig'

export default function AiGate({ children }: { children: React.ReactNode }) {
  if (!aiConfig.enabled) return null
  return <>{children}</>
}
