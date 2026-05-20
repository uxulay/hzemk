-- 开发阶段采购单策略
-- 目的：允许前端调试 /purchase/orders 页面，包括读取缺料、创建采购单、写入采购明细、更新采购单状态。
-- 注意：这是开发阶段策略。生产环境必须按真实角色收紧权限，例如只有采购/管理员能创建和更新采购单。
-- 本文件不开放 delete，避免误删采购单、采购明细或物料需求。

begin;

grant usage on schema public to anon, authenticated;

-- 页面展示需要读取这些表。
grant select on public.material_requirements to anon, authenticated;
grant select on public.purchase_orders to anon, authenticated;
grant select on public.purchase_order_items to anon, authenticated;
grant select on public.suppliers to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.production_orders to anon, authenticated;
grant select on public.profiles to anon, authenticated;

-- 创建采购单需要写入主表和明细表。
grant insert on public.purchase_orders to anon, authenticated;
grant insert on public.purchase_order_items to anon, authenticated;

-- 更新采购单状态、到货数量，以及把缺料需求标记为 purchased。
grant update on public.purchase_orders to anon, authenticated;
grant update on public.purchase_order_items to anon, authenticated;
grant update on public.material_requirements to anon, authenticated;

alter table public.material_requirements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.suppliers enable row level security;
alter table public.skus enable row level security;
alter table public.production_orders enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "dev purchase read material_requirements" on public.material_requirements;
drop policy if exists "dev purchase update material_requirements" on public.material_requirements;
drop policy if exists "dev purchase read purchase_orders" on public.purchase_orders;
drop policy if exists "dev purchase create purchase_orders" on public.purchase_orders;
drop policy if exists "dev purchase update purchase_orders" on public.purchase_orders;
drop policy if exists "dev purchase read purchase_order_items" on public.purchase_order_items;
drop policy if exists "dev purchase create purchase_order_items" on public.purchase_order_items;
drop policy if exists "dev purchase update purchase_order_items" on public.purchase_order_items;
drop policy if exists "dev purchase read suppliers" on public.suppliers;
drop policy if exists "dev purchase read skus" on public.skus;
drop policy if exists "dev purchase read production_orders" on public.production_orders;
drop policy if exists "dev purchase read profiles" on public.profiles;

create policy "dev purchase read material_requirements"
on public.material_requirements
for select
to anon, authenticated
using (true);

create policy "dev purchase update material_requirements"
on public.material_requirements
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev purchase read purchase_orders"
on public.purchase_orders
for select
to anon, authenticated
using (true);

create policy "dev purchase create purchase_orders"
on public.purchase_orders
for insert
to anon, authenticated
with check (true);

create policy "dev purchase update purchase_orders"
on public.purchase_orders
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev purchase read purchase_order_items"
on public.purchase_order_items
for select
to anon, authenticated
using (true);

create policy "dev purchase create purchase_order_items"
on public.purchase_order_items
for insert
to anon, authenticated
with check (true);

create policy "dev purchase update purchase_order_items"
on public.purchase_order_items
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev purchase read suppliers"
on public.suppliers
for select
to anon, authenticated
using (true);

create policy "dev purchase read skus"
on public.skus
for select
to anon, authenticated
using (true);

create policy "dev purchase read production_orders"
on public.production_orders
for select
to anon, authenticated
using (true);

create policy "dev purchase read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

commit;
