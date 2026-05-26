-- Drop legacy material SKU fields/data after final check and backup.
--
-- Protection rules:
--   1. This script repeats the final database checks. Any unmigrated legacy
--      reference raises an exception.
--   2. This script verifies backup tables exist and contain at least one backup
--      run. If not, it raises an exception.
--   3. It deletes only old skus.sku_type = 'material' rows after all legacy
--      references are gone.
--   4. It does not delete products, finished-product SKUs, purchase orders,
--      production orders, inventory balances, or inventory transactions.

begin;

do $$
declare
  issue_count integer;
  backup_run_count integer;
begin
  with legacy_material_skus as (
    select id
    from public.skus
    where sku_type = 'material'
  ),
  issues as (
    select item.id
    from public.bom_items item
    join legacy_material_skus sku on sku.id = item.component_sku_id
    where item.material_id is null
    union all
    select requirement.id
    from public.material_requirements requirement
    join legacy_material_skus sku on sku.id = requirement.material_sku_id
    where requirement.material_id is null
    union all
    select item.id
    from public.purchase_order_items item
    join legacy_material_skus sku on sku.id = item.sku_id
    where item.material_id is null
    union all
    select item.id
    from public.inventory_items item
    join legacy_material_skus sku on sku.id = item.sku_id
    where item.material_id is null
    union all
    select transaction.id
    from public.inventory_transactions transaction
    join legacy_material_skus sku on sku.id = transaction.sku_id
    where transaction.material_id is null
    union all
    select item.id
    from public.bom_items item
    join legacy_material_skus sku on sku.id = item.component_sku_id
    where item.material_id is null
    union all
    select requirement.id
    from public.material_requirements requirement
    join legacy_material_skus sku on sku.id = requirement.material_sku_id
    where requirement.material_id is null
    union all
    select item.id
    from public.purchase_order_items item
    join legacy_material_skus sku on sku.id = item.sku_id
    where item.material_id is null
    union all
    select item.id
    from public.inventory_items item
    join legacy_material_skus sku on sku.id = item.sku_id
    where item.material_id is null
    union all
    select transaction.id
    from public.inventory_transactions transaction
    join legacy_material_skus sku on sku.id = transaction.sku_id
    where transaction.material_id is null
  )
  select count(*) into issue_count
  from issues;

  if issue_count > 0 then
    raise exception
      'Drop stopped: % legacy material SKU references still exist. Run final-check-before-dropping-legacy-material-fields.sql first.',
      issue_count;
  end if;

  if to_regclass('public.legacy_material_skus_backup') is null
    or to_regclass('public.legacy_material_backup_runs') is null
    or to_regclass('public.legacy_bom_items_material_fields_backup') is null
    or to_regclass('public.legacy_material_requirements_fields_backup') is null
    or to_regclass('public.legacy_purchase_order_items_material_fields_backup') is null
    or to_regclass('public.legacy_inventory_items_material_fields_backup') is null
    or to_regclass('public.legacy_inventory_transactions_material_fields_backup') is null then
    raise exception 'Drop stopped: legacy backup tables are missing. Run backup-legacy-material-data-before-drop.sql first.';
  end if;

  select count(*) into backup_run_count
  from public.legacy_material_backup_runs;

  if backup_run_count = 0 then
    raise exception 'Drop stopped: no legacy material backup run found.';
  end if;
end $$;

alter table public.bom_items
drop constraint if exists bom_items_component_sku_id_fkey;

alter table public.bom_items
drop constraint if exists bom_items_bom_header_id_component_sku_id_key;

drop index if exists public.idx_bom_items_component_sku_id;

alter table public.bom_items
drop column if exists component_sku_id;

alter table public.bom_items
add constraint bom_items_bom_header_id_material_id_key unique (bom_header_id, material_id);

alter table public.material_requirements
drop constraint if exists material_requirements_material_sku_id_fkey;

alter table public.material_requirements
drop constraint if exists material_requirements_production_order_id_material_sku_id_key;

drop index if exists public.idx_material_requirements_material_sku_id;

alter table public.material_requirements
drop column if exists material_sku_id;

alter table public.material_requirements
add constraint material_requirements_production_order_id_material_id_key unique (production_order_id, material_id);

-- purchase_order_items.sku_id is kept because it may still describe old
-- non-material purchase history. New material purchase logic uses material_id.

alter table public.inventory_items
alter column sku_id drop not null;

alter table public.inventory_transactions
alter column sku_id drop not null;

update public.inventory_items item
set sku_id = null
from public.skus sku
where item.sku_id = sku.id
  and sku.sku_type = 'material'
  and item.material_id is not null;

update public.purchase_order_items item
set sku_id = null
from public.skus sku
where item.sku_id = sku.id
  and sku.sku_type = 'material'
  and item.material_id is not null;

update public.inventory_transactions transaction
set sku_id = null
from public.skus sku
where transaction.sku_id = sku.id
  and sku.sku_type = 'material'
  and transaction.material_id is not null;

-- inventory sku_id columns are kept for historical non-material compatibility,
-- but old material references are cleared before old material SKU rows are deleted.

delete from public.skus
where sku_type = 'material';

comment on table public.materials is '辅料表：保存辅料基础资料。辅料不再存储在 skus 表。';
comment on table public.bom_items is 'BOM 明细表：记录生产 1 个成品 SKU 需要哪些辅料。辅料通过 material_id 关联 materials。';
comment on table public.material_requirements is '物料需求表：根据生产任务和 BOM 计算需要多少辅料，并通过 material_id 关联 materials。';
comment on column public.purchase_order_items.material_id is '辅料 ID，关联 public.materials.id。采购辅料使用该字段。';
comment on table public.inventory_items is '库存表：保存每个仓库里每个库存对象的当前数量。成品优先用 product_sku_id，辅料优先用 material_id；sku_id 保留给历史库存和成品兼容。';
comment on table public.inventory_transactions is '出入库流水表：成品优先用 product_sku_id，辅料优先用 material_id；sku_id 保留给历史流水和成品兼容。';

commit;
