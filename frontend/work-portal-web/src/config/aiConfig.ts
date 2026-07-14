export const aiConfig = {
  enabled: import.meta.env.VITE_AI_ENABLED === 'true',
  // 로컬: Vite 프록시(/api/chat → 192.168.0.28:8080) 사용, 직접 호출 불필요
  apiUrl: '',
}
