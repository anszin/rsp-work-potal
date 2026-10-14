import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, TooltipProvider } from 'rsp-react-design-system/shadcn'
import App from './App.tsx'
// CSS 순서 중요: RSP 디자인시스템 SDK → 포탈 스타일(토큰 매핑·보정)
import 'rsp-react-design-system/styles.css'
import './index.css'

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      {/* RSP 디자인시스템 SDK 전역: 툴팁 지연 공유, 토스트 표시 영역 */}
      <TooltipProvider delay={300}>
        <Toaster>
          <App />
        </Toaster>
      </TooltipProvider>
    </QueryClientProvider>
  </StrictMode>,
)
