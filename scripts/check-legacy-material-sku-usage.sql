-- Check legacy references to old skus.sku_type = 'material' rows.
-- This script only reports data. It does not update or delete anything.

with legacy_material_skus as (
  select
    id,
    sku_code,
    sku_name
  from public.skus
  where sku_type = 'material'
),
legacy_usage as (
  select
    'bom_items.component_sku_id' as legacy_field,
    sku.id as legacy_sku_id,
    sku.sku_code,
    sku.sku_name,
    count(item.id)::bigint as reference_count
  from legacy_material_skus sku
  join public.bom_items item on item.component_sku_id = sku.id
  group by sku.id, sku.sku_code, sku.sku_name

  union all

  select
    'material_requirements.material_sku_id' as legacy_field,
    sku.id as legacy_sku_id,
    sku.sku_code,
    sku.sku_name,
    count(requirement.id)::bigint as reference_count
  from legacy_material_skus sku
  join public.material_requirements requirement on requirement.material_sku_id = sku.id
  group by sku.id, sku.sku_code, sku.sku_name

  union all

  select
    'purchase_order_items.sku_id' as legacy_field,
    sku.id as legacy_sku_id,
    sku.sku_code,
    sku.sku_name,
    count(item.id)::bigint as reference_count
  from legacy_material_skus sku
  join public.purchase_order_items item on item.sku_id = sku.id
  group by sku.id, sku.sku_code, sku.sku_name

  union all

  select
    'inventory_items.sku_id' as legacy_field,
    sku.id as legacy_sku_id,
    sku.sku_code,
    sku.sku_name,
    count(item.id)::bigint as reference_count
  from legacy_material_skus sku
  join public.inventory_items item on item.sku_id = sku.id
  group by sku.id, sku.sku_code, sku.sku_name

  union all

  select
    'inventory_transactions.sku_id' as legacy_field,
    sku.id as legacy_sku_id,
    sku.sku_code,
    sku.sku_name,
    count(transaction.id)::bigint as reference_count
  from legacy_material_skus sku
  join public.inventory_transactions transaction on transaction.sku_id = sku.id
  group by sku.id, sku.sku_code, sku.sku_name
)
select
  legacy_field,
  legacy_sku_id,
  sku_code,
  sku_name,
  reference_count
from legacy_usage
order by legacy_field, sku_code;
