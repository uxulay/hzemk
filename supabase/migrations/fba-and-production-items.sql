-- FBA 备货单和生产任务明细表升级
-- 说明：旧主表字段先保留，用于兼容旧页面和旧数据；新流程优先使用明细表。

begin;

alter table public.products
add column if not exists product_image_url text;

comment on column public.products.product_image_url is '产品图片 URL。当前阶段不做上传，先保存外部图片地址。';

create table if not exists public.fba_replenishment_request_items (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.fba_replenishment_requests(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku_id uuid not null references public.skus(id) on delete restrict,
  requested_quantity numeric(18, 4) not null,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (request_id, sku_id),
  check (requested_quantity > 0)
);

comment on table public.fba_replenishment_request_items is 'FBA 备货单明细表：一张 FBA 备货单下的多个产品、多个成品 SKU 备货数量。';
comment on column public.fba_replenishment_request_items.id is '主键 ID。';
comment on column public.fba_replenishment_request_items.request_id is '所属 FBA 备货单主表 ID。';
comment on column public.fba_replenishment_request_items.product_id is '产品 ID，用于按产品分组展示。';
comment on column public.fba_replenishment_request_items.sku_id is '成品 SKU ID。';
comment on column public.fba_replenishment_request_items.requested_quantity is '运营要求的 FBA 备货数量。';
comment on column public.fba_replenishment_request_items.remark is '明细备注。';
comment on column public.fba_replenishment_request_items.created_at is '创建时间。';
comment on column public.fba_replenishment_request_items.updated_at is '更新时间。';

create table if not exists public.production_order_items (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  replenishment_request_item_id uuid references public.fba_replenishment_request_items(id) on delete set null,
  sku_id uuid not null references public.skus(id) on delete restrict,
  requested_quantity numeric(18, 4),
  planned_quantity numeric(18, 4) not null,
  completed_quantity numeric(18, 4) not null default 0,
  remark text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_order_id, sku_id),
  check (planned_quantity > 0),
  check (completed_quantity >= 0)
);

comment on table public.production_order_items is '生产任务明细表：一张生产任务下多个成品 SKU 的计划生产数量和完成数量。';
comment on column public.production_order_items.id is '主键 ID。';
comment on column public.production_order_items.production_order_id is '所属生产任务主表 ID。';
comment on column public.production_order_items.replenishment_request_item_id is '来源 FBA 备货单明细 ID。';
comment on column public.production_order_items.sku_id is '需要生产的成品 SKU ID。';
comment on column public.production_order_items.requested_quantity is '运营在 FBA 备货单明细中要求的数量。';
comment on column public.production_order_items.planned_quantity is '厂长实际计划生产数量，可以大于运营需求数量。';
comment on column public.production_order_items.completed_quantity is '已完成或已入库数量。';
comment on column public.production_order_items.remark is '明细备注。';
comment on column public.production_order_items.created_at is '创建时间。';
comment on column public.production_order_items.updated_at is '更新时间。';

create index if not exists idx_fba_request_items_request_id
on public.fba_replenishment_request_items(request_id);

create index if not exists idx_fba_request_items_product_id
on public.fba_replenishment_request_items(product_id);

create index if not exists idx_fba_request_items_sku_id
on public.fba_replenishment_request_items(sku_id);

create index if not exists idx_production_order_items_order_id
on public.production_order_items(production_order_id);

create index if not exists idx_production_order_items_request_item_id
on public.production_order_items(replenishment_request_item_id);

create index if not exists idx_production_order_items_sku_id
on public.production_order_items(sku_id);

drop trigger if exists trg_fba_replenishment_request_items_updated_at
on public.fba_replenishment_request_items;

create trigger trg_fba_replenishment_request_items_updated_at
before update on public.fba_replenishment_request_items
for each row execute function public.set_updated_at();

drop trigger if exists trg_production_order_items_updated_at
on public.production_order_items;

create trigger trg_production_order_items_updated_at
before update on public.production_order_items
for each row execute function public.set_updated_at();

alter table public.fba_replenishment_request_items enable row level security;
alter table public.production_order_items enable row level security;

drop policy if exists "dev allow read fba_replenishment_request_items" on public.fba_replenishment_request_items;
drop policy if exists "dev allow insert fba_replenishment_request_items" on public.fba_replenishment_request_items;
drop policy if exists "dev allow update fba_replenishment_request_items" on public.fba_replenishment_request_items;
drop policy if exists "dev allow read production_order_items" on public.production_order_items;
drop policy if exists "dev allow insert production_order_items" on public.production_order_items;
drop policy if exists "dev allow update production_order_items" on public.production_order_items;

create policy "dev allow read fba_replenishment_request_items"
on public.fba_replenishment_request_items
for select
to anon, authenticated
using (true);

create policy "dev allow insert fba_replenishment_request_items"
on public.fba_replenishment_request_items
for insert
to anon, authenticated
with check (true);

create policy "dev allow update fba_replenishment_request_items"
on public.fba_replenishment_request_items
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev allow read production_order_items"
on public.production_order_items
for select
to anon, authenticated
using (true);

create policy "dev allow insert production_order_items"
on public.production_order_items
for insert
to anon, authenticated
with check (true);

create policy "dev allow update production_order_items"
on public.production_order_items
for update
to anon, authenticated
using (true)
with check (true);

grant select, insert, update on public.fba_replenishment_request_items to anon, authenticated;
grant select, insert, update on public.production_order_items to anon, authenticated;
grant select on public.products, public.skus, public.warehouses to anon, authenticated;

commit;
