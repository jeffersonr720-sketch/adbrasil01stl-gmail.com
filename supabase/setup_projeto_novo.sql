-- ============================================================================
-- Escala Fácil (AD Brasil) - Setup Completo para Novo Projeto Supabase
-- ============================================================================
-- Execute este script completo no SQL Editor de um projeto Supabase novo.
-- Ele cria todas as 8 tabelas atualizadas, índices, RLS de segurança e os
-- dados iniciais (configurações, departamentos, cultos, voluntários, escalas,
-- líderes com senha criptografada em scrypt e notificações).
--
-- Seguro para reexecução: utiliza CREATE IF NOT EXISTS e ON CONFLICT DO NOTHING.
-- ============================================================================

-- 1. TABELAS PRINCIPAIS
-- ----------------------------------------------------------------------------

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
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
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
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint,
  expires_at bigint
);

create table if not exists public.notifications (
  id text primary key,
  category text not null check (category in ('service', 'schedule', 'ministry', 'member')),
  ministry_id text,
  title text not null,
  message text not null,
  target_tab text not null default 'schedules' check (target_tab in ('dashboard', 'schedules', 'services', 'ministries', 'members', 'attendance')),
  target_id text,
  actor_name text not null default 'Coordenação Geral',
  read_by jsonb not null default '[]'::jsonb,
  created_at bigint not null default (extract(epoch from now()) * 1000)::bigint
);

-- 2. ÍNDICES DE PERFORMANCE E INTEGRIDADE
-- ----------------------------------------------------------------------------

create index if not exists idx_members_ministry on public.members (ministry_id);
create index if not exists idx_schedules_date on public.schedules (date_iso desc);
create index if not exists idx_schedules_service on public.schedules (service_id);
create unique index if not exists idx_leaders_login_unique on public.leaders (lower(login));
create index if not exists idx_leaders_ministry on public.leaders (ministry_id);
create index if not exists idx_password_resets_leader on public.password_resets (leader_id, created_at desc);
create index if not exists idx_notifications_created on public.notifications (created_at desc);
create index if not exists idx_notifications_ministry on public.notifications (ministry_id);

-- 3. SEGURANÇA (ROW LEVEL SECURITY)
-- ----------------------------------------------------------------------------
-- Bloqueia leitura/escrita direta pela chave pública anon no navegador.
-- O servidor backend Express utiliza SUPABASE_SERVICE_ROLE_KEY com RBAC por departamento.

alter table public.app_settings enable row level security;
alter table public.ministries enable row level security;
alter table public.members enable row level security;
alter table public.services enable row level security;
alter table public.schedules enable row level security;
alter table public.leaders enable row level security;
alter table public.password_resets enable row level security;
alter table public.notifications enable row level security;

-- 4. DADOS INICIAIS DO SISTEMA
-- ----------------------------------------------------------------------------

-- 4.1 Configurações da Igreja
insert into public.app_settings (id, church_name)
values ('default', 'Assembleia de Deus • AD Brasil')
on conflict (id) do nothing;

-- 4.2 Departamentos / Ministérios
insert into public.ministries (id, name, locais, color, sort_order)
values
  (
    'min-louvor',
    'Louvor & Adoração',
    '["Voz Líder","Backing Vocal 1","Backing Vocal 2","Teclado / Piano","Violão Acústico","Guitarra","Baixo Elétrico","Bateria"]'::jsonb,
    '#2F9B45',
    0
  ),
  (
    'min-midia',
    'Mídia & Transmissão',
    '["Mesa de Som (FOH)","Transmissão Online / Live","Projeção de Letras / EasyWorship","Câmera Principal","Fotografia"]'::jsonb,
    '#F7B13D',
    1
  ),
  (
    'min-recepcao',
    'Recepção & Boas-Vindas',
    '["Entrada Principal - Porta A","Entrada Principal - Porta B","Distribuição de Boletins","Acolhimento de Visitantes","Estacionamento"]'::jsonb,
    '#1B7A32',
    2
  ),
  (
    'min-infantil',
    'Ministério Infantil',
    '["Berçário (0 a 2 anos)","Maternal (3 a 5 anos)","Juniores (6 a 10 anos)","Apoio e Lanche"]'::jsonb,
    '#E88A1A',
    3
  ),
  (
    'min-diaconato',
    'Diaconato & Apoio',
    '["Recolhimento de Ofertas","Segurança Interna","Apoio ao Altar e Santa Ceia","Água e Conforto Pastoral"]'::jsonb,
    '#134E24',
    4
  )
on conflict (id) do nothing;

-- 4.3 Cultos Regulares
insert into public.services (id, label, day_of_week, time, sort_order)
values
  ('srv-dom-manha', 'Culto de Domingo Manhã (10h)', 'Domingo', '10:00', 0),
  ('srv-dom-noite', 'Culto de Domingo Noite (19h)', 'Domingo', '19:00', 1),
  ('srv-quarta', 'Quarta da Vitória & Oração (20h)', 'Quarta-feira', '20:00', 2),
  ('srv-sabado-jovens', 'Culto de Jovens Conectados (19h30)', 'Sábado', '19:30', 3)
on conflict (id) do nothing;

-- 4.4 Voluntários Iniciais
insert into public.members (id, name, cargo, phone, ministry_id, locais, email, sort_order)
values
  ('mem-1', 'Pr. Lucas Ribeiro', 'Pastor Titular & Voz Líder', '5511988881001', 'min-louvor', '["Voz Líder","Violão Acústico"]'::jsonb, 'lucas.pastor@igreja.com.br', 0),
  ('mem-2', 'Camila Fernandes', 'Líder de Louvor & Voz', '5511988881002', 'min-louvor', '["Voz Líder","Backing Vocal 1"]'::jsonb, 'camila.louvor@igreja.com.br', 1),
  ('mem-3', 'Gabriel Siqueira', 'Músico (Baterista)', '5511988881003', 'min-louvor', '["Bateria"]'::jsonb, 'gabriel.drum@igreja.com.br', 2),
  ('mem-4', 'Matheus Costa', 'Músico (Tecladista)', '5511988881004', 'min-louvor', '["Teclado / Piano"]'::jsonb, 'matheus.keys@igreja.com.br', 3),
  ('mem-5', 'Felipe Alencar', 'Músico (Baixista)', '5511988881005', 'min-louvor', '["Baixo Elétrico"]'::jsonb, 'felipe.bass@igreja.com.br', 4),
  ('mem-6', 'Beatriz Lima', 'Líder de Mídia', '5511988882001', 'min-midia', '["Transmissão Online / Live","Projeção de Letras / EasyWorship"]'::jsonb, 'beatriz.midia@igreja.com.br', 5),
  ('mem-7', 'Rodrigo Macedo', 'Técnico de Áudio', '5511988882002', 'min-midia', '["Mesa de Som (FOH)"]'::jsonb, 'rodrigo.audio@igreja.com.br', 6),
  ('mem-8', 'Juliana Barbosa', 'Líder de Recepção', '5511988883001', 'min-recepcao', '["Entrada Principal - Porta A","Acolhimento de Visitantes"]'::jsonb, 'juliana.recepcao@igreja.com.br', 7),
  ('mem-9', 'Marcos Vinicius', 'Voluntário de Recepção', '5511988883002', 'min-recepcao', '["Entrada Principal - Porta B","Estacionamento"]'::jsonb, 'marcos.recepcao@igreja.com.br', 8),
  ('mem-10', 'Tia Débora Santos', 'Coordenadora Infantil', '5511988884001', 'min-infantil', '["Juniores (6 a 10 anos)","Berçário (0 a 2 anos)"]'::jsonb, 'debora.kids@igreja.com.br', 9),
  ('mem-11', 'Diácono Paulo Andrade', 'Diácono Chefe', '5511988885001', 'min-diaconato', '["Apoio ao Altar e Santa Ceia","Recolhimento de Ofertas"]'::jsonb, 'paulo.diacono@igreja.com.br', 10)
on conflict (id) do nothing;

-- 4.5 Escalas Iniciais (datas dinâmicas relativas ao próximo domingo)
with dates as (
  select
    (current_date + (((7 - extract(dow from current_date)::int) % 7) + case when extract(dow from current_date)::int = 0 then 7 else 0 end)) as next_sunday
)
insert into public.schedules (id, date_iso, service_id, service_label, assignments, note, created_at)
select
  s.id,
  s.date_iso,
  s.service_id,
  s.service_label,
  s.assignments,
  s.note,
  s.created_at
from dates d,
lateral (
  values
    (
      'sch-proximo-domingo-noite',
      to_char(d.next_sunday, 'YYYY-MM-DD'),
      'srv-dom-noite',
      'Culto de Domingo Noite (19h)',
      '{
        "min-louvor": [
          {"id":"as-1","memberId":"mem-2","local":"Voz Líder","present":true},
          {"id":"as-2","memberId":"mem-4","local":"Teclado / Piano","present":true},
          {"id":"as-3","memberId":"mem-3","local":"Bateria","present":true},
          {"id":"as-4","memberId":"mem-5","local":"Baixo Elétrico","present":false}
        ],
        "min-midia": [
          {"id":"as-5","memberId":"mem-7","local":"Mesa de Som (FOH)","present":true},
          {"id":"as-6","memberId":"mem-6","local":"Projeção de Letras / EasyWorship","present":true}
        ],
        "min-recepcao": [
          {"id":"as-7","memberId":"mem-8","local":"Entrada Principal - Porta A","present":true},
          {"id":"as-8","memberId":"mem-9","local":"Entrada Principal - Porta B","present":true}
        ],
        "min-infantil": [
          {"id":"as-9","memberId":"mem-10","local":"Juniores (6 a 10 anos)","present":true}
        ],
        "min-diaconato": [
          {"id":"as-10","memberId":"mem-11","local":"Apoio ao Altar e Santa Ceia","present":true}
        ]
      }'::jsonb,
      'Reunião de oração com todos os voluntários às 18h15 na sala dos fundos. Uniforme: Camiseta preta ministerial.',
      ((extract(epoch from now()) * 1000)::bigint - 86400000)
    ),
    (
      'sch-sabado-jovens',
      to_char(d.next_sunday - 1, 'YYYY-MM-DD'),
      'srv-sabado-jovens',
      'Culto de Jovens Conectados (19h30)',
      '{
        "min-louvor": [
          {"id":"as-15","memberId":"mem-2","local":"Voz Líder","present":true},
          {"id":"as-16","memberId":"mem-3","local":"Bateria","present":false},
          {"id":"as-17","memberId":"mem-5","local":"Baixo Elétrico","present":true}
        ],
        "min-midia": [
          {"id":"as-18","memberId":"mem-6","local":"Transmissão Online / Live","present":true}
        ],
        "min-recepcao": [
          {"id":"as-19","memberId":"mem-9","local":"Acolhimento de Visitantes","present":true}
        ]
      }'::jsonb,
      'Passagem de som da banda jovem às 18h00.',
      ((extract(epoch from now()) * 1000)::bigint - 172800000)
    ),
    (
      'sch-quarta-vitoria',
      to_char(d.next_sunday - 4, 'YYYY-MM-DD'),
      'srv-quarta',
      'Quarta da Vitória & Oração (20h)',
      '{
        "min-louvor": [
          {"id":"as-20","memberId":"mem-1","local":"Violão Acústico","present":true},
          {"id":"as-21","memberId":"mem-4","local":"Teclado / Piano","present":true}
        ],
        "min-midia": [
          {"id":"as-22","memberId":"mem-7","local":"Mesa de Som (FOH)","present":true}
        ],
        "min-diaconato": [
          {"id":"as-23","memberId":"mem-11","local":"Recolhimento de Ofertas","present":true}
        ]
      }'::jsonb,
      'Culto de ensino e clamor pelas famílias.',
      ((extract(epoch from now()) * 1000)::bigint - 345600000)
    ),
    (
      'sch-domingo-anterior',
      to_char(d.next_sunday - 7, 'YYYY-MM-DD'),
      'srv-dom-manha',
      'Culto de Domingo Manhã (10h)',
      '{
        "min-louvor": [
          {"id":"as-11","memberId":"mem-1","local":"Voz Líder","present":true},
          {"id":"as-12","memberId":"mem-4","local":"Teclado / Piano","present":true}
        ],
        "min-midia": [
          {"id":"as-13","memberId":"mem-7","local":"Mesa de Som (FOH)","present":true}
        ],
        "min-recepcao": [
          {"id":"as-14","memberId":"mem-8","local":"Acolhimento de Visitantes","present":true}
        ]
      }'::jsonb,
      'Culto da Santa Ceia do Senhor. Todos os diáconos a postos para o serviço do pão e do cálice.',
      ((extract(epoch from now()) * 1000)::bigint - 604800000)
    )
) as s(id, date_iso, service_id, service_label, assignments, note, created_at)
on conflict (id) do nothing;

-- 4.6 Acessos por Departamento (Líderes e Coordenação Geral)
-- Senhas iniciais padrão (altere após o primeiro acesso):
-- admin -> admin123 | louvor, midia, recepcao, infantil, diaconato -> adbrasil123
insert into public.leaders (
  id, name, login, email, cargo, role, ministry_id, active, password_hash, created_at, last_login_at
)
values
  (
    'ldr-admin',
    'Pr. Lucas Ribeiro',
    'admin',
    'lucas.pastor@igreja.com.br',
    'Pastor Titular · Coordenação Geral',
    'admin',
    null,
    true,
    '6f4c216c312c9acc3699a5119cbbea21:fd78190e0dfd525902231cabe7dc54a451d9a39198afb56aca143156106bf759ed4ee17e2ee2d7238401abe05949da092f08222ce0b1e428e88801a62adb4afb',
    1732200000000,
    null
  ),
  (
    'ldr-louvor',
    'Camila Fernandes',
    'louvor',
    'camila.louvor@igreja.com.br',
    'Líder de Louvor',
    'leader',
    'min-louvor',
    true,
    'b62158675a8da89aa0bca49d3b6cb5d4:f1e889c6d586e0db62bc041a838cc078701d99324b1ecaf33e5c3a9b4293dafb84f60898c4e626a28aacd9a6b23210ad6b6cd1b7c43d961f87d3e2b6e03eeb3d',
    1732200000000,
    null
  ),
  (
    'ldr-midia',
    'Beatriz Lima',
    'midia',
    'beatriz.midia@igreja.com.br',
    'Líder de Mídia',
    'leader',
    'min-midia',
    true,
    '0fc96af060231675d2c390d468f2175c:030983fb684decb44abd56047071ad04af78337385e82be277eb95d0f70617f478b943397c190f09718f07aecf25d928c7e1246b5572ade42d7ac84193ccf8b0',
    1732200000000,
    null
  ),
  (
    'ldr-recepcao',
    'Juliana Barbosa',
    'recepcao',
    'juliana.recepcao@igreja.com.br',
    'Líder de Recepção',
    'leader',
    'min-recepcao',
    true,
    '90a68e0af35b05dbf9097e9359a6c668:ae8bb4d51496ee5c1714d893a5a47ceed8c042ee15d20d8d959ddeb67f55735efbc2b2e200d2badde40134b359a6636758d1d4b4cc73dd6e3420016f5b6e0521',
    1732200000000,
    null
  ),
  (
    'ldr-infantil',
    'Tia Débora Santos',
    'infantil',
    'debora.kids@igreja.com.br',
    'Coordenadora Infantil',
    'leader',
    'min-infantil',
    true,
    'ee5afb073c1738ab62111d0a02b288fa:5c057220214162b8cf15f895f6e7965ff6cba2bdc72bdbc1728c6a30dc13521d9274d402622667281e968cf73b69b6885d04c3bd7c8c2ac2c0adfbd383674d6e',
    1732200000000,
    null
  ),
  (
    'ldr-diaconato',
    'Diácono Paulo Andrade',
    'diaconato',
    'paulo.diacono@igreja.com.br',
    'Diácono Chefe',
    'leader',
    'min-diaconato',
    true,
    'adda536feb630374cbbbe9cfe27ec238:e82e0116353523240639a4ccbcf5c147782ecef064642f4ef4106ccfc89d351548609bcb235d55abcdf9c2dc9f8943eba81541bba5bb1e15f4b9be4dca140f60',
    1732200000000,
    null
  )
on conflict do nothing;

-- 4.7 Notificações Iniciais por Departamento e Cultos
insert into public.notifications (
  id, category, ministry_id, title, message, target_tab, target_id, actor_name, read_by, created_at
)
values
  (
    'notif-seed-culto-domingo',
    'service',
    null,
    'Culto de Domingo Noite confirmado',
    'Reunião de oração com as equipes às 18h15 antes do culto das 19h.',
    'schedules',
    'sch-proximo-domingo-noite',
    'Pr. Lucas Ribeiro',
    '[]'::jsonb,
    ((extract(epoch from now()) * 1000)::bigint - 1500000)
  ),
  (
    'notif-seed-culto-jovens',
    'service',
    null,
    'Culto de Jovens Conectados (19h30)',
    'Passagem de som programada para 18h00 no templo principal.',
    'services',
    'srv-sabado-jovens',
    'Pr. Lucas Ribeiro',
    '[]'::jsonb,
    ((extract(epoch from now()) * 1000)::bigint - 7200000)
  ),
  (
    'notif-seed-louvor',
    'schedule',
    'min-louvor',
    'Pendência na escala de Louvor & Adoração',
    '1 músico ainda aguarda confirmação de presença para o Culto de Domingo Noite.',
    'schedules',
    'sch-proximo-domingo-noite',
    'Camila Fernandes',
    '[]'::jsonb,
    ((extract(epoch from now()) * 1000)::bigint - 2700000)
  ),
  (
    'notif-seed-midia',
    'ministry',
    'min-midia',
    'Postos de Mídia & Transmissão revisados',
    'Função "Transmissão Online / Live" atualizada para o culto de sábado.',
    'ministries',
    'min-midia',
    'Beatriz Lima',
    '[]'::jsonb,
    ((extract(epoch from now()) * 1000)::bigint - 5400000)
  ),
  (
    'notif-seed-recepcao',
    'schedule',
    'min-recepcao',
    'Equipe de Recepção escalada',
    'Portas A e B confirmadas para o próximo culto de domingo.',
    'schedules',
    'sch-proximo-domingo-noite',
    'Juliana Barbosa',
    '[]'::jsonb,
    ((extract(epoch from now()) * 1000)::bigint - 10800000)
  ),
  (
    'notif-seed-infantil',
    'schedule',
    'min-infantil',
    'Escala do Ministério Infantil aberta',
    'Confira os voluntários de Berçário e Maternal para o próximo fim de semana.',
    'schedules',
    'sch-sabado-jovens',
    'Tia Débora Santos',
    '[]'::jsonb,
    ((extract(epoch from now()) * 1000)::bigint - 18000000)
  ),
  (
    'notif-seed-diaconato',
    'schedule',
    'min-diaconato',
    'Apoio ao Altar e Santa Ceia',
    'Escala do Diaconato atualizada para o culto de domingo às 19h.',
    'schedules',
    'sch-proximo-domingo-noite',
    'Diácono Paulo Andrade',
    '[]'::jsonb,
    ((extract(epoch from now()) * 1000)::bigint - 21600000)
  )
on conflict (id) do nothing;
