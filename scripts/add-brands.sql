-- 新增品牌管理所需表和产品关联字段。
-- 说明：
-- 1. 品牌只存放在 brands 表。
-- 2. 产品通过 products.brand_id 关联品牌。
-- 3. SKU、BOM、库存、FBA 备货、生产、采购等业务表不新增 brand_id。
-- 4. products.brand_id 允许为空，兼容已有产品。

begin;

create table if not exists public.brands (
  id uuid primary key default gen_random_uuid(),
  brand_code text not null unique,
  name text not null,
  english_name text,
  logo_url text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.products
add column if not exists brand_id uuid references public.brands(id) on delete set null;

create index if not exists idx_products_brand_id on public.products(brand_id);

comment on table public.brands is '品牌表：保存公司品牌基础资料。品牌属于产品 SPU，不直接挂在 SKU 上。';
comment on column public.brands.id is '主键 ID。';
comment on column public.brands.brand_code is '品牌编码。';
comment on column public.brands.name is '品牌名称。';
comment on column public.brands.english_name is '品牌英文名称。';
comment on column public.brands.logo_url is '品牌 Logo URL。当前阶段不做上传，先保存外部图片地址。';
comment on column public.brands.status is '品牌状态，例如 active、inactive。';
comment on column public.brands.notes is '备注。';
comment on column public.brands.created_at is '创建时间。';
comment on column public.brands.updated_at is '更新时间。';
comment on column public.products.brand_id is '所属品牌 ID。品牌属于产品 SPU，SKU 通过产品继承品牌。';

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'trg_brands_updated_at'
  ) then
    create trigger trg_brands_updated_at
    before update on public.brands
    for each row execute function public.set_updated_at();
  end if;
end $$;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on public.brands to anon, authenticated;
grant select, update on public.products to anon, authenticated;

alter table public.brands enable row level security;
alter table public.products enable row level security;

drop policy if exists "dev brands select" on public.brands;
create policy "dev brands select"
on public.brands for select to anon, authenticated using (true);

drop policy if exists "dev brands insert" on public.brands;
create policy "dev brands insert"
on public.brands for insert to anon, authenticated with check (true);

drop policy if exists "dev brands update" on public.brands;
create policy "dev brands update"
on public.brands for update to anon, authenticated using (true) with check (true);

drop policy if exists "dev brands delete" on public.brands;
create policy "dev brands delete"
on public.brands for delete to anon, authenticated using (true);

drop policy if exists "dev brands read products" on public.products;
create policy "dev brands read products"
on public.products for select to anon, authenticated using (true);

drop policy if exists "dev brands update products" on public.products;
create policy "dev brands update products"
on public.products for update to anon, authenticated using (true) with check (true);

commit;
