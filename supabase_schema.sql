-- =============================================
-- GPS da Obra — Schema do banco de dados
-- Execute no Supabase > SQL Editor
-- =============================================

-- OBRAS
create table if not exists obras (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  local text,
  valor numeric(15,2) default 0,
  inicio date,
  fim date,
  responsavel text,
  tipo text,
  descricao text,
  custo_realizado numeric(15,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- EAP (Estrutura Analítica do Projeto) por obra
create table if not exists eap_itens (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  codigo text not null,
  nome text not null,
  peso numeric(6,2) default 0,
  orcado numeric(15,2) default 0,
  prazo_dias int default 0,
  avanco numeric(6,2) default 0,
  executado numeric(15,2) default 0,
  ordem int default 0
);

-- LANÇAMENTOS DE QUALIDADE
create table if not exists qualidade (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  periodo text not null,
  materiais numeric(4,2) default 0,
  execucao numeric(4,2) default 0,
  conformidade numeric(4,2) default 0,
  prazo numeric(4,2) default 0,
  acabamento numeric(4,2) default 0,
  media numeric(4,2) default 0,
  created_at timestamptz default now()
);

-- LANÇAMENTOS DE SEGURANÇA
create table if not exists seguranca (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid references obras(id) on delete cascade,
  periodo text not null,
  incidentes int default 0,
  afastamentos int default 0,
  dias_sem_acidente int default 0,
  treinamentos int default 0,
  trabalhadores_treinados int default 0,
  observacoes text,
  created_at timestamptz default now()
);

-- RLS (Row Level Security) — permite acesso público anon por enquanto
alter table obras enable row level security;
alter table eap_itens enable row level security;
alter table qualidade enable row level security;
alter table seguranca enable row level security;

create policy "acesso publico obras" on obras for all using (true) with check (true);
create policy "acesso publico eap" on eap_itens for all using (true) with check (true);
create policy "acesso publico qualidade" on qualidade for all using (true) with check (true);
create policy "acesso publico seguranca" on seguranca for all using (true) with check (true);

-- Trigger para updated_at automático
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger obras_updated_at before update on obras
  for each row execute function update_updated_at();
