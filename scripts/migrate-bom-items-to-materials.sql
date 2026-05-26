-- Phase 2: connect BOM detail rows to the new public.materials table.
-- This keeps bom_items.component_sku_id for old data and compatibility.

alter table public.bom_items
add column if not exists material_id uuid references public.materials(id) on delete restrict;

alter table public.bom_items
alter column component_sku_id drop not null;

create index if not exists idx_bom_items_material_id
on public.bom_items(material_id);

comment on column public.bom_items.component_sku_id is
'兼容旧数据字段：旧版组件 SKU ID，阶段二后辅料优先使用 material_id。';

comment on column public.bom_items.material_id is
'辅料 ID，关联 public.materials.id。阶段二起 BOM 辅料明细优先使用该字段。';

update public.bom_items as bom_item
set material_id = material.id
from public.skus as sku
join public.materials as material
  on material.material_code = sku.sku_code
where bom_item.component_sku_id = sku.id
  and bom_item.material_id is null
  and sku.sku_type = 'material';

grant usage on schema public to anon, authenticated;
grant select on public.materials to anon, authenticated;
grant select, insert, update on public.bom_items to anon, authenticated;

alter table public.materials enable row level security;
alter table public.bom_items enable row level security;

drop policy if exists "dev bom read materials" on public.materials;
create policy "dev bom read materials"
on public.materials for select to anon, authenticated using (true);

select
  bom_item.id as bom_item_id,
  bom_header.bom_code,
  bom_header.version,
  sku.sku_code as old_component_sku_code,
  sku.sku_name as old_component_sku_name,
  bom_item.component_sku_id,
  bom_item.material_id
from public.bom_items as bom_item
left join public.bom_headers as bom_header
  on bom_header.id = bom_item.bom_header_id
left join public.skus as sku
  on sku.id = bom_item.component_sku_id
where bom_item.material_id is null
order by bom_header.bom_code, bom_item.created_at;
