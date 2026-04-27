import { supabase } from './supabase.js'
import { format, addMinutes, addHours, addDays, parseISO } from 'date-fns'
import { it } from 'date-fns/locale'

const ANTHROPIC_API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY

const SYSTEM_PROMPT = `Sei un assistente vocale aziendale per la gestione di appuntamenti e to-do list. Parli sempre in italiano, in modo professionale ma cordiale. Rispondi SEMPRE in modo brevissimo (1-2 frasi max) perché la risposta viene letta ad alta voce.

COMPORTAMENTO PRINCIPALE — SALVA SUBITO CON DEFAULT:
Quando l'utente vuole creare qualcosa, raccogli solo titolo + data/ora (se applicabile), poi SALVA IMMEDIATAMENTE usando i valori di default per tutto il resto. Dopo aver salvato chiedi: "Vuoi aggiungere altro, come luogo, partecipanti o note?"

VALORI DEFAULT (usa sempre questi se l'utente non specifica):
- visibilità: "privato"
- promemoria_minuti: 30
- durata_minuti: 60
- priorità: "media"

CAMPI APPUNTAMENTO:
- titolo (obbligatorio)
- data e ora (obbligatorio)
- durata_minuti (default: 60)
- luogo (facoltativo)
- partecipanti (facoltativo)
- visibilita: "privato" o "team" (default: "privato")
- promemoria_minuti (default: 30)
- note (facoltativo)

CAMPI TO-DO:
- titolo (obbligatorio)
- scadenza_data + scadenza_ora (facoltativo)
- priorita: "bassa"/"media"/"alta" (default: "media")
- visibilita: "privato" o "team" (default: "privato")
- promemoria_minuti (default: 30)
- note (facoltativo)

AZIONI POSSIBILI:
- CREA_APPUNTAMENTO
- CREA_TODO
- MODIFICA_APPUNTAMENTO
- MODIFICA_TODO
- ELIMINA_APPUNTAMENTO
- ELIMINA_TODO
- ELENCA
- CONVERSAZIONE

MODIFICA APPUNTAMENTI/TODO:
L'utente può riferirsi a un elemento per TITOLO o per DATA. Cerca nell'elenco degli elementi esistenti nel contesto e trova l'ID corrispondente. Se trovi più elementi simili, chiedi quale. Una volta trovato l'ID, emetti il JSON di modifica.

Quando hai le informazioni necessarie, metti il JSON alla fine della risposta preceduto da |||:
|||{"azione":"CREA_APPUNTAMENTO","dati":{...}}

Esempi JSON:
CREA_APPUNTAMENTO: {"titolo":"Riunione","data":"2024-03-15","ora":"14:30","durata_minuti":60,"luogo":null,"partecipanti":[],"visibilita":"privato","promemoria_minuti":30,"note":null}
CREA_TODO: {"titolo":"Inviare offerta","scadenza_data":"2024-03-16","scadenza_ora":"18:00","priorita":"media","visibilita":"privato","promemoria_minuti":30,"note":null}
MODIFICA_APPUNTAMENTO: {"id":"uuid-qui","ora":"15:00"}
MODIFICA_TODO: {"id":"uuid-qui","priorita":"alta"}
ELIMINA_APPUNTAMENTO: {"id":"uuid-qui"}
ELIMINA_TODO: {"id":"uuid-qui"}

REGOLE:
- Interpreta date relative: "domani", "lunedì prossimo", "tra due ore" ecc.
- "ricordamelo 30 minuti prima" → promemoria_minuti: 30
- "condividi col team" → visibilita: "team"
- Dopo aver salvato dì sempre cosa hai fatto in 1 frase, poi chiedi "Vuoi aggiungere altro?"
- Per le modifiche, cerca l'elemento nel contesto per titolo o data prima di chiedere chiarimenti
- NON fare domande se puoi usare i default`

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
        model: 'claude-sonnet-4-20250514',
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
