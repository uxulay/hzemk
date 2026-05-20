-- 开发阶段 FBA 出库策略
-- 目的：允许前端调试 /inventory/fba-outbound 页面，包括读取待出库 FBA 需求、扣减成品库存、写出库流水、标记已发往 FBA。
-- 注意：这是开发阶段策略。生产环境必须按真实角色收紧权限，例如只有仓库/管理员能执行出库。
-- 本文件不开放 delete，避免误删库存、流水或 FBA 备货需求。

begin;

grant usage on schema public to anon, authenticated;

-- 页面展示需要读取这些表。
grant select on public.fba_replenishment_requests to anon, authenticated;
grant select on public.production_orders to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;
grant select on public.inventory_transactions to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.warehouses to anon, authenticated;

-- FBA 出库需要写流水、扣库存，并在完成后更新备货需求状态为 shipped。
grant insert on public.inventory_transactions to anon, authenticated;
grant update on public.inventory_items to anon, authenticated;
grant update on public.fba_replenishment_requests to anon, authenticated;

alter table public.fba_replenishment_requests enable row level security;
alter table public.production_orders enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.skus enable row level security;
alter table public.products enable row level security;
alter table public.warehouses enable row level security;

drop policy if exists "dev fba outbound read fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev fba outbound update fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev fba outbound read production_orders" on public.production_orders;
drop policy if exists "dev fba outbound read inventory_items" on public.inventory_items;
drop policy if exists "dev fba outbound update inventory_items" on public.inventory_items;
drop policy if exists "dev fba outbound read inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev fba outbound create inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev fba outbound read skus" on public.skus;
drop policy if exists "dev fba outbound read products" on public.products;
drop policy if exists "dev fba outbound read warehouses" on public.warehouses;

create policy "dev fba outbound read fba_replenishment_requests"
on public.fba_replenishment_requests
for select
to anon, authenticated
using (true);

create policy "dev fba outbound update fba_replenishment_requests"
on public.fba_replenishment_requests
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev fba outbound read production_orders"
on public.production_orders
for select
to anon, authenticated
using (true);

create policy "dev fba outbound read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

create policy "dev fba outbound update inventory_items"
on public.inventory_items
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev fba outbound read inventory_transactions"
on public.inventory_transactions
for select
to anon, authenticated
using (true);

create policy "dev fba outbound create inventory_transactions"
on public.inventory_transactions
for insert
to anon, authenticated
with check (true);

create policy "dev fba outbound read skus"
on public.skus
for select
to anon, authenticated
using (true);

create policy "dev fba outbound read products"
on public.products
for select
to anon, authenticated
using (true);

create policy "dev fba outbound read warehouses"
on public.warehouses
for select
to anon, authenticated
using (true);

commit;
