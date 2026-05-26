-- Phase 4: connect purchase order detail rows to the new public.materials table.
-- This keeps purchase_order_items.sku_id for old data and compatibility.

alter table public.purchase_order_items
add column if not exists material_id uuid references public.materials(id) on delete restrict;

alter table public.purchase_order_items
alter column sku_id drop not null;

create index if not exists idx_purchase_order_items_material_id
on public.purchase_order_items(material_id);

comment on column public.purchase_order_items.sku_id is
'兼容旧数据字段：旧版采购的原材料或半成品 SKU ID，采购辅料优先使用 material_id。';

comment on column public.purchase_order_items.material_id is
'辅料 ID，关联 public.materials.id。阶段四起采购明细优先使用该字段。';

-- 1) If the purchase item is linked to a material requirement, trust the
-- requirement's material_id first.
update public.purchase_order_items as item
set material_id = requirement.material_id
from public.material_requirements as requirement
where item.material_requirement_id = requirement.id
  and item.material_id is null
  and requirement.material_id is not null;

-- 2) For old purchase items without material_requirements.material_id, match
-- old sku_id -> skus.sku_code -> materials.material_code.
update public.purchase_order_items as item
set material_id = material.id
from public.skus as sku
join public.materials as material
  on lower(material.material_code) = lower(sku.sku_code)
where item.sku_id = sku.id
  and item.material_id is null
  and sku.sku_type = 'material';

grant usage on schema public to anon, authenticated;
grant select on public.materials to anon, authenticated;
grant select, insert, update on public.purchase_order_items to anon, authenticated;

alter table public.materials enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists "dev purchase read materials" on public.materials;
create policy "dev purchase read materials"
on public.materials for select to anon, authenticated using (true);

select
  item.id as purchase_order_item_id,
  purchase_order.purchase_order_no,
  requirement.id as material_requirement_id,
  requirement.material_id as requirement_material_id,
  sku.sku_code as old_sku_code,
  sku.sku_name as old_sku_name,
  item.sku_id,
  item.material_id,
  item.ordered_quantity,
  item.unit
from public.purchase_order_items as item
left join public.purchase_orders as purchase_order
  on purchase_order.id = item.purchase_order_id
left join public.material_requirements as requirement
  on requirement.id = item.material_requirement_id
left join public.skus as sku
  on sku.id = item.sku_id
where item.material_id is null
order by purchase_order.purchase_order_no, item.created_at;
