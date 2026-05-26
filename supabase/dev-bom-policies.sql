-- 开发阶段 BOM 管理策略
-- 目的：让 /bom 页面可以读取产品、SKU、辅料、BOM 主表和 BOM 明细，并可以新增/更新 BOM。
-- 注意：这是开发阶段策略。生产环境必须按真实登录用户和角色收紧权限，不能长期这样放开。
-- 本文件不开放 delete，因为当前 BOM 页面没有删除功能。

begin;

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.products to anon, authenticated;
grant select, insert, update on public.skus to anon, authenticated;
grant select on public.materials to anon, authenticated;
grant select, insert, update on public.bom_headers to anon, authenticated;
grant select, insert, update on public.bom_items to anon, authenticated;

alter table public.products enable row level security;
alter table public.skus enable row level security;
alter table public.materials enable row level security;
alter table public.bom_headers enable row level security;
alter table public.bom_items enable row level security;

drop policy if exists "dev bom read products" on public.products;
create policy "dev bom read products"
on public.products
for select
to anon, authenticated
using (true);

drop policy if exists "dev bom insert products" on public.products;
create policy "dev bom insert products"
on public.products
for insert
to anon, authenticated
with check (true);

drop policy if exists "dev bom update products" on public.products;
create policy "dev bom update products"
on public.products
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev bom read skus" on public.skus;
create policy "dev bom read skus"
on public.skus
for select
to anon, authenticated
using (true);

drop policy if exists "dev bom insert skus" on public.skus;
create policy "dev bom insert skus"
on public.skus
for insert
to anon, authenticated
with check (true);

drop policy if exists "dev bom update skus" on public.skus;
create policy "dev bom update skus"
on public.skus
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev bom read materials" on public.materials;
create policy "dev bom read materials"
on public.materials
for select
to anon, authenticated
using (true);

drop policy if exists "dev bom read bom_headers" on public.bom_headers;
create policy "dev bom read bom_headers"
on public.bom_headers
for select
to anon, authenticated
using (true);

drop policy if exists "dev bom insert bom_headers" on public.bom_headers;
create policy "dev bom insert bom_headers"
on public.bom_headers
for insert
to anon, authenticated
with check (true);

drop policy if exists "dev bom update bom_headers" on public.bom_headers;
create policy "dev bom update bom_headers"
on public.bom_headers
for update
to anon, authenticated
using (true)
with check (true);

drop policy if exists "dev bom read bom_items" on public.bom_items;
create policy "dev bom read bom_items"
on public.bom_items
for select
to anon, authenticated
using (true);

drop policy if exists "dev bom insert bom_items" on public.bom_items;
create policy "dev bom insert bom_items"
on public.bom_items
for insert
to anon, authenticated
with check (true);

drop policy if exists "dev bom update bom_items" on public.bom_items;
create policy "dev bom update bom_items"
on public.bom_items
for update
to anon, authenticated
using (true)
with check (true);

commit;
