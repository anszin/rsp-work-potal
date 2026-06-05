import { useState, FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'

export default function LoginPage() {
  const { login, token } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  if (token) return <Navigate to="/" replace />

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { mustChangePassword } = await login({ username, password })
      if (mustChangePassword) navigate('/change-password', { replace: true })
    } catch {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>플랫폼팀 업무 포탈</h1>
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>아이디</label>
            <input style={styles.input} type="text" value={username}
              onChange={(e) => setUsername(e.target.value)} placeholder="아이디 입력" required autoFocus />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>비밀번호</label>
            <input style={styles.input} type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="비밀번호 입력" required />
          </div>
          {error && <p style={styles.error}>{error}</p>}
          <button style={styles.button} type="submit" disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#f0f2f5' },
  card: { background: '#fff', borderRadius: 8, padding: '40px 48px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', width: 360 },
  title: { textAlign: 'center', marginBottom: 32, fontSize: 20, fontWeight: 600, color: '#1a1a2e' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 500, color: '#555' },
  input: { padding: '10px 12px', border: '1px solid #ddd', borderRadius: 6, fontSize: 14, outline: 'none' },
  error: { color: '#e53e3e', fontSize: 13, margin: 0 },
  button: { padding: '12px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
}
