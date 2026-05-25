alter table if exists public.skus
add column if not exists default_supplier_id uuid references public.suppliers(id) on delete set null;

create index if not exists idx_skus_default_supplier_id
on public.skus(default_supplier_id);

comment on column public.skus.default_supplier_id is
'辅料默认供应商 ID。仅 sku_type = material 的 SKU 使用，成品和半成品可为空。';
