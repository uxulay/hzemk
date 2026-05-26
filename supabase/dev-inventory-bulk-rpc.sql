-- 开发阶段库存批量导入 RPC
-- 目的：把其他入库、其他出库、库存调整的批量导入放到数据库函数里一次完成。
-- 注意：RLS 仍然开启。本文件只补充函数执行权限和必要的开发阶段 insert/update/select 权限。
-- 在 Supabase SQL Editor 执行本文件后，前端批量导入会调用下面 3 个 RPC。

begin;

grant usage on schema public to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;
grant insert, update on public.inventory_items to anon, authenticated;
grant insert on public.inventory_transactions to anon, authenticated;

alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

drop policy if exists "dev inventory bulk read inventory_items" on public.inventory_items;
drop policy if exists "dev inventory bulk create inventory_items" on public.inventory_items;
drop policy if exists "dev inventory bulk update inventory_items" on public.inventory_items;
drop policy if exists "dev inventory bulk create inventory_transactions" on public.inventory_transactions;

create policy "dev inventory bulk read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

create policy "dev inventory bulk create inventory_items"
on public.inventory_items
for insert
to anon, authenticated
with check (true);

create policy "dev inventory bulk update inventory_items"
on public.inventory_items
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev inventory bulk create inventory_transactions"
on public.inventory_transactions
for insert
to anon, authenticated
with check (true);

create or replace function public.bulk_inventory_transaction_no()
returns text
language sql
as $$
  select 'INV-' ||
    to_char(clock_timestamp(), 'YYYYMMDD') ||
    '-' ||
    upper(substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 8));
$$;

create or replace function public.bulk_create_other_inbound(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  payload_count integer := coalesce(jsonb_array_length(payload), 0);
begin
  if jsonb_typeof(payload) is distinct from 'array' then
    raise exception '导入数据格式错误：payload 必须是数组。';
  end if;

  create temporary table tmp_other_inbound_payload (
    row_number integer,
    warehouse_id uuid,
    sku_id uuid,
    quantity numeric(18, 4),
    reason text,
    remark text,
    unit text,
    sku_type text,
    warehouse_code text,
    sku_code text
  ) on commit drop;

  insert into tmp_other_inbound_payload (
    row_number,
    warehouse_id,
    sku_id,
    quantity,
    reason,
    remark,
    unit,
    sku_type,
    warehouse_code,
    sku_code
  )
  select
    item.ordinality::integer + 1,
    nullif(item.value ->> 'warehouse_id', '')::uuid,
    nullif(item.value ->> 'sku_id', '')::uuid,
    nullif(item.value ->> 'quantity', '')::numeric(18, 4),
    coalesce(item.value ->> 'reason', ''),
    coalesce(item.value ->> 'remark', ''),
    coalesce(item.value ->> 'unit', 'pcs'),
    coalesce(item.value ->> 'sku_type', ''),
    coalesce(item.value ->> 'warehouse_code', ''),
    coalesce(item.value ->> 'sku_code', '')
  from jsonb_array_elements(payload) with ordinality as item(value, ordinality);

  if exists (select 1 from tmp_other_inbound_payload where quantity is null or quantity <= 0) then
    raise exception '入库数量必须大于 0。';
  end if;

  if exists (
    select 1
    from tmp_other_inbound_payload
    where sku_type not in ('material', 'finished_good', 'finished_product')
  ) then
    raise exception 'SKU 类型只支持 material、finished_good、finished_product。';
  end if;

  insert into public.inventory_items (
    warehouse_id,
    sku_id,
    item_type,
    quantity_on_hand,
    reserved_quantity,
    safety_stock_quantity,
    unit
  )
  select
    warehouse_id,
    sku_id,
    case when max(sku_type) = 'material' then 'material' else 'finished_product' end,
    sum(quantity),
    0,
    0,
    max(unit)
  from tmp_other_inbound_payload
  group by warehouse_id, sku_id
  on conflict (warehouse_id, sku_id)
  do update set
    quantity_on_hand = public.inventory_items.quantity_on_hand + excluded.quantity_on_hand,
    unit = excluded.unit;

  insert into public.inventory_transactions (
    transaction_no,
    warehouse_id,
    sku_id,
    transaction_type,
    quantity,
    operator_id,
    occurred_at,
    notes
  )
  select
    public.bulk_inventory_transaction_no(),
    warehouse_id,
    sku_id,
    case when sku_type = 'material' then 'material_in' else 'product_in' end,
    quantity,
    null,
    now(),
    concat_ws(
      E'\n',
      case
        when position('初始' in reason) > 0 or position('初始' in remark) > 0
          then '初始库存导入'
        else '其他入库'
      end,
      '入库原因：' || trim(reason),
      '单位：' || unit,
      '操作备注：' || coalesce(nullif(trim(remark), ''), '-')
    )
  from tmp_other_inbound_payload
  order by row_number;

  return jsonb_build_object(
    'success_count', payload_count,
    'failed_count', 0,
    'errors', '[]'::jsonb
  );
end;
$$;

create or replace function public.bulk_create_other_outbound(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  payload_count integer := coalesce(jsonb_array_length(payload), 0);
  failed_label text;
  failed_requested numeric(18, 4);
  failed_available numeric(18, 4);
begin
  if jsonb_typeof(payload) is distinct from 'array' then
    raise exception '导入数据格式错误：payload 必须是数组。';
  end if;

  create temporary table tmp_other_outbound_payload (
    row_number integer,
    warehouse_id uuid,
    sku_id uuid,
    quantity numeric(18, 4),
    reason text,
    remark text,
    unit text,
    sku_type text,
    warehouse_code text,
    sku_code text
  ) on commit drop;

  insert into tmp_other_outbound_payload (
    row_number,
    warehouse_id,
    sku_id,
    quantity,
    reason,
    remark,
    unit,
    sku_type,
    warehouse_code,
    sku_code
  )
  select
    item.ordinality::integer + 1,
    nullif(item.value ->> 'warehouse_id', '')::uuid,
    nullif(item.value ->> 'sku_id', '')::uuid,
    nullif(item.value ->> 'quantity', '')::numeric(18, 4),
    coalesce(item.value ->> 'reason', ''),
    coalesce(item.value ->> 'remark', ''),
    coalesce(item.value ->> 'unit', 'pcs'),
    coalesce(item.value ->> 'sku_type', ''),
    coalesce(item.value ->> 'warehouse_code', ''),
    coalesce(item.value ->> 'sku_code', '')
  from jsonb_array_elements(payload) with ordinality as item(value, ordinality);

  if exists (select 1 from tmp_other_outbound_payload where quantity is null or quantity <= 0) then
    raise exception '出库数量必须大于 0。';
  end if;

  if exists (
    select 1
    from tmp_other_outbound_payload
    where sku_type not in ('material', 'finished_good', 'finished_product')
  ) then
    raise exception 'SKU 类型只支持 material、finished_good、finished_product。';
  end if;

  perform 1
  from public.inventory_items item
  join (
    select warehouse_id, sku_id
    from tmp_other_outbound_payload
    group by warehouse_id, sku_id
  ) target
    on target.warehouse_id = item.warehouse_id
   and target.sku_id = item.sku_id
  for update of item;

  with grouped as (
    select
      warehouse_id,
      sku_id,
      max(warehouse_code) as warehouse_code,
      max(sku_code) as sku_code,
      sum(quantity) as requested_quantity
    from tmp_other_outbound_payload
    group by warehouse_id, sku_id
  ),
  checked as (
    select
      grouped.*,
      coalesce(item.quantity_on_hand, 0) - coalesce(item.reserved_quantity, 0) as available_quantity
    from grouped
    left join public.inventory_items item
      on item.warehouse_id = grouped.warehouse_id
     and item.sku_id = grouped.sku_id
  )
  select
    warehouse_code || ' / ' || sku_code,
    requested_quantity,
    available_quantity
  into failed_label, failed_requested, failed_available
  from checked
  where requested_quantity > available_quantity
  order by warehouse_code, sku_code
  limit 1;

  if failed_label is not null then
    raise exception '% 合计出库 %，超过可用库存 %。', failed_label, failed_requested, failed_available;
  end if;

  update public.inventory_items item
  set quantity_on_hand = item.quantity_on_hand - grouped.requested_quantity
  from (
    select warehouse_id, sku_id, sum(quantity) as requested_quantity
    from tmp_other_outbound_payload
    group by warehouse_id, sku_id
  ) grouped
  where item.warehouse_id = grouped.warehouse_id
    and item.sku_id = grouped.sku_id;

  insert into public.inventory_transactions (
    transaction_no,
    warehouse_id,
    sku_id,
    transaction_type,
    quantity,
    operator_id,
    occurred_at,
    notes
  )
  select
    public.bulk_inventory_transaction_no(),
    warehouse_id,
    sku_id,
    case when sku_type = 'material' then 'material_out' else 'product_out' end,
    quantity,
    null,
    now(),
    concat_ws(
      E'\n',
      '其他出库',
      '出库原因：' || trim(reason),
      '单位：' || unit,
      '操作备注：' || coalesce(nullif(trim(remark), ''), '-')
    )
  from tmp_other_outbound_payload
  order by row_number;

  return jsonb_build_object(
    'success_count', payload_count,
    'failed_count', 0,
    'errors', '[]'::jsonb
  );
end;
$$;

create or replace function public.bulk_adjust_inventory(payload jsonb)
returns jsonb
language plpgsql
as $$
declare
  payload_count integer := coalesce(jsonb_array_length(payload), 0);
  failed_label text;
  skipped_count integer := 0;
begin
  if jsonb_typeof(payload) is distinct from 'array' then
    raise exception '导入数据格式错误：payload 必须是数组。';
  end if;

  create temporary table tmp_inventory_adjustment_payload (
    row_number integer,
    warehouse_id uuid,
    sku_id uuid,
    adjustment_mode text,
    adjustment_quantity numeric(18, 4),
    target_quantity numeric(18, 4),
    reason text,
    remark text,
    unit text,
    sku_type text,
    warehouse_code text,
    sku_code text
  ) on commit drop;

  insert into tmp_inventory_adjustment_payload (
    row_number,
    warehouse_id,
    sku_id,
    adjustment_mode,
    adjustment_quantity,
    target_quantity,
    reason,
    remark,
    unit,
    sku_type,
    warehouse_code,
    sku_code
  )
  select
    item.ordinality::integer + 1,
    nullif(item.value ->> 'warehouse_id', '')::uuid,
    nullif(item.value ->> 'sku_id', '')::uuid,
    coalesce(item.value ->> 'adjustment_mode', ''),
    nullif(item.value ->> 'adjustment_quantity', '')::numeric(18, 4),
    nullif(item.value ->> 'target_quantity', '')::numeric(18, 4),
    coalesce(item.value ->> 'reason', ''),
    coalesce(item.value ->> 'remark', ''),
    coalesce(item.value ->> 'unit', 'pcs'),
    coalesce(item.value ->> 'sku_type', ''),
    coalesce(item.value ->> 'warehouse_code', ''),
    coalesce(item.value ->> 'sku_code', '')
  from jsonb_array_elements(payload) with ordinality as item(value, ordinality);

  if exists (
    select 1
    from tmp_inventory_adjustment_payload
    where sku_type not in ('material', 'finished_good', 'finished_product')
  ) then
    raise exception 'SKU 类型只支持 material、finished_good、finished_product。';
  end if;

  if exists (
    select 1
    from tmp_inventory_adjustment_payload
    where adjustment_mode not in ('increase', 'decrease', 'set_to')
  ) then
    raise exception '调整方式只支持 increase、decrease、set_to。';
  end if;

  if exists (
    select 1
    from tmp_inventory_adjustment_payload
    group by warehouse_id, sku_id
    having count(*) > 1
  ) then
    raise exception '同一仓库同一 SKU 在文件里重复，请合并成一行。';
  end if;

  if exists (
    select 1
    from tmp_inventory_adjustment_payload
    where adjustment_mode in ('increase', 'decrease')
      and (adjustment_quantity is null or adjustment_quantity <= 0)
  ) then
    raise exception '增加或减少库存时，调整数量必须大于 0。';
  end if;

  if exists (
    select 1
    from tmp_inventory_adjustment_payload
    where adjustment_mode = 'set_to'
      and (target_quantity is null or target_quantity < 0)
  ) then
    raise exception '直接修正库存时，调整后库存必须大于或等于 0。';
  end if;

  perform 1
  from public.inventory_items item
  join tmp_inventory_adjustment_payload target
    on target.warehouse_id = item.warehouse_id
   and target.sku_id = item.sku_id
  for update of item;

  with calculated as (
    select
      payload.*,
      item.id as inventory_item_id,
      coalesce(item.quantity_on_hand, 0) as before_quantity,
      case
        when payload.adjustment_mode = 'increase'
          then coalesce(item.quantity_on_hand, 0) + payload.adjustment_quantity
        when payload.adjustment_mode = 'decrease'
          then coalesce(item.quantity_on_hand, 0) - payload.adjustment_quantity
        else payload.target_quantity
      end as after_quantity
    from tmp_inventory_adjustment_payload payload
    left join public.inventory_items item
      on item.warehouse_id = payload.warehouse_id
     and item.sku_id = payload.sku_id
  )
  select warehouse_code || ' / ' || sku_code
  into failed_label
  from calculated
  where adjustment_mode = 'decrease'
    and inventory_item_id is null
  order by row_number
  limit 1;

  if failed_label is not null then
    raise exception '% 当前仓库没有这个 SKU 的库存记录，不能减少库存。', failed_label;
  end if;

  with calculated as (
    select
      payload.*,
      item.id as inventory_item_id,
      coalesce(item.quantity_on_hand, 0) as before_quantity,
      case
        when payload.adjustment_mode = 'increase'
          then coalesce(item.quantity_on_hand, 0) + payload.adjustment_quantity
        when payload.adjustment_mode = 'decrease'
          then coalesce(item.quantity_on_hand, 0) - payload.adjustment_quantity
        else payload.target_quantity
      end as after_quantity
    from tmp_inventory_adjustment_payload payload
    left join public.inventory_items item
      on item.warehouse_id = payload.warehouse_id
     and item.sku_id = payload.sku_id
  )
  select warehouse_code || ' / ' || sku_code
  into failed_label
  from calculated
  where after_quantity < 0
  order by row_number
  limit 1;

  if failed_label is not null then
    raise exception '% 调整后库存不能小于 0。', failed_label;
  end if;

  create temporary table tmp_inventory_adjustment_calculated
  on commit drop
  as
  select
    payload.*,
    item.id as inventory_item_id,
    coalesce(item.quantity_on_hand, 0) as before_quantity,
    case
      when payload.adjustment_mode = 'increase'
        then coalesce(item.quantity_on_hand, 0) + payload.adjustment_quantity
      when payload.adjustment_mode = 'decrease'
        then coalesce(item.quantity_on_hand, 0) - payload.adjustment_quantity
      else payload.target_quantity
    end as after_quantity
  from tmp_inventory_adjustment_payload payload
  left join public.inventory_items item
    on item.warehouse_id = payload.warehouse_id
   and item.sku_id = payload.sku_id;

  insert into public.inventory_items (
    warehouse_id,
    sku_id,
    item_type,
    quantity_on_hand,
    reserved_quantity,
    safety_stock_quantity,
    unit
  )
  select
    warehouse_id,
    sku_id,
    case when sku_type = 'material' then 'material' else 'finished_product' end,
    case
      when adjustment_mode = 'increase' then adjustment_quantity
      else target_quantity
    end,
    0,
    0,
    unit
  from tmp_inventory_adjustment_calculated
  where inventory_item_id is null
    and (
      adjustment_mode = 'increase'
      or (adjustment_mode = 'set_to' and target_quantity > 0)
    );

  update public.inventory_items item
  set quantity_on_hand = calculated.after_quantity,
      unit = calculated.unit
  from tmp_inventory_adjustment_calculated calculated
  where calculated.inventory_item_id is not null
    and item.id = calculated.inventory_item_id
    and calculated.before_quantity <> calculated.after_quantity;

  with transaction_rows as (
    select
      *,
      after_quantity - before_quantity as signed_difference
    from tmp_inventory_adjustment_calculated
    where after_quantity <> before_quantity
  )
  insert into public.inventory_transactions (
    transaction_no,
    warehouse_id,
    sku_id,
    transaction_type,
    quantity,
    operator_id,
    occurred_at,
    notes
  )
  select
    public.bulk_inventory_transaction_no(),
    warehouse_id,
    sku_id,
    'adjustment',
    abs(signed_difference),
    null,
    now(),
    concat_ws(
      E'\n',
      '调整原因：' ||
        case reason
          when 'initial_stock' then '期初库存'
          when 'stocktake_gain' then '盘盈'
          when 'stocktake_loss' then '盘亏'
          when 'damage_loss' then '破损报废'
          when 'sample_use' then '样品领用'
          when 'data_correction' then '数据修正'
          else '其他'
        end || '（' || reason || '）',
      '调整方式：' ||
        case adjustment_mode
          when 'increase' then '增加库存'
          when 'decrease' then '减少库存'
          else '直接修正库存'
        end || '（' || adjustment_mode || '）',
      '调整前库存：' || before_quantity || ' ' || unit,
      '调整后库存：' || after_quantity || ' ' || unit,
      '调整差异：' ||
        case when signed_difference > 0 then '+' else '' end ||
        signed_difference || ' ' || unit,
      '操作备注：' || coalesce(nullif(trim(remark), ''), '-')
    )
  from transaction_rows
  order by row_number;

  select count(*)
  into skipped_count
  from tmp_inventory_adjustment_calculated
  where before_quantity = after_quantity;

  return jsonb_build_object(
    'success_count', payload_count,
    'failed_count', 0,
    'skipped_count', skipped_count,
    'errors', '[]'::jsonb
  );
end;
$$;

grant execute on function public.bulk_inventory_transaction_no() to anon, authenticated;
grant execute on function public.bulk_create_other_inbound(jsonb) to anon, authenticated;
grant execute on function public.bulk_create_other_outbound(jsonb) to anon, authenticated;
grant execute on function public.bulk_adjust_inventory(jsonb) to anon, authenticated;

commit;
