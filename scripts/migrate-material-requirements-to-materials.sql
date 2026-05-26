-- Phase 3: connect material requirements to the new public.materials table.
-- This keeps material_requirements.material_sku_id for old data and compatibility.

alter table public.material_requirements
add column if not exists material_id uuid references public.materials(id) on delete restrict;

alter table public.material_requirements
alter column material_sku_id drop not null;

create index if not exists idx_material_requirements_material_id
on public.material_requirements(material_id);

comment on column public.material_requirements.material_sku_id is
'兼容旧数据字段：旧版原材料或半成品 SKU ID，辅料需求优先使用 material_id。';

comment on column public.material_requirements.material_id is
'辅料 ID，关联 public.materials.id。阶段三起物料需求优先使用该字段。';

update public.material_requirements as requirement
set material_id = material.id
from public.skus as sku
join public.materials as material
  on lower(material.material_code) = lower(sku.sku_code)
where requirement.material_sku_id = sku.id
  and requirement.material_id is null
  and sku.sku_type = 'material';

grant usage on schema public to anon, authenticated;
grant select on public.materials to anon, authenticated;
grant select, insert, update on public.material_requirements to anon, authenticated;

alter table public.materials enable row level security;
alter table public.material_requirements enable row level security;

drop policy if exists "dev material requirements read materials" on public.materials;
create policy "dev material requirements read materials"
on public.materials for select to anon, authenticated using (true);

select
  requirement.id as material_requirement_id,
  production_order.production_order_no,
  sku.sku_code as old_material_sku_code,
  sku.sku_name as old_material_sku_name,
  requirement.material_sku_id,
  requirement.material_id,
  requirement.required_quantity,
  requirement.status
from public.material_requirements as requirement
left join public.production_orders as production_order
  on production_order.id = requirement.production_order_id
left join public.skus as sku
  on sku.id = requirement.material_sku_id
where requirement.material_id is null
order by requirement.created_at;
