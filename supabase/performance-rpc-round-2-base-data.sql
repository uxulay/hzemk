-- 第二轮数据读取性能优化：基础资料和 BOM 分页、聚合、索引。
-- 使用方式：在 Supabase SQL Editor 中执行本文件。

create extension if not exists pg_trgm;

create index if not exists idx_materials_material_code on public.materials(material_code);
create index if not exists idx_materials_material_name on public.materials(material_name);
create index if not exists idx_materials_default_supplier_id on public.materials(default_supplier_id);
create index if not exists idx_brands_brand_code on public.brands(brand_code);
create index if not exists idx_brands_name on public.brands(name);
create index if not exists idx_warehouses_warehouse_code on public.warehouses(warehouse_code);
create index if not exists idx_warehouses_name on public.warehouses(name);
create index if not exists idx_bom_headers_product_sku_id on public.bom_headers(product_sku_id);
create index if not exists idx_bom_headers_status on public.bom_headers(status);
create index if not exists idx_bom_items_bom_header_id on public.bom_items(bom_header_id);
create index if not exists idx_bom_items_material_id on public.bom_items(material_id);

create index if not exists idx_materials_material_code_trgm on public.materials using gin (material_code gin_trgm_ops);
create index if not exists idx_materials_material_name_trgm on public.materials using gin (material_name gin_trgm_ops);
create index if not exists idx_materials_category_trgm on public.materials using gin (category gin_trgm_ops);
create index if not exists idx_materials_specs_trgm on public.materials using gin (specs gin_trgm_ops);
create index if not exists idx_brands_brand_code_trgm on public.brands using gin (brand_code gin_trgm_ops);
create index if not exists idx_brands_name_trgm on public.brands using gin (name gin_trgm_ops);
create index if not exists idx_brands_english_name_trgm on public.brands using gin (english_name gin_trgm_ops);
create index if not exists idx_warehouses_warehouse_code_trgm on public.warehouses using gin (warehouse_code gin_trgm_ops);
create index if not exists idx_warehouses_name_trgm on public.warehouses using gin (name gin_trgm_ops);
create index if not exists idx_bom_headers_bom_code_trgm on public.bom_headers using gin (bom_code gin_trgm_ops);
create index if not exists idx_bom_headers_version_trgm on public.bom_headers using gin (version gin_trgm_ops);

create or replace function public.get_materials_page(
  p_page integer default 1,
  p_page_size integer default 20,
  p_keyword text default null,
  p_filters jsonb default '{}'::jsonb,
  p_sort_by text default 'material_code',
  p_sort_direction text default 'asc'
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
    nullif(p_filters->>'category', 'all') as category,
    nullif(p_filters->>'supplierId', 'all') as supplier_id,
    nullif(p_filters->>'status', 'all') as status,
    lower(coalesce(nullif(p_sort_by, ''), 'material_code')) as sort_by,
    lower(coalesce(nullif(p_sort_direction, ''), 'asc')) as sort_direction
),
inventory_summary as (
  select
    ii.material_id,
    sum(ii.quantity_on_hand)::numeric as inventory_quantity,
    sum(ii.reserved_quantity)::numeric as reserved_quantity,
    sum(ii.safety_stock_quantity)::numeric as safety_stock_quantity,
    count(*)::integer as inventory_row_count
  from public.inventory_items ii
  where ii.material_id is not null
  group by ii.material_id
),
bom_usage as (
  select bi.material_id, count(*)::integer as usage_count
  from public.bom_items bi
  where bi.material_id is not null
  group by bi.material_id
),
requirement_usage as (
  select mr.material_id, count(*)::integer as usage_count
  from public.material_requirements mr
  where mr.material_id is not null
  group by mr.material_id
),
purchase_usage as (
  select poi.material_id, count(*)::integer as usage_count
  from public.purchase_order_items poi
  where poi.material_id is not null
  group by poi.material_id
),
filtered as (
  select
    m.id,
    m.default_supplier_id,
    m.material_code,
    m.material_name,
    m.category,
    m.unit,
    m.specs,
    m.status,
    m.notes,
    m.created_at,
    m.updated_at,
    sup.supplier_code,
    sup.name as supplier_name,
    sup.contact_name as supplier_contact_name,
    sup.phone as supplier_phone,
    sup.status as supplier_status,
    coalesce(inv.inventory_quantity, 0) as inventory_quantity,
    coalesce(inv.reserved_quantity, 0) as reserved_quantity,
    coalesce(inv.safety_stock_quantity, 0) as safety_stock_quantity,
    coalesce(inv.inventory_row_count, 0) as inventory_row_count,
    coalesce(bu.usage_count, 0) as bom_usage_count,
    coalesce(ru.usage_count, 0) as material_requirement_usage_count,
    coalesce(pu.usage_count, 0) as purchase_usage_count
  from public.materials m
  left join public.suppliers sup on sup.id = m.default_supplier_id
  left join inventory_summary inv on inv.material_id = m.id
  left join bom_usage bu on bu.material_id = m.id
  left join requirement_usage ru on ru.material_id = m.id
  left join purchase_usage pu on pu.material_id = m.id
  cross join params
  where (params.status is null or m.status = params.status)
    and (params.category is null or m.category = params.category)
    and (
      params.supplier_id is null
      or (params.supplier_id = 'none' and m.default_supplier_id is null)
      or m.default_supplier_id::text = params.supplier_id
    )
    and (
      params.keyword is null
      or m.material_code ilike '%' || params.keyword || '%'
      or m.material_name ilike '%' || params.keyword || '%'
      or coalesce(m.category, '') ilike '%' || params.keyword || '%'
      or coalesce(m.specs, '') ilike '%' || params.keyword || '%'
      or coalesce(sup.supplier_code, '') ilike '%' || params.keyword || '%'
      or coalesce(sup.name, '') ilike '%' || params.keyword || '%'
    )
),
filtered_count as (
  select count(*)::integer as total from filtered
),
summary as (
  select
    count(*)::integer as total_materials,
    count(*) filter (where m.status = 'active')::integer as active_materials,
    count(*) filter (where m.status = 'inactive')::integer as inactive_materials,
    count(*) filter (where coalesce(inv.inventory_quantity, 0) > 0)::integer as in_stock_materials,
    count(*) filter (
      where coalesce(inv.safety_stock_quantity, 0) > 0
        and coalesce(inv.inventory_quantity, 0) < coalesce(inv.safety_stock_quantity, 0)
    )::integer as low_stock_materials
  from public.materials m
  left join inventory_summary inv on inv.material_id = m.id
),
paged as (
  select filtered.*
  from filtered, params
  order by
    case when params.sort_by = 'material_name' and params.sort_direction = 'asc' then filtered.material_name end asc,
    case when params.sort_by = 'material_name' and params.sort_direction = 'desc' then filtered.material_name end desc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'asc' then filtered.created_at end asc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'desc' then filtered.created_at end desc,
    case when params.sort_direction = 'desc' then filtered.material_code end desc,
    filtered.material_code asc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'default_supplier_id', paged.default_supplier_id,
        'material_code', paged.material_code,
        'material_name', paged.material_name,
        'sku_code', paged.material_code,
        'sku_name', paged.material_name,
        'category', paged.category,
        'unit', paged.unit,
        'specs', paged.specs,
        'status', paged.status,
        'notes', paged.notes,
        'created_at', paged.created_at,
        'updated_at', paged.updated_at,
        'inventory_quantity', paged.inventory_quantity,
        'reserved_quantity', paged.reserved_quantity,
        'safety_stock_quantity', paged.safety_stock_quantity,
        'inventory_row_count', paged.inventory_row_count,
        'bom_usage_count', paged.bom_usage_count,
        'material_requirement_usage_count', paged.material_requirement_usage_count,
        'purchase_usage_count', paged.purchase_usage_count,
        'default_supplier',
          case when paged.default_supplier_id is null then null else jsonb_build_object(
            'id', paged.default_supplier_id,
            'supplier_code', paged.supplier_code,
            'name', paged.supplier_name,
            'contact_name', paged.supplier_contact_name,
            'phone', paged.supplier_phone,
            'status', paged.supplier_status
          ) end
      )
    ),
    '[]'::jsonb
  ),
  'total', (select filtered_count.total from filtered_count),
  'page', (select params.page from params),
  'pageSize', (select params.page_size from params),
  'totalPages', greatest(1, ceil((select filtered_count.total from filtered_count)::numeric / (select params.page_size from params))::integer),
  'summary', jsonb_build_object(
    'totalMaterials', (select summary.total_materials from summary),
    'activeMaterials', (select summary.active_materials from summary),
    'inactiveMaterials', (select summary.inactive_materials from summary),
    'inStockMaterials', (select summary.in_stock_materials from summary),
    'lowStockMaterials', (select summary.low_stock_materials from summary)
  )
)
from paged;
$$;

create or replace function public.get_brands_page(
  p_page integer default 1,
  p_page_size integer default 20,
  p_keyword text default null,
  p_filters jsonb default '{}'::jsonb,
  p_sort_by text default 'brand_code',
  p_sort_direction text default 'asc'
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
    nullif(p_filters->>'status', 'all') as status,
    lower(coalesce(nullif(p_sort_by, ''), 'brand_code')) as sort_by,
    lower(coalesce(nullif(p_sort_direction, ''), 'asc')) as sort_direction
),
product_counts as (
  select p.brand_id, count(*)::integer as product_count
  from public.products p
  where p.brand_id is not null
  group by p.brand_id
),
filtered as (
  select
    b.id,
    b.brand_code,
    b.name,
    b.english_name,
    b.logo_url,
    b.status,
    b.notes,
    b.created_at,
    b.updated_at,
    coalesce(pc.product_count, 0) as product_count
  from public.brands b
  left join product_counts pc on pc.brand_id = b.id
  cross join params
  where (params.status is null or b.status = params.status)
    and (
      params.keyword is null
      or b.brand_code ilike '%' || params.keyword || '%'
      or b.name ilike '%' || params.keyword || '%'
      or coalesce(b.english_name, '') ilike '%' || params.keyword || '%'
    )
),
filtered_count as (
  select count(*)::integer as total from filtered
),
summary as (
  select
    count(*)::integer as total_brands,
    count(*) filter (where b.status = 'active')::integer as active_brands,
    count(*) filter (where b.status = 'inactive')::integer as inactive_brands,
    (select count(*)::integer from public.products p where p.brand_id is not null) as total_linked_products
  from public.brands b
),
paged as (
  select filtered.*
  from filtered, params
  order by
    case when params.sort_by = 'name' and params.sort_direction = 'asc' then filtered.name end asc,
    case when params.sort_by = 'name' and params.sort_direction = 'desc' then filtered.name end desc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'asc' then filtered.created_at end asc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'desc' then filtered.created_at end desc,
    case when params.sort_direction = 'desc' then filtered.brand_code end desc,
    filtered.brand_code asc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'brand_code', paged.brand_code,
        'name', paged.name,
        'english_name', paged.english_name,
        'logo_url', paged.logo_url,
        'status', paged.status,
        'notes', paged.notes,
        'created_at', paged.created_at,
        'updated_at', paged.updated_at,
        'product_count', paged.product_count
      )
    ),
    '[]'::jsonb
  ),
  'total', (select filtered_count.total from filtered_count),
  'page', (select params.page from params),
  'pageSize', (select params.page_size from params),
  'totalPages', greatest(1, ceil((select filtered_count.total from filtered_count)::numeric / (select params.page_size from params))::integer),
  'summary', jsonb_build_object(
    'totalBrands', (select summary.total_brands from summary),
    'activeBrands', (select summary.active_brands from summary),
    'inactiveBrands', (select summary.inactive_brands from summary),
    'totalLinkedProducts', (select summary.total_linked_products from summary)
  )
)
from paged;
$$;

create or replace function public.get_warehouses_page(
  p_page integer default 1,
  p_page_size integer default 20,
  p_keyword text default null,
  p_filters jsonb default '{}'::jsonb,
  p_sort_by text default 'warehouse_code',
  p_sort_direction text default 'asc'
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
    nullif(p_filters->>'warehouseType', 'all') as warehouse_type,
    nullif(p_filters->>'status', 'all') as status,
    lower(coalesce(nullif(p_sort_by, ''), 'warehouse_code')) as sort_by,
    lower(coalesce(nullif(p_sort_direction, ''), 'asc')) as sort_direction
),
inventory_summary as (
  select
    ii.warehouse_id,
    count(distinct coalesce(ii.product_sku_id, ii.sku_id, ii.material_id))::integer as inventory_sku_count,
    sum(ii.quantity_on_hand)::numeric as inventory_total_quantity
  from public.inventory_items ii
  group by ii.warehouse_id
),
filtered as (
  select
    w.id,
    w.warehouse_code,
    w.name,
    w.warehouse_type,
    w.address,
    w.status,
    w.created_at,
    w.updated_at,
    coalesce(inv.inventory_sku_count, 0) as inventory_sku_count,
    coalesce(inv.inventory_total_quantity, 0) as inventory_total_quantity
  from public.warehouses w
  left join inventory_summary inv on inv.warehouse_id = w.id
  cross join params
  where (params.status is null or w.status = params.status)
    and (params.warehouse_type is null or w.warehouse_type = params.warehouse_type)
    and (
      params.keyword is null
      or w.warehouse_code ilike '%' || params.keyword || '%'
      or w.name ilike '%' || params.keyword || '%'
      or coalesce(w.address, '') ilike '%' || params.keyword || '%'
    )
),
filtered_count as (
  select count(*)::integer as total from filtered
),
summary as (
  select
    count(*)::integer as total_warehouses,
    count(*) filter (where w.warehouse_type = 'material')::integer as material_warehouses,
    count(*) filter (where w.warehouse_type in ('finished_good', 'finished_product'))::integer as finished_good_warehouses,
    count(*) filter (where w.warehouse_type in ('fba', 'fba_staging'))::integer as fba_staging_warehouses,
    count(*) filter (where coalesce(inv.inventory_total_quantity, 0) > 0)::integer as warehouses_with_inventory
  from public.warehouses w
  left join inventory_summary inv on inv.warehouse_id = w.id
),
paged as (
  select filtered.*
  from filtered, params
  order by
    case when params.sort_by = 'name' and params.sort_direction = 'asc' then filtered.name end asc,
    case when params.sort_by = 'name' and params.sort_direction = 'desc' then filtered.name end desc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'asc' then filtered.created_at end asc,
    case when params.sort_by = 'created_at' and params.sort_direction = 'desc' then filtered.created_at end desc,
    case when params.sort_direction = 'desc' then filtered.warehouse_code end desc,
    filtered.warehouse_code asc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'warehouse_code', paged.warehouse_code,
        'name', paged.name,
        'warehouse_type', paged.warehouse_type,
        'address', paged.address,
        'status', paged.status,
        'created_at', paged.created_at,
        'updated_at', paged.updated_at,
        'inventory_sku_count', paged.inventory_sku_count,
        'inventory_total_quantity', paged.inventory_total_quantity
      )
    ),
    '[]'::jsonb
  ),
  'total', (select filtered_count.total from filtered_count),
  'page', (select params.page from params),
  'pageSize', (select params.page_size from params),
  'totalPages', greatest(1, ceil((select filtered_count.total from filtered_count)::numeric / (select params.page_size from params))::integer),
  'summary', jsonb_build_object(
    'totalWarehouses', (select summary.total_warehouses from summary),
    'materialWarehouses', (select summary.material_warehouses from summary),
    'finishedGoodWarehouses', (select summary.finished_good_warehouses from summary),
    'fbaStagingWarehouses', (select summary.fba_staging_warehouses from summary),
    'warehousesWithInventory', (select summary.warehouses_with_inventory from summary)
  )
)
from paged;
$$;

create or replace function public.get_bom_page(
  p_page integer default 1,
  p_page_size integer default 20,
  p_keyword text default null,
  p_filters jsonb default '{}'::jsonb,
  p_sort_by text default 'created_at',
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
    nullif(p_filters->>'status', 'all') as status,
    nullif(p_filters->>'productId', 'all') as product_id,
    nullif(p_filters->>'skuId', 'all') as sku_id,
    nullif(p_filters->>'brandId', 'all') as brand_id,
    lower(coalesce(nullif(p_sort_by, ''), 'created_at')) as sort_by,
    lower(coalesce(nullif(p_sort_direction, ''), 'desc')) as sort_direction
),
item_counts as (
  select bi.bom_header_id, count(*)::integer as item_count
  from public.bom_items bi
  group by bi.bom_header_id
),
joined as (
  select
    bh.id,
    bh.product_sku_id,
    bh.bom_code,
    bh.version,
    bh.status,
    bh.effective_from,
    bh.notes,
    bh.created_at,
    bh.updated_at,
    s.product_id,
    s.sku_code,
    s.sku_name,
    s.sku_type,
    s.unit as sku_unit,
    s.specs as sku_specs,
    s.status as sku_status,
    p.brand_id,
    p.product_code,
    p.name as product_name,
    p.product_image_url,
    b.brand_code,
    b.name as brand_name,
    b.english_name as brand_english_name,
    b.logo_url as brand_logo_url,
    b.status as brand_status,
    coalesce(ic.item_count, 0) as item_count
  from public.bom_headers bh
  left join public.skus s on s.id = bh.product_sku_id
  left join public.products p on p.id = s.product_id
  left join public.brands b on b.id = p.brand_id
  left join item_counts ic on ic.bom_header_id = bh.id
),
filtered as (
  select joined.*
  from joined, params
  where (params.status is null or joined.status = params.status)
    and (params.product_id is null or joined.product_id::text = params.product_id)
    and (params.sku_id is null or joined.product_sku_id::text = params.sku_id)
    and (
      params.brand_id is null
      or (params.brand_id = 'none' and joined.brand_id is null)
      or joined.brand_id::text = params.brand_id
    )
    and (
      params.keyword is null
      or joined.bom_code ilike '%' || params.keyword || '%'
      or joined.version ilike '%' || params.keyword || '%'
      or coalesce(joined.sku_code, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.sku_name, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.product_code, '') ilike '%' || params.keyword || '%'
      or coalesce(joined.product_name, '') ilike '%' || params.keyword || '%'
    )
),
filtered_count as (
  select count(*)::integer as total from filtered
),
summary as (
  select
    count(*)::integer as total_boms,
    count(*) filter (where joined.status = 'active')::integer as active_boms,
    count(*) filter (where joined.status = 'inactive')::integer as inactive_boms,
    coalesce(sum(joined.item_count), 0)::integer as total_bom_items
  from joined
),
paged as (
  select filtered.*
  from filtered, params
  order by
    case when params.sort_by = 'bom_code' and params.sort_direction = 'asc' then filtered.bom_code end asc,
    case when params.sort_by = 'bom_code' and params.sort_direction = 'desc' then filtered.bom_code end desc,
    case when params.sort_by = 'updated_at' and params.sort_direction = 'asc' then filtered.updated_at end asc,
    case when params.sort_by = 'updated_at' and params.sort_direction = 'desc' then filtered.updated_at end desc,
    case when params.sort_direction = 'asc' then filtered.created_at end asc,
    filtered.created_at desc
  offset ((select page from params) - 1) * (select page_size from params)
  limit (select page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', paged.id,
        'product_sku_id', paged.product_sku_id,
        'bom_code', paged.bom_code,
        'version', paged.version,
        'status', paged.status,
        'effective_from', paged.effective_from,
        'notes', paged.notes,
        'created_at', paged.created_at,
        'updated_at', paged.updated_at,
        'item_count', paged.item_count,
        'product_sku', jsonb_build_object(
          'id', paged.product_sku_id,
          'product_id', paged.product_id,
          'sku_code', paged.sku_code,
          'sku_name', paged.sku_name,
          'sku_type', paged.sku_type,
          'unit', paged.sku_unit,
          'specs', paged.sku_specs,
          'status', paged.sku_status,
          'product',
            case when paged.product_id is null then null else jsonb_build_object(
              'id', paged.product_id,
              'brand_id', paged.brand_id,
              'product_code', paged.product_code,
              'name', paged.product_name,
              'product_image_url', paged.product_image_url,
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
      )
    ),
    '[]'::jsonb
  ),
  'total', (select filtered_count.total from filtered_count),
  'page', (select params.page from params),
  'pageSize', (select params.page_size from params),
  'totalPages', greatest(1, ceil((select filtered_count.total from filtered_count)::numeric / (select params.page_size from params))::integer),
  'summary', jsonb_build_object(
    'totalBoms', (select summary.total_boms from summary),
    'activeBoms', (select summary.active_boms from summary),
    'inactiveBoms', (select summary.inactive_boms from summary),
    'totalBomItems', (select summary.total_bom_items from summary)
  )
)
from paged;
$$;
