-- Phase 1: split material master data from skus into a dedicated materials table.
-- This script keeps the existing skus rows unchanged.

create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  material_code text not null unique,
  material_name text not null,
  category text,
  unit text not null default 'pcs',
  specs text,
  default_supplier_id uuid references public.suppliers(id) on delete set null,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.materials is '辅料表：阶段一先从 skus.sku_type = material 拆出独立辅料基础资料。';
comment on column public.materials.id is '主键 ID。';
comment on column public.materials.material_code is '辅料编码。';
comment on column public.materials.material_name is '辅料名称。';
comment on column public.materials.category is '辅料分类。';
comment on column public.materials.unit is '单位，例如 pcs、kg、m。';
comment on column public.materials.specs is '规格说明。';
comment on column public.materials.default_supplier_id is '默认供应商 ID。';
comment on column public.materials.status is '状态，例如 active、inactive。';
comment on column public.materials.notes is '备注。';
comment on column public.materials.created_at is '创建时间。';
comment on column public.materials.updated_at is '更新时间。';

create index if not exists idx_materials_default_supplier_id
on public.materials(default_supplier_id);

drop trigger if exists trg_materials_updated_at on public.materials;

create trigger trg_materials_updated_at
before update on public.materials
for each row execute function public.set_updated_at();

insert into public.materials (
  material_code,
  material_name,
  unit,
  specs,
  default_supplier_id,
  status,
  created_at,
  updated_at
)
select
  sku_code,
  sku_name,
  coalesce(nullif(unit, ''), 'pcs'),
  specs,
  default_supplier_id,
  coalesce(nullif(status, ''), 'active'),
  created_at,
  updated_at
from public.skus
where sku_type = 'material'
on conflict (material_code) do update set
  material_name = excluded.material_name,
  unit = excluded.unit,
  specs = excluded.specs,
  default_supplier_id = excluded.default_supplier_id,
  status = excluded.status,
  updated_at = excluded.updated_at;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.materials to anon, authenticated;
grant select on public.suppliers to anon, authenticated;

alter table public.materials enable row level security;

drop policy if exists "dev materials select" on public.materials;
create policy "dev materials select"
on public.materials for select to anon, authenticated using (true);

drop policy if exists "dev materials insert" on public.materials;
create policy "dev materials insert"
on public.materials for insert to anon, authenticated with check (true);

drop policy if exists "dev materials update" on public.materials;
create policy "dev materials update"
on public.materials for update to anon, authenticated using (true) with check (true);

drop policy if exists "dev materials delete" on public.materials;
create policy "dev materials delete"
on public.materials for delete to anon, authenticated using (true);
