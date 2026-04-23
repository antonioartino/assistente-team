// supabase/functions/send-reminders/index.ts
// Questa funzione viene eseguita ogni 5 minuti dal cron di Supabase
// e invia email/push per gli eventi in scadenza

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const FROM_EMAIL = Deno.env.get('FROM_EMAIL') || 'assistente@tuazienda.com'

serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const now = new Date()
  const windowEnd = new Date(now.getTime() + 5 * 60 * 1000) // prossimi 5 min

  // Cerca appuntamenti con reminder da inviare
  const { data: appts } = await supabase
    .from('appuntamenti')
    .select('*, profiles(nome, email)')
    .gte('reminder_at', now.toISOString())
    .lte('reminder_at', windowEnd.toISOString())
    .eq('reminder_inviato', false)

  // Cerca todos con reminder da inviare
  const { data: todos } = await supabase
    .from('todos')
    .select('*, profiles(nome, email)')
    .gte('reminder_at', now.toISOString())
    .lte('reminder_at', windowEnd.toISOString())
    .eq('reminder_inviato', false)

  const results = []

  // Invia promemoria appuntamenti
  for (const appt of appts || []) {
    const userEmail = appt.profiles?.email
    const userName = appt.profiles?.nome || 'Utente'

    if (userEmail) {
      // Invia email via Resend
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: userEmail,
          subject: `🔔 Promemoria: ${appt.titolo}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #00e5ff;">🔔 Promemoria appuntamento</h2>
              <h3>${appt.titolo}</h3>
              <p>📅 Data: <strong>${appt.data}</strong></p>
              ${appt.ora ? `<p>🕐 Ora: <strong>${appt.ora}</strong></p>` : ''}
              ${appt.luogo ? `<p>📍 Luogo: <strong>${appt.luogo}</strong></p>` : ''}
              ${appt.note ? `<p>📝 Note: ${appt.note}</p>` : ''}
              <hr />
              <p style="color: #666; font-size: 0.8em;">Inviato dal tuo Assistente Team</p>
            </div>
          `
        })
      })
    }

    // Invia push notification
    await sendPushToUser(supabase, appt.user_id, {
      title: `🔔 ${appt.titolo}`,
      body: `Tra poco: ${appt.ora || ''} ${appt.luogo ? '— ' + appt.luogo : ''}`
    })

    // Marca come inviato
    await supabase.from('appuntamenti').update({ reminder_inviato: true }).eq('id', appt.id)
    results.push({ type: 'appuntamento', id: appt.id, sent: true })
  }

  // Invia promemoria todos
  for (const todo of todos || []) {
    const userEmail = todo.profiles?.email

    if (userEmail) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: userEmail,
          subject: `⏰ Scadenza: ${todo.titolo}`,
          html: `
            <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
              <h2 style="color: #00e5ff;">⏰ Promemoria to-do</h2>
              <h3>${todo.titolo}</h3>
              <p>Priorità: <strong>${todo.priorita}</strong></p>
              ${todo.scadenza_data ? `<p>📅 Scadenza: <strong>${todo.scadenza_data}${todo.scadenza_ora ? ' ' + todo.scadenza_ora : ''}</strong></p>` : ''}
              ${todo.note ? `<p>📝 Note: ${todo.note}</p>` : ''}
              <hr />
              <p style="color: #666; font-size: 0.8em;">Inviato dal tuo Assistente Team</p>
            </div>
          `
        })
      })
    }

    await sendPushToUser(supabase, todo.user_id, {
      title: `⏰ ${todo.titolo}`,
      body: `Scadenza: ${todo.scadenza_data || ''} ${todo.scadenza_ora || ''}`
    })

    await supabase.from('todos').update({ reminder_inviato: true }).eq('id', todo.id)
    results.push({ type: 'todo', id: todo.id, sent: true })
  }

  return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
    headers: { 'Content-Type': 'application/json' }
  })
})

async function sendPushToUser(supabase: any, userId: string, notification: { title: string, body: string }) {
  const { data: sub } = await supabase
    .from('push_subscriptions')
    .select('subscription')
    .eq('user_id', userId)
    .single()

  if (!sub) return

  // Usa web-push per inviare la notifica
  // In produzione usa la libreria web-push di Deno
  const subscription = JSON.parse(sub.subscription)
  console.log('Push notification to:', userId, notification.title)
  // Implementazione completa con web-push va aggiunta con la libreria npm:web-push
}
