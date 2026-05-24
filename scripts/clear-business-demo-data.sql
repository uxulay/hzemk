-- 清理业务测试单据数据，保留基础资料。
-- 执行前请先确认已经备份 Supabase 数据库。
-- 本脚本不会清理产品、SKU、BOM、供应商、仓库、用户和角色。
-- 注意：当前 schema 没有单独的采购入库单、生产入库单、FBA 出库单表；
-- 这些动作通过 inventory_transactions 以及对应业务单据状态/数量字段记录。
-- inventory_items 没有“是否样本数据”的来源字段，因此这里会清空当前库存余额。
-- 如果 inventory_items 中已经有真实库存，请不要直接执行本脚本。

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
  public.fba_replenishment_requests
restart identity cascade;

commit;
