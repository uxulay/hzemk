-- 开发阶段厂长排产写入策略
-- 目的：允许前端用 anon 或 authenticated 调试 /production/planning 页面。
-- 注意：这是开发阶段策略。生产环境必须改成“只有厂长或管理员可以接单、拒绝和创建生产任务”。
-- 本文件开放：
-- 1. fba_replenishment_requests 的 update，用于接单、拒绝、进入生产中。
-- 2. production_orders 的 insert，用于创建生产任务。

begin;

grant usage on schema public to anon, authenticated;
grant update on public.fba_replenishment_requests to anon, authenticated;
grant insert on public.production_orders to anon, authenticated;

alter table public.fba_replenishment_requests enable row level security;
alter table public.production_orders enable row level security;

drop policy if exists "dev allow update fba_replenishment_requests" on public.fba_replenishment_requests;
drop policy if exists "dev allow create production_orders" on public.production_orders;

create policy "dev allow update fba_replenishment_requests"
on public.fba_replenishment_requests
for update
to anon, authenticated
using (true)
with check (true);

create policy "dev allow create production_orders"
on public.production_orders
for insert
to anon, authenticated
with check (true);

commit;
