import { useState, useEffect } from 'react'
import { supabase, getUserProfile } from './lib/supabase.js'
import AuthPage from './pages/AuthPage.jsx'
import AssistantPage from './pages/AssistantPage.jsx'
import './styles.css'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Controlla sessione esistente
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setLoading(false)
      }
    })

    // Ascolta cambi auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        loadProfile(session.user.id)
      } else {
        setUser(null)
        setProfile(null)
        setLoading(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    const p = await getUserProfile(userId)
    setProfile(p)
    setLoading(false)
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'pulse 1s infinite' }}>🎙️</div>
          <p style={{ color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace', fontSize: '0.8rem' }}>Caricamento...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage onAuth={setUser} />
  }

  return <AssistantPage user={user} profile={profile} onSignOut={handleSignOut} />
}
