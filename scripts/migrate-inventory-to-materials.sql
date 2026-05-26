-- 辅料拆表第五阶段：库存余额和库存流水接入独立 materials 表。
-- 说明：
-- 1. 不删除旧 sku_id，继续保留做历史兼容。
-- 2. 成品库存回填 product_sku_id = sku_id。
-- 3. 辅料库存按 skus.sku_code = materials.material_code 回填 material_id。
-- 4. 最后输出仍未匹配的库存余额和库存流水，方便人工检查。

alter table public.inventory_items
  add column if not exists product_sku_id uuid references public.skus(id) on delete restrict,
  add column if not exists material_id uuid references public.materials(id) on delete restrict;

alter table public.inventory_transactions
  add column if not exists product_sku_id uuid references public.skus(id) on delete restrict,
  add column if not exists material_id uuid references public.materials(id) on delete restrict;

create index if not exists idx_inventory_items_product_sku_id
  on public.inventory_items(product_sku_id);

create index if not exists idx_inventory_items_material_id
  on public.inventory_items(material_id);

create index if not exists idx_inventory_items_warehouse_material
  on public.inventory_items(warehouse_id, material_id);

create index if not exists idx_inventory_items_warehouse_product_sku
  on public.inventory_items(warehouse_id, product_sku_id);

create index if not exists idx_inventory_transactions_product_sku_id
  on public.inventory_transactions(product_sku_id);

create index if not exists idx_inventory_transactions_material_id
  on public.inventory_transactions(material_id);

update public.inventory_items ii
set material_id = m.id
from public.skus s
join public.materials m on m.material_code = s.sku_code
where ii.sku_id = s.id
  and s.sku_type = 'material'
  and ii.material_id is null;

update public.inventory_items ii
set product_sku_id = ii.sku_id
from public.skus s
where ii.sku_id = s.id
  and coalesce(s.sku_type, '') <> 'material'
  and ii.product_sku_id is null;

update public.inventory_transactions it
set material_id = m.id
from public.skus s
join public.materials m on m.material_code = s.sku_code
where it.sku_id = s.id
  and s.sku_type = 'material'
  and it.material_id is null;

update public.inventory_transactions it
set product_sku_id = it.sku_id
from public.skus s
where it.sku_id = s.id
  and coalesce(s.sku_type, '') <> 'material'
  and it.product_sku_id is null;

alter table public.inventory_items
  drop constraint if exists inventory_items_product_sku_required,
  add constraint inventory_items_product_sku_required check (
    item_type not in ('finished_product', 'finished_good', 'product_sku')
    or product_sku_id is not null
  ) not valid;

alter table public.inventory_items
  drop constraint if exists inventory_items_material_required,
  add constraint inventory_items_material_required check (
    item_type <> 'material'
    or material_id is not null
  ) not valid;

comment on column public.inventory_items.sku_id is '兼容旧数据字段：库存 SKU ID。阶段五起代码逻辑不再依赖它判断辅料。';
comment on column public.inventory_items.product_sku_id is '成品 SKU ID，库存类型为 finished_product、finished_good、product_sku 时优先使用。';
comment on column public.inventory_items.material_id is '辅料 ID，库存类型为 material 时优先使用。';
comment on column public.inventory_transactions.sku_id is '兼容旧数据字段：发生库存变化的 SKU ID。阶段五起辅料优先使用 material_id。';
comment on column public.inventory_transactions.product_sku_id is '发生库存变化的成品 SKU ID。';
comment on column public.inventory_transactions.material_id is '发生库存变化的辅料 ID。';

select
  '未匹配库存余额' as check_type,
  ii.id as inventory_item_id,
  ii.warehouse_id,
  ii.sku_id,
  s.sku_code,
  s.sku_name,
  s.sku_type,
  ii.item_type,
  ii.quantity_on_hand,
  ii.reserved_quantity
from public.inventory_items ii
left join public.skus s on s.id = ii.sku_id
where (
    (ii.item_type = 'material' or s.sku_type = 'material')
    and ii.material_id is null
  )
  or (
    ii.item_type in ('finished_product', 'finished_good', 'product_sku')
    and ii.product_sku_id is null
  )
order by s.sku_code nulls last, ii.updated_at desc;

select
  '未匹配库存流水' as check_type,
  it.id as inventory_transaction_id,
  it.transaction_no,
  it.warehouse_id,
  it.sku_id,
  s.sku_code,
  s.sku_name,
  s.sku_type,
  it.transaction_type,
  it.quantity,
  it.occurred_at
from public.inventory_transactions it
left join public.skus s on s.id = it.sku_id
where (
    it.transaction_type in ('material_in', 'material_out')
    and it.material_id is null
  )
  or (
    it.transaction_type in ('product_in', 'product_out')
    and it.product_sku_id is null
  )
order by it.occurred_at desc;
