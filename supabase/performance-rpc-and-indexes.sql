-- 数据读取性能优化：数据库端分页、聚合 RPC 和查询索引。
-- 使用方式：在 Supabase SQL Editor 中执行本文件。

create extension if not exists pg_trgm;

create index if not exists idx_skus_sku_code on public.skus(sku_code);
create index if not exists idx_skus_sku_name on public.skus(sku_name);
create index if not exists idx_skus_amazon_sku on public.skus(amazon_sku);
create index if not exists idx_skus_fnsku on public.skus(fnsku);
create index if not exists idx_products_product_code on public.products(product_code);
create index if not exists idx_products_name on public.products(name);
create index if not exists idx_materials_material_code on public.materials(material_code);
create index if not exists idx_materials_material_name on public.materials(material_name);
create index if not exists idx_inventory_items_sku_id on public.inventory_items(sku_id);
create index if not exists idx_inventory_items_warehouse_id on public.inventory_items(warehouse_id);
create index if not exists idx_inventory_transactions_occurred_at on public.inventory_transactions(occurred_at);

create index if not exists idx_skus_sku_code_trgm on public.skus using gin (sku_code gin_trgm_ops);
create index if not exists idx_skus_sku_name_trgm on public.skus using gin (sku_name gin_trgm_ops);
create index if not exists idx_skus_amazon_sku_trgm on public.skus using gin (amazon_sku gin_trgm_ops);
create index if not exists idx_skus_fnsku_trgm on public.skus using gin (fnsku gin_trgm_ops);
create index if not exists idx_products_product_code_trgm on public.products using gin (product_code gin_trgm_ops);
create index if not exists idx_products_name_trgm on public.products using gin (name gin_trgm_ops);
create index if not exists idx_materials_material_code_trgm on public.materials using gin (material_code gin_trgm_ops);
create index if not exists idx_materials_material_name_trgm on public.materials using gin (material_name gin_trgm_ops);
create index if not exists idx_suppliers_supplier_code_trgm on public.suppliers using gin (supplier_code gin_trgm_ops);
create index if not exists idx_suppliers_name_trgm on public.suppliers using gin (name gin_trgm_ops);
create index if not exists idx_warehouses_warehouse_code_trgm on public.warehouses using gin (warehouse_code gin_trgm_ops);
create index if not exists idx_warehouses_name_trgm on public.warehouses using gin (name gin_trgm_ops);

create or replace function public.get_skus_page(
  p_page integer default 1,
  p_page_size integer default 100,
  p_keyword text default null,
  p_filters jsonb default '{}'::jsonb,
  p_sort_by text default 'sku_code',
  p_sort_direction text default 'asc'
)
returns jsonb
language sql
stable
as $$
with params as (
  select
    greatest(coalesce(p_page, 1), 1) as page,
    least(greatest(coalesce(p_page_size, 100), 1), 100) as page_size,
    nullif(trim(coalesce(p_keyword, '')), '') as keyword,
    nullif(p_filters->>'skuType', 'all') as sku_type,
    nullif(p_filters->>'status', 'all') as status,
    nullif(p_filters->>'brandId', 'all') as brand_id,
    nullif(p_filters->>'productId', 'all') as product_id,
    nullif(p_filters->>'supplierId', 'all') as supplier_id,
    lower(coalesce(nullif(p_sort_by, ''), 'sku_code')) as sort_by,
    lower(coalesce(nullif(p_sort_direction, ''), 'asc')) as sort_direction
),
inventory_summary as (
  select
    coalesce(product_sku_id, sku_id) as sku_id,
    sum(quantity_on_hand)::numeric as quantity_on_hand,
    sum(reserved_quantity)::numeric as reserved_quantity,
    count(*)::integer as inventory_row_count
  from public.inventory_items
  where coalesce(product_sku_id, sku_id) is not null
  group by coalesce(product_sku_id, sku_id)
),
filtered as (
  select
    s.*,
    p.product_code,
    p.name as product_name,
    p.product_image_url,
    p.status as product_status,
    p.brand_id,
    b.brand_code,
    b.name as brand_name,
    b.english_name as brand_english_name,
    b.logo_url as brand_logo_url,
    b.status as brand_status,
    sup.supplier_code,
    sup.name as supplier_name,
    sup.contact_name as supplier_contact_name,
    sup.phone as supplier_phone,
    sup.status as supplier_status,
    coalesce(inv.quantity_on_hand, 0) as inventory_quantity,
    coalesce(inv.reserved_quantity, 0) as reserved_quantity,
    coalesce(inv.inventory_row_count, 0) as inventory_row_count,
    count(*) over ()::integer as total_count
  from public.skus s
  left join public.products p on p.id = s.product_id
  left join public.brands b on b.id = p.brand_id
  left join public.suppliers sup on sup.id = s.default_supplier_id
  left join inventory_summary inv on inv.sku_id = s.id
  cross join params
  where s.sku_type in ('finished_good', 'finished_product', 'semi_finished')
    and (params.sku_type is null or s.sku_type = params.sku_type)
    and (params.status is null or s.status = params.status)
    and (
      params.product_id is null
      or (params.product_id = 'none' and s.product_id is null)
      or s.product_id::text = params.product_id
    )
    and (
      params.brand_id is null
      or (params.brand_id = 'none' and p.brand_id is null)
      or p.brand_id::text = params.brand_id
    )
    and (
      params.supplier_id is null
      or (params.supplier_id = 'none' and s.default_supplier_id is null)
      or s.default_supplier_id::text = params.supplier_id
    )
    and (
      params.keyword is null
      or s.sku_code ilike '%' || params.keyword || '%'
      or s.sku_name ilike '%' || params.keyword || '%'
      or coalesce(s.amazon_sku, '') ilike '%' || params.keyword || '%'
      or coalesce(s.fnsku, '') ilike '%' || params.keyword || '%'
      or coalesce(s.specs, '') ilike '%' || params.keyword || '%'
      or coalesce(p.product_code, '') ilike '%' || params.keyword || '%'
      or coalesce(p.name, '') ilike '%' || params.keyword || '%'
      or coalesce(b.brand_code, '') ilike '%' || params.keyword || '%'
      or coalesce(b.name, '') ilike '%' || params.keyword || '%'
    )
),
paged as (
  select *
  from filtered, params
  order by
    case when params.sort_by = 'sku_name' and params.sort_direction = 'asc' then sku_name end asc,
    case when params.sort_by = 'sku_name' and params.sort_direction = 'desc' then sku_name end desc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'asc' then created_at end asc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'desc' then created_at end desc,
    case when params.sort_by = 'updated_at' and params.sort_direction = 'asc' then updated_at end asc,
    case when params.sort_by = 'updated_at' and params.sort_direction = 'desc' then updated_at end desc,
    case when params.sort_direction = 'desc' then sku_code end desc,
    sku_code asc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'product_id', product_id,
        'default_supplier_id', default_supplier_id,
        'sku_code', sku_code,
        'sku_name', sku_name,
        'sku_type', sku_type,
        'amazon_sku', amazon_sku,
        'fnsku', fnsku,
        'unit', unit,
        'specs', specs,
        'status', status,
        'created_at', created_at,
        'updated_at', updated_at,
        'inventory_quantity', inventory_quantity,
        'reserved_quantity', reserved_quantity,
        'inventory_row_count', inventory_row_count,
        'default_supplier',
          case when default_supplier_id is null then null else jsonb_build_object(
            'id', default_supplier_id,
            'supplier_code', supplier_code,
            'name', supplier_name,
            'contact_name', supplier_contact_name,
            'phone', supplier_phone,
            'status', supplier_status
          ) end,
        'product',
          case when product_id is null then null else jsonb_build_object(
            'id', product_id,
            'brand_id', brand_id,
            'product_code', product_code,
            'name', product_name,
            'product_image_url', product_image_url,
            'status', product_status,
            'brand',
              case when brand_id is null then null else jsonb_build_object(
                'id', brand_id,
                'brand_code', brand_code,
                'name', brand_name,
                'english_name', brand_english_name,
                'logo_url', brand_logo_url,
                'status', brand_status
              ) end
          ) end
      )
    ),
    '[]'::jsonb
  ),
  'total', coalesce(max(total_count), 0),
  'page', (select page from params),
  'pageSize', (select page_size from params),
  'totalPages', greatest(1, ceil(coalesce(max(total_count), 0)::numeric / (select page_size from params))::integer)
)
from paged;
$$;

create or replace function public.get_current_inventory_page(
  p_page integer default 1,
  p_page_size integer default 20,
  p_keyword text default null,
  p_filters jsonb default '{}'::jsonb,
  p_sort_by text default 'updated_at',
  p_sort_direction text default 'desc'
)
returns jsonb
language sql
stable
as $$
with params as (
  select
    greatest(coalesce(p_page, 1), 1) as page,
    least(greatest(coalesce(p_page_size, 20), 1), 100) as page_size,
    nullif(trim(coalesce(p_keyword, '')), '') as keyword,
    coalesce(nullif(p_filters->>'mode', ''), 'products') as mode,
    nullif(p_filters->>'warehouseId', 'all') as warehouse_id,
    nullif(p_filters->>'brandId', 'all') as brand_id,
    nullif(p_filters->>'stockStatus', 'all') as stock_status,
    lower(coalesce(nullif(p_sort_by, ''), 'updated_at')) as sort_by,
    lower(coalesce(nullif(p_sort_direction, ''), 'desc')) as sort_direction
),
joined as (
  select
    ii.*,
    w.warehouse_code,
    w.name as warehouse_name,
    w.warehouse_type,
    w.status as warehouse_status,
    s.product_id as legacy_product_id,
    s.sku_code as legacy_sku_code,
    s.sku_name as legacy_sku_name,
    s.sku_type as legacy_sku_type,
    s.unit as legacy_unit,
    sp.product_code as legacy_product_code,
    sp.name as legacy_product_name,
    sp.brand_id as legacy_brand_id,
    sb.brand_code as legacy_brand_code,
    sb.name as legacy_brand_name,
    sb.english_name as legacy_brand_english_name,
    sb.logo_url as legacy_brand_logo_url,
    sb.status as legacy_brand_status,
    ps.product_id as product_product_id,
    ps.sku_code as product_sku_code,
    ps.sku_name as product_sku_name,
    ps.sku_type as product_sku_type,
    ps.unit as product_sku_unit,
    pp.product_code as product_product_code,
    pp.name as product_product_name,
    pp.brand_id as product_brand_id,
    pb.brand_code as product_brand_code,
    pb.name as product_brand_name,
    pb.english_name as product_brand_english_name,
    pb.logo_url as product_brand_logo_url,
    pb.status as product_brand_status,
    m.material_code,
    m.material_name,
    m.category as material_category,
    m.unit as material_unit,
    m.specs as material_specs,
    m.default_supplier_id as material_default_supplier_id,
    m.status as material_status,
    ms.supplier_code,
    ms.name as supplier_name,
    case
      when coalesce(ii.quantity_on_hand, 0) - coalesce(ii.reserved_quantity, 0) <= 0 then 'out_of_stock'
      when ii.safety_stock_quantity is not null
        and coalesce(ii.quantity_on_hand, 0) - coalesce(ii.reserved_quantity, 0) < ii.safety_stock_quantity then 'low_stock'
      else 'normal'
    end as stock_status
  from public.inventory_items ii
  left join public.warehouses w on w.id = ii.warehouse_id
  left join public.skus s on s.id = ii.sku_id
  left join public.products sp on sp.id = s.product_id
  left join public.brands sb on sb.id = sp.brand_id
  left join public.skus ps on ps.id = ii.product_sku_id
  left join public.products pp on pp.id = ps.product_id
  left join public.brands pb on pb.id = pp.brand_id
  left join public.materials m on m.id = ii.material_id
  left join public.suppliers ms on ms.id = m.default_supplier_id
),
filtered as (
  select joined.*, count(*) over ()::integer as total_count
  from joined, params
  where (
      (params.mode = 'materials' and (
        material_id is not null
        or item_type = 'material'
        or legacy_sku_type = 'material'
      ))
      or (params.mode <> 'materials' and (
        product_sku_id is not null
        or item_type in ('finished_product', 'finished_good', 'product_sku')
        or coalesce(product_sku_type, legacy_sku_type) in ('finished_product', 'finished_good')
      ))
    )
    and (
      params.warehouse_id is null
      or warehouse_id::text = params.warehouse_id
    )
    and (
      params.mode = 'materials'
      or params.brand_id is null
      or (params.brand_id = 'none' and coalesce(product_brand_id, legacy_brand_id) is null)
      or coalesce(product_brand_id, legacy_brand_id)::text = params.brand_id
    )
    and (
      params.mode <> 'materials'
      or params.stock_status is null
      or stock_status = params.stock_status
    )
    and (
      params.keyword is null
      or coalesce(material_code, '') ilike '%' || params.keyword || '%'
      or coalesce(material_name, '') ilike '%' || params.keyword || '%'
      or coalesce(material_specs, '') ilike '%' || params.keyword || '%'
      or coalesce(product_sku_code, legacy_sku_code, '') ilike '%' || params.keyword || '%'
      or coalesce(product_sku_name, legacy_sku_name, '') ilike '%' || params.keyword || '%'
      or coalesce(product_product_name, legacy_product_name, '') ilike '%' || params.keyword || '%'
    )
),
summary as (
  select
    count(distinct coalesce(material_id, product_sku_id, sku_id))::integer as sku_kind_count,
    coalesce(sum(quantity_on_hand), 0)::numeric as total_quantity,
    count(*) filter (where stock_status = 'low_stock')::integer as low_stock_count,
    count(*) filter (where stock_status = 'out_of_stock')::integer as out_of_stock_count,
    count(distinct coalesce(product_sku_id, sku_id)) filter (where quantity_on_hand > 0)::integer as in_stock_sku_count,
    count(distinct coalesce(product_sku_id, sku_id)) filter (where quantity_on_hand <= 0)::integer as out_of_stock_sku_count
  from filtered
),
paged as (
  select *
  from filtered, params
  order by
    case when params.sort_by = 'quantity' and params.sort_direction = 'asc' then quantity_on_hand end asc,
    case when params.sort_by = 'quantity' and params.sort_direction = 'desc' then quantity_on_hand end desc,
    case when params.sort_direction = 'asc' then updated_at end asc,
    updated_at desc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'warehouse_id', warehouse_id,
        'sku_id', sku_id,
        'product_sku_id', product_sku_id,
        'material_id', material_id,
        'item_type', item_type,
        'quantity_on_hand', quantity_on_hand,
        'reserved_quantity', reserved_quantity,
        'safety_stock_quantity', safety_stock_quantity,
        'unit', unit,
        'updated_at', updated_at,
        'stock_status', stock_status,
        'warehouse', jsonb_build_object(
          'id', warehouse_id,
          'warehouse_code', warehouse_code,
          'name', warehouse_name,
          'warehouse_type', warehouse_type,
          'status', warehouse_status
        ),
        'sku',
          case when sku_id is null then null else jsonb_build_object(
            'id', sku_id,
            'product_id', legacy_product_id,
            'sku_code', legacy_sku_code,
            'sku_name', legacy_sku_name,
            'sku_type', legacy_sku_type,
            'unit', legacy_unit,
            'product',
              case when legacy_product_id is null then null else jsonb_build_object(
                'id', legacy_product_id,
                'brand_id', legacy_brand_id,
                'product_code', legacy_product_code,
                'name', legacy_product_name,
                'brand',
                  case when legacy_brand_id is null then null else jsonb_build_object(
                    'id', legacy_brand_id,
                    'brand_code', legacy_brand_code,
                    'name', legacy_brand_name,
                    'english_name', legacy_brand_english_name,
                    'logo_url', legacy_brand_logo_url,
                    'status', legacy_brand_status
                  ) end
              ) end
          ) end,
        'product_sku',
          case when product_sku_id is null then null else jsonb_build_object(
            'id', product_sku_id,
            'product_id', product_product_id,
            'sku_code', product_sku_code,
            'sku_name', product_sku_name,
            'sku_type', product_sku_type,
            'unit', product_sku_unit,
            'product',
              case when product_product_id is null then null else jsonb_build_object(
                'id', product_product_id,
                'brand_id', product_brand_id,
                'product_code', product_product_code,
                'name', product_product_name,
                'brand',
                  case when product_brand_id is null then null else jsonb_build_object(
                    'id', product_brand_id,
                    'brand_code', product_brand_code,
                    'name', product_brand_name,
                    'english_name', product_brand_english_name,
                    'logo_url', product_brand_logo_url,
                    'status', product_brand_status
                  ) end
              ) end
          ) end,
        'material',
          case when material_id is null then null else jsonb_build_object(
            'id', material_id,
            'material_code', material_code,
            'material_name', material_name,
            'category', material_category,
            'unit', material_unit,
            'specs', material_specs,
            'default_supplier_id', material_default_supplier_id,
            'status', material_status,
            'supplier',
              case when material_default_supplier_id is null then null else jsonb_build_object(
                'id', material_default_supplier_id,
                'supplier_code', supplier_code,
                'name', supplier_name
              ) end
          ) end
      )
    ),
    '[]'::jsonb
  ),
  'summary',
    jsonb_build_object(
      'skuKindCount', coalesce((select sku_kind_count from summary), 0),
      'totalQuantity', coalesce((select total_quantity from summary), 0),
      'lowStockCount', coalesce((select low_stock_count from summary), 0),
      'outOfStockCount', coalesce((select out_of_stock_count from summary), 0),
      'inStockSkuCount', coalesce((select in_stock_sku_count from summary), 0),
      'outOfStockSkuCount', coalesce((select out_of_stock_sku_count from summary), 0)
    ),
  'total', coalesce(max(total_count), 0),
  'page', (select page from params),
  'pageSize', (select page_size from params),
  'totalPages', greatest(1, ceil(coalesce(max(total_count), 0)::numeric / (select page_size from params))::integer)
)
from paged;
$$;

create or replace function public.get_inventory_transactions_page(
  p_page integer default 1,
  p_page_size integer default 20,
  p_keyword text default null,
  p_filters jsonb default '{}'::jsonb,
  p_sort_by text default 'occurred_at',
  p_sort_direction text default 'desc'
)
returns jsonb
language sql
stable
as $$
with params as (
  select
    greatest(coalesce(p_page, 1), 1) as page,
    least(greatest(coalesce(p_page_size, 20), 1), 100) as page_size,
    nullif(trim(coalesce(p_keyword, '')), '') as keyword,
    nullif(p_filters->>'transactionType', 'all') as transaction_type,
    nullif(p_filters->>'warehouseId', 'all') as warehouse_id,
    nullif(p_filters->>'brandId', 'all') as brand_id,
    nullif(p_filters->>'startDate', '') as start_date,
    nullif(p_filters->>'endDate', '') as end_date
),
joined as (
  select
    it.*,
    w.warehouse_code,
    w.name as warehouse_name,
    w.warehouse_type,
    w.status as warehouse_status,
    s.product_id as legacy_product_id,
    s.sku_code as legacy_sku_code,
    s.sku_name as legacy_sku_name,
    s.sku_type as legacy_sku_type,
    s.unit as legacy_unit,
    sp.product_code as legacy_product_code,
    sp.name as legacy_product_name,
    sp.brand_id as legacy_brand_id,
    sb.brand_code as legacy_brand_code,
    sb.name as legacy_brand_name,
    sb.english_name as legacy_brand_english_name,
    sb.logo_url as legacy_brand_logo_url,
    sb.status as legacy_brand_status,
    ps.product_id as product_product_id,
    ps.sku_code as product_sku_code,
    ps.sku_name as product_sku_name,
    ps.sku_type as product_sku_type,
    ps.unit as product_sku_unit,
    pp.product_code as product_product_code,
    pp.name as product_product_name,
    pp.brand_id as product_brand_id,
    pb.brand_code as product_brand_code,
    pb.name as product_brand_name,
    pb.english_name as product_brand_english_name,
    pb.logo_url as product_brand_logo_url,
    pb.status as product_brand_status,
    m.material_code,
    m.material_name,
    m.category as material_category,
    m.unit as material_unit,
    m.specs as material_specs,
    m.default_supplier_id as material_default_supplier_id,
    m.status as material_status,
    po.purchase_order_no,
    pr.production_order_no,
    rr.request_no,
    op.full_name as operator_full_name,
    op.email as operator_email
  from public.inventory_transactions it
  left join public.warehouses w on w.id = it.warehouse_id
  left join public.skus s on s.id = it.sku_id
  left join public.products sp on sp.id = s.product_id
  left join public.brands sb on sb.id = sp.brand_id
  left join public.skus ps on ps.id = it.product_sku_id
  left join public.products pp on pp.id = ps.product_id
  left join public.brands pb on pb.id = pp.brand_id
  left join public.materials m on m.id = it.material_id
  left join public.purchase_orders po on po.id = it.purchase_order_id
  left join public.production_orders pr on pr.id = it.production_order_id
  left join public.fba_replenishment_requests rr on rr.id = it.replenishment_request_id
  left join public.profiles op on op.id = it.operator_id
),
filtered as (
  select joined.*, count(*) over ()::integer as total_count
  from joined, params
  where (params.transaction_type is null or transaction_type = params.transaction_type)
    and (params.warehouse_id is null or warehouse_id::text = params.warehouse_id)
    and (
      params.brand_id is null
      or (params.brand_id = 'none' and (material_id is not null or coalesce(product_brand_id, legacy_brand_id) is null))
      or coalesce(product_brand_id, legacy_brand_id)::text = params.brand_id
    )
    and (
      params.start_date is null
      or occurred_at >= (params.start_date::date)::timestamptz
    )
    and (
      params.end_date is null
      or occurred_at < ((params.end_date::date + interval '1 day')::timestamptz)
    )
    and (
      params.keyword is null
      or coalesce(material_code, '') ilike '%' || params.keyword || '%'
      or coalesce(material_name, '') ilike '%' || params.keyword || '%'
      or coalesce(material_specs, '') ilike '%' || params.keyword || '%'
      or coalesce(product_sku_code, legacy_sku_code, '') ilike '%' || params.keyword || '%'
      or coalesce(product_sku_name, legacy_sku_name, '') ilike '%' || params.keyword || '%'
      or coalesce(product_product_name, legacy_product_name, '') ilike '%' || params.keyword || '%'
      or coalesce(transaction_no, '') ilike '%' || params.keyword || '%'
    )
),
summary as (
  select
    count(*) filter (where transaction_type = 'material_in')::integer as material_in,
    count(*) filter (where transaction_type = 'material_out')::integer as material_out,
    count(*) filter (where transaction_type = 'product_in')::integer as product_in,
    count(*) filter (where transaction_type = 'product_out')::integer as product_out,
    count(*) filter (where transaction_type = 'adjustment')::integer as adjustment
  from filtered
),
paged as (
  select *
  from filtered
  order by occurred_at desc, created_at desc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', id,
        'transaction_no', transaction_no,
        'warehouse_id', warehouse_id,
        'sku_id', sku_id,
        'product_sku_id', product_sku_id,
        'material_id', material_id,
        'transaction_type', transaction_type,
        'quantity', quantity,
        'production_order_id', production_order_id,
        'purchase_order_id', purchase_order_id,
        'replenishment_request_id', replenishment_request_id,
        'operator_id', operator_id,
        'occurred_at', occurred_at,
        'notes', notes,
        'created_at', created_at,
        'related_order_type',
          case
            when purchase_order_id is not null then 'purchase_order'
            when production_order_id is not null then 'production_order'
            when replenishment_request_id is not null then 'fba_replenishment_request'
            else null
          end,
        'related_order_no', coalesce(purchase_order_no, production_order_no, request_no),
        'warehouse', jsonb_build_object(
          'id', warehouse_id,
          'warehouse_code', warehouse_code,
          'name', warehouse_name,
          'warehouse_type', warehouse_type,
          'status', warehouse_status
        ),
        'purchase_order',
          case when purchase_order_id is null then null else jsonb_build_object(
            'id', purchase_order_id,
            'purchase_order_no', purchase_order_no
          ) end,
        'production_order',
          case when production_order_id is null then null else jsonb_build_object(
            'id', production_order_id,
            'production_order_no', production_order_no
          ) end,
        'replenishment_request',
          case when replenishment_request_id is null then null else jsonb_build_object(
            'id', replenishment_request_id,
            'request_no', request_no
          ) end,
        'operator',
          case when operator_id is null then null else jsonb_build_object(
            'id', operator_id,
            'full_name', operator_full_name,
            'email', operator_email
          ) end,
        'sku',
          case when sku_id is null then null else jsonb_build_object(
            'id', sku_id,
            'product_id', legacy_product_id,
            'sku_code', legacy_sku_code,
            'sku_name', legacy_sku_name,
            'sku_type', legacy_sku_type,
            'unit', legacy_unit,
            'product',
              case when legacy_product_id is null then null else jsonb_build_object(
                'id', legacy_product_id,
                'brand_id', legacy_brand_id,
                'product_code', legacy_product_code,
                'name', legacy_product_name,
                'brand',
                  case when legacy_brand_id is null then null else jsonb_build_object(
                    'id', legacy_brand_id,
                    'brand_code', legacy_brand_code,
                    'name', legacy_brand_name,
                    'english_name', legacy_brand_english_name,
                    'logo_url', legacy_brand_logo_url,
                    'status', legacy_brand_status
                  ) end
              ) end
          ) end,
        'product_sku',
          case when product_sku_id is null then null else jsonb_build_object(
            'id', product_sku_id,
            'product_id', product_product_id,
            'sku_code', product_sku_code,
            'sku_name', product_sku_name,
            'sku_type', product_sku_type,
            'unit', product_sku_unit,
            'product',
              case when product_product_id is null then null else jsonb_build_object(
                'id', product_product_id,
                'brand_id', product_brand_id,
                'product_code', product_product_code,
                'name', product_product_name,
                'brand',
                  case when product_brand_id is null then null else jsonb_build_object(
                    'id', product_brand_id,
                    'brand_code', product_brand_code,
                    'name', product_brand_name,
                    'english_name', product_brand_english_name,
                    'logo_url', product_brand_logo_url,
                    'status', product_brand_status
                  ) end
              ) end
          ) end,
        'material',
          case when material_id is null then null else jsonb_build_object(
            'id', material_id,
            'material_code', material_code,
            'material_name', material_name,
            'category', material_category,
            'unit', material_unit,
            'specs', material_specs,
            'default_supplier_id', material_default_supplier_id,
            'status', material_status
          ) end
      )
    ),
    '[]'::jsonb
  ),
  'summary',
    jsonb_build_object(
      'material_in', coalesce((select material_in from summary), 0),
      'material_out', coalesce((select material_out from summary), 0),
      'product_in', coalesce((select product_in from summary), 0),
      'product_out', coalesce((select product_out from summary), 0),
      'adjustment', coalesce((select adjustment from summary), 0)
    ),
  'total', coalesce(max(total_count), 0),
  'page', (select page from params),
  'pageSize', (select page_size from params),
  'totalPages', greatest(1, ceil(coalesce(max(total_count), 0)::numeric / (select page_size from params))::integer)
)
from paged;
$$;

create or replace function public.get_dashboard_summary()
returns jsonb
language sql
stable
as $$
with today_value as (
  select current_date as today
),
pending_production_inbound as (
  select count(*)::integer as value
  from public.production_orders po
  left join lateral (
    select
      sum(planned_quantity) as planned_quantity,
      sum(completed_quantity) as completed_quantity
    from public.production_order_items poi
    where poi.production_order_id = po.id
  ) item_totals on true
  where po.status in ('in_progress', 'completed')
    and coalesce(item_totals.completed_quantity, po.completed_quantity, 0)
      < coalesce(item_totals.planned_quantity, po.planned_quantity, 0)
),
inventory_warnings as (
  select
    count(*) filter (
      where material_id is not null
        and quantity_on_hand - reserved_quantity < coalesce(safety_stock_quantity, 0)
    )::integer as low_stock_materials,
    count(*) filter (
      where (product_sku_id is not null or item_type in ('finished_product', 'finished_good'))
        and (quantity_on_hand < 0 or quantity_on_hand < reserved_quantity)
    )::integer as abnormal_finished_stock
  from public.inventory_items
)
select jsonb_build_object(
  'fbaSubmitted', (select count(*) from public.fba_replenishment_requests where status = 'submitted'),
  'fbaAccepted', (select count(*) from public.fba_replenishment_requests where status = 'accepted'),
  'fbaInProduction', (select count(*) from public.fba_replenishment_requests where status = 'in_production'),
  'fbaCompleted', (select count(*) from public.fba_replenishment_requests where status = 'completed'),
  'overdueFba', (
    select count(*) from public.fba_replenishment_requests, today_value
    where status in ('submitted', 'accepted', 'in_production', 'completed')
      and target_ship_date < today_value.today
  ),
  'productionPlanned', (select count(*) from public.production_orders where status = 'planned'),
  'productionMaterialPending', (select count(*) from public.production_orders where status = 'material_pending'),
  'productionInProgress', (select count(*) from public.production_orders where status = 'in_progress'),
  'overdueProduction', (
    select count(*) from public.production_orders, today_value
    where status in ('planned', 'material_pending', 'in_progress')
      and planned_end_date < today_value.today
  ),
  'shortageMaterials', (select count(*) from public.material_requirements where status = 'shortage'),
  'readyMaterials', (select count(*) from public.material_requirements where status in ('ready', 'reserved', 'received')),
  'purchaseDraft', (select count(*) from public.purchase_orders where status = 'draft'),
  'purchaseOrdered', (select count(*) from public.purchase_orders where status in ('ordered', 'partially_received')),
  'overduePurchase', (
    select count(*) from public.purchase_orders, today_value
    where status in ('ordered', 'partially_received')
      and expected_arrival_date < today_value.today
  ),
  'productsWithoutBrand', (select count(*) from public.products where brand_id is null),
  'materialsWithoutSupplier', (select count(*) from public.materials where default_supplier_id is null),
  'inactiveSupplierReferences', (
    select count(*)
    from public.materials m
    join public.suppliers s on s.id = m.default_supplier_id
    where s.status = 'inactive'
  ),
  'missingBomSkus', (
    select count(*)
    from public.skus s
    where s.status = 'active'
      and s.sku_type in ('finished_product', 'finished_good')
      and not exists (
        select 1
        from public.bom_headers bh
        where bh.product_sku_id = s.id
          and bh.status = 'active'
      )
  ),
  'acceptedFbaWithoutProduction', (
    select count(*)
    from public.fba_replenishment_requests r
    where r.status = 'accepted'
      and not exists (
        select 1
        from public.production_orders po
        where po.replenishment_request_id = r.id
      )
  ),
  'lowStockMaterials', (select low_stock_materials from inventory_warnings),
  'abnormalFinishedStock', (select abnormal_finished_stock from inventory_warnings),
  'pendingProductionInbound', (select value from pending_production_inbound)
);
$$;

create or replace function public.get_inventory_warning_summary()
returns jsonb
language sql
stable
as $$
select jsonb_build_object(
  'lowStockMaterials',
    count(*) filter (
      where material_id is not null
        and quantity_on_hand - reserved_quantity < coalesce(safety_stock_quantity, 0)
    ),
  'outOfStockMaterials',
    count(*) filter (
      where material_id is not null
        and quantity_on_hand - reserved_quantity <= 0
    ),
  'abnormalFinishedStock',
    count(*) filter (
      where (product_sku_id is not null or item_type in ('finished_product', 'finished_good'))
        and (quantity_on_hand < 0 or quantity_on_hand < reserved_quantity)
    )
)
from public.inventory_items;
$$;
