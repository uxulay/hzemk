-- 开发阶段生产领料策略
-- 目的：允许前端调试 /production/orders 的“确认领料”功能，包括读取物料需求、扣减原材料库存、写 material_out 流水、更新生产任务状态。
-- 注意：这是开发阶段策略。生产环境必须按真实角色收紧权限，例如只有厂长/管理员能确认领料。
-- 本文件不开放 delete，避免误删库存、流水、生产任务或物料需求。

begin;

grant usage on schema public to anon, authenticated;

-- 页面展示和领料预览需要读取这些表。
grant select on public.production_orders to anon, authenticated;
grant select on public.material_requirements to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;
grant select on public.inventory_transactions to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.warehouses to anon, authenticated;

-- /production/orders 页面已有详情展示会用到这些关联表，这里一并给开发阶段读取权限。
grant select on public.fba_replenishment_requests to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.profiles to anon, authenticated;

-- 确认领料需要扣库存、写 material_out 流水、更新生产任务为 in_progress，并把物料需求标记为 issued。
grant update on public.inventory_items to anon, authenticated;
grant insert on public.inventory_transactions to anon, authenticated;
grant update on public.production_orders to anon, authenticated;
grant update on public.material_requirements to anon, authenticated;

alter table public.production_orders enable row level security;
alter table public.material_requirements enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.skus enable row level security;
alter table public.warehouses enable row level security;
alter table public.fba_replenishment_requests enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "dev material out read production_orders" on public.production_orders;
drop policy if exists "dev material out update production_orders" on public.production_orders;
drop policy if exists "dev material out read material_requirements" on public.material_requirements;
drop policy if exists "dev material out update material_requirements" on public.material_requirements;
drop policy if exists "dev material out read inventory_items" on public.inventory_items;
drop policy if exists "dev material out update inventory_items" on public.inventory_items;
drop policy if exists "dev material out read inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev material out create inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev material out read skus" on public.skus;
drop policy if exists "dev material out read warehouses" on public.warehouses;
drop policy if exists "dev material out read fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev material out read products" on public.products;
drop policy if exists "dev material out read profiles" on public.profiles;

create policy "dev material out read production_orders"
on public.production_orders
for select
to anon, authenticated
using (true);

create policy "dev material out update production_orders"
on public.production_orders
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev material out read material_requirements"
on public.material_requirements
for select
to anon, authenticated
using (true);

create policy "dev material out update material_requirements"
on public.material_requirements
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev material out read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

create policy "dev material out update inventory_items"
on public.inventory_items
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev material out read inventory_transactions"
on public.inventory_transactions
for select
to anon, authenticated
using (true);

create policy "dev material out create inventory_transactions"
on public.inventory_transactions
for insert
to anon, authenticated
with check (true);

create policy "dev material out read skus"
on public.skus
for select
to anon, authenticated
using (true);

create policy "dev material out read warehouses"
on public.warehouses
for select
to anon, authenticated
using (true);

create policy "dev material out read fba_replenishment_requests"
on public.fba_replenishment_requests
for select
to anon, authenticated
using (true);

create policy "dev material out read products"
on public.products
for select
to anon, authenticated
using (true);

create policy "dev material out read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

commit;
