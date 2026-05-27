-- Round 4 performance cleanup helpers.
-- Copy this file into Supabase SQL Editor before using the related dashboard counts.

create or replace function public.count_inactive_supplier_references()
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.materials as m
  join public.suppliers as s
    on s.id = m.default_supplier_id
  where s.status = 'inactive';
$$;

create or replace function public.count_missing_bom_skus()
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.skus as s
  where s.status = 'active'
    and s.sku_type in ('finished_product', 'finished_good')
    and not exists (
      select 1
      from public.bom_headers as bh
      where bh.product_sku_id = s.id
        and bh.status = 'active'
    );
$$;

create or replace function public.count_accepted_fba_without_production()
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.fba_replenishment_requests as frr
  where frr.status = 'accepted'
    and not exists (
      select 1
      from public.production_orders as po
      where po.replenishment_request_id = frr.id
    );
$$;
