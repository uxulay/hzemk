-- 开发阶段库存调整策略
-- 目的：允许前端调试 /inventory/adjustments 页面，包括读取当前库存、更新库存余额、写 adjustment 库存流水。
-- 注意：这是开发阶段策略。生产环境必须按真实登录用户、仓库角色、管理员角色等条件收紧权限。
-- 本文件不开放 delete，也不开放直接 update 库存流水，避免误删或篡改历史记录。

begin;

grant usage on schema public to anon, authenticated;

-- 页面展示和最近调整记录需要读取这些表。
grant select on public.inventory_items to anon, authenticated;
grant select on public.inventory_transactions to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.warehouses to anon, authenticated;
grant select on public.profiles to anon, authenticated;

-- 库存调整只允许更新当前库存，并且每次都新增一条 adjustment 流水。
grant update on public.inventory_items to anon, authenticated;
grant insert on public.inventory_transactions to anon, authenticated;

alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.skus enable row level security;
alter table public.products enable row level security;
alter table public.warehouses enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "dev inventory adjustment read inventory_items" on public.inventory_items;
drop policy if exists "dev inventory adjustment update inventory_items" on public.inventory_items;
drop policy if exists "dev inventory adjustment read inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev inventory adjustment create inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev inventory adjustment read skus" on public.skus;
drop policy if exists "dev inventory adjustment read products" on public.products;
drop policy if exists "dev inventory adjustment read warehouses" on public.warehouses;
drop policy if exists "dev inventory adjustment read profiles" on public.profiles;

create policy "dev inventory adjustment read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

create policy "dev inventory adjustment update inventory_items"
on public.inventory_items
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev inventory adjustment read inventory_transactions"
on public.inventory_transactions
for select
to anon, authenticated
using (true);

create policy "dev inventory adjustment create inventory_transactions"
on public.inventory_transactions
for insert
to anon, authenticated
with check (true);

create policy "dev inventory adjustment read skus"
on public.skus
for select
to anon, authenticated
using (true);

create policy "dev inventory adjustment read products"
on public.products
for select
to anon, authenticated
using (true);

create policy "dev inventory adjustment read warehouses"
on public.warehouses
for select
to anon, authenticated
using (true);

create policy "dev inventory adjustment read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

commit;
