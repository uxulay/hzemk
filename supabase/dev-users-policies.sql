-- 开发阶段用户管理策略
-- 目的：让 /admin/users 页面可以读取 profiles、roles，并新增、编辑、启用/停用 profiles 用户资料。
-- 注意：这是开发阶段策略。生产环境必须按真实登录用户、管理员角色和操作权限收紧，不能长期这样放开。
-- 本文件不开放 delete，因为当前用户管理页面没有删除功能。
-- 本文件不会创建 Supabase Auth 账号，也不能绕过 profiles.id -> auth.users.id 外键。
-- 新增 profiles 时，profiles.id 仍然必须是已经存在的 auth.users.id。

begin;

grant usage on schema public to anon, authenticated;

grant select on public.roles to anon, authenticated;
grant select, insert, update on public.profiles to anon, authenticated;

alter table public.roles enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "dev users read roles" on public.roles;
drop policy if exists "dev users read profiles" on public.profiles;
drop policy if exists "dev users insert profiles" on public.profiles;
drop policy if exists "dev users update profiles" on public.profiles;

create policy "dev users read roles"
on public.roles
for select
to anon, authenticated
using (true);

create policy "dev users read profiles"
on public.profiles
for select
to anon, authenticated
using (true);

create policy "dev users insert profiles"
on public.profiles
for insert
to anon, authenticated
with check (true);

create policy "dev users update profiles"
on public.profiles
for update
to anon, authenticated
using (true)
with check (true);

commit;
