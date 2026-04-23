import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function AuthPage({ onAuth }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [nome, setNome] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  async function handleSubmit() {
    setError('')
    setInfo('')
    setLoading(true)
    try {
      if (mode === 'register') {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email, password,
          options: { data: { nome } }
        })
        if (signUpError) throw signUpError
        // Crea profilo
        if (data.user) {
          await supabase.from('profiles').upsert({ id: data.user.id, nome, email })
        }
        setInfo('Registrazione completata! Controlla la tua email per confermare l\'account.')
      } else {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
        onAuth(data.user)
      }
    } catch (e) {
      setError(e.message || 'Errore di autenticazione')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: '2rem'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
        <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>🎙️</div>
        <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '2rem', fontWeight: 800, color: 'var(--accent)', margin: 0 }}>
          Assistente
        </h1>
        <p style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem', marginTop: '0.3rem' }}>
          TEAM WORKSPACE
        </p>
      </div>

      <div className="card" style={{ width: '100%', maxWidth: '360px' }}>
        <div style={{ display: 'flex', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)' }}>
          {['login', 'register'].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(''); setInfo('') }}
              style={{
                flex: 1, padding: '0.75rem', background: 'none', border: 'none',
                color: mode === m ? 'var(--accent)' : 'var(--muted)',
                borderBottom: mode === m ? '2px solid var(--accent)' : '2px solid transparent',
                fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.85rem',
                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
                marginBottom: '-1px', transition: 'all 0.2s'
              }}>
              {m === 'login' ? 'Accedi' : 'Registrati'}
            </button>
          ))}
        </div>

        {mode === 'register' && (
          <div style={{ marginBottom: '1rem' }}>
            <label className="label">Nome</label>
            <input className="input" type="text" placeholder="Il tuo nome"
              value={nome} onChange={e => setNome(e.target.value)} />
          </div>
        )}

        <div style={{ marginBottom: '1rem' }}>
          <label className="label">Email</label>
          <input className="input" type="email" placeholder="email@esempio.com"
            value={email} onChange={e => setEmail(e.target.value)} />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label className="label">Password</label>
          <input className="input" type="password" placeholder="••••••••"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
        </div>

        {error && (
          <div style={{ background: '#ff444420', border: '1px solid #ff4444', borderRadius: '8px',
            padding: '0.75rem', marginBottom: '1rem', color: '#ff6666', fontSize: '0.85rem' }}>
            {error}
          </div>
        )}
        {info && (
          <div style={{ background: '#00ff8820', border: '1px solid #00ff88', borderRadius: '8px',
            padding: '0.75rem', marginBottom: '1rem', color: '#00ff88', fontSize: '0.85rem' }}>
            {info}
          </div>
        )}

        <button className="btn-primary" onClick={handleSubmit} disabled={loading}
          style={{ width: '100%', opacity: loading ? 0.6 : 1 }}>
          {loading ? '...' : mode === 'login' ? 'Accedi' : 'Crea account'}
        </button>
      </div>
    </div>
  )
}
