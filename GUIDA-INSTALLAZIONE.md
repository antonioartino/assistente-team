# 🎙️ Guida Completa — Assistente Team
## Installazione passo-passo (senza esperienza tecnica)

> ⏱ Tempo stimato: **60-90 minuti** la prima volta  
> 💻 Ti serve: un computer con browser Chrome o Firefox

---

## PANORAMICA DEI PASSI

```
1. Crea account GitHub (gratis)          → 5 min
2. Carica il progetto su GitHub          → 10 min
3. Crea il database Supabase (gratis)    → 15 min
4. Pubblica l'app su Vercel (gratis)     → 10 min
5. Configura le email (gratis)           → 10 min
6. Attiva i promemoria automatici        → 10 min
7. Installa l'app sul telefono           → 5 min
```

---

## PASSO 1 — Crea un account GitHub

GitHub è dove caricheremo il codice dell'app.

1. Vai su **github.com**
2. Clicca **Sign up** in alto a destra
3. Inserisci email, password, username
4. Conferma l'email che ti arriva
5. ✅ Fatto!

---

## PASSO 2 — Carica il progetto su GitHub

1. Una volta dentro GitHub, clicca il **+** in alto a destra → **New repository**
2. Nome repository: `assistente-team`
3. Lascia tutto il resto come sta, clicca **Create repository**
4. Nella pagina che si apre, clicca **uploading an existing file**
5. Trascina TUTTI i file della cartella `assistente-team` in quella pagina
   - ⚠️ Attenzione: trascina i FILE dentro la cartella, non la cartella stessa
   - Includi tutti i file: `package.json`, `vite.config.js`, `index.html`, la cartella `src/`, la cartella `supabase/`
6. Clicca **Commit changes**
7. ✅ Fatto!

---

## PASSO 3 — Crea il database Supabase

Supabase è il "magazzino" dove vengono salvati appuntamenti e to-do.

### 3a. Crea account e progetto
1. Vai su **supabase.com**
2. Clicca **Start your project** → accedi con GitHub (più comodo)
3. Clicca **New Project**
4. Scegli un nome: `assistente-team`
5. Scegli una **password sicura** per il database (scrivila da qualche parte!)
6. Regione: scegli **West EU (Ireland)** — la più vicina all'Italia
7. Clicca **Create new project** e aspetta ~2 minuti

### 3b. Crea le tabelle del database
1. Nel menu a sinistra clicca **SQL Editor** (icona con i simboli `< >`)
2. Clicca **New query**
3. Apri il file `supabase/schema.sql` dal tuo computer con un editor di testo (es. Blocco Note)
4. Copia **tutto** il contenuto (Ctrl+A poi Ctrl+C)
5. Incollalo nell'editor SQL di Supabase (Ctrl+V)
6. Clicca **Run** (il tasto verde)
7. Dovresti vedere "Success. No rows returned" — significa che è andato bene
8. ✅ Fatto!

### 3c. Prendi le credenziali
1. Nel menu a sinistra clicca **Settings** (icona ingranaggio) → **API**
2. Copia e salva in un file di testo:
   - **Project URL** (es. `https://abcdefgh.supabase.co`)
   - **anon public** key (stringa lunghissima che inizia con `eyJ...`)
3. ✅ Fatto!

---

## PASSO 4 — Pubblica l'app su Vercel

Vercel mette la tua app online gratuitamente.

1. Vai su **vercel.com**
2. Clicca **Sign Up** → accedi con GitHub
3. Clicca **Add New Project**
4. Clicca **Import** accanto al repository `assistente-team`
5. **NON** cliccare ancora Deploy — prima configura le variabili

### 4a. Configura le variabili d'ambiente
Questa è la parte più importante: stai dicendo all'app dove trovare il database e le chiavi API.

Nella pagina di Vercel, scorri fino a **Environment Variables** e aggiungi queste variabili una per una:

| Nome variabile | Valore |
|---|---|
| `VITE_SUPABASE_URL` | L'URL di Supabase copiato prima |
| `VITE_SUPABASE_ANON_KEY` | La chiave `anon public` di Supabase |
| `VITE_ANTHROPIC_API_KEY` | La chiave API di Anthropic (vedi sotto) |
| `VITE_VAPID_PUBLIC_KEY` | Chiave VAPID pubblica (vedi sotto) |

Per aggiungere ciascuna: scrivi il nome nel campo **Name**, il valore nel campo **Value**, clicca **Add**.

### 4b. Ottieni la chiave Anthropic (AI)
1. Vai su **console.anthropic.com**
2. Registrati o accedi
3. Clicca **API Keys** → **Create Key**
4. Dai un nome (es. "assistente-team"), clicca **Create Key**
5. **COPIA SUBITO** la chiave (inizia con `sk-ant-...`) — non la potrai rivedere!
6. Usala come valore per `VITE_ANTHROPIC_API_KEY`

### 4c. Genera le chiavi VAPID (per notifiche push)
1. Vai su **web-push-codelab.glitch.me**
2. Clicca **Generate VAPID Keys**
3. Copia la **Public Key** → usala per `VITE_VAPID_PUBLIC_KEY`
4. Copia la **Private Key** → ti servirà dopo per Supabase

### 4d. Deploy!
1. Torna su Vercel, clicca **Deploy**
2. Aspetta 1-2 minuti
3. Vedrai un link tipo `assistente-team.vercel.app` — quella è la tua app! 🎉
4. ✅ Fatto!

---

## PASSO 5 — Configura le email (Resend)

Resend invia le email di promemoria. Gratis fino a 3.000 email/mese.

1. Vai su **resend.com**
2. Crea un account gratuito
3. Clicca **API Keys** → **Create API Key**
4. Copia la chiave (inizia con `re_...`)
5. Crea un dominio o usa il dominio di test per i primi test
6. ✅ Annota la chiave — ti servirà al passo 6

---

## PASSO 6 — Attiva i promemoria automatici (Supabase Edge Function)

Questo è il "motore" che ogni 5 minuti controlla se ci sono promemoria da inviare.

### 6a. Configura i segreti nella funzione
1. In Supabase, vai su **Settings** → **Edge Functions**
2. Clicca **Manage secrets** e aggiungi questi segreti:

| Nome | Valore |
|---|---|
| `RESEND_API_KEY` | La chiave Resend copiata al passo 5 |
| `VAPID_PRIVATE_KEY` | La chiave privata VAPID del passo 4c |
| `VAPID_PUBLIC_KEY` | La chiave pubblica VAPID del passo 4c |
| `FROM_EMAIL` | L'email da cui partono i promemoria (es. `assistente@tuazienda.com`) |

### 6b. Installa Supabase CLI e fai il deploy della funzione

> Questa parte richiede di usare il Terminale. Su Windows: tasto Start → cerca "cmd". Su Mac: cerca "Terminal".

Digita questi comandi uno per uno (premi Invio dopo ciascuno):

```
npm install -g supabase
```
```
supabase login
```
(si aprirà il browser, autorizza l'accesso)

```
cd percorso/della/tua/cartella/assistente-team
```
(sostituisci il percorso con dove hai salvato i file)

```
supabase link --project-ref IL-TUO-PROJECT-REF
```
(il project-ref lo trovi in Supabase → Settings → General → Reference ID)

```
supabase functions deploy send-reminders
```

### 6c. Attiva il cron job (esecuzione automatica ogni 5 minuti)
1. In Supabase, vai su **SQL Editor**
2. Crea una nuova query con questo contenuto:
```sql
select cron.schedule(
  'send-reminders',
  '*/5 * * * *',
  $$select net.http_post(
    url := 'https://IL-TUO-PROJECT-REF.supabase.co/functions/v1/send-reminders',
    headers := '{"Authorization": "Bearer LA-TUA-SERVICE-ROLE-KEY"}'::jsonb
  )$$
);
```
3. Sostituisci `IL-TUO-PROJECT-REF` e `LA-TUA-SERVICE-ROLE-KEY` (trovate in Settings → API → service_role)
4. Clicca **Run**
5. ✅ I promemoria sono attivi!

---

## PASSO 7 — Installa l'app sul telefono

La tua app è una PWA: si installa come un'app normale, senza App Store!

### Su Android (Chrome):
1. Apri Chrome
2. Vai su `assistente-team.vercel.app` (o l'indirizzo che ti ha dato Vercel)
3. Aspetta che la pagina carichi completamente
4. Vedrai un banner "Aggiungi alla schermata Home" — oppure clicca i tre puntini ⋮ in alto
5. Clicca **Installa** o **Aggiungi alla schermata Home**
6. Conferma → l'icona dell'app apparirà nella home!

### Su iPhone (Safari):
1. Apri **Safari** (non Chrome!)
2. Vai su `assistente-team.vercel.app`
3. Clicca l'icona **Condividi** (il quadratino con la freccia in su)
4. Scorri e clicca **Aggiungi alla schermata Home**
5. Clicca **Aggiungi** in alto a destra
6. ✅ L'app è sulla home!

---

## PASSO 8 — Crea gli account per il team

Ogni membro del team deve:
1. Aprire l'app sul proprio telefono
2. Cliccare **Registrati**
3. Inserire nome, email personale (o email dedicata) e password
4. Confermare l'email
5. Accedere e iniziare a usare l'assistente!

---

## 🎙️ COME USARE L'ASSISTENTE

### Esempi di comandi vocali:

**Creare un appuntamento:**
> "Segna una riunione con il team commerciale venerdì prossimo alle 10, in sala conferenze, durata due ore, condividi con il team e ricordamelo un'ora prima"

**Creare un to-do:**
> "Aggiungi alle cose da fare: inviare il preventivo al cliente Rossi entro giovedì sera, priorità alta, solo per me, ricordamelo 2 ore prima"

**Modificare:**
> "Sposta la riunione di venerdì alle 11"

**Eliminare:**
> "Cancella l'appuntamento con Rossi di lunedì"

**Vedere la lista:**
> "Cosa ho in agenda questa settimana?"

L'assistente farà domande se mancano informazioni. Rispondi e lui completerà tutto da solo! 🎉

---

## 🆘 PROBLEMI COMUNI

**"Il microfono non funziona"**
→ Su Android usa Chrome. Su iPhone usa Safari. Controlla che il browser abbia i permessi al microfono nelle impostazioni del telefono.

**"Non ricevo le email"**
→ Controlla la cartella spam. Assicurati che il passo 5 e 6 siano stati completati correttamente.

**"L'app non si carica"**
→ Controlla le variabili d'ambiente su Vercel (Passo 4a). La più comune è un errore nel copiare la chiave Supabase.

**"Errore durante la registrazione"**
→ In Supabase, vai su Authentication → Settings e disabilita "Email confirmations" durante i test.

---

## 💰 RIEPILOGO COSTI MENSILI

| Servizio | Piano | Costo |
|---|---|---|
| Vercel (hosting app) | Hobby | **Gratis** |
| Supabase (database) | Free | **Gratis** |
| Resend (email) | Free (3k/mese) | **Gratis** |
| Anthropic Claude API | Pay-as-you-go | **~€5-15/mese** |
| **TOTALE** | | **~€5-15/mese** |

---

Buona fortuna! 🚀
