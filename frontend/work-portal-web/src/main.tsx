import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster, TooltipProvider } from '@lotte/rsp-react-design-system/shadcn'
import App from './App.tsx'
// Pretendard 웹폰트 (npm 패키지로 자체 제공 — 외부 CDN 차단 시에도 동일 폰트 표시)
// 가변 폰트(모든 굵기 1벌) + dynamic subset(화면에 쓰인 글자 범위 조각만 다운로드) — CSS 용량 최소화
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
// CSS 순서 중요: RSP 디자인시스템 SDK → 포탈 스타일(토큰 매핑·보정)
import '@lotte/rsp-react-design-system/styles.css'
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
