import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
})

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

client.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token')
      // 전체 리로드 없이 로그인 페이지로 이동 (AuthContext가 token null로 리렌더링)
      const event = new CustomEvent('auth:unauthorized')
      window.dispatchEvent(event)
    }
    // 세션 중 관리자가 비밀번호를 초기화하면 서버가 403 + code 로 알림 → 변경 화면으로 (F-AUTH-001 R-010)
    // 전체 리로드로 refreshMe 가 다시 돌아 PrivateRoute 가드가 유지된다
    if (error.response?.status === 403
        && error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED'
        && window.location.pathname !== '/change-password') {
      window.location.assign('/change-password')
    }
    return Promise.reject(error)
  }
)

export default client
