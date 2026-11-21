-- Escala Fácil (AD Brasil) - Schema PostgreSQL para Supabase
-- Execute este script no SQL Editor do seu projeto Supabase.

create table if not exists public.app_settings (
  id text primary key,
  church_name text not null default 'Assembleia de Deus • AD Brasil',
  updated_at timestamptz not null default now()
);

create table if not exists public.ministries (
  id text primary key,
  name text not null,
  locais jsonb not null default '[]'::jsonb,
  color text,
  sort_order integer not null default 0,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists public.members (
  id text primary key,
  name text not null,
  cargo text not null default '',
  phone text not null default '',
  ministry_id text not null references public.ministries(id) on delete cascade,
  locais jsonb not null default '[]'::jsonb,
  email text,
  avatar_url text,
  sort_order integer not null default 0,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists public.services (
  id text primary key,
  label text not null,
  day_of_week text,
  time text,
  sort_order integer not null default 0,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists public.schedules (
  id text primary key,
  date_iso text not null,
  service_id text not null,
  service_label text not null,
  assignments jsonb not null default '{}'::jsonb,
  note text not null default '',
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

create table if not exists public.leaders (
  id text primary key,
  name text not null,
  login text not null unique,
  email text not null default '',
  cargo text not null default '',
  role text not null check (role in ('admin', 'leader')),
  ministry_id text,
  active boolean not null default true,
  password_hash text not null,
  created_at bigint not null,
  last_login_at bigint
);

create table if not exists public.password_resets (
  id text primary key,
  leader_id text not null references public.leaders(id) on delete cascade,
  leader_login text not null,
  leader_name text not null,
  ministry_id text,
  contact_note text not null default '',
  code_hash text,
  status text not null check (status in ('pending', 'code_issued', 'completed')),
  created_at bigint not null,
  expires_at bigint
);

create table if not exists public.notifications (
  id text primary key,
  category text not null check (category in ('service', 'schedule', 'ministry', 'member')),
  ministry_id text,
  title text not null,
  message text not null,
  target_tab text not null default 'schedules',
  target_id text,
  actor_name text not null default 'Coordenação Geral',
  read_by jsonb not null default '[]'::jsonb,
  created_at bigint not null
);

create index if not exists idx_members_ministry on public.members (ministry_id);
create index if not exists idx_schedules_date on public.schedules (date_iso desc);
create index if not exists idx_leaders_login on public.leaders (lower(login));
create index if not exists idx_leaders_ministry on public.leaders (ministry_id);
create index if not exists idx_password_resets_leader on public.password_resets (leader_id, created_at desc);
create index if not exists idx_notifications_created on public.notifications (created_at desc);
create index if not exists idx_notifications_ministry on public.notifications (ministry_id);

-- Habilita RLS para proteger acesso direto via anon key.
-- O backend Express utiliza SUPABASE_SERVICE_ROLE_KEY com controle RBAC por departamento.
alter table public.app_settings enable row level security;
alter table public.ministries enable row level security;
alter table public.members enable row level security;
alter table public.services enable row level security;
alter table public.schedules enable row level security;
alter table public.leaders enable row level security;
alter table public.password_resets enable row level security;
alter table public.notifications enable row level security;
