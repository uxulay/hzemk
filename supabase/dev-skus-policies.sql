-- 开发阶段 SKU 管理策略
-- 目的：让 /admin/skus 页面可以读取产品、SKU、库存和 BOM 关联，并可以新增、编辑、启用/停用 SKU。
-- 注意：这是开发阶段策略。生产环境必须按真实登录用户、管理员角色和操作权限收紧，不能长期这样放开。
-- 本文件不开放 delete，因为当前 SKU 管理页面没有删除功能。

begin;

grant usage on schema public to anon, authenticated;

grant select on public.products to anon, authenticated;
grant select, insert, update on public.skus to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;
grant select on public.bom_headers to anon, authenticated;
grant select on public.bom_items to anon, authenticated;

alter table public.products enable row level security;
alter table public.skus enable row level security;
alter table public.inventory_items enable row level security;
alter table public.bom_headers enable row level security;
alter table public.bom_items enable row level security;

drop policy if exists "dev skus read products" on public.products;
create policy "dev skus read products"
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists "dev skus read skus" on public.skus;
create policy "dev skus read skus"
on public.skus
for select
to anon, authenticated
using (true);

drop policy if exists "dev skus insert skus" on public.skus;
create policy "dev skus insert skus"
on public.skus
for insert
to anon, authenticated
with check (true);

drop policy if exists "dev skus update skus" on public.skus;
create policy "dev skus update skus"
on public.skus
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev skus read inventory_items" on public.inventory_items;
create policy "dev skus read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

drop policy if exists "dev skus read bom_headers" on public.bom_headers;
create policy "dev skus read bom_headers"
on public.bom_headers
for select
to anon, authenticated
using (true);

drop policy if exists "dev skus read bom_items" on public.bom_items;
create policy "dev skus read bom_items"
on public.bom_items
for select
to anon, authenticated
using (true);

commit;
