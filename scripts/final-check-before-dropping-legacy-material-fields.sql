-- Final safety check before dropping legacy material SKU fields/data.
-- Purpose:
--   Run this script before any destructive cleanup. It lists every legacy
--   material-SKU reference that still needs migration. It does not delete data
--   and does not drop fields.
--
-- How to use:
--   1. Run this in the current development Supabase database only.
--   2. If the summary result is empty, it is safe
--      to run the backup script next.
--   3. If any row is returned, inspect the result set and migrate those rows
--      first. Do not run the backup script or drop script.

begin;

create table if not exists public.legacy_material_final_check_issues (
  check_name text not null,
  table_name text not null,
  legacy_field text not null,
  row_id uuid,
  legacy_sku_id uuid,
  material_id uuid,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

alter table public.legacy_material_final_check_issues enable row level security;

truncate table public.legacy_material_final_check_issues;

with legacy_material_skus as (
  select id, sku_code, sku_name
  from public.skus
  where sku_type = 'material'
)
insert into public.legacy_material_final_check_issues (
  check_name, table_name, legacy_field, row_id, legacy_sku_id, material_id, details
)
select
  'bom_items_component_sku_without_material',
  'bom_items',
  'component_sku_id',
  item.id,
  item.component_sku_id,
  item.material_id,
  jsonb_build_object(
    'bom_header_id', item.bom_header_id,
    'legacy_sku_code', sku.sku_code,
    'legacy_sku_name', sku.sku_name
  )
from public.bom_items item
join legacy_material_skus sku on sku.id = item.component_sku_id
where item.component_sku_id is not null
  and item.material_id is null;

with legacy_material_skus as (
  select id, sku_code, sku_name
  from public.skus
  where sku_type = 'material'
)
insert into public.legacy_material_final_check_issues (
  check_name, table_name, legacy_field, row_id, legacy_sku_id, material_id, details
)
select
  'material_requirements_material_sku_without_material',
  'material_requirements',
  'material_sku_id',
  requirement.id,
  requirement.material_sku_id,
  requirement.material_id,
  jsonb_build_object(
    'production_order_id', requirement.production_order_id,
    'status', requirement.status,
    'legacy_sku_code', sku.sku_code,
    'legacy_sku_name', sku.sku_name
  )
from public.material_requirements requirement
join legacy_material_skus sku on sku.id = requirement.material_sku_id
where requirement.material_sku_id is not null
  and requirement.material_id is null;

with legacy_material_skus as (
  select id, sku_code, sku_name
  from public.skus
  where sku_type = 'material'
)
insert into public.legacy_material_final_check_issues (
  check_name, table_name, legacy_field, row_id, legacy_sku_id, material_id, details
)
select
  'purchase_order_items_material_sku_without_material',
  'purchase_order_items',
  'sku_id',
  item.id,
  item.sku_id,
  item.material_id,
  jsonb_build_object(
    'purchase_order_id', item.purchase_order_id,
    'material_requirement_id', item.material_requirement_id,
    'legacy_sku_code', sku.sku_code,
    'legacy_sku_name', sku.sku_name
  )
from public.purchase_order_items item
join legacy_material_skus sku on sku.id = item.sku_id
where item.sku_id is not null
  and item.material_id is null;

with legacy_material_skus as (
  select id, sku_code, sku_name
  from public.skus
  where sku_type = 'material'
)
insert into public.legacy_material_final_check_issues (
  check_name, table_name, legacy_field, row_id, legacy_sku_id, material_id, details
)
select
  'inventory_items_material_sku_without_material',
  'inventory_items',
  'sku_id',
  item.id,
  item.sku_id,
  item.material_id,
  jsonb_build_object(
    'warehouse_id', item.warehouse_id,
    'item_type', item.item_type,
    'quantity_on_hand', item.quantity_on_hand,
    'reserved_quantity', item.reserved_quantity,
    'legacy_sku_code', sku.sku_code,
    'legacy_sku_name', sku.sku_name
  )
from public.inventory_items item
join legacy_material_skus sku on sku.id = item.sku_id
where item.sku_id is not null
  and item.material_id is null;

with legacy_material_skus as (
  select id, sku_code, sku_name
  from public.skus
  where sku_type = 'material'
)
insert into public.legacy_material_final_check_issues (
  check_name, table_name, legacy_field, row_id, legacy_sku_id, material_id, details
)
select
  'inventory_transactions_material_sku_without_material',
  'inventory_transactions',
  'sku_id',
  transaction.id,
  transaction.sku_id,
  transaction.material_id,
  jsonb_build_object(
    'transaction_no', transaction.transaction_no,
    'warehouse_id', transaction.warehouse_id,
    'transaction_type', transaction.transaction_type,
    'quantity', transaction.quantity,
    'legacy_sku_code', sku.sku_code,
    'legacy_sku_name', sku.sku_name
  )
from public.inventory_transactions transaction
join legacy_material_skus sku on sku.id = transaction.sku_id
where transaction.sku_id is not null
  and transaction.material_id is null;

-- Any remaining reference to old material SKU rows blocks deletion.
with legacy_material_skus as (
  select id, sku_code, sku_name
  from public.skus
  where sku_type = 'material'
),
legacy_refs as (
  select 'bom_items' as table_name, 'component_sku_id' as legacy_field,
    item.id as row_id, item.component_sku_id as legacy_sku_id, item.material_id,
    jsonb_build_object('bom_header_id', item.bom_header_id) as details
  from public.bom_items item
  join legacy_material_skus sku on sku.id = item.component_sku_id
  where item.material_id is null
  union all
  select 'material_requirements', 'material_sku_id',
    requirement.id, requirement.material_sku_id, requirement.material_id,
    jsonb_build_object('production_order_id', requirement.production_order_id, 'status', requirement.status)
  from public.material_requirements requirement
  join legacy_material_skus sku on sku.id = requirement.material_sku_id
  where requirement.material_id is null
  union all
  select 'purchase_order_items', 'sku_id',
    item.id, item.sku_id, item.material_id,
    jsonb_build_object('purchase_order_id', item.purchase_order_id)
  from public.purchase_order_items item
  join legacy_material_skus sku on sku.id = item.sku_id
  where item.material_id is null
  union all
  select 'inventory_items', 'sku_id',
    item.id, item.sku_id, item.material_id,
    jsonb_build_object('warehouse_id', item.warehouse_id, 'quantity_on_hand', item.quantity_on_hand)
  from public.inventory_items item
  join legacy_material_skus sku on sku.id = item.sku_id
  where item.material_id is null
  union all
  select 'inventory_transactions', 'sku_id',
    transaction.id, transaction.sku_id, transaction.material_id,
    jsonb_build_object('transaction_no', transaction.transaction_no, 'transaction_type', transaction.transaction_type)
  from public.inventory_transactions transaction
  join legacy_material_skus sku on sku.id = transaction.sku_id
  where transaction.material_id is null
)
insert into public.legacy_material_final_check_issues (
  check_name, table_name, legacy_field, row_id, legacy_sku_id, material_id, details
)
select
  'legacy_material_sku_still_referenced',
  legacy_refs.table_name,
  legacy_refs.legacy_field,
  legacy_refs.row_id,
  legacy_refs.legacy_sku_id,
  legacy_refs.material_id,
  legacy_refs.details
from legacy_refs;

select
  check_name,
  table_name,
  legacy_field,
  count(*) as issue_count
from public.legacy_material_final_check_issues
group by check_name, table_name, legacy_field
order by table_name, legacy_field, check_name;

select *
from public.legacy_material_final_check_issues
order by table_name, legacy_field, row_id
limit 200;

do $$
declare
  issue_count integer;
begin
  select count(*) into issue_count
  from public.legacy_material_final_check_issues;

  if issue_count > 0 then
    raise notice
      'Final legacy material check found % unmigrated legacy references. Stop here. Do not run backup or drop scripts.',
      issue_count;
  else
    raise notice 'Final legacy material check passed: 0 unmigrated legacy references found.';
  end if;
end $$;

commit;
