-- Escala Fácil (AD Brasil) - Acessos iniciais por departamento (public.leaders)
-- Execute este script no SQL Editor do seu projeto Supabase após rodar o /supabase/schema.sql.
--
-- Credenciais padrão incluídas neste arquivo (altere as senhas após o primeiro acesso):
-- 1) Coordenação Geral (Admin) -> login: admin      | senha: admin123
-- 2) Louvor & Adoração         -> login: louvor     | senha: adbrasil123
-- 3) Mídia & Transmissão       -> login: midia      | senha: adbrasil123
-- 4) Recepção & Boas-Vindas    -> login: recepcao   | senha: adbrasil123
-- 5) Ministério Infantil       -> login: infantil   | senha: adbrasil123
-- 6) Diaconato & Apoio         -> login: diaconato  | senha: adbrasil123
--
-- Os hashes abaixo estão no formato scrypt ("salt:hash") esperado pelo backend Express (/server/authStore.ts).

insert into public.leaders (
  id,
  name,
  login,
  email,
  cargo,
  role,
  ministry_id,
  active,
  password_hash,
  created_at,
  last_login_at
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
