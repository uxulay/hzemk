-- 开发阶段供应商管理策略
-- 目的：让 /admin/suppliers 页面可以读取供应商、读取关联采购单，并新增、编辑、启用/停用供应商。
-- 注意：这是开发阶段策略。生产环境必须按真实登录用户、管理员/采购角色和操作权限收紧，不能长期这样放开。
-- 本文件不开放 delete，因为当前供应商管理页面没有删除功能。

begin;

grant usage on schema public to anon, authenticated;

-- 页面展示需要读取供应商和采购单。
grant select on public.suppliers to anon, authenticated;
grant select on public.purchase_orders to anon, authenticated;

-- 供应商管理页面需要新增、编辑、启用/停用供应商。
grant insert, update on public.suppliers to anon, authenticated;

alter table public.suppliers enable row level security;
alter table public.purchase_orders enable row level security;

drop policy if exists "dev suppliers read suppliers" on public.suppliers;
drop policy if exists "dev suppliers create suppliers" on public.suppliers;
drop policy if exists "dev suppliers update suppliers" on public.suppliers;
drop policy if exists "dev suppliers read purchase_orders" on public.purchase_orders;

create policy "dev suppliers read suppliers"
on public.suppliers
for select
to anon, authenticated
using (true);

create policy "dev suppliers create suppliers"
on public.suppliers
for insert
to anon, authenticated
with check (true);

create policy "dev suppliers update suppliers"
on public.suppliers
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev suppliers read purchase_orders"
on public.purchase_orders
for select
to anon, authenticated
using (true);

commit;
