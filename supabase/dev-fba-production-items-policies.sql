-- 开发阶段 FBA 备货单明细和生产任务明细策略
-- 目的：允许前端用 anon 或 authenticated 调试整张 FBA 备货单、整张生产任务和 BOM 自动算料。
-- 注意：这是开发阶段策略。生产环境必须按角色收紧权限，例如运营只能创建备货单，厂长只能排产和领料。

begin;

grant usage on schema public to anon, authenticated;

grant select, insert, update on public.fba_replenishment_requests to anon, authenticated;
grant select, insert, update on public.fba_replenishment_request_items to anon, authenticated;
grant select, insert, update on public.production_orders to anon, authenticated;
grant select, insert, update on public.production_order_items to anon, authenticated;
grant select on public.products to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.warehouses to anon, authenticated;
grant select, insert, update on public.material_requirements to anon, authenticated;
grant select on public.bom_headers to anon, authenticated;
grant select on public.bom_items to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;

alter table public.fba_replenishment_requests enable row level security;
alter table public.fba_replenishment_request_items enable row level security;
alter table public.production_orders enable row level security;
alter table public.production_order_items enable row level security;
alter table public.products enable row level security;
alter table public.skus enable row level security;
alter table public.warehouses enable row level security;
alter table public.material_requirements enable row level security;
alter table public.bom_headers enable row level security;
alter table public.bom_items enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "dev allow select fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev allow insert fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev allow update fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev allow select fba_replenishment_request_items" on public.fba_replenishment_request_items;
drop policy if exists "dev allow insert fba_replenishment_request_items" on public.fba_replenishment_request_items;
drop policy if exists "dev allow update fba_replenishment_request_items" on public.fba_replenishment_request_items;
drop policy if exists "dev allow select production_orders" on public.production_orders;
drop policy if exists "dev allow insert production_orders" on public.production_orders;
drop policy if exists "dev allow update production_orders" on public.production_orders;
drop policy if exists "dev allow select production_order_items" on public.production_order_items;
drop policy if exists "dev allow insert production_order_items" on public.production_order_items;
drop policy if exists "dev allow update production_order_items" on public.production_order_items;
drop policy if exists "dev allow select products" on public.products;
drop policy if exists "dev allow select skus" on public.skus;
drop policy if exists "dev allow select warehouses" on public.warehouses;
drop policy if exists "dev allow select material_requirements" on public.material_requirements;
drop policy if exists "dev allow insert material_requirements" on public.material_requirements;
drop policy if exists "dev allow update material_requirements" on public.material_requirements;
drop policy if exists "dev allow select bom_headers" on public.bom_headers;
drop policy if exists "dev allow select bom_items" on public.bom_items;
drop policy if exists "dev allow select inventory_items" on public.inventory_items;

create policy "dev allow select fba_replenishment_requests" on public.fba_replenishment_requests for select to anon, authenticated using (true);
create policy "dev allow insert fba_replenishment_requests" on public.fba_replenishment_requests for insert to anon, authenticated with check (true);
create policy "dev allow update fba_replenishment_requests" on public.fba_replenishment_requests for update to anon, authenticated using (true) with check (true);

create policy "dev allow select fba_replenishment_request_items" on public.fba_replenishment_request_items for select to anon, authenticated using (true);
create policy "dev allow insert fba_replenishment_request_items" on public.fba_replenishment_request_items for insert to anon, authenticated with check (true);
create policy "dev allow update fba_replenishment_request_items" on public.fba_replenishment_request_items for update to anon, authenticated using (true) with check (true);

create policy "dev allow select production_orders" on public.production_orders for select to anon, authenticated using (true);
create policy "dev allow insert production_orders" on public.production_orders for insert to anon, authenticated with check (true);
create policy "dev allow update production_orders" on public.production_orders for update to anon, authenticated using (true) with check (true);

create policy "dev allow select production_order_items" on public.production_order_items for select to anon, authenticated using (true);
create policy "dev allow insert production_order_items" on public.production_order_items for insert to anon, authenticated with check (true);
create policy "dev allow update production_order_items" on public.production_order_items for update to anon, authenticated using (true) with check (true);

create policy "dev allow select products" on public.products for select to anon, authenticated using (true);
create policy "dev allow select skus" on public.skus for select to anon, authenticated using (true);
create policy "dev allow select warehouses" on public.warehouses for select to anon, authenticated using (true);

create policy "dev allow select material_requirements" on public.material_requirements for select to anon, authenticated using (true);
create policy "dev allow insert material_requirements" on public.material_requirements for insert to anon, authenticated with check (true);
create policy "dev allow update material_requirements" on public.material_requirements for update to anon, authenticated using (true) with check (true);

create policy "dev allow select bom_headers" on public.bom_headers for select to anon, authenticated using (true);
create policy "dev allow select bom_items" on public.bom_items for select to anon, authenticated using (true);
create policy "dev allow select inventory_items" on public.inventory_items for select to anon, authenticated using (true);

commit;
