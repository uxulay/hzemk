-- 开发阶段批量导入、删除、停用策略
-- 目的：让基础资料页面可以在开发阶段测试 CSV 批量导入、停用和受保护删除。
-- 注意：这是开发阶段策略。生产环境必须按真实登录用户、管理员角色和操作权限收紧。
-- 重要：本文件不开放 inventory_transactions、inventory_items、采购单、生产任务、FBA 备货需求等业务流水/业务单据的 delete 权限。
-- 库存流水是历史账本，任何环境都不应该随便开放删除权限。

begin;

grant usage on schema public to anon, authenticated;

grant select, insert, update, delete on public.brands to anon, authenticated;
grant select, insert, update, delete on public.products to anon, authenticated;
grant select, insert, update, delete on public.skus to anon, authenticated;
grant select, insert, update, delete on public.suppliers to anon, authenticated;
grant select, insert, update, delete on public.warehouses to anon, authenticated;
grant select, insert, update, delete on public.bom_headers to anon, authenticated;
grant select, insert, update, delete on public.bom_items to anon, authenticated;

-- 这些表只用于删除保护检查，不开放 delete。
grant select on public.fba_replenishment_requests to anon, authenticated;
grant select on public.production_orders to anon, authenticated;
grant select on public.material_requirements to anon, authenticated;
grant select on public.purchase_orders to anon, authenticated;
grant select on public.purchase_order_items to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;
grant select on public.inventory_transactions to anon, authenticated;

alter table public.brands enable row level security;
alter table public.products enable row level security;
alter table public.skus enable row level security;
alter table public.suppliers enable row level security;
alter table public.warehouses enable row level security;
alter table public.bom_headers enable row level security;
alter table public.bom_items enable row level security;
alter table public.fba_replenishment_requests enable row level security;
alter table public.production_orders enable row level security;
alter table public.material_requirements enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.inventory_items enable row level security;
alter table public.inventory_transactions enable row level security;

drop policy if exists "dev bulk brands select" on public.brands;
create policy "dev bulk brands select"
on public.brands for select to anon, authenticated using (true);

drop policy if exists "dev bulk brands insert" on public.brands;
create policy "dev bulk brands insert"
on public.brands for insert to anon, authenticated with check (true);

drop policy if exists "dev bulk brands update" on public.brands;
create policy "dev bulk brands update"
on public.brands for update to anon, authenticated using (true) with check (true);

drop policy if exists "dev bulk brands delete" on public.brands;
create policy "dev bulk brands delete"
on public.brands for delete to anon, authenticated using (true);

drop policy if exists "dev bulk products select" on public.products;
create policy "dev bulk products select"
on public.products for select to anon, authenticated using (true);

drop policy if exists "dev bulk products insert" on public.products;
create policy "dev bulk products insert"
on public.products for insert to anon, authenticated with check (true);

drop policy if exists "dev bulk products update" on public.products;
create policy "dev bulk products update"
on public.products for update to anon, authenticated using (true) with check (true);

drop policy if exists "dev bulk products delete" on public.products;
create policy "dev bulk products delete"
on public.products for delete to anon, authenticated using (true);

drop policy if exists "dev bulk skus select" on public.skus;
create policy "dev bulk skus select"
on public.skus for select to anon, authenticated using (true);

drop policy if exists "dev bulk skus insert" on public.skus;
create policy "dev bulk skus insert"
on public.skus for insert to anon, authenticated with check (true);

drop policy if exists "dev bulk skus update" on public.skus;
create policy "dev bulk skus update"
on public.skus for update to anon, authenticated using (true) with check (true);

drop policy if exists "dev bulk skus delete" on public.skus;
create policy "dev bulk skus delete"
on public.skus for delete to anon, authenticated using (true);

drop policy if exists "dev bulk suppliers select" on public.suppliers;
create policy "dev bulk suppliers select"
on public.suppliers for select to anon, authenticated using (true);

drop policy if exists "dev bulk suppliers insert" on public.suppliers;
create policy "dev bulk suppliers insert"
on public.suppliers for insert to anon, authenticated with check (true);

drop policy if exists "dev bulk suppliers update" on public.suppliers;
create policy "dev bulk suppliers update"
on public.suppliers for update to anon, authenticated using (true) with check (true);

drop policy if exists "dev bulk suppliers delete" on public.suppliers;
create policy "dev bulk suppliers delete"
on public.suppliers for delete to anon, authenticated using (true);

drop policy if exists "dev bulk warehouses select" on public.warehouses;
create policy "dev bulk warehouses select"
on public.warehouses for select to anon, authenticated using (true);

drop policy if exists "dev bulk warehouses insert" on public.warehouses;
create policy "dev bulk warehouses insert"
on public.warehouses for insert to anon, authenticated with check (true);

drop policy if exists "dev bulk warehouses update" on public.warehouses;
create policy "dev bulk warehouses update"
on public.warehouses for update to anon, authenticated using (true) with check (true);

drop policy if exists "dev bulk warehouses delete" on public.warehouses;
create policy "dev bulk warehouses delete"
on public.warehouses for delete to anon, authenticated using (true);

drop policy if exists "dev bulk bom headers select" on public.bom_headers;
create policy "dev bulk bom headers select"
on public.bom_headers for select to anon, authenticated using (true);

drop policy if exists "dev bulk bom headers insert" on public.bom_headers;
create policy "dev bulk bom headers insert"
on public.bom_headers for insert to anon, authenticated with check (true);

drop policy if exists "dev bulk bom headers update" on public.bom_headers;
create policy "dev bulk bom headers update"
on public.bom_headers for update to anon, authenticated using (true) with check (true);

drop policy if exists "dev bulk bom headers delete" on public.bom_headers;
create policy "dev bulk bom headers delete"
on public.bom_headers for delete to anon, authenticated using (true);

drop policy if exists "dev bulk bom items select" on public.bom_items;
create policy "dev bulk bom items select"
on public.bom_items for select to anon, authenticated using (true);

drop policy if exists "dev bulk bom items insert" on public.bom_items;
create policy "dev bulk bom items insert"
on public.bom_items for insert to anon, authenticated with check (true);

drop policy if exists "dev bulk bom items update" on public.bom_items;
create policy "dev bulk bom items update"
on public.bom_items for update to anon, authenticated using (true) with check (true);

drop policy if exists "dev bulk bom items delete" on public.bom_items;
create policy "dev bulk bom items delete"
on public.bom_items for delete to anon, authenticated using (true);

-- 以下只读策略用于删除保护检查，不包含 delete。
drop policy if exists "dev bulk fba requests select" on public.fba_replenishment_requests;
create policy "dev bulk fba requests select"
on public.fba_replenishment_requests for select to anon, authenticated using (true);

drop policy if exists "dev bulk production orders select" on public.production_orders;
create policy "dev bulk production orders select"
on public.production_orders for select to anon, authenticated using (true);

drop policy if exists "dev bulk material requirements select" on public.material_requirements;
create policy "dev bulk material requirements select"
on public.material_requirements for select to anon, authenticated using (true);

drop policy if exists "dev bulk purchase orders select" on public.purchase_orders;
create policy "dev bulk purchase orders select"
on public.purchase_orders for select to anon, authenticated using (true);

drop policy if exists "dev bulk purchase order items select" on public.purchase_order_items;
create policy "dev bulk purchase order items select"
on public.purchase_order_items for select to anon, authenticated using (true);

drop policy if exists "dev bulk inventory items select" on public.inventory_items;
create policy "dev bulk inventory items select"
on public.inventory_items for select to anon, authenticated using (true);

drop policy if exists "dev bulk inventory transactions select" on public.inventory_transactions;
create policy "dev bulk inventory transactions select"
on public.inventory_transactions for select to anon, authenticated using (true);

commit;
