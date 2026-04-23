import { useState, useEffect, useRef, useCallback } from 'react'
import { AssistantConversation } from '../lib/assistant.js'
import { useVoiceRecognition, speak } from '../hooks/useVoice.js'
import {
  createAppointment, updateAppointment, deleteAppointment, getAppointments,
  createTodo, updateTodo, deleteTodo, getTodos, toggleTodoComplete, savePushSubscription
} from '../lib/db.js'
import { registerPushNotifications, showLocalNotification } from '../lib/notifications.js'
import { format, parseISO, isToday, isTomorrow } from 'date-fns'
import { it } from 'date-fns/locale'

const PRIORITY_COLOR = { alta: '#ff4444', media: '#f59e0b', bassa: '#10b981' }
const PRIORITY_LABEL = { alta: '🔴 Alta', media: '🟡 Media', bassa: '🟢 Bassa' }

export default function AssistantPage({ user, profile, onSignOut }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', text: `Ciao ${profile?.nome || ''}! 👋 Sono il tuo assistente. Premi il microfono e dimmi cosa devo fare.` }
  ])
  const [appointments, setAppointments] = useState([])
  const [todos, setTodos] = useState([])
  const [tab, setTab] = useState('chat') // 'chat' | 'agenda' | 'todo'
  const [isProcessing, setIsProcessing] = useState(false)
  const conversationRef = useRef(null)
  const messagesEndRef = useRef(null)
  const [inputText, setInputText] = useState('')

  // Init assistant
  useEffect(() => {
    loadData()
    initPush()
  }, [])

  useEffect(() => {
    if (!conversationRef.current || appointments.length || todos.length) {
      conversationRef.current = new AssistantConversation(profile, { appointments, todos })
    } else {
      conversationRef.current.existingItems = { appointments, todos }
    }
  }, [appointments, todos, profile])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function loadData() {
    try {
      const [appts, tdos] = await Promise.all([getAppointments(user.id), getTodos(user.id)])
      setAppointments(appts)
      setTodos(tdos)
    } catch (e) { console.error(e) }
  }

  async function initPush() {
    const sub = await registerPushNotifications()
    if (sub) await savePushSubscription(user.id, sub).catch(() => {})
  }

  async function handleUserMessage(text) {
    if (!text.trim() || isProcessing) return
    setInputText('')
    setMessages(prev => [...prev, { role: 'user', text }])
    setIsProcessing(true)

    try {
      const conv = conversationRef.current
      conv.existingItems = { appointments, todos }
      const { text: replyText, action } = await conv.sendMessage(text)

      // Esegui azione se presente
      let actionMsg = ''
      if (action) {
        actionMsg = await executeAction(action)
      }

      const finalText = replyText + (actionMsg ? '\n\n' + actionMsg : '')
      setMessages(prev => [...prev, { role: 'assistant', text: finalText }])
      speak(replyText)
    } catch (e) {
      const errMsg = 'Scusa, ho avuto un problema tecnico. Riprova.'
      setMessages(prev => [...prev, { role: 'assistant', text: errMsg }])
      speak(errMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  async function executeAction(action) {
    const { azione, dati } = action
    try {
      switch (azione) {
        case 'CREA_APPUNTAMENTO': {
          await createAppointment(user.id, dati)
          await loadData()
          showLocalNotification('✅ Appuntamento salvato', dati.titolo)
          return '✅ Appuntamento salvato!'
        }
        case 'CREA_TODO': {
          await createTodo(user.id, dati)
          await loadData()
          showLocalNotification('✅ To-do salvato', dati.titolo)
          return '✅ To-do aggiunto!'
        }
        case 'MODIFICA_APPUNTAMENTO': {
          const { id, ...updates } = dati
          // Gestisci campo singolo o oggetto completo
          const updateData = dati.campo ? { [dati.campo]: dati.nuovo_valore } : updates
          await updateAppointment(user.id, id, updateData)
          await loadData()
          return '✅ Appuntamento aggiornato!'
        }
        case 'MODIFICA_TODO': {
          const { id, ...updates } = dati
          const updateData = dati.campo ? { [dati.campo]: dati.nuovo_valore } : updates
          await updateTodo(user.id, id, updateData)
          await loadData()
          return '✅ To-do aggiornato!'
        }
        case 'ELIMINA_APPUNTAMENTO': {
          await deleteAppointment(user.id, dati.id)
          await loadData()
          return '🗑️ Appuntamento eliminato.'
        }
        case 'ELIMINA_TODO': {
          await deleteTodo(user.id, dati.id)
          await loadData()
          return '🗑️ To-do eliminato.'
        }
        default: return ''
      }
    } catch (e) {
      return `⚠️ Errore: ${e.message}`
    }
  }

  const { isListening, startListening, stopListening } = useVoiceRecognition({
    onResult: handleUserMessage,
    onError: (err) => setMessages(prev => [...prev, { role: 'assistant', text: `Errore microfono: ${err}` }])
  })

  function formatDate(dateStr) {
    if (!dateStr) return ''
    try {
      const d = parseISO(dateStr)
      if (isToday(d)) return 'Oggi'
      if (isTomorrow(d)) return 'Domani'
      return format(d, 'EEE d MMM', { locale: it })
    } catch { return dateStr }
  }

  const todayAppts = appointments.filter(a => {
    try { return isToday(parseISO(a.data)) } catch { return false }
  })

  return (
    <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', maxWidth: '480px', margin: '0 auto' }}>
      {/* Header */}
      <header style={{
        padding: '1rem 1.25rem', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid var(--border)',
        position: 'sticky', top: 0, background: 'var(--bg)', zIndex: 10
      }}>
        <div>
          <h1 style={{ fontFamily: 'Syne, sans-serif', fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', margin: 0 }}>
            🎙️ Assistente
          </h1>
          <p style={{ color: 'var(--muted)', fontSize: '0.7rem', margin: 0, fontFamily: 'JetBrains Mono, monospace' }}>
            {profile?.nome?.toUpperCase() || user.email}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {todayAppts.length > 0 && (
            <span style={{ background: 'var(--accent)', color: '#000', borderRadius: '999px',
              fontSize: '0.7rem', fontWeight: 700, padding: '0.2rem 0.5rem', fontFamily: 'JetBrains Mono, monospace' }}>
              {todayAppts.length} oggi
            </span>
          )}
          <button onClick={onSignOut}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
              color: 'var(--muted)', padding: '0.3rem 0.6rem', cursor: 'pointer', fontSize: '0.75rem' }}>
            Esci
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        {[
          { id: 'chat', label: '💬 Chat' },
          { id: 'agenda', label: `📅 Agenda${appointments.length ? ` (${appointments.length})` : ''}` },
          { id: 'todo', label: `✅ To-do${todos.length ? ` (${todos.length})` : ''}` }
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              flex: 1, padding: '0.75rem 0.5rem', background: 'none', border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.id ? 'var(--accent)' : 'var(--muted)',
              fontFamily: 'Syne, sans-serif', fontWeight: 600, fontSize: '0.75rem',
              cursor: 'pointer', transition: 'all 0.2s'
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '1rem' }}>
        {/* CHAT TAB */}
        {tab === 'chat' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{
                display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
              }}>
                <div style={{
                  maxWidth: '85%', padding: '0.75rem 1rem', borderRadius: msg.role === 'user'
                    ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--surface)',
                  color: msg.role === 'user' ? '#000' : 'var(--text)',
                  fontSize: '0.9rem', lineHeight: 1.5,
                  fontFamily: msg.role === 'user' ? 'Syne, sans-serif' : 'inherit',
                  fontWeight: msg.role === 'user' ? 600 : 400,
                  whiteSpace: 'pre-wrap'
                }}>
                  {msg.text}
                </div>
              </div>
            ))}
            {isProcessing && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{ background: 'var(--surface)', borderRadius: '16px 16px 16px 4px', padding: '0.75rem 1rem' }}>
                  <span style={{ animation: 'pulse 1s infinite', color: 'var(--muted)' }}>● ● ●</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* AGENDA TAB */}
        {tab === 'agenda' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {appointments.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📅</div>
                <p>Nessun appuntamento.<br />Dillo all'assistente per aggiungerne uno!</p>
              </div>
            ) : appointments.map(a => (
              <div key={a.id} className="card" style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                  <h3 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '1rem', color: 'var(--text)' }}>
                    {a.titolo}
                  </h3>
                  <span style={{
                    fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px',
                    background: a.visibilita === 'team' ? '#3b82f620' : '#ffffff10',
                    color: a.visibilita === 'team' ? '#60a5fa' : 'var(--muted)',
                    border: `1px solid ${a.visibilita === 'team' ? '#3b82f640' : 'var(--border)'}`,
                    fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap', marginLeft: '0.5rem'
                  }}>
                    {a.visibilita === 'team' ? '👥 team' : '🔒 privato'}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.8rem', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                  <span>📅 {formatDate(a.data)}</span>
                  {a.ora && <span>🕐 {a.ora.slice(0, 5)}</span>}
                  {a.durata_minuti && <span>⏱ {a.durata_minuti}min</span>}
                  {a.luogo && <span>📍 {a.luogo}</span>}
                </div>
                {a.partecipanti?.length > 0 && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--muted)' }}>
                    👥 {a.partecipanti.join(', ')}
                  </div>
                )}
                {a.note && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>
                    {a.note}
                  </div>
                )}
                {a.promemoria_minuti && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.7rem', color: 'var(--accent)', fontFamily: 'JetBrains Mono, monospace' }}>
                    🔔 Promemoria {a.promemoria_minuti < 60 ? `${a.promemoria_minuti}min` : `${a.promemoria_minuti / 60}h`} prima
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* TODO TAB */}
        {tab === 'todo' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {todos.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem 1rem' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
                <p>Nessun to-do.<br />Dillo all'assistente per aggiungerne uno!</p>
              </div>
            ) : todos.map(t => (
              <div key={t.id} className="card" style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <button onClick={() => toggleTodoComplete(user.id, t.id, true).then(loadData)}
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${PRIORITY_COLOR[t.priorita] || 'var(--border)'}`,
                    background: 'none', cursor: 'pointer', flexShrink: 0, marginTop: '2px'
                  }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    <h3 style={{ margin: 0, fontFamily: 'Syne, sans-serif', fontWeight: 700, fontSize: '0.95rem', color: 'var(--text)' }}>
                      {t.titolo}
                    </h3>
                    <span style={{
                      fontSize: '0.65rem', padding: '0.15rem 0.4rem', borderRadius: '4px',
                      background: a?.visibilita === 'team' ? '#3b82f620' : '#ffffff10',
                      color: t.visibilita === 'team' ? '#60a5fa' : 'var(--muted)',
                      border: `1px solid ${t.visibilita === 'team' ? '#3b82f640' : 'var(--border)'}`,
                      fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap'
                    }}>
                      {t.visibilita === 'team' ? '👥' : '🔒'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--muted)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {t.scadenza_data && <span>📅 {formatDate(t.scadenza_data)}{t.scadenza_ora ? ` ${t.scadenza_ora.slice(0, 5)}` : ''}</span>}
                    <span style={{ color: PRIORITY_COLOR[t.priorita] }}>{PRIORITY_LABEL[t.priorita]}</span>
                  </div>
                  {t.note && <div style={{ marginTop: '0.3rem', fontSize: '0.8rem', color: 'var(--muted)', fontStyle: 'italic' }}>{t.note}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom input area */}
      <div style={{
        padding: '1rem', borderTop: '1px solid var(--border)', background: 'var(--surface)',
        display: 'flex', gap: '0.75rem', alignItems: 'center',
        position: 'sticky', bottom: 0
      }}>
        <input
          className="input"
          style={{ flex: 1, margin: 0 }}
          placeholder="Scrivi un messaggio..."
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleUserMessage(inputText)}
        />
        <button
          onClick={isListening ? stopListening : startListening}
          style={{
            width: '52px', height: '52px', borderRadius: '50%', border: 'none',
            background: isListening ? '#ff4444' : 'var(--accent)',
            color: isListening ? '#fff' : '#000',
            fontSize: '1.4rem', cursor: 'pointer', flexShrink: 0,
            boxShadow: isListening ? '0 0 0 6px #ff444430' : '0 0 0 0 transparent',
            transition: 'all 0.3s', display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: isListening ? 'ripple 1s infinite' : 'none'
          }}>
          {isListening ? '⏹' : '🎤'}
        </button>
        {inputText && (
          <button onClick={() => handleUserMessage(inputText)}
            style={{
              width: '52px', height: '52px', borderRadius: '50%', border: 'none',
              background: 'var(--accent)', color: '#000', fontSize: '1.2rem',
              cursor: 'pointer', flexShrink: 0
            }}>
            ➤
          </button>
        )}
      </div>
    </div>
  )
}
