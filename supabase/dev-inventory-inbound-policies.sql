-- 开发阶段入库策略
-- 目的：允许前端调试 /inventory/inbound 页面，包括采购入库、生产入库、库存余额更新和库存流水写入。
-- 注意：这是开发阶段策略。生产环境必须按真实角色收紧权限，例如只有仓库/管理员能做入库。
-- 本文件不开放 delete，避免误删库存、流水或业务单据。

begin;

grant usage on schema public to anon, authenticated;

-- 页面展示需要读取这些表。
grant select on public.inventory_items to anon, authenticated;
grant select on public.inventory_transactions to anon, authenticated;
grant select on public.purchase_orders to anon, authenticated;
grant select on public.purchase_order_items to anon, authenticated;
grant select on public.production_orders to anon, authenticated;
grant select on public.fba_replenishment_requests to anon, authenticated;
grant select on public.material_requirements to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.suppliers to anon, authenticated;
grant select on public.warehouses to anon, authenticated;

-- 入库需要新增或更新当前库存，并且每次都写库存流水。
grant insert, update on public.inventory_items to anon, authenticated;
grant insert on public.inventory_transactions to anon, authenticated;

-- 采购入库会更新采购单状态、采购明细到货数量、物料需求到货状态。
grant update on public.purchase_orders to anon, authenticated;
grant update on public.purchase_order_items to anon, authenticated;
grant update on public.material_requirements to anon, authenticated;

-- 生产入库会更新生产任务 completed_quantity 和状态。
grant update on public.production_orders to anon, authenticated;

alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.production_orders enable row level security;
alter table public.fba_replenishment_requests enable row level security;
alter table public.material_requirements enable row level security;
alter table public.skus enable row level security;
alter table public.products enable row level security;
alter table public.suppliers enable row level security;
alter table public.warehouses enable row level security;

drop policy if exists "dev inbound read inventory_items" on public.inventory_items;
drop policy if exists "dev inbound create inventory_items" on public.inventory_items;
drop policy if exists "dev inbound update inventory_items" on public.inventory_items;
drop policy if exists "dev inbound read inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev inbound create inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev inbound read purchase_orders" on public.purchase_orders;
drop policy if exists "dev inbound update purchase_orders" on public.purchase_orders;
drop policy if exists "dev inbound read purchase_order_items" on public.purchase_order_items;
drop policy if exists "dev inbound update purchase_order_items" on public.purchase_order_items;
drop policy if exists "dev inbound read production_orders" on public.production_orders;
drop policy if exists "dev inbound update production_orders" on public.production_orders;
drop policy if exists "dev inbound read fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev inbound read material_requirements" on public.material_requirements;
drop policy if exists "dev inbound update material_requirements" on public.material_requirements;
drop policy if exists "dev inbound read skus" on public.skus;
drop policy if exists "dev inbound read products" on public.products;
drop policy if exists "dev inbound read suppliers" on public.suppliers;
drop policy if exists "dev inbound read warehouses" on public.warehouses;

create policy "dev inbound read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

create policy "dev inbound create inventory_items"
on public.inventory_items
for insert
to anon, authenticated
with check (true);

create policy "dev inbound update inventory_items"
on public.inventory_items
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev inbound read inventory_transactions"
on public.inventory_transactions
for select
to anon, authenticated
using (true);

create policy "dev inbound create inventory_transactions"
on public.inventory_transactions
for insert
to anon, authenticated
with check (true);

create policy "dev inbound read purchase_orders"
on public.purchase_orders
for select
to anon, authenticated
using (true);

create policy "dev inbound update purchase_orders"
on public.purchase_orders
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev inbound read purchase_order_items"
on public.purchase_order_items
for select
to anon, authenticated
using (true);

create policy "dev inbound update purchase_order_items"
on public.purchase_order_items
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev inbound read production_orders"
on public.production_orders
for select
to anon, authenticated
using (true);

create policy "dev inbound update production_orders"
on public.production_orders
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev inbound read fba_replenishment_requests"
on public.fba_replenishment_requests
for select
to anon, authenticated
using (true);

create policy "dev inbound read material_requirements"
on public.material_requirements
for select
to anon, authenticated
using (true);

create policy "dev inbound update material_requirements"
on public.material_requirements
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev inbound read skus"
on public.skus
for select
to anon, authenticated
using (true);

create policy "dev inbound read products"
on public.products
for select
to anon, authenticated
using (true);

create policy "dev inbound read suppliers"
on public.suppliers
for select
to anon, authenticated
using (true);

create policy "dev inbound read warehouses"
on public.warehouses
for select
to anon, authenticated
using (true);

commit;
