-- 开发阶段 FBA 备货需求创建策略
-- 目的：允许前端用 anon 或 authenticated 创建 FBA 备货需求，方便调试 /replenishment/new。
-- 注意：这是开发阶段策略。生产环境必须改成“只有运营或管理员可以创建”。
-- 本文件只开放 fba_replenishment_requests 的 insert，不开放 update / delete。

begin;

grant usage on schema public to anon, authenticated;
grant insert on public.fba_replenishment_requests to anon, authenticated;

alter table public.fba_replenishment_requests enable row level security;

drop policy if exists "dev allow create fba_replenishment_requests" on public.fba_replenishment_requests;

create policy "dev allow create fba_replenishment_requests"
on public.fba_replenishment_requests
for insert
to anon, authenticated
with check (true);

commit;
