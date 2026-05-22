-- 开发阶段仓库管理策略
-- 目的：让 /admin/warehouses 页面可以读取仓库、当前库存、库存流水和 SKU，并新增、编辑、启用/停用仓库。
-- 注意：这是开发阶段策略。生产环境必须按真实登录用户、管理员/仓库角色和仓库范围收紧，不能长期这样放开。
-- 本文件不开放 delete，因为当前仓库管理页面没有删除功能。

begin;

grant usage on schema public to anon, authenticated;

-- 页面展示需要读取仓库、当前库存、库存流水和 SKU。
grant select on public.warehouses to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;
grant select on public.inventory_transactions to anon, authenticated;
grant select on public.skus to anon, authenticated;

-- 仓库管理页面需要新增、编辑、启用/停用仓库。
grant insert, update on public.warehouses to anon, authenticated;

alter table public.warehouses enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;
alter table public.skus enable row level security;

drop policy if exists "dev warehouses read warehouses" on public.warehouses;
drop policy if exists "dev warehouses create warehouses" on public.warehouses;
drop policy if exists "dev warehouses update warehouses" on public.warehouses;
drop policy if exists "dev warehouses read inventory_items" on public.inventory_items;
drop policy if exists "dev warehouses read inventory_transactions" on public.inventory_transactions;
drop policy if exists "dev warehouses read skus" on public.skus;

create policy "dev warehouses read warehouses"
on public.warehouses
for select
to anon, authenticated
using (true);

create policy "dev warehouses create warehouses"
on public.warehouses
for insert
to anon, authenticated
with check (true);

create policy "dev warehouses update warehouses"
on public.warehouses
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev warehouses read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

create policy "dev warehouses read inventory_transactions"
on public.inventory_transactions
for select
to anon, authenticated
using (true);

create policy "dev warehouses read skus"
on public.skus
for select
to anon, authenticated
using (true);

commit;
