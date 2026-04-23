-- ================================================================
-- SCHEMA COMPLETO PER ASSISTENTE TEAM
-- Esegui questo SQL nell'editor SQL di Supabase (una volta sola)
-- ================================================================

-- Abilita estensione UUID
create extension if not exists "uuid-ossp";

-- ─── PROFILI UTENTI ─────────────────────────────────────────────
create table profiles (
  id uuid references auth.users primary key,
  nome text not null,
  email text not null,
  created_at timestamptz default now()
);

-- Crea profilo automaticamente alla registrazione
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, nome, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'nome', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ─── APPUNTAMENTI ────────────────────────────────────────────────
create table appuntamenti (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  titolo text not null,
  data date not null,
  ora time,
  durata_minuti integer default 60,
  luogo text,
  partecipanti text[] default '{}',
  visibilita text default 'privato' check (visibilita in ('privato', 'team')),
  promemoria_minuti integer,
  reminder_at timestamptz,
  reminder_inviato boolean default false,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Aggiorna updated_at automaticamente
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger appuntamenti_updated_at
  before update on appuntamenti
  for each row execute procedure update_updated_at();

-- ─── TO-DO ───────────────────────────────────────────────────────
create table todos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  titolo text not null,
  scadenza_data date,
  scadenza_ora time,
  priorita text default 'media' check (priorita in ('bassa', 'media', 'alta')),
  visibilita text default 'privato' check (visibilita in ('privato', 'team')),
  promemoria_minuti integer,
  reminder_at timestamptz,
  reminder_inviato boolean default false,
  completato boolean default false,
  completato_at timestamptz,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create trigger todos_updated_at
  before update on todos
  for each row execute procedure update_updated_at();

-- ─── PUSH SUBSCRIPTIONS ──────────────────────────────────────────
create table push_subscriptions (
  user_id uuid references auth.users primary key,
  subscription text not null,
  updated_at timestamptz default now()
);

-- ─── ROW LEVEL SECURITY (RLS) ────────────────────────────────────
-- Abilita RLS su tutte le tabelle

alter table profiles enable row level security;
alter table appuntamenti enable row level security;
alter table todos enable row level security;
alter table push_subscriptions enable row level security;

-- Profili: ognuno vede solo il proprio
create policy "profiles: solo il proprietario"
  on profiles for all using (auth.uid() = id);

-- Appuntamenti: vedi i tuoi + quelli del team
create policy "appuntamenti: leggi propri e team"
  on appuntamenti for select
  using (auth.uid() = user_id or visibilita = 'team');

create policy "appuntamenti: crea solo i tuoi"
  on appuntamenti for insert
  with check (auth.uid() = user_id);

create policy "appuntamenti: modifica solo i tuoi"
  on appuntamenti for update
  using (auth.uid() = user_id);

create policy "appuntamenti: elimina solo i tuoi"
  on appuntamenti for delete
  using (auth.uid() = user_id);

-- To-do: stessa logica
create policy "todos: leggi propri e team"
  on todos for select
  using (auth.uid() = user_id or visibilita = 'team');

create policy "todos: crea solo i tuoi"
  on todos for insert
  with check (auth.uid() = user_id);

create policy "todos: modifica solo i tuoi"
  on todos for update
  using (auth.uid() = user_id);

create policy "todos: elimina solo i tuoi"
  on todos for delete
  using (auth.uid() = user_id);

-- Push subscriptions: solo il proprietario
create policy "push: solo il proprietario"
  on push_subscriptions for all using (auth.uid() = user_id);

-- ─── INDICI per performance ───────────────────────────────────────
create index idx_appuntamenti_user on appuntamenti(user_id);
create index idx_appuntamenti_data on appuntamenti(data);
create index idx_appuntamenti_reminder on appuntamenti(reminder_at) where reminder_inviato = false;
create index idx_todos_user on todos(user_id);
create index idx_todos_scadenza on todos(scadenza_data);
create index idx_todos_reminder on todos(reminder_at) where reminder_inviato = false;

-- ================================================================
-- FINE SCHEMA
-- ================================================================
