-- Backup legacy material SKU data before dropping old fields/data.
-- Purpose:
--   This script copies old material-SKU rows and old material-link fields into
--   backup tables before destructive cleanup.
--
-- Restore notes:
--   Each backup row has backup_run_id and backup_created_at. To inspect a run:
--     select * from public.legacy_material_skus_backup
--     where backup_run_id = '<run id>';
--   To restore key fields, join the backup table by original id and update the
--   target table manually. Example:
--     update public.bom_items item
--     set component_sku_id = backup.component_sku_id
--     from public.legacy_bom_items_material_fields_backup backup
--     where backup.backup_run_id = '<run id>'
--       and backup.id = item.id;
--
-- Important:
--   Do not delete old backup rows. Run IDs keep each backup separated.

begin;

create extension if not exists "pgcrypto";

create table if not exists public.legacy_material_backup_runs (
  backup_run_id uuid primary key,
  backup_created_at timestamptz not null default now(),
  purpose text not null
);

create table if not exists public.legacy_material_skus_backup (
  backup_run_id uuid not null,
  backup_created_at timestamptz not null default now(),
  id uuid not null,
  product_id uuid,
  default_supplier_id uuid,
  sku_code text,
  sku_name text,
  sku_type text,
  amazon_sku text,
  fnsku text,
  unit text,
  specs text,
  status text,
  created_at timestamptz,
  updated_at timestamptz,
  primary key (backup_run_id, id)
);

create table if not exists public.legacy_bom_items_material_fields_backup (
  backup_run_id uuid not null,
  backup_created_at timestamptz not null default now(),
  id uuid not null,
  bom_header_id uuid,
  component_sku_id uuid,
  material_id uuid,
  quantity_per numeric(18, 4),
  unit text,
  loss_rate numeric(8, 4),
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  primary key (backup_run_id, id)
);

create table if not exists public.legacy_material_requirements_fields_backup (
  backup_run_id uuid not null,
  backup_created_at timestamptz not null default now(),
  id uuid not null,
  production_order_id uuid,
  replenishment_request_id uuid,
  material_sku_id uuid,
  material_id uuid,
  required_quantity numeric(18, 4),
  available_quantity numeric(18, 4),
  shortage_quantity numeric(18, 4),
  reserved_quantity numeric(18, 4),
  unit text,
  status text,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  primary key (backup_run_id, id)
);

create table if not exists public.legacy_purchase_order_items_material_fields_backup (
  backup_run_id uuid not null,
  backup_created_at timestamptz not null default now(),
  id uuid not null,
  purchase_order_id uuid,
  sku_id uuid,
  material_id uuid,
  material_requirement_id uuid,
  ordered_quantity numeric(18, 4),
  received_quantity numeric(18, 4),
  unit text,
  unit_price numeric(18, 4),
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  primary key (backup_run_id, id)
);

create table if not exists public.legacy_inventory_items_material_fields_backup (
  backup_run_id uuid not null,
  backup_created_at timestamptz not null default now(),
  id uuid not null,
  warehouse_id uuid,
  sku_id uuid,
  material_id uuid,
  product_sku_id uuid,
  item_type text,
  quantity_on_hand numeric(18, 4),
  reserved_quantity numeric(18, 4),
  safety_stock_quantity numeric(18, 4),
  unit text,
  created_at timestamptz,
  updated_at timestamptz,
  primary key (backup_run_id, id)
);

create table if not exists public.legacy_inventory_transactions_material_fields_backup (
  backup_run_id uuid not null,
  backup_created_at timestamptz not null default now(),
  id uuid not null,
  transaction_no text,
  warehouse_id uuid,
  sku_id uuid,
  material_id uuid,
  product_sku_id uuid,
  item_type text,
  transaction_type text,
  quantity numeric(18, 4),
  production_order_id uuid,
  purchase_order_id uuid,
  replenishment_request_id uuid,
  operator_id uuid,
  occurred_at timestamptz,
  notes text,
  created_at timestamptz,
  updated_at timestamptz,
  primary key (backup_run_id, id)
);

do $$
declare
  run_id uuid := gen_random_uuid();
begin
  insert into public.legacy_material_backup_runs (backup_run_id, purpose)
  values (run_id, 'Backup before dropping legacy material SKU fields/data');

  insert into public.legacy_material_skus_backup (
    backup_run_id, id, product_id, default_supplier_id, sku_code, sku_name,
    sku_type, amazon_sku, fnsku, unit, specs, status, created_at, updated_at
  )
  select
    run_id, id, product_id, default_supplier_id, sku_code, sku_name,
    sku_type, amazon_sku, fnsku, unit, specs, status, created_at, updated_at
  from public.skus
  where sku_type = 'material';

  insert into public.legacy_bom_items_material_fields_backup (
    backup_run_id, id, bom_header_id, component_sku_id, material_id,
    quantity_per, unit, loss_rate, notes, created_at, updated_at
  )
  select
    run_id, id, bom_header_id, component_sku_id, material_id,
    quantity_per, unit, loss_rate, notes, created_at, updated_at
  from public.bom_items;

  insert into public.legacy_material_requirements_fields_backup (
    backup_run_id, id, production_order_id, replenishment_request_id,
    material_sku_id, material_id, required_quantity, available_quantity,
    shortage_quantity, reserved_quantity, unit, status, notes, created_at,
    updated_at
  )
  select
    run_id, id, production_order_id, replenishment_request_id,
    material_sku_id, material_id, required_quantity, available_quantity,
    shortage_quantity, reserved_quantity, unit, status, notes, created_at,
    updated_at
  from public.material_requirements;

  insert into public.legacy_purchase_order_items_material_fields_backup (
    backup_run_id, id, purchase_order_id, sku_id, material_id,
    material_requirement_id, ordered_quantity, received_quantity, unit,
    unit_price, notes, created_at, updated_at
  )
  select
    run_id, id, purchase_order_id, sku_id, material_id,
    material_requirement_id, ordered_quantity, received_quantity, unit,
    unit_price, notes, created_at, updated_at
  from public.purchase_order_items;

  insert into public.legacy_inventory_items_material_fields_backup (
    backup_run_id, id, warehouse_id, sku_id, material_id, product_sku_id,
    item_type, quantity_on_hand, reserved_quantity, safety_stock_quantity,
    unit, created_at, updated_at
  )
  select
    run_id, id, warehouse_id, sku_id, material_id, product_sku_id,
    item_type, quantity_on_hand, reserved_quantity, safety_stock_quantity,
    unit, created_at, updated_at
  from public.inventory_items;

  insert into public.legacy_inventory_transactions_material_fields_backup (
    backup_run_id, id, transaction_no, warehouse_id, sku_id, material_id,
    product_sku_id, item_type, transaction_type, quantity, production_order_id,
    purchase_order_id, replenishment_request_id, operator_id, occurred_at,
    notes, created_at, updated_at
  )
  select
    run_id, id, transaction_no, warehouse_id, sku_id, material_id,
    product_sku_id,
    case
      when material_id is not null then 'material'
      when product_sku_id is not null then 'finished_product'
      else null
    end,
    transaction_type, quantity, production_order_id, purchase_order_id,
    replenishment_request_id, operator_id, occurred_at, notes, created_at,
    updated_at
  from public.inventory_transactions;

  raise notice 'Legacy material backup completed. backup_run_id=%', run_id;
end $$;

commit;
