-- 开发阶段库存流水查询策略
-- 目的：允许前端调试 /inventory/transactions 页面，读取库存流水及其关联的 SKU、产品、仓库、单据和操作人。
-- 注意：这是开发阶段策略。生产环境不能长期这样放开，必须按仓库、管理员、厂长等真实角色收紧权限。
-- 本文件只开放 select，不开放 insert / update / delete，库存流水原则上不应该随便删除或改写。

begin;

grant usage on schema public to anon, authenticated;

grant select on public.inventory_transactions to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.warehouses to anon, authenticated;
grant select on public.purchase_orders to anon, authenticated;
grant select on public.production_orders to anon, authenticated;
grant select on public.fba_replenishment_requests to anon, authenticated;
grant select on public.profiles to anon, authenticated;

alter table public.inventory_transactions enable row level security;
alter table public.inventory_items enable row level security;
alter table public.skus enable row level security;
alter table public.products enable row level security;
alter table public.warehouses enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.production_orders enable row level security;
alter table public.fba_replenishment_requests enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "dev inventory transactions read inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev inventory transactions read inventory_items" on public.inventory_items;
drop policy if exists "dev inventory transactions read skus" on public.skus;
drop policy if exists "dev inventory transactions read products" on public.products;
drop policy if exists "dev inventory transactions read warehouses" on public.warehouses;
drop policy if exists "dev inventory transactions read purchase_orders" on public.purchase_orders;
drop policy if exists "dev inventory transactions read production_orders" on public.production_orders;
drop policy if exists "dev inventory transactions read fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev inventory transactions read profiles" on public.profiles;

create policy "dev inventory transactions read inventory_transactions"
on public.inventory_transactions
for select
to anon, authenticated
using (true);

create policy "dev inventory transactions read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

create policy "dev inventory transactions read skus"
on public.skus
for select
to anon, authenticated
using (true);

create policy "dev inventory transactions read products"
on public.products
for select
to anon, authenticated
using (true);

create policy "dev inventory transactions read warehouses"
on public.warehouses
for select
to anon, authenticated
using (true);

create policy "dev inventory transactions read purchase_orders"
on public.purchase_orders
for select
to anon, authenticated
using (true);

create policy "dev inventory transactions read production_orders"
on public.production_orders
for select
to anon, authenticated
using (true);

create policy "dev inventory transactions read fba_replenishment_requests"
on public.fba_replenishment_requests
for select
to anon, authenticated
using (true);

create policy "dev inventory transactions read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

commit;
