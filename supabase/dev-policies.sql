-- 开发阶段 RLS 读取策略
-- 目的：允许前端匿名用户 anon 和已登录用户 authenticated 读取测试数据，方便调试页面。
-- 注意：这是开发阶段策略。生产环境不能长期这样放开，需要按角色收紧权限。
-- 本文件只开放 select，不开放 insert / update / delete。

begin;

grant usage on schema public to anon, authenticated;

grant select on public.roles to anon, authenticated;
grant select on public.profiles to anon, authenticated;
grant select on public.brands to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.materials to anon, authenticated;
grant select on public.suppliers to anon, authenticated;
grant select on public.warehouses to anon, authenticated;
grant select on public.bom_headers to anon, authenticated;
grant select on public.bom_items to anon, authenticated;
grant select on public.fba_replenishment_requests to anon, authenticated;
grant select on public.production_orders to anon, authenticated;
grant select on public.material_requirements to anon, authenticated;
grant select on public.purchase_orders to anon, authenticated;
grant select on public.purchase_order_items to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;
grant select on public.inventory_transactions to anon, authenticated;

alter table public.roles enable row level security;
drop policy if exists "dev allow read roles" on public.roles;
create policy "dev allow read roles"
on public.roles
for select
to anon, authenticated
using (true);

alter table public.profiles enable row level security;
drop policy if exists "dev allow read profiles" on public.profiles;
create policy "dev allow read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

alter table public.brands enable row level security;
drop policy if exists "dev allow read brands" on public.brands;
create policy "dev allow read brands"
on public.brands
for select
to anon, authenticated
using (true);

alter table public.products enable row level security;
drop policy if exists "dev allow read products" on public.products;
create policy "dev allow read products"
on public.products
for select
to anon, authenticated
using (true);

alter table public.skus enable row level security;
drop policy if exists "dev allow read skus" on public.skus;
create policy "dev allow read skus"
on public.skus
for select
to anon, authenticated
using (true);

alter table public.materials enable row level security;
drop policy if exists "dev allow read materials" on public.materials;
create policy "dev allow read materials"
on public.materials
for select
to anon, authenticated
using (true);

alter table public.suppliers enable row level security;
drop policy if exists "dev allow read suppliers" on public.suppliers;
create policy "dev allow read suppliers"
on public.suppliers
for select
to anon, authenticated
using (true);

alter table public.warehouses enable row level security;
drop policy if exists "dev allow read warehouses" on public.warehouses;
create policy "dev allow read warehouses"
on public.warehouses
for select
to anon, authenticated
using (true);

alter table public.bom_headers enable row level security;
drop policy if exists "dev allow read bom_headers" on public.bom_headers;
create policy "dev allow read bom_headers"
on public.bom_headers
for select
to anon, authenticated
using (true);

alter table public.bom_items enable row level security;
drop policy if exists "dev allow read bom_items" on public.bom_items;
create policy "dev allow read bom_items"
on public.bom_items
for select
to anon, authenticated
using (true);

alter table public.fba_replenishment_requests enable row level security;
drop policy if exists "dev allow read fba_replenishment_requests" on public.fba_replenishment_requests;
create policy "dev allow read fba_replenishment_requests"
on public.fba_replenishment_requests
for select
to anon, authenticated
using (true);

alter table public.production_orders enable row level security;
drop policy if exists "dev allow read production_orders" on public.production_orders;
create policy "dev allow read production_orders"
on public.production_orders
for select
to anon, authenticated
using (true);

alter table public.material_requirements enable row level security;
drop policy if exists "dev allow read material_requirements" on public.material_requirements;
create policy "dev allow read material_requirements"
on public.material_requirements
for select
to anon, authenticated
using (true);

alter table public.purchase_orders enable row level security;
drop policy if exists "dev allow read purchase_orders" on public.purchase_orders;
create policy "dev allow read purchase_orders"
on public.purchase_orders
for select
to anon, authenticated
using (true);

alter table public.purchase_order_items enable row level security;
drop policy if exists "dev allow read purchase_order_items" on public.purchase_order_items;
create policy "dev allow read purchase_order_items"
on public.purchase_order_items
for select
to anon, authenticated
using (true);

alter table public.inventory_items enable row level security;
drop policy if exists "dev allow read inventory_items" on public.inventory_items;
create policy "dev allow read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

alter table public.inventory_transactions enable row level security;
drop policy if exists "dev allow read inventory_transactions" on public.inventory_transactions;
create policy "dev allow read inventory_transactions"
on public.inventory_transactions
for select
to anon, authenticated
using (true);

commit;
