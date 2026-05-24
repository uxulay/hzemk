-- 清空所有测试数据，适合重新初始化系统。
-- 执行前请先确认已经备份 Supabase 数据库。
-- 本脚本会清空业务单据、库存、BOM、产品、SKU、供应商和仓库。
-- 本脚本保留 roles、profiles 和 auth.users，不会清空用户和角色。
-- 当前项目没有单独 materials 表；原材料保存在 skus 表中，通过 sku_type = 'material' 区分。
-- 当前 schema 没有单独的采购入库单、生产入库单、FBA 出库单表；
-- 这些动作通过 inventory_transactions 以及对应业务单据状态/数量字段记录。

begin;

truncate table
  public.inventory_transactions,
  public.inventory_items,
  public.purchase_order_items,
  public.purchase_orders,
  public.material_requirements,
  public.production_order_items,
  public.production_orders,
  public.fba_replenishment_request_items,
  public.fba_replenishment_requests,
  public.bom_items,
  public.bom_headers,
  public.skus,
  public.products,
  public.suppliers,
  public.warehouses
restart identity cascade;

commit;
