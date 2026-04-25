import { supabase } from './supabase.js'
import { format, addMinutes, addHours, addDays, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

const SYSTEM_PROMPT = `Sei un assistente vocale aziendale per la gestione di appuntamenti e to-do list. Parli sempre in italiano, in modo professionale ma cordiale.

Il tuo compito è:
1. Comprendere cosa vuole l'utente (creare/modificare/eliminare un appuntamento o un to-do)
2. Raccogliere TUTTE le informazioni necessarie in modo interattivo, facendo UNA domanda alla volta
3. Confermare prima di salvare
4. Rispondere in modo conciso (max 2-3 frasi) perché la risposta verrà letta ad alta voce

CAMPI APPUNTAMENTO:
- titolo (obbligatorio)
- data e ora (obbligatorio)
- durata in minuti (chiedi se non specificato, default 60)
- luogo o link videochiamata (facoltativo)
- partecipanti del team (facoltativo - nomi)
- visibilità: "privato" (solo io) o "team" (visibile a tutti) — CHIEDI SEMPRE
- promemoria: quanti minuti/ore prima inviare la notifica — CHIEDI SEMPRE
- note aggiuntive (facoltativo)

CAMPI TO-DO:
- titolo/descrizione (obbligatorio)
- scadenza (data + ora opzionale) — CHIEDI SEMPRE
- priorità: bassa / media / alta — CHIEDI SEMPRE
- visibilità: "privato" o "team" — CHIEDI SEMPRE
- promemoria prima della scadenza (facoltativo)
- note aggiuntive (facoltativo)

AZIONI POSSIBILI:
- CREA_APPUNTAMENTO: quando l'utente vuole aggiungere una riunione, meeting, appuntamento
- CREA_TODO: quando vuole aggiungere un compito, attività, cosa da fare, reminder
- MODIFICA_APPUNTAMENTO: quando vuole cambiare qualcosa di un appuntamento esistente
- MODIFICA_TODO: quando vuole cambiare qualcosa di un to-do esistente
- ELIMINA_APPUNTAMENTO: quando vuole cancellare un appuntamento
- ELIMINA_TODO: quando vuole cancellare un to-do
- ELENCA: quando vuole vedere i suoi appuntamenti o to-do
- CONVERSAZIONE: domande generali, saluti, ecc.

Quando hai TUTTE le informazioni necessarie, rispondi con un JSON speciale in questo formato esatto (su una sola riga, alla fine della risposta, preceduto da |||):
|||{"azione":"CREA_APPUNTAMENTO","dati":{...}}

Esempi di dati:
CREA_APPUNTAMENTO: {"titolo":"Riunione commerciale","data":"2024-03-15","ora":"14:30","durata_minuti":60,"luogo":"Sala riunioni A","partecipanti":["Marco","Sara"],"visibilita":"team","promemoria_minuti":30,"note":"Portare il report Q1"}
CREA_TODO: {"titolo":"Inviare offerta cliente Rossi","scadenza_data":"2024-03-16","scadenza_ora":"18:00","priorita":"alta","visibilita":"privato","promemoria_minuti":120,"note":"Usare il template standard"}
MODIFICA_APPUNTAMENTO: {"id":"xxx","campo":"ora","nuovo_valore":"15:00"}
ELIMINA_APPUNTAMENTO: {"id":"xxx"}

REGOLE:
- Fai UNA sola domanda alla volta
- Se l'utente dice "tra due ore" o "domani" interpretalo come data/ora relativa
- Se dice "ricordamelo 30 minuti prima" → promemoria_minuti: 30
- Se dice "ricordamelo un'ora prima" → promemoria_minuti: 60
- Quando elenca elementi, sii conciso
- Se l'azione non è chiara, chiedi chiarimenti
- NON inserire mai il JSON se mancano dati obbligatori`

export class AssistantConversation {
  constructor(userProfile, existingItems) {
    this.userProfile = userProfile
    this.existingItems = existingItems // {appointments: [], todos: []}
    this.history = []
  }

  async sendMessage(userMessage) {
    // Aggiungi contesto items all'utente
    const contextMsg = this.buildContextMessage()
    
    this.history.push({ role: 'user', content: userMessage })

    const messages = [
      { role: 'user', content: contextMsg },
      { role: 'assistant', content: `Perfetto, ho il contesto aggiornato. Ciao ${this.userProfile?.nome || ''}! Come posso aiutarti?` },
      ...this.history
    ]

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1000,
        system: SYSTEM_PROMPT,
        messages
      })
    })

    const data = await response.json()
    const fullText = data.content?.[0]?.text || 'Scusa, non ho capito. Puoi ripetere?'

    // Estrai JSON azione se presente
    let actionData = null
    let displayText = fullText

    const jsonMatch = fullText.match(/\|\|\|(\{.*\})/)
    if (jsonMatch) {
      try {
        actionData = JSON.parse(jsonMatch[1])
        displayText = fullText.replace(/\|\|\|.*/, '').trim()
      } catch (e) {
        console.error('Errore parsing JSON azione:', e)
      }
    }

    this.history.push({ role: 'assistant', content: fullText })

    return { text: displayText, action: actionData }
  }

  buildContextMessage() {
    const now = format(new Date(), "EEEE d MMMM yyyy 'alle' HH:mm", { locale: it })
    const appts = this.existingItems.appointments
      .map(a => `[ID:${a.id}] ${a.titolo} — ${a.data} ${a.ora} (${a.visibilita})`)
      .join('\n') || 'Nessuno'
    const todos = this.existingItems.todos
      .map(t => `[ID:${t.id}] ${t.titolo} — scadenza: ${t.scadenza_data || 'non impostata'} — priorità: ${t.priorita} (${t.visibilita})`)
      .join('\n') || 'Nessuno'

    return `CONTESTO ATTUALE:
Data e ora corrente: ${now}
Utente: ${this.userProfile?.nome || 'Utente'} (${this.userProfile?.email || ''})

APPUNTAMENTI ESISTENTI:
${appts}

TO-DO ESISTENTI:
${todos}

L'utente parlerà ora.`
  }

  resetHistory() {
    this.history = []
  }
}

// Calcola la data/ora del promemoria
export function calcReminderTime(dataStr, oraStr, minutiPrima) {
  const dt = new Date(`${dataStr}T${oraStr || '09:00'}:00`)
  return addMinutes(dt, -minutiPrima)
}
