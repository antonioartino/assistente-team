import { supabase } from './supabase.js'
import { calcReminderTime } from './assistant.js'

// ─── APPUNTAMENTI ────────────────────────────────────────────────────────────

export async function createAppointment(userId, dati) {
  const reminderAt = dati.promemoria_minuti
    ? calcReminderTime(dati.data, dati.ora, dati.promemoria_minuti).toISOString()
    : null

  const { data, error } = await supabase
    .from('appuntamenti')
    .insert({
      user_id: userId,
      titolo: dati.titolo,
      data: dati.data,
      ora: dati.ora || null,
      durata_minuti: dati.durata_minuti || 60,
      luogo: dati.luogo || null,
      partecipanti: dati.partecipanti || [],
      visibilita: dati.visibilita || 'privato',
      promemoria_minuti: dati.promemoria_minuti || null,
      reminder_at: reminderAt,
      reminder_inviato: false,
      note: dati.note || null
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateAppointment(userId, id, updates) {
  // Ricalcola reminder_at se cambiano data/ora/promemoria
  if (updates.data || updates.ora || updates.promemoria_minuti !== undefined) {
    const { data: existing } = await supabase
      .from('appuntamenti').select('*').eq('id', id).eq('user_id', userId).single()
    if (existing) {
      const newData = updates.data || existing.data
      const newOra = updates.ora || existing.ora
      const newMin = updates.promemoria_minuti ?? existing.promemoria_minuti
      if (newMin) {
        updates.reminder_at = calcReminderTime(newData, newOra, newMin).toISOString()
        updates.reminder_inviato = false
      }
    }
  }

  const { data, error } = await supabase
    .from('appuntamenti')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw error
  return data
}

export async function deleteAppointment(userId, id) {
  const { error } = await supabase
    .from('appuntamenti')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getAppointments(userId) {
  const { data, error } = await supabase
    .from('appuntamenti')
    .select('*')
    .or(`user_id.eq.${userId},visibilita.eq.team`)
    .order('data', { ascending: true })
    .order('ora', { ascending: true })
  if (error) throw error
  return data || []
}

// ─── TO-DO ───────────────────────────────────────────────────────────────────

export async function createTodo(userId, dati) {
  const reminderAt = dati.promemoria_minuti && dati.scadenza_data
    ? calcReminderTime(dati.scadenza_data, dati.scadenza_ora, dati.promemoria_minuti).toISOString()
    : null

  const { data, error } = await supabase
    .from('todos')
    .insert({
      user_id: userId,
      titolo: dati.titolo,
      scadenza_data: dati.scadenza_data || null,
      scadenza_ora: dati.scadenza_ora || null,
      priorita: dati.priorita || 'media',
      visibilita: dati.visibilita || 'privato',
      promemoria_minuti: dati.promemoria_minuti || null,
      reminder_at: reminderAt,
      reminder_inviato: false,
      completato: false,
      note: dati.note || null
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateTodo(userId, id, updates) {
  const { data, error } = await supabase
    .from('todos')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteTodo(userId, id) {
  const { error } = await supabase
    .from('todos')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (error) throw error
}

export async function getTodos(userId) {
  const { data, error } = await supabase
    .from('todos')
    .select('*')
    .or(`user_id.eq.${userId},visibilita.eq.team`)
    .eq('completato', false)
    .order('scadenza_data', { ascending: true, nullsFirst: false })
  if (error) throw error
  return data || []
}

export async function toggleTodoComplete(userId, id, completato) {
  return updateTodo(userId, id, { completato, completato_at: completato ? new Date().toISOString() : null })
}

// ─── PUSH SUBSCRIPTIONS ──────────────────────────────────────────────────────

export async function savePushSubscription(userId, subscription) {
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      user_id: userId,
      subscription: JSON.stringify(subscription),
      updated_at: new Date().toISOString()
    }, { onConflict: 'user_id' })
  if (error) throw error
}
