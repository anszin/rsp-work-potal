import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { changePassword } from '../../api/auth'
import { useAuth } from '../../context/useAuth'

export default function ChangePasswordPage() {
  const { refreshMe } = useAuth()
  const navigate = useNavigate()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (next !== confirm) { setError('새 비밀번호가 일치하지 않습니다.'); return }
    if (next.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return }
    setError('')
    setLoading(true)
    try {
      await changePassword(current, next)
      await refreshMe()
      navigate('/', { replace: true })
    } catch {
      setError('현재 비밀번호가 올바르지 않습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.container}>
      <div style={s.card}>
        <h2 style={s.title}>비밀번호 변경</h2>
        <p style={s.desc}>최초 로그인 시 비밀번호를 변경해야 합니다.</p>
        <form onSubmit={handleSubmit} style={s.form}>
          <div style={s.field}>
            <label style={s.label}>현재 비밀번호 (임시)</label>
            <input style={s.input} type="password" value={current}
              onChange={e => setCurrent(e.target.value)} required autoFocus />
          </div>
          <div style={s.field}>
            <label style={s.label}>새 비밀번호</label>
            <input style={s.input} type="password" value={next}
              onChange={e => setNext(e.target.value)} placeholder="8자 이상" required />
          </div>
          <div style={s.field}>
            <label style={s.label}>새 비밀번호 확인</label>
            <input style={s.input} type="password" value={confirm}
              onChange={e => setConfirm(e.target.value)} required />
          </div>
          {error && <p style={s.error}>{error}</p>}
          <button style={s.button} type="submit" disabled={loading}>
            {loading ? '변경 중...' : '비밀번호 변경'}
          </button>
        </form>
      </div>
    </div>
  )
}

const s: Record<string, React.CSSProperties> = {
  container: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--c-bg)' },
  card: { background: 'var(--c-card)', borderRadius: 8, padding: '40px 48px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', width: 400 },
  title: { textAlign: 'center', marginBottom: 8, fontSize: 20, fontWeight: 600, color: 'var(--c-text)' },
  desc: { textAlign: 'center', marginBottom: 24, fontSize: 13, color: 'var(--c-text-muted)' },
  form: { display: 'flex', flexDirection: 'column', gap: 16 },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 14, fontWeight: 500, color: 'var(--c-text-sub)' },
  input: { padding: '10px 12px', border: '1px solid var(--c-border-in)', borderRadius: 6, fontSize: 14 },
  error: { color: '#e53e3e', fontSize: 13, margin: 0 },
  button: { padding: '12px', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 6, fontSize: 15, fontWeight: 500, cursor: 'pointer', marginTop: 8 },
}
