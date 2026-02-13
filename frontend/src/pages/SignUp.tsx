import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

// Using inline styles only to rule out Tailwind/component issues
const s = {
  page: {
    minHeight: '100vh',
    background: '#000',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  } as const,
  card: {
    width: '100%',
    maxWidth: 400,
    background: '#18181b',
    border: '1px solid #3f3f46',
    borderRadius: 16,
    padding: 24,
  } as const,
  title: { fontSize: 24, fontWeight: 600, color: '#fff', margin: '0 0 8px 0' } as const,
  desc: { fontSize: 14, color: '#a1a1aa', margin: '0 0 20px 0' } as const,
  label: { display: 'block', fontSize: 14, fontWeight: 500, color: '#d4d4d8', marginBottom: 8 } as const,
  input: {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    background: '#27272a',
    border: '1px solid #52525b',
    borderRadius: 8,
    color: '#fff',
    boxSizing: 'border-box' as const,
  } as const,
  row: { marginBottom: 16 } as const,
  btn: {
    width: '100%',
    padding: '12px 16px',
    fontSize: 14,
    fontWeight: 500,
    background: '#fff',
    color: '#000',
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
  } as const,
  link: { color: '#fff', textDecoration: 'underline' } as const,
  footer: { marginTop: 20, textAlign: 'center' as const, fontSize: 14, color: '#a1a1aa' } as const,
}

export function SignUp() {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { signup } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await signup(email, firstName, lastName, password)
      navigate('/user-dashboard')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { detail?: string | { msg?: string }[] } }; message?: string }
      const detail = e.response?.data?.detail
      const msg = typeof detail === 'string' ? detail : Array.isArray(detail) ? detail[0]?.msg : undefined
      setError(msg || e.message || 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <h1 style={s.title}>Create an account</h1>
        <p style={s.desc}>Get started with MemberCore</p>
        <form onSubmit={handleSubmit}>
          {error && (
            <div style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', padding: 12, borderRadius: 8, marginBottom: 16 }}>
              {error}
            </div>
          )}
          <div style={s.row}>
            <label htmlFor="firstName" style={s.label}>First Name</label>
            <input id="firstName" type="text" placeholder="First name" style={s.input} value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div style={s.row}>
            <label htmlFor="lastName" style={s.label}>Last Name</label>
            <input id="lastName" type="text" placeholder="Last name" style={s.input} value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
          <div style={s.row}>
            <label htmlFor="email" style={s.label}>Email</label>
            <input id="email" type="email" placeholder="you@example.com" style={s.input} value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div style={s.row}>
            <label htmlFor="password" style={s.label}>Password</label>
            <input id="password" type="password" placeholder="Min 8 characters" style={s.input} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          <button type="submit" disabled={loading} style={s.btn}>{loading ? 'Loading...' : 'Sign up'}</button>
        </form>
        <p style={s.footer}>
          Already have an account? <Link to="/signin" style={s.link}>Sign in</Link>
        </p>
      </div>
    </div>
  )
}
