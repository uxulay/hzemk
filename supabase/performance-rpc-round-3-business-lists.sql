-- 第三轮数据读取性能优化：业务单据主列表分页、聚合、索引。
-- 使用方式：在 Supabase SQL Editor 中执行本文件。

create extension if not exists pg_trgm;

create index if not exists idx_purchase_orders_status on public.purchase_orders(status);
create index if not exists idx_purchase_orders_supplier_id on public.purchase_orders(supplier_id);
create index if not exists idx_purchase_orders_warehouse_id on public.purchase_orders(warehouse_id);
create index if not exists idx_purchase_orders_created_at on public.purchase_orders(created_at);
create index if not exists idx_purchase_order_items_order_id on public.purchase_order_items(purchase_order_id);
create index if not exists idx_purchase_order_items_material_id on public.purchase_order_items(material_id);
create index if not exists idx_production_orders_status on public.production_orders(status);
create index if not exists idx_production_orders_sku_id on public.production_orders(sku_id);
create index if not exists idx_production_orders_request_id on public.production_orders(replenishment_request_id);
create index if not exists idx_production_orders_planned_start_date on public.production_orders(planned_start_date);
create index if not exists idx_production_orders_planned_end_date on public.production_orders(planned_end_date);
create index if not exists idx_fba_requests_status on public.fba_replenishment_requests(status);
create index if not exists idx_fba_requests_sku_id on public.fba_replenishment_requests(sku_id);
create index if not exists idx_fba_requests_target_warehouse_id on public.fba_replenishment_requests(target_warehouse_id);
create index if not exists idx_fba_requests_target_ship_date on public.fba_replenishment_requests(target_ship_date);
create index if not exists idx_material_requirements_status on public.material_requirements(status);
create index if not exists idx_material_requirements_material_id on public.material_requirements(material_id);
create index if not exists idx_material_requirements_order_id on public.material_requirements(production_order_id);

create index if not exists idx_purchase_orders_no_trgm on public.purchase_orders using gin (purchase_order_no gin_trgm_ops);
create index if not exists idx_purchase_orders_notes_trgm on public.purchase_orders using gin (notes gin_trgm_ops);
create index if not exists idx_production_orders_no_trgm on public.production_orders using gin (production_order_no gin_trgm_ops);
create index if not exists idx_fba_requests_no_trgm on public.fba_replenishment_requests using gin (request_no gin_trgm_ops);

create or replace function public.get_purchase_orders_page(
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
    nullif(trim(coalesce(p_keyword, '')), '') as keyword_text,
    nullif(p_filters->>'status', 'all') as status_filter,
    nullif(p_filters->>'supplierId', 'all') as supplier_id_filter,
    nullif(p_filters->>'warehouseId', 'all') as warehouse_id_filter,
    nullif(p_filters->>'startDate', '')::date as start_date_filter,
    nullif(p_filters->>'endDate', '')::date as end_date_filter,
    lower(coalesce(nullif(p_sort_by, ''), 'created_at')) as sort_by_value,
    lower(coalesce(nullif(p_sort_direction, ''), 'desc')) as sort_direction_value
),
item_summary as (
  select
    poi.purchase_order_id,
    count(*)::integer as item_count,
    coalesce(sum(poi.ordered_quantity), 0)::numeric as ordered_quantity_total,
    coalesce(sum(poi.received_quantity), 0)::numeric as received_quantity_total,
    coalesce(sum(poi.ordered_quantity * coalesce(poi.unit_price, 0)), 0)::numeric as total_amount,
    bool_or(poi.material_requirement_id is not null) as has_requirement
  from public.purchase_order_items poi
  group by poi.purchase_order_id
),
filtered as (
  select
    po.id,
    po.purchase_order_no,
    po.supplier_id,
    po.warehouse_id,
    po.created_by,
    po.status,
    po.ordered_at,
    po.expected_arrival_date,
    po.received_at,
    po.notes,
    po.created_at,
    po.updated_at,
    sup.supplier_code,
    sup.name as supplier_name,
    sup.contact_name as supplier_contact_name,
    sup.phone as supplier_phone,
    sup.email as supplier_email,
    sup.address as supplier_address,
    wh.warehouse_code,
    wh.name as warehouse_name,
    wh.warehouse_type,
    pr.full_name as created_by_full_name,
    pr.email as created_by_email,
    coalesce(item_summary.item_count, 0) as item_count,
    coalesce(item_summary.ordered_quantity_total, 0) as ordered_quantity_total,
    coalesce(item_summary.received_quantity_total, 0) as received_quantity_total,
    coalesce(item_summary.total_amount, 0) as total_amount,
    case
      when coalesce(item_summary.has_requirement, false) then 'shortage'
      when coalesce(po.notes, '') ilike '%[批量导入]%' then 'bulk_import'
      else 'manual'
    end as source
  from public.purchase_orders po
  left join public.suppliers sup on sup.id = po.supplier_id
  left join public.warehouses wh on wh.id = po.warehouse_id
  left join public.profiles pr on pr.id = po.created_by
  left join item_summary on item_summary.purchase_order_id = po.id
  cross join params
  where (params.status_filter is null or po.status = params.status_filter)
    and (
      params.supplier_id_filter is null
      or (params.supplier_id_filter = 'none' and po.supplier_id is null)
      or po.supplier_id::text = params.supplier_id_filter
    )
    and (
      params.warehouse_id_filter is null
      or (params.warehouse_id_filter = 'none' and po.warehouse_id is null)
      or po.warehouse_id::text = params.warehouse_id_filter
    )
    and (params.start_date_filter is null or po.created_at::date >= params.start_date_filter)
    and (params.end_date_filter is null or po.created_at::date <= params.end_date_filter)
    and (
      params.keyword_text is null
      or po.purchase_order_no ilike '%' || params.keyword_text || '%'
      or coalesce(po.notes, '') ilike '%' || params.keyword_text || '%'
      or coalesce(sup.supplier_code, '') ilike '%' || params.keyword_text || '%'
      or coalesce(sup.name, '') ilike '%' || params.keyword_text || '%'
    )
),
filtered_count as (
  select count(*)::integer as total_count from filtered
),
summary as (
  select
    count(*)::integer as total_orders,
    count(*) filter (where filtered.status = 'draft')::integer as draft_orders,
    count(*) filter (where filtered.status = 'ordered')::integer as ordered_orders,
    count(*) filter (where filtered.status = 'partially_received')::integer as partially_received_orders,
    count(*) filter (where filtered.status = 'received')::integer as received_orders,
    count(*) filter (where filtered.status = 'cancelled')::integer as cancelled_orders,
    coalesce(sum(filtered.ordered_quantity_total), 0)::numeric as ordered_quantity_total,
    coalesce(sum(filtered.received_quantity_total), 0)::numeric as received_quantity_total
  from filtered
),
paged as (
  select filtered.*
  from filtered, params
  order by
    case when params.sort_by_value = 'purchase_order_no' and params.sort_direction_value = 'asc' then filtered.purchase_order_no end asc,
    case when params.sort_by_value = 'purchase_order_no' and params.sort_direction_value = 'desc' then filtered.purchase_order_no end desc,
    case when params.sort_by_value = 'updated_at' and params.sort_direction_value = 'asc' then filtered.updated_at end asc,
    case when params.sort_by_value = 'updated_at' and params.sort_direction_value = 'desc' then filtered.updated_at end desc,
    case when params.sort_direction_value = 'asc' then filtered.created_at end asc,
    filtered.created_at desc
  offset ((select params.page from params) - 1) * (select params.page_size from params)
  limit (select params.page_size from params)
)
select jsonb_build_object(
  'rows',
  coalesce(jsonb_agg(jsonb_build_object(
    'id', paged.id,
    'purchase_order_no', paged.purchase_order_no,
    'supplier_id', paged.supplier_id,
    'warehouse_id', paged.warehouse_id,
    'created_by', paged.created_by,
    'status', paged.status,
    'ordered_at', paged.ordered_at,
    'expected_arrival_date', paged.expected_arrival_date,
    'received_at', paged.received_at,
    'notes', paged.notes,
    'created_at', paged.created_at,
    'updated_at', paged.updated_at,
    'supplier', case when paged.supplier_id is null then null else jsonb_build_object(
      'id', paged.supplier_id,
      'supplier_code', paged.supplier_code,
      'name', paged.supplier_name,
      'contact_name', paged.supplier_contact_name,
      'phone', paged.supplier_phone,
      'email', paged.supplier_email,
      'address', paged.supplier_address
    ) end,
    'target_warehouse', case when paged.warehouse_id is null then null else jsonb_build_object(
      'id', paged.warehouse_id,
      'warehouse_code', paged.warehouse_code,
      'name', paged.warehouse_name,
      'warehouse_type', paged.warehouse_type
    ) end,
    'created_by_profile', case when paged.created_by is null then null else jsonb_build_object(
      'id', paged.created_by,
      'full_name', paged.created_by_full_name,
      'email', paged.created_by_email
    ) end,
    'items', '[]'::jsonb,
    'total_amount', paged.total_amount,
    'item_count', paged.item_count,
    'ordered_quantity_total', paged.ordered_quantity_total,
    'received_quantity_total', paged.received_quantity_total,
    'source', paged.source
  )), '[]'::jsonb),
  'total', (select filtered_count.total_count from filtered_count),
  'page', (select params.page from params),
  'pageSize', (select params.page_size from params),
  'totalPages', greatest(1, ceil((select filtered_count.total_count from filtered_count)::numeric / (select params.page_size from params))::integer),
  'summary', jsonb_build_object(
    'totalOrders', (select summary.total_orders from summary),
    'draftOrders', (select summary.draft_orders from summary),
    'orderedOrders', (select summary.ordered_orders from summary),
    'partiallyReceivedOrders', (select summary.partially_received_orders from summary),
    'receivedOrders', (select summary.received_orders from summary),
    'cancelledOrders', (select summary.cancelled_orders from summary),
    'orderedQuantityTotal', (select summary.ordered_quantity_total from summary),
    'receivedQuantityTotal', (select summary.received_quantity_total from summary)
  )
)
from paged;
$$;

create or replace function public.get_production_orders_page(
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
    nullif(trim(coalesce(p_keyword, '')), '') as keyword_text,
    nullif(p_filters->>'status', 'all') as status_filter,
    nullif(p_filters->>'materialStatus', 'all') as material_status_filter,
    nullif(p_filters->>'skuId', 'all') as sku_id_filter,
    nullif(p_filters->>'productId', 'all') as product_id_filter,
    nullif(p_filters->>'brandId', 'all') as brand_id_filter,
    nullif(p_filters->>'startDate', '')::date as start_date_filter,
    nullif(p_filters->>'endDate', '')::date as end_date_filter,
    lower(coalesce(nullif(p_sort_by, ''), 'created_at')) as sort_by_value,
    lower(coalesce(nullif(p_sort_direction, ''), 'desc')) as sort_direction_value
),
order_items as (
  select
    poi.production_order_id,
    count(*)::integer as item_count,
    count(distinct poi.sku_id)::integer as sku_count,
    count(distinct ps.product_id)::integer as product_count,
    coalesce(sum(coalesce(poi.requested_quantity, 0)), 0)::numeric as requested_quantity_total,
    coalesce(sum(poi.planned_quantity), 0)::numeric as planned_quantity_total,
    coalesce(sum(poi.completed_quantity), 0)::numeric as completed_quantity_total,
    string_agg(coalesce(ps.sku_code, '') || ' ' || coalesce(ps.sku_name, '') || ' ' || coalesce(pp.product_code, '') || ' ' || coalesce(pp.name, ''), ' ') as item_search_text,
    array_agg(distinct pp.brand_id::text) filter (where pp.brand_id is not null) as brand_ids,
    jsonb_agg(jsonb_build_object(
      'id', poi.id,
      'production_order_id', poi.production_order_id,
      'replenishment_request_item_id', poi.replenishment_request_item_id,
      'sku_id', poi.sku_id,
      'requested_quantity', poi.requested_quantity,
      'planned_quantity', poi.planned_quantity,
      'completed_quantity', poi.completed_quantity,
      'remark', poi.remark,
      'sku', jsonb_build_object(
        'id', ps.id,
        'product_id', ps.product_id,
        'sku_code', ps.sku_code,
        'sku_name', ps.sku_name,
        'specs', ps.specs,
        'unit', ps.unit,
        'product', case when pp.id is null then null else jsonb_build_object(
          'id', pp.id,
          'brand_id', pp.brand_id,
          'product_code', pp.product_code,
          'name', pp.name,
          'product_image_url', pp.product_image_url,
          'brand', case when pb.id is null then null else jsonb_build_object(
            'id', pb.id,
            'brand_code', pb.brand_code,
            'name', pb.name,
            'english_name', pb.english_name,
            'logo_url', pb.logo_url,
            'status', pb.status
          ) end
        ) end
      )
    ) order by poi.created_at asc) as items_json
  from public.production_order_items poi
  left join public.skus ps on ps.id = poi.sku_id
  left join public.products pp on pp.id = ps.product_id
  left join public.brands pb on pb.id = pp.brand_id
  group by poi.production_order_id
),
requirement_summary as (
  select
    mr.production_order_id,
    count(*)::integer as requirement_count,
    count(*) filter (where mr.status = 'shortage')::integer as shortage_count,
    bool_or(mr.status = 'shortage') as has_shortage,
    bool_or(mr.status = 'purchased') as has_purchased,
    bool_or(mr.status = 'received') as has_received,
    bool_and(mr.status in ('enough', 'ready', 'reserved')) as all_ready,
    jsonb_agg(jsonb_build_object(
      'id', mr.id,
      'material_id', mr.material_id,
      'required_quantity', mr.required_quantity,
      'available_quantity', mr.available_quantity,
      'shortage_quantity', mr.shortage_quantity,
      'unit', mr.unit,
      'status', mr.status,
      'material', case when m.id is null then null else jsonb_build_object(
        'id', m.id,
        'material_code', m.material_code,
        'material_name', m.material_name,
        'specs', m.specs,
        'unit', m.unit
      ) end
    ) order by mr.created_at asc) as requirements_json
  from public.material_requirements mr
  left join public.materials m on m.id = mr.material_id
  group by mr.production_order_id
),
transaction_summary as (
  select
    it.production_order_id,
    coalesce(sum(it.quantity) filter (where it.transaction_type = 'product_in'), 0)::numeric as inbound_quantity,
    bool_or(it.transaction_type = 'material_out') as materials_issued,
    jsonb_agg(jsonb_build_object(
      'id', it.id,
      'transaction_no', it.transaction_no,
      'warehouse_id', it.warehouse_id,
      'transaction_type', it.transaction_type,
      'quantity', it.quantity,
      'occurred_at', it.occurred_at,
      'notes', it.notes,
      'warehouse', case when wh.id is null then null else jsonb_build_object(
        'id', wh.id,
        'warehouse_code', wh.warehouse_code,
        'name', wh.name
      ) end
    ) order by it.occurred_at desc) filter (where it.transaction_type in ('product_in', 'material_out')) as transactions_json
  from public.inventory_transactions it
  left join public.warehouses wh on wh.id = it.warehouse_id
  where it.production_order_id is not null
  group by it.production_order_id
),
filtered as (
  select
    po.id,
    po.production_order_no,
    po.replenishment_request_id,
    po.sku_id,
    po.bom_header_id,
    po.planned_quantity,
    po.completed_quantity,
    po.planned_start_date,
    po.planned_end_date,
    po.actual_start_at,
    po.actual_completed_at,
    po.status,
    po.assigned_to,
    po.notes,
    po.created_at,
    po.updated_at,
    fr.request_no,
    fr.requested_quantity as request_requested_quantity,
    fr.status as request_status,
    fr.target_ship_date,
    fr.fba_warehouse_code,
    s.product_id,
    s.sku_code,
    s.sku_name,
    s.specs,
    s.unit as sku_unit,
    p.product_code,
    p.name as product_name,
    p.product_image_url,
    p.brand_id,
    b.brand_code,
    b.name as brand_name,
    b.english_name as brand_english_name,
    b.logo_url as brand_logo_url,
    b.status as brand_status,
    ap.full_name as assigned_full_name,
    ap.email as assigned_email,
    ap.status as assigned_status,
    coalesce(order_items.item_count, 0) as item_count,
    coalesce(order_items.sku_count, 1) as sku_count,
    coalesce(order_items.product_count, case when s.product_id is null then 0 else 1 end) as product_count,
    coalesce(nullif(order_items.requested_quantity_total, 0), fr.requested_quantity, 0) as requested_quantity_total,
    coalesce(nullif(order_items.planned_quantity_total, 0), po.planned_quantity) as planned_quantity_total,
    coalesce(nullif(order_items.completed_quantity_total, 0), po.completed_quantity) as completed_quantity_total,
    coalesce(order_items.items_json, '[]'::jsonb) as items_json,
    order_items.item_search_text,
    order_items.brand_ids,
    coalesce(requirement_summary.requirement_count, 0) as requirement_count,
    coalesce(requirement_summary.shortage_count, 0) as shortage_count,
    coalesce(requirement_summary.requirements_json, '[]'::jsonb) as requirements_json,
    coalesce(transaction_summary.inbound_quantity, 0) as inbound_quantity,
    coalesce(transaction_summary.materials_issued, false) as materials_issued,
    coalesce(transaction_summary.transactions_json, '[]'::jsonb) as transactions_json,
    case
      when coalesce(requirement_summary.requirement_count, 0) = 0 then 'not_generated'
      when coalesce(transaction_summary.materials_issued, false) then 'issued'
      when coalesce(requirement_summary.has_shortage, false) then 'shortage'
      when coalesce(requirement_summary.has_purchased, false) then 'purchased'
      when coalesce(requirement_summary.has_received, false) then 'received'
      when coalesce(requirement_summary.all_ready, false) then 'ready'
      else 'pending'
    end as material_status
  from public.production_orders po
  left join public.fba_replenishment_requests fr on fr.id = po.replenishment_request_id
  left join public.skus s on s.id = po.sku_id
  left join public.products p on p.id = s.product_id
  left join public.brands b on b.id = p.brand_id
  left join public.profiles ap on ap.id = po.assigned_to
  left join order_items on order_items.production_order_id = po.id
  left join requirement_summary on requirement_summary.production_order_id = po.id
  left join transaction_summary on transaction_summary.production_order_id = po.id
  cross join params
  where (params.status_filter is null or po.status = params.status_filter)
    and (params.sku_id_filter is null or po.sku_id::text = params.sku_id_filter)
    and (params.product_id_filter is null or s.product_id::text = params.product_id_filter)
    and (
      params.brand_id_filter is null
      or (params.brand_id_filter = 'none' and p.brand_id is null)
      or p.brand_id::text = params.brand_id_filter
      or params.brand_id_filter = any(coalesce(order_items.brand_ids, array[]::text[]))
    )
    and (params.start_date_filter is null or coalesce(po.planned_start_date, po.created_at::date) >= params.start_date_filter)
    and (params.end_date_filter is null or coalesce(po.planned_end_date, po.created_at::date) <= params.end_date_filter)
    and (
      params.keyword_text is null
      or po.production_order_no ilike '%' || params.keyword_text || '%'
      or coalesce(fr.request_no, '') ilike '%' || params.keyword_text || '%'
      or coalesce(s.sku_code, '') ilike '%' || params.keyword_text || '%'
      or coalesce(s.sku_name, '') ilike '%' || params.keyword_text || '%'
      or coalesce(p.product_code, '') ilike '%' || params.keyword_text || '%'
      or coalesce(p.name, '') ilike '%' || params.keyword_text || '%'
      or coalesce(order_items.item_search_text, '') ilike '%' || params.keyword_text || '%'
    )
),
filtered_with_material as (
  select filtered.*
  from filtered, params
  where params.material_status_filter is null
    or filtered.material_status = params.material_status_filter
),
filtered_count as (select count(*)::integer as total_count from filtered_with_material),
summary as (
  select
    count(*)::integer as total_orders,
    count(*) filter (where filtered_with_material.status = 'planned')::integer as planned_orders,
    count(*) filter (where filtered_with_material.status = 'material_pending')::integer as material_pending_orders,
    count(*) filter (where filtered_with_material.status = 'in_progress')::integer as in_progress_orders,
    count(*) filter (where filtered_with_material.status = 'completed')::integer as completed_orders,
    count(*) filter (where filtered_with_material.status = 'cancelled')::integer as cancelled_orders
  from filtered_with_material
),
paged as (
  select filtered_with_material.*
  from filtered_with_material, params
  order by
    case when params.sort_by_value = 'planned_start_date' and params.sort_direction_value = 'asc' then filtered_with_material.planned_start_date end asc,
    case when params.sort_by_value = 'planned_start_date' and params.sort_direction_value = 'desc' then filtered_with_material.planned_start_date end desc,
    case when params.sort_by_value = 'planned_end_date' and params.sort_direction_value = 'asc' then filtered_with_material.planned_end_date end asc,
    case when params.sort_by_value = 'planned_end_date' and params.sort_direction_value = 'desc' then filtered_with_material.planned_end_date end desc,
    case when params.sort_direction_value = 'asc' then filtered_with_material.created_at end asc,
    filtered_with_material.created_at desc
  offset ((select params.page from params) - 1) * (select params.page_size from params)
  limit (select params.page_size from params)
)
select jsonb_build_object(
  'rows', coalesce(jsonb_agg(jsonb_build_object(
    'id', paged.id,
    'production_order_no', paged.production_order_no,
    'replenishment_request_id', paged.replenishment_request_id,
    'sku_id', paged.sku_id,
    'bom_header_id', paged.bom_header_id,
    'planned_quantity', paged.planned_quantity,
    'completed_quantity', paged.completed_quantity,
    'planned_start_date', paged.planned_start_date,
    'planned_end_date', paged.planned_end_date,
    'actual_start_at', paged.actual_start_at,
    'actual_completed_at', paged.actual_completed_at,
    'status', paged.status,
    'assigned_to', paged.assigned_to,
    'notes', paged.notes,
    'created_at', paged.created_at,
    'updated_at', paged.updated_at,
    'replenishment_request', case when paged.replenishment_request_id is null then null else jsonb_build_object(
      'id', paged.replenishment_request_id,
      'request_no', paged.request_no,
      'requested_quantity', paged.request_requested_quantity,
      'status', paged.request_status,
      'target_ship_date', paged.target_ship_date,
      'fba_warehouse_code', paged.fba_warehouse_code
    ) end,
    'sku', jsonb_build_object(
      'id', paged.sku_id,
      'product_id', paged.product_id,
      'sku_code', paged.sku_code,
      'sku_name', paged.sku_name,
      'specs', paged.specs,
      'unit', paged.sku_unit,
      'product', case when paged.product_id is null then null else jsonb_build_object(
        'id', paged.product_id,
        'brand_id', paged.brand_id,
        'product_code', paged.product_code,
        'name', paged.product_name,
        'product_image_url', paged.product_image_url,
        'brand', case when paged.brand_id is null then null else jsonb_build_object(
          'id', paged.brand_id,
          'brand_code', paged.brand_code,
          'name', paged.brand_name,
          'english_name', paged.brand_english_name,
          'logo_url', paged.brand_logo_url,
          'status', paged.brand_status
        ) end
      ) end
    ),
    'assigned_profile', case when paged.assigned_to is null then null else jsonb_build_object(
      'id', paged.assigned_to,
      'full_name', paged.assigned_full_name,
      'email', paged.assigned_email,
      'status', paged.assigned_status
    ) end,
    'material_requirements', paged.requirements_json,
    'inbound_transactions', paged.transactions_json,
    'material_issue_transactions', paged.transactions_json,
    'requested_quantity', paged.requested_quantity_total,
    'overproduction_quantity', greatest(0, paged.planned_quantity_total - paged.requested_quantity_total),
    'inbound_quantity', paged.inbound_quantity,
    'pending_inbound_quantity', greatest(0, paged.planned_quantity_total - paged.inbound_quantity),
    'material_status', paged.material_status,
    'materials_issued', paged.materials_issued,
    'material_issue_status', case
      when paged.materials_issued then 'issued'
      when paged.requirement_count = 0 then 'not_generated'
      when paged.shortage_count > 0 then 'shortage'
      when paged.material_status = 'ready' then 'ready'
      else 'blocked'
    end,
    'material_issue_can_issue', (not paged.materials_issued and paged.material_status = 'ready' and paged.status <> 'cancelled'),
    'material_issue_block_reason', case
      when paged.materials_issued then '该生产任务已确认领料，不能重复扣减库存。'
      when paged.requirement_count = 0 then '请先生成物料需求。'
      when paged.shortage_count > 0 then '仍有缺料，不能确认领料。'
      when paged.status = 'cancelled' then '生产任务已取消。'
      else null
    end,
    'material_issue_shortage_count', paged.shortage_count,
    'items', case when paged.item_count > 0 then paged.items_json else jsonb_build_array(jsonb_build_object(
      'id', paged.id || '-legacy-item',
      'production_order_id', paged.id,
      'replenishment_request_item_id', null,
      'sku_id', paged.sku_id,
      'requested_quantity', paged.request_requested_quantity,
      'planned_quantity', paged.planned_quantity,
      'completed_quantity', paged.completed_quantity,
      'remark', null,
      'sku', jsonb_build_object(
        'id', paged.sku_id,
        'product_id', paged.product_id,
        'sku_code', paged.sku_code,
        'sku_name', paged.sku_name,
        'specs', paged.specs,
        'unit', paged.sku_unit,
        'product', case when paged.product_id is null then null else jsonb_build_object(
          'id', paged.product_id,
          'brand_id', paged.brand_id,
          'product_code', paged.product_code,
          'name', paged.product_name,
          'product_image_url', paged.product_image_url,
          'brand', case when paged.brand_id is null then null else jsonb_build_object(
            'id', paged.brand_id,
            'brand_code', paged.brand_code,
            'name', paged.brand_name,
            'english_name', paged.brand_english_name,
            'logo_url', paged.brand_logo_url,
            'status', paged.brand_status
          ) end
        ) end
      )
    )) end,
    'product_count', paged.product_count,
    'sku_count', paged.sku_count,
    'total_planned_quantity', paged.planned_quantity_total,
    'total_completed_quantity', paged.completed_quantity_total
  )), '[]'::jsonb),
  'total', (select filtered_count.total_count from filtered_count),
  'page', (select params.page from params),
  'pageSize', (select params.page_size from params),
  'totalPages', greatest(1, ceil((select filtered_count.total_count from filtered_count)::numeric / (select params.page_size from params))::integer),
  'summary', jsonb_build_object(
    'totalOrders', (select summary.total_orders from summary),
    'plannedOrders', (select summary.planned_orders from summary),
    'materialPendingOrders', (select summary.material_pending_orders from summary),
    'inProgressOrders', (select summary.in_progress_orders from summary),
    'completedOrders', (select summary.completed_orders from summary),
    'cancelledOrders', (select summary.cancelled_orders from summary)
  )
)
from paged;
$$;

create or replace function public.get_material_requirements_page(
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
    nullif(trim(coalesce(p_keyword, '')), '') as keyword_text,
    nullif(p_filters->>'status', 'all') as status_filter,
    nullif(p_filters->>'materialId', 'all') as material_id_filter,
    nullif(p_filters->>'supplierId', 'all') as supplier_id_filter,
    nullif(p_filters->>'productionOrderId', 'all') as production_order_id_filter,
    nullif(p_filters->>'purchaseStatus', 'all') as purchase_status_filter,
    lower(coalesce(nullif(p_sort_by, ''), 'created_at')) as sort_by_value,
    lower(coalesce(nullif(p_sort_direction, ''), 'desc')) as sort_direction_value
),
purchase_status as (
  select
    poi.material_requirement_id,
    case
      when coalesce(sum(poi.ordered_quantity), 0) = 0 then 'not_purchased'
      when coalesce(sum(poi.received_quantity), 0) >= coalesce(sum(poi.ordered_quantity), 0) then 'received'
      when coalesce(sum(poi.received_quantity), 0) > 0 then 'partially_received'
      else 'ordered'
    end as purchase_status_value
  from public.purchase_order_items poi
  where poi.material_requirement_id is not null
  group by poi.material_requirement_id
),
filtered as (
  select
    mr.id,
    mr.production_order_id,
    mr.replenishment_request_id,
    mr.material_id,
    mr.required_quantity,
    mr.available_quantity,
    mr.shortage_quantity,
    mr.reserved_quantity,
    mr.unit,
    mr.status,
    mr.notes,
    mr.created_at,
    mr.updated_at,
    coalesce(purchase_status.purchase_status_value, 'not_purchased') as purchase_status_value,
    po.production_order_no,
    po.sku_id as production_sku_id,
    po.bom_header_id,
    po.planned_quantity,
    s.sku_code,
    s.sku_name,
    m.material_code,
    m.material_name,
    m.specs as material_specs,
    m.unit as material_unit,
    m.default_supplier_id,
    bi.quantity_per,
    bi.loss_rate,
    bi.unit as bom_item_unit
  from public.material_requirements mr
  left join public.production_orders po on po.id = mr.production_order_id
  left join public.skus s on s.id = po.sku_id
  left join public.materials m on m.id = mr.material_id
  left join public.bom_items bi on bi.bom_header_id = po.bom_header_id and bi.material_id = mr.material_id
  left join purchase_status on purchase_status.material_requirement_id = mr.id
  cross join params
  where (params.status_filter is null or mr.status = params.status_filter)
    and (params.material_id_filter is null or mr.material_id::text = params.material_id_filter)
    and (params.production_order_id_filter is null or mr.production_order_id::text = params.production_order_id_filter)
    and (params.supplier_id_filter is null or m.default_supplier_id::text = params.supplier_id_filter)
    and (params.purchase_status_filter is null or coalesce(purchase_status.purchase_status_value, 'not_purchased') = params.purchase_status_filter)
    and (
      params.keyword_text is null
      or coalesce(m.material_code, '') ilike '%' || params.keyword_text || '%'
      or coalesce(m.material_name, '') ilike '%' || params.keyword_text || '%'
      or coalesce(po.production_order_no, '') ilike '%' || params.keyword_text || '%'
      or coalesce(s.sku_code, '') ilike '%' || params.keyword_text || '%'
      or coalesce(s.sku_name, '') ilike '%' || params.keyword_text || '%'
    )
),
filtered_count as (select count(*)::integer as total_count from filtered),
summary as (
  select
    count(*)::integer as total_requirements,
    count(*) filter (where filtered.status = 'shortage')::integer as shortage_requirements,
    count(*) filter (where filtered.status = 'purchased')::integer as purchased_requirements,
    count(*) filter (where filtered.status = 'received')::integer as received_requirements,
    count(*) filter (where filtered.status in ('enough', 'ready', 'reserved'))::integer as enough_requirements,
    coalesce(sum(filtered.required_quantity), 0)::numeric as total_required_quantity,
    coalesce(sum(filtered.shortage_quantity), 0)::numeric as total_shortage_quantity
  from filtered
),
paged as (
  select filtered.*
  from filtered, params
  order by
    case when params.sort_by_value = 'material_code' and params.sort_direction_value = 'asc' then filtered.material_code end asc,
    case when params.sort_by_value = 'material_code' and params.sort_direction_value = 'desc' then filtered.material_code end desc,
    case when params.sort_direction_value = 'asc' then filtered.created_at end asc,
    filtered.created_at desc
  offset ((select params.page from params) - 1) * (select params.page_size from params)
  limit (select params.page_size from params)
)
select jsonb_build_object(
  'rows', coalesce(jsonb_agg(jsonb_build_object(
    'id', paged.id,
    'production_order_id', paged.production_order_id,
    'replenishment_request_id', paged.replenishment_request_id,
    'material_id', paged.material_id,
    'required_quantity', paged.required_quantity,
    'available_quantity', paged.available_quantity,
    'shortage_quantity', paged.shortage_quantity,
    'reserved_quantity', paged.reserved_quantity,
    'unit', paged.unit,
    'status', paged.status,
    'notes', paged.notes,
    'created_at', paged.created_at,
    'updated_at', paged.updated_at,
    'production_order', case when paged.production_order_id is null then null else jsonb_build_object(
      'id', paged.production_order_id,
      'production_order_no', paged.production_order_no,
      'sku_id', paged.production_sku_id,
      'bom_header_id', paged.bom_header_id,
      'planned_quantity', paged.planned_quantity,
      'finished_sku', case when paged.production_sku_id is null then null else jsonb_build_object(
        'id', paged.production_sku_id,
        'sku_code', paged.sku_code,
        'sku_name', paged.sku_name
      ) end
    ) end,
    'material', case when paged.material_id is null then null else jsonb_build_object(
      'id', paged.material_id,
      'material_code', paged.material_code,
      'material_name', paged.material_name,
      'specs', paged.material_specs,
      'unit', paged.material_unit
    ) end,
    'bom_item', case when paged.quantity_per is null then null else jsonb_build_object(
      'quantity_per', paged.quantity_per,
      'loss_rate', paged.loss_rate,
      'unit', paged.bom_item_unit
    ) end,
    'purchase_status', paged.purchase_status_value
  )), '[]'::jsonb),
  'total', (select filtered_count.total_count from filtered_count),
  'page', (select params.page from params),
  'pageSize', (select params.page_size from params),
  'totalPages', greatest(1, ceil((select filtered_count.total_count from filtered_count)::numeric / (select params.page_size from params))::integer),
  'summary', jsonb_build_object(
    'totalRequirements', (select summary.total_requirements from summary),
    'shortageRequirements', (select summary.shortage_requirements from summary),
    'purchasedRequirements', (select summary.purchased_requirements from summary),
    'receivedRequirements', (select summary.received_requirements from summary),
    'enoughRequirements', (select summary.enough_requirements from summary),
    'totalRequiredQuantity', (select summary.total_required_quantity from summary),
    'totalShortageQuantity', (select summary.total_shortage_quantity from summary)
  )
)
from paged;
$$;

create or replace function public.get_replenishment_requests_page(
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
    nullif(trim(coalesce(p_keyword, '')), '') as keyword_text,
    nullif(p_filters->>'status', 'all') as status_filter,
    nullif(p_filters->>'priority', 'all') as priority_filter,
    nullif(p_filters->>'brandId', 'all') as brand_id_filter,
    nullif(p_filters->>'skuId', 'all') as sku_id_filter,
    nullif(p_filters->>'targetWarehouseId', 'all') as warehouse_id_filter,
    nullif(p_filters->>'targetShipDateStart', '')::date as start_date_filter,
    nullif(p_filters->>'targetShipDateEnd', '')::date as end_date_filter,
    lower(coalesce(nullif(p_sort_by, ''), 'created_at')) as sort_by_value,
    lower(coalesce(nullif(p_sort_direction, ''), 'desc')) as sort_direction_value
),
item_summary as (
  select
    fri.request_id,
    count(distinct coalesce(fri.product_id, s.product_id))::integer as product_count,
    count(distinct fri.sku_id)::integer as sku_count,
    coalesce(sum(fri.requested_quantity), 0)::numeric as total_requested_quantity,
    jsonb_agg(jsonb_build_object(
      'id', fri.id,
      'request_id', fri.request_id,
      'product_id', fri.product_id,
      'sku_id', fri.sku_id,
      'requested_quantity', fri.requested_quantity,
      'remark', fri.remark,
      'created_at', fri.created_at,
      'updated_at', fri.updated_at,
      'sku', jsonb_build_object(
        'id', s.id,
        'product_id', s.product_id,
        'sku_code', s.sku_code,
        'sku_name', s.sku_name,
        'amazon_sku', s.amazon_sku,
        'fnsku', s.fnsku,
        'specs', s.specs,
        'unit', s.unit,
        'product', case when p.id is null then null else jsonb_build_object(
          'id', p.id,
          'brand_id', p.brand_id,
          'product_code', p.product_code,
          'name', p.name,
          'product_image_url', p.product_image_url,
          'brand', case when b.id is null then null else jsonb_build_object(
            'id', b.id,
            'brand_code', b.brand_code,
            'name', b.name,
            'english_name', b.english_name,
            'logo_url', b.logo_url,
            'status', b.status
          ) end
        ) end
      ),
      'product', case when coalesce(ip.id, p.id) is null then null else jsonb_build_object(
        'id', coalesce(ip.id, p.id),
        'brand_id', coalesce(ip.brand_id, p.brand_id),
        'product_code', coalesce(ip.product_code, p.product_code),
        'name', coalesce(ip.name, p.name),
        'product_image_url', coalesce(ip.product_image_url, p.product_image_url),
        'brand', case when coalesce(ib.id, b.id) is null then null else jsonb_build_object(
          'id', coalesce(ib.id, b.id),
          'brand_code', coalesce(ib.brand_code, b.brand_code),
          'name', coalesce(ib.name, b.name),
          'english_name', coalesce(ib.english_name, b.english_name),
          'logo_url', coalesce(ib.logo_url, b.logo_url),
          'status', coalesce(ib.status, b.status)
        ) end
      ) end
    ) order by fri.created_at asc) as items_json,
    string_agg(coalesce(s.sku_code, '') || ' ' || coalesce(s.sku_name, '') || ' ' || coalesce(p.product_code, '') || ' ' || coalesce(p.name, ''), ' ') as item_search_text,
    bool_or(coalesce(ip.brand_id, p.brand_id) is null) as has_no_brand,
    array_agg(distinct coalesce(ip.brand_id, p.brand_id)::text) filter (where coalesce(ip.brand_id, p.brand_id) is not null) as brand_ids
  from public.fba_replenishment_request_items fri
  left join public.skus s on s.id = fri.sku_id
  left join public.products p on p.id = s.product_id
  left join public.brands b on b.id = p.brand_id
  left join public.products ip on ip.id = fri.product_id
  left join public.brands ib on ib.id = ip.brand_id
  group by fri.request_id
),
filtered as (
  select
    fr.id,
    fr.request_no,
    fr.requested_by,
    fr.sku_id,
    fr.target_warehouse_id,
    fr.fba_warehouse_code,
    fr.requested_quantity,
    fr.target_ship_date,
    fr.priority,
    fr.status,
    fr.accepted_by,
    fr.accepted_at,
    fr.rejected_reason,
    fr.notes,
    fr.created_at,
    fr.updated_at,
    s.product_id,
    s.sku_code,
    s.sku_name,
    s.amazon_sku,
    s.fnsku,
    s.specs,
    s.unit as sku_unit,
    p.product_code,
    p.name as product_name,
    p.product_image_url,
    p.brand_id,
    b.brand_code,
    b.name as brand_name,
    b.english_name as brand_english_name,
    b.logo_url as brand_logo_url,
    b.status as brand_status,
    wh.warehouse_code,
    wh.name as warehouse_name,
    wh.warehouse_type,
    pr.full_name as requested_by_full_name,
    pr.email as requested_by_email,
    coalesce(item_summary.product_count, case when s.product_id is null then 0 else 1 end) as product_count,
    coalesce(item_summary.sku_count, 1) as sku_count,
    coalesce(nullif(item_summary.total_requested_quantity, 0), fr.requested_quantity) as total_requested_quantity,
    coalesce(item_summary.items_json, '[]'::jsonb) as items_json,
    item_summary.item_search_text,
    item_summary.has_no_brand,
    item_summary.brand_ids
  from public.fba_replenishment_requests fr
  left join public.skus s on s.id = fr.sku_id
  left join public.products p on p.id = s.product_id
  left join public.brands b on b.id = p.brand_id
  left join public.warehouses wh on wh.id = fr.target_warehouse_id
  left join public.profiles pr on pr.id = fr.requested_by
  left join item_summary on item_summary.request_id = fr.id
  cross join params
  where (
      params.status_filter is null
      or (params.status_filter = 'planning_open' and fr.status in ('submitted', 'accepted'))
      or fr.status = params.status_filter
    )
    and (params.priority_filter is null or fr.priority = params.priority_filter)
    and (params.sku_id_filter is null or fr.sku_id::text = params.sku_id_filter)
    and (
      params.warehouse_id_filter is null
      or (params.warehouse_id_filter = 'none' and fr.target_warehouse_id is null)
      or fr.target_warehouse_id::text = params.warehouse_id_filter
    )
    and (params.start_date_filter is null or fr.target_ship_date >= params.start_date_filter)
    and (params.end_date_filter is null or fr.target_ship_date <= params.end_date_filter)
    and (
      params.brand_id_filter is null
      or (params.brand_id_filter = 'none' and coalesce(item_summary.has_no_brand, p.brand_id is null))
      or p.brand_id::text = params.brand_id_filter
      or params.brand_id_filter = any(coalesce(item_summary.brand_ids, array[]::text[]))
    )
    and (
      params.keyword_text is null
      or fr.request_no ilike '%' || params.keyword_text || '%'
      or coalesce(s.sku_code, '') ilike '%' || params.keyword_text || '%'
      or coalesce(s.sku_name, '') ilike '%' || params.keyword_text || '%'
      or coalesce(s.amazon_sku, '') ilike '%' || params.keyword_text || '%'
      or coalesce(s.fnsku, '') ilike '%' || params.keyword_text || '%'
      or coalesce(p.product_code, '') ilike '%' || params.keyword_text || '%'
      or coalesce(p.name, '') ilike '%' || params.keyword_text || '%'
      or coalesce(item_summary.item_search_text, '') ilike '%' || params.keyword_text || '%'
    )
),
filtered_count as (select count(*)::integer as total_count from filtered),
summary as (
  select
    count(*)::integer as total_requests,
    count(*) filter (where filtered.status = 'draft')::integer as draft_requests,
    count(*) filter (where filtered.status = 'submitted')::integer as submitted_requests,
    count(*) filter (where filtered.status = 'accepted')::integer as accepted_requests,
    count(*) filter (where filtered.status = 'in_production')::integer as in_production_requests,
    count(*) filter (where filtered.status = 'completed')::integer as completed_requests,
    count(*) filter (where filtered.status = 'shipped')::integer as shipped_requests,
    coalesce(sum(filtered.total_requested_quantity), 0)::numeric as total_requested_quantity
  from filtered
),
paged as (
  select filtered.*
  from filtered, params
  order by
    case when params.sort_by_value = 'target_ship_date' and params.sort_direction_value = 'asc' then filtered.target_ship_date end asc,
    case when params.sort_by_value = 'target_ship_date' and params.sort_direction_value = 'desc' then filtered.target_ship_date end desc,
    case when params.sort_direction_value = 'asc' then filtered.created_at end asc,
    filtered.created_at desc
  offset ((select params.page from params) - 1) * (select params.page_size from params)
  limit (select params.page_size from params)
)
select jsonb_build_object(
  'rows', coalesce(jsonb_agg(jsonb_build_object(
    'id', paged.id,
    'request_no', paged.request_no,
    'requested_by', paged.requested_by,
    'sku_id', paged.sku_id,
    'target_warehouse_id', paged.target_warehouse_id,
    'fba_warehouse_code', paged.fba_warehouse_code,
    'requested_quantity', paged.requested_quantity,
    'target_ship_date', paged.target_ship_date,
    'priority', paged.priority,
    'status', paged.status,
    'accepted_by', paged.accepted_by,
    'accepted_at', paged.accepted_at,
    'rejected_reason', paged.rejected_reason,
    'notes', paged.notes,
    'created_at', paged.created_at,
    'updated_at', paged.updated_at,
    'sku', jsonb_build_object(
      'id', paged.sku_id,
      'product_id', paged.product_id,
      'sku_code', paged.sku_code,
      'sku_name', paged.sku_name,
      'amazon_sku', paged.amazon_sku,
      'fnsku', paged.fnsku,
      'specs', paged.specs,
      'unit', paged.sku_unit,
      'product', case when paged.product_id is null then null else jsonb_build_object(
        'id', paged.product_id,
        'brand_id', paged.brand_id,
        'product_code', paged.product_code,
        'name', paged.product_name,
        'product_image_url', paged.product_image_url,
        'brand', case when paged.brand_id is null then null else jsonb_build_object(
          'id', paged.brand_id,
          'brand_code', paged.brand_code,
          'name', paged.brand_name,
          'english_name', paged.brand_english_name,
          'logo_url', paged.brand_logo_url,
          'status', paged.brand_status
        ) end
      ) end
    ),
    'target_warehouse', case when paged.target_warehouse_id is null then null else jsonb_build_object(
      'id', paged.target_warehouse_id,
      'warehouse_code', paged.warehouse_code,
      'name', paged.warehouse_name,
      'warehouse_type', paged.warehouse_type
    ) end,
    'requested_by_profile', case when paged.requested_by is null then null else jsonb_build_object(
      'id', paged.requested_by,
      'full_name', paged.requested_by_full_name,
      'email', paged.requested_by_email
    ) end,
    'items', paged.items_json,
    'product_count', paged.product_count,
    'sku_count', paged.sku_count,
    'total_requested_quantity', paged.total_requested_quantity
  )), '[]'::jsonb),
  'total', (select filtered_count.total_count from filtered_count),
  'page', (select params.page from params),
  'pageSize', (select params.page_size from params),
  'totalPages', greatest(1, ceil((select filtered_count.total_count from filtered_count)::numeric / (select params.page_size from params))::integer),
  'summary', jsonb_build_object(
    'totalRequests', (select summary.total_requests from summary),
    'draftRequests', (select summary.draft_requests from summary),
    'submittedRequests', (select summary.submitted_requests from summary),
    'acceptedRequests', (select summary.accepted_requests from summary),
    'inProductionRequests', (select summary.in_production_requests from summary),
    'completedRequests', (select summary.completed_requests from summary),
    'shippedRequests', (select summary.shipped_requests from summary),
    'totalRequestedQuantity', (select summary.total_requested_quantity from summary)
  )
)
from paged;
$$;

create or replace function public.get_production_planning_page(
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
select public.get_replenishment_requests_page(
  p_page,
  p_page_size,
  p_keyword,
  jsonb_strip_nulls(jsonb_build_object(
    'status', coalesce(nullif(p_filters->>'status', 'all'), 'planning_open'),
    'priority', nullif(p_filters->>'priority', 'all'),
    'brandId', nullif(p_filters->>'brandId', 'all'),
    'targetShipDateStart', nullif(p_filters->>'targetShipDateStart', ''),
    'targetShipDateEnd', nullif(p_filters->>'targetShipDateEnd', '')
  )),
  p_sort_by,
  p_sort_direction
);
$$;
