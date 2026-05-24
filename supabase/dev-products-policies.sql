-- 开发阶段产品管理策略
-- 目的：让 /admin/products 页面可以读取产品和 SKU，并可以新增、编辑、启用/停用产品。
-- 注意：这是开发阶段策略。生产环境必须按真实登录用户、管理员角色和操作权限收紧，不能长期这样放开。
-- 本文件不开放 delete，因为当前产品管理页面没有删除功能。

begin;

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.brands to anon, authenticated;
grant select, insert, update on public.products to anon, authenticated;
grant select, insert, update on public.skus to anon, authenticated;

alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.skus enable row level security;

drop policy if exists "dev products read brands" on public.brands;
create policy "dev products read brands"
on public.brands
for select
to anon, authenticated
using (true);

drop policy if exists "dev products insert brands" on public.brands;
create policy "dev products insert brands"
on public.brands
for insert
to anon, authenticated
with check (true);

drop policy if exists "dev products update brands" on public.brands;
create policy "dev products update brands"
on public.brands
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev products read products" on public.products;
create policy "dev products read products"
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists "dev products insert products" on public.products;
create policy "dev products insert products"
on public.products
for insert
to anon, authenticated
with check (true);

drop policy if exists "dev products update products" on public.products;
create policy "dev products update products"
on public.products
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev products read skus" on public.skus;
create policy "dev products read skus"
on public.skus
for select
to anon, authenticated
using (true);

drop policy if exists "dev products insert skus" on public.skus;
create policy "dev products insert skus"
on public.skus
for insert
to anon, authenticated
with check (true);

drop policy if exists "dev products update skus" on public.skus;
create policy "dev products update skus"
on public.skus
for update
to anon, authenticated
using (true)
with check (true);

commit;
