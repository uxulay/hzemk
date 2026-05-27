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
    coalesce(ii.product_sku_id, ii.sku_id) as sku_id,
    sum(ii.quantity_on_hand)::numeric as quantity_on_hand,
    sum(ii.reserved_quantity)::numeric as reserved_quantity,
    count(*)::integer as inventory_row_count
  from public.inventory_items ii
  where coalesce(ii.product_sku_id, ii.sku_id) is not null
  group by coalesce(ii.product_sku_id, ii.sku_id)
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
  select filtered.*
  from filtered, params
  order by
    case when params.sort_by = 'sku_name' and params.sort_direction = 'asc' then filtered.sku_name end asc,
    case when params.sort_by = 'sku_name' and params.sort_direction = 'desc' then filtered.sku_name end desc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'asc' then filtered.created_at end asc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'desc' then filtered.created_at end desc,
    case when params.sort_by = 'updated_at' and params.sort_direction = 'asc' then filtered.updated_at end asc,
    case when params.sort_by = 'updated_at' and params.sort_direction = 'desc' then filtered.updated_at end desc,
    case when params.sort_direction = 'desc' then filtered.sku_code end desc,
    filtered.sku_code asc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'product_id', paged.product_id,
        'default_supplier_id', paged.default_supplier_id,
        'sku_code', paged.sku_code,
        'sku_name', paged.sku_name,
        'sku_type', paged.sku_type,
        'amazon_sku', paged.amazon_sku,
        'fnsku', paged.fnsku,
        'unit', paged.unit,
        'specs', paged.specs,
        'status', paged.status,
        'created_at', paged.created_at,
        'updated_at', paged.updated_at,
        'inventory_quantity', paged.inventory_quantity,
        'reserved_quantity', paged.reserved_quantity,
        'inventory_row_count', paged.inventory_row_count,
        'default_supplier',
          case when paged.default_supplier_id is null then null else jsonb_build_object(
            'id', paged.default_supplier_id,
            'supplier_code', paged.supplier_code,
            'name', paged.supplier_name,
            'contact_name', paged.supplier_contact_name,
            'phone', paged.supplier_phone,
            'status', paged.supplier_status
          ) end,
        'product',
          case when paged.product_id is null then null else jsonb_build_object(
            'id', paged.product_id,
            'brand_id', paged.brand_id,
            'product_code', paged.product_code,
            'name', paged.product_name,
            'product_image_url', paged.product_image_url,
            'status', paged.product_status,
            'brand',
              case when paged.brand_id is null then null else jsonb_build_object(
                'id', paged.brand_id,
                'brand_code', paged.brand_code,
                'name', paged.brand_name,
                'english_name', paged.brand_english_name,
                'logo_url', paged.brand_logo_url,
                'status', paged.brand_status
              ) end
          ) end
      )
    ),
    '[]'::jsonb
  ),
  'total', coalesce(max(paged.total_count), 0),
  'page', (select page from params),
  'pageSize', (select page_size from params),
  'totalPages', greatest(1, ceil(coalesce(max(paged.total_count), 0)::numeric / (select page_size from params))::integer)
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
        joined.material_id is not null
        or joined.item_type = 'material'
        or joined.legacy_sku_type = 'material'
      ))
      or (params.mode <> 'materials' and (
        joined.product_sku_id is not null
        or joined.item_type in ('finished_product', 'finished_good', 'product_sku')
        or coalesce(joined.product_sku_type, joined.legacy_sku_type) in ('finished_product', 'finished_good')
      ))
    )
    and (
      params.warehouse_id is null
      or joined.warehouse_id::text = params.warehouse_id
    )
    and (
      params.mode = 'materials'
      or params.brand_id is null
      or (params.brand_id = 'none' and coalesce(joined.product_brand_id, joined.legacy_brand_id) is null)
      or coalesce(joined.product_brand_id, joined.legacy_brand_id)::text = params.brand_id
    )
    and (
      params.mode <> 'materials'
      or params.stock_status is null
      or joined.stock_status = params.stock_status
    )
    and (
      params.keyword is null
      or coalesce(joined.material_code, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.material_name, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.material_specs, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.product_sku_code, joined.legacy_sku_code, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.product_sku_name, joined.legacy_sku_name, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.product_product_name, joined.legacy_product_name, '') ilike '%' || params.keyword || '%'
    )
),
summary as (
  select
    count(distinct coalesce(filtered.material_id, filtered.product_sku_id, filtered.sku_id))::integer as sku_kind_count,
    coalesce(sum(filtered.quantity_on_hand), 0)::numeric as total_quantity,
    count(*) filter (where filtered.stock_status = 'low_stock')::integer as low_stock_count,
    count(*) filter (where filtered.stock_status = 'out_of_stock')::integer as out_of_stock_count,
    count(distinct coalesce(filtered.product_sku_id, filtered.sku_id)) filter (where filtered.quantity_on_hand > 0)::integer as in_stock_sku_count,
    count(distinct coalesce(filtered.product_sku_id, filtered.sku_id)) filter (where filtered.quantity_on_hand <= 0)::integer as out_of_stock_sku_count
  from filtered
),
paged as (
  select filtered.*
  from filtered, params
  order by
    case when params.sort_by = 'quantity' and params.sort_direction = 'asc' then filtered.quantity_on_hand end asc,
    case when params.sort_by = 'quantity' and params.sort_direction = 'desc' then filtered.quantity_on_hand end desc,
    case when params.sort_direction = 'asc' then filtered.updated_at end asc,
    filtered.updated_at desc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'warehouse_id', paged.warehouse_id,
        'sku_id', paged.sku_id,
        'product_sku_id', paged.product_sku_id,
        'material_id', paged.material_id,
        'item_type', paged.item_type,
        'quantity_on_hand', paged.quantity_on_hand,
        'reserved_quantity', paged.reserved_quantity,
        'safety_stock_quantity', paged.safety_stock_quantity,
        'unit', paged.unit,
        'updated_at', paged.updated_at,
        'stock_status', paged.stock_status,
        'warehouse', jsonb_build_object(
          'id', paged.warehouse_id,
          'warehouse_code', paged.warehouse_code,
          'name', paged.warehouse_name,
          'warehouse_type', paged.warehouse_type,
          'status', paged.warehouse_status
        ),
        'sku',
          case when paged.sku_id is null then null else jsonb_build_object(
            'id', paged.sku_id,
            'product_id', paged.legacy_product_id,
            'sku_code', paged.legacy_sku_code,
            'sku_name', paged.legacy_sku_name,
            'sku_type', paged.legacy_sku_type,
            'unit', paged.legacy_unit,
            'product',
              case when paged.legacy_product_id is null then null else jsonb_build_object(
                'id', paged.legacy_product_id,
                'brand_id', paged.legacy_brand_id,
                'product_code', paged.legacy_product_code,
                'name', paged.legacy_product_name,
                'brand',
                  case when paged.legacy_brand_id is null then null else jsonb_build_object(
                    'id', paged.legacy_brand_id,
                    'brand_code', paged.legacy_brand_code,
                    'name', paged.legacy_brand_name,
                    'english_name', paged.legacy_brand_english_name,
                    'logo_url', paged.legacy_brand_logo_url,
                    'status', paged.legacy_brand_status
                  ) end
              ) end
          ) end,
        'product_sku',
          case when paged.product_sku_id is null then null else jsonb_build_object(
            'id', paged.product_sku_id,
            'product_id', paged.product_product_id,
            'sku_code', paged.product_sku_code,
            'sku_name', paged.product_sku_name,
            'sku_type', paged.product_sku_type,
            'unit', paged.product_sku_unit,
            'product',
              case when paged.product_product_id is null then null else jsonb_build_object(
                'id', paged.product_product_id,
                'brand_id', paged.product_brand_id,
                'product_code', paged.product_product_code,
                'name', paged.product_product_name,
                'brand',
                  case when paged.product_brand_id is null then null else jsonb_build_object(
                    'id', paged.product_brand_id,
                    'brand_code', paged.product_brand_code,
                    'name', paged.product_brand_name,
                    'english_name', paged.product_brand_english_name,
                    'logo_url', paged.product_brand_logo_url,
                    'status', paged.product_brand_status
                  ) end
              ) end
          ) end,
        'material',
          case when paged.material_id is null then null else jsonb_build_object(
            'id', paged.material_id,
            'material_code', paged.material_code,
            'material_name', paged.material_name,
            'category', paged.material_category,
            'unit', paged.material_unit,
            'specs', paged.material_specs,
            'default_supplier_id', paged.material_default_supplier_id,
            'status', paged.material_status,
            'supplier',
              case when paged.material_default_supplier_id is null then null else jsonb_build_object(
                'id', paged.material_default_supplier_id,
                'supplier_code', paged.supplier_code,
                'name', paged.supplier_name
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
  'total', coalesce(max(paged.total_count), 0),
  'page', (select page from params),
  'pageSize', (select page_size from params),
  'totalPages', greatest(1, ceil(coalesce(max(paged.total_count), 0)::numeric / (select page_size from params))::integer)
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
  where (params.transaction_type is null or joined.transaction_type = params.transaction_type)
    and (params.warehouse_id is null or joined.warehouse_id::text = params.warehouse_id)
    and (
      params.brand_id is null
      or (params.brand_id = 'none' and (joined.material_id is not null or coalesce(joined.product_brand_id, joined.legacy_brand_id) is null))
      or coalesce(joined.product_brand_id, joined.legacy_brand_id)::text = params.brand_id
    )
    and (
      params.start_date is null
      or joined.occurred_at >= (params.start_date::date)::timestamptz
    )
    and (
      params.end_date is null
      or joined.occurred_at < ((params.end_date::date + interval '1 day')::timestamptz)
    )
    and (
      params.keyword is null
      or coalesce(joined.material_code, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.material_name, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.material_specs, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.product_sku_code, joined.legacy_sku_code, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.product_sku_name, joined.legacy_sku_name, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.product_product_name, joined.legacy_product_name, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.transaction_no, '') ilike '%' || params.keyword || '%'
    )
),
summary as (
  select
    count(*) filter (where filtered.transaction_type = 'material_in')::integer as material_in,
    count(*) filter (where filtered.transaction_type = 'material_out')::integer as material_out,
    count(*) filter (where filtered.transaction_type = 'product_in')::integer as product_in,
    count(*) filter (where filtered.transaction_type = 'product_out')::integer as product_out,
    count(*) filter (where filtered.transaction_type = 'adjustment')::integer as adjustment
  from filtered
),
paged as (
  select filtered.*
  from filtered
  order by filtered.occurred_at desc, filtered.created_at desc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'transaction_no', paged.transaction_no,
        'warehouse_id', paged.warehouse_id,
        'sku_id', paged.sku_id,
        'product_sku_id', paged.product_sku_id,
        'material_id', paged.material_id,
        'transaction_type', paged.transaction_type,
        'quantity', paged.quantity,
        'production_order_id', paged.production_order_id,
        'purchase_order_id', paged.purchase_order_id,
        'replenishment_request_id', paged.replenishment_request_id,
        'operator_id', paged.operator_id,
        'occurred_at', paged.occurred_at,
        'notes', paged.notes,
        'created_at', paged.created_at,
        'related_order_type',
          case
            when paged.purchase_order_id is not null then 'purchase_order'
            when paged.production_order_id is not null then 'production_order'
            when paged.replenishment_request_id is not null then 'fba_replenishment_request'
            else null
          end,
        'related_order_no', coalesce(paged.purchase_order_no, paged.production_order_no, paged.request_no),
        'warehouse', jsonb_build_object(
          'id', paged.warehouse_id,
          'warehouse_code', paged.warehouse_code,
          'name', paged.warehouse_name,
          'warehouse_type', paged.warehouse_type,
          'status', paged.warehouse_status
        ),
        'purchase_order',
          case when paged.purchase_order_id is null then null else jsonb_build_object(
            'id', paged.purchase_order_id,
            'purchase_order_no', paged.purchase_order_no
          ) end,
        'production_order',
          case when paged.production_order_id is null then null else jsonb_build_object(
            'id', paged.production_order_id,
            'production_order_no', paged.production_order_no
          ) end,
        'replenishment_request',
          case when paged.replenishment_request_id is null then null else jsonb_build_object(
            'id', paged.replenishment_request_id,
            'request_no', paged.request_no
          ) end,
        'operator',
          case when paged.operator_id is null then null else jsonb_build_object(
            'id', paged.operator_id,
            'full_name', paged.operator_full_name,
            'email', paged.operator_email
          ) end,
        'sku',
          case when paged.sku_id is null then null else jsonb_build_object(
            'id', paged.sku_id,
            'product_id', paged.legacy_product_id,
            'sku_code', paged.legacy_sku_code,
            'sku_name', paged.legacy_sku_name,
            'sku_type', paged.legacy_sku_type,
            'unit', paged.legacy_unit,
            'product',
              case when paged.legacy_product_id is null then null else jsonb_build_object(
                'id', paged.legacy_product_id,
                'brand_id', paged.legacy_brand_id,
                'product_code', paged.legacy_product_code,
                'name', paged.legacy_product_name,
                'brand',
                  case when paged.legacy_brand_id is null then null else jsonb_build_object(
                    'id', paged.legacy_brand_id,
                    'brand_code', paged.legacy_brand_code,
                    'name', paged.legacy_brand_name,
                    'english_name', paged.legacy_brand_english_name,
                    'logo_url', paged.legacy_brand_logo_url,
                    'status', paged.legacy_brand_status
                  ) end
              ) end
          ) end,
        'product_sku',
          case when paged.product_sku_id is null then null else jsonb_build_object(
            'id', paged.product_sku_id,
            'product_id', paged.product_product_id,
            'sku_code', paged.product_sku_code,
            'sku_name', paged.product_sku_name,
            'sku_type', paged.product_sku_type,
            'unit', paged.product_sku_unit,
            'product',
              case when paged.product_product_id is null then null else jsonb_build_object(
                'id', paged.product_product_id,
                'brand_id', paged.product_brand_id,
                'product_code', paged.product_product_code,
                'name', paged.product_product_name,
                'brand',
                  case when paged.product_brand_id is null then null else jsonb_build_object(
                    'id', paged.product_brand_id,
                    'brand_code', paged.product_brand_code,
                    'name', paged.product_brand_name,
                    'english_name', paged.product_brand_english_name,
                    'logo_url', paged.product_brand_logo_url,
                    'status', paged.product_brand_status
                  ) end
              ) end
          ) end,
        'material',
          case when paged.material_id is null then null else jsonb_build_object(
            'id', paged.material_id,
            'material_code', paged.material_code,
            'material_name', paged.material_name,
            'category', paged.material_category,
            'unit', paged.material_unit,
            'specs', paged.material_specs,
            'default_supplier_id', paged.material_default_supplier_id,
            'status', paged.material_status
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
  'total', coalesce(max(paged.total_count), 0),
  'page', (select page from params),
  'pageSize', (select page_size from params),
  'totalPages', greatest(1, ceil(coalesce(max(paged.total_count), 0)::numeric / (select page_size from params))::integer)
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
      sum(poi.planned_quantity) as planned_quantity,
      sum(poi.completed_quantity) as completed_quantity
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
      where ii.material_id is not null
        and ii.quantity_on_hand - ii.reserved_quantity < coalesce(ii.safety_stock_quantity, 0)
    )::integer as low_stock_materials,
    count(*) filter (
      where (ii.product_sku_id is not null or ii.item_type in ('finished_product', 'finished_good'))
        and (ii.quantity_on_hand < 0 or ii.quantity_on_hand < ii.reserved_quantity)
    )::integer as abnormal_finished_stock
  from public.inventory_items ii
)
select jsonb_build_object(
  'fbaSubmitted', (select count(*) from public.fba_replenishment_requests r where r.status = 'submitted'),
  'fbaAccepted', (select count(*) from public.fba_replenishment_requests r where r.status = 'accepted'),
  'fbaInProduction', (select count(*) from public.fba_replenishment_requests r where r.status = 'in_production'),
  'fbaCompleted', (select count(*) from public.fba_replenishment_requests r where r.status = 'completed'),
  'overdueFba', (
    select count(*) from public.fba_replenishment_requests r, today_value
    where r.status in ('submitted', 'accepted', 'in_production', 'completed')
      and r.target_ship_date < today_value.today
  ),
  'productionPlanned', (select count(*) from public.production_orders po where po.status = 'planned'),
  'productionMaterialPending', (select count(*) from public.production_orders po where po.status = 'material_pending'),
  'productionInProgress', (select count(*) from public.production_orders po where po.status = 'in_progress'),
  'overdueProduction', (
    select count(*) from public.production_orders po, today_value
    where po.status in ('planned', 'material_pending', 'in_progress')
      and po.planned_end_date < today_value.today
  ),
  'shortageMaterials', (select count(*) from public.material_requirements mr where mr.status = 'shortage'),
  'readyMaterials', (select count(*) from public.material_requirements mr where mr.status in ('ready', 'reserved', 'received')),
  'purchaseDraft', (select count(*) from public.purchase_orders po where po.status = 'draft'),
  'purchaseOrdered', (select count(*) from public.purchase_orders po where po.status in ('ordered', 'partially_received')),
  'overduePurchase', (
    select count(*) from public.purchase_orders po, today_value
    where po.status in ('ordered', 'partially_received')
      and po.expected_arrival_date < today_value.today
  ),
  'productsWithoutBrand', (select count(*) from public.products p where p.brand_id is null),
  'materialsWithoutSupplier', (select count(*) from public.materials m where m.default_supplier_id is null),
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
      where ii.material_id is not null
        and ii.quantity_on_hand - ii.reserved_quantity < coalesce(ii.safety_stock_quantity, 0)
    ),
  'outOfStockMaterials',
    count(*) filter (
      where ii.material_id is not null
        and ii.quantity_on_hand - ii.reserved_quantity <= 0
    ),
  'abnormalFinishedStock',
    count(*) filter (
      where (ii.product_sku_id is not null or ii.item_type in ('finished_product', 'finished_good'))
        and (ii.quantity_on_hand < 0 or ii.quantity_on_hand < ii.reserved_quantity)
    )
)
from public.inventory_items ii;
$$;
