-- 开发阶段生产任务列表策略
-- 目的：允许前端调试 /production/orders 页面，包括读取生产任务、物料需求、成品入库流水，以及把计划中任务标记为生产中。
-- 注意：这是开发阶段策略。生产环境必须按真实角色收紧权限，例如只有厂长/管理员能更新生产任务状态。
-- 本文件不开放 delete，避免误删生产任务、物料需求或库存流水。

begin;

grant usage on schema public to anon, authenticated;

-- 页面展示需要读取这些表。
grant select on public.production_orders to anon, authenticated;
grant select on public.fba_replenishment_requests to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.material_requirements to anon, authenticated;
grant select on public.inventory_transactions to anon, authenticated;
grant select on public.warehouses to anon, authenticated;

-- 页面当前只支持把 planned 标记为 in_progress。
grant update on public.production_orders to anon, authenticated;

alter table public.production_orders enable row level security;
alter table public.fba_replenishment_requests enable row level security;
alter table public.skus enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.material_requirements enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.warehouses enable row level security;

drop policy if exists "dev production orders read production_orders" on public.production_orders;
drop policy if exists "dev production orders update production_orders" on public.production_orders;
drop policy if exists "dev production orders read fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev production orders read skus" on public.skus;
drop policy if exists "dev production orders read products" on public.products;
drop policy if exists "dev production orders read profiles" on public.profiles;
drop policy if exists "dev production orders read material_requirements" on public.material_requirements;
drop policy if exists "dev production orders read inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev production orders read warehouses" on public.warehouses;

create policy "dev production orders read production_orders"
on public.production_orders
for select
to anon, authenticated
using (true);

create policy "dev production orders update production_orders"
on public.production_orders
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev production orders read fba_replenishment_requests"
on public.fba_replenishment_requests
for select
to anon, authenticated
using (true);

create policy "dev production orders read skus"
on public.skus
for select
to anon, authenticated
using (true);

create policy "dev production orders read products"
on public.products
for select
to anon, authenticated
using (true);

create policy "dev production orders read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

create policy "dev production orders read material_requirements"
on public.material_requirements
for select
to anon, authenticated
using (true);

create policy "dev production orders read inventory_transactions"
on public.inventory_transactions
for select
to anon, authenticated
using (true);

create policy "dev production orders read warehouses"
on public.warehouses
for select
to anon, authenticated
using (true);

commit;
