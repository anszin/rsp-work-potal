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
    return Promise.reject(error)
  }
)

export default client
