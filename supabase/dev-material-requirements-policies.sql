-- 开发阶段物料需求策略
-- 目的：允许前端调试“创建生产任务后自动生成物料需求”和 /materials/requirements 页面。
-- 注意：这是开发阶段策略。生产环境必须改成“厂长可生成，采购/厂长/管理员按角色查看和更新”。
-- 本文件不开放 delete，避免误删已经生成的物料需求。

begin;

grant usage on schema public to anon, authenticated;

-- 页面展示和自动计算需要读取这些表。
grant select on public.material_requirements to anon, authenticated;
grant select on public.production_orders to anon, authenticated;
grant select on public.skus to anon, authenticated;
grant select on public.bom_headers to anon, authenticated;
grant select on public.bom_items to anon, authenticated;
grant select on public.inventory_items to anon, authenticated;

-- 创建生产任务后需要写入物料需求；后续采购流程可能需要更新状态。
grant insert, update on public.material_requirements to anon, authenticated;

alter table public.material_requirements enable row level security;
alter table public.production_orders enable row level security;
alter table public.skus enable row level security;
alter table public.bom_headers enable row level security;
alter table public.bom_items enable row level security;
alter table public.inventory_items enable row level security;

drop policy if exists "dev allow read material_requirements" on public.material_requirements;
drop policy if exists "dev allow create material_requirements" on public.material_requirements;
drop policy if exists "dev allow update material_requirements" on public.material_requirements;
drop policy if exists "dev allow read production_orders" on public.production_orders;
drop policy if exists "dev allow read skus" on public.skus;
drop policy if exists "dev allow read bom_headers" on public.bom_headers;
drop policy if exists "dev allow read bom_items" on public.bom_items;
drop policy if exists "dev allow read inventory_items" on public.inventory_items;

create policy "dev allow read material_requirements"
on public.material_requirements
for select
to anon, authenticated
using (true);

create policy "dev allow create material_requirements"
on public.material_requirements
for insert
to anon, authenticated
with check (true);

create policy "dev allow update material_requirements"
on public.material_requirements
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev allow read production_orders"
on public.production_orders
for select
to anon, authenticated
using (true);

create policy "dev allow read skus"
on public.skus
for select
to anon, authenticated
using (true);

create policy "dev allow read bom_headers"
on public.bom_headers
for select
to anon, authenticated
using (true);

create policy "dev allow read bom_items"
on public.bom_items
for select
to anon, authenticated
using (true);

create policy "dev allow read inventory_items"
on public.inventory_items
for select
to anon, authenticated
using (true);

commit;
