-- Seed data for the FBA replenishment production management system.
-- Run schema.sql first, then run this file in Supabase SQL Editor.
-- This file uses fixed UUIDs so test data can be referenced predictably.
-- No real sensitive information is included.

begin;

-- 1. Roles
insert into public.roles (id, code, name, description)
values
  ('00000000-0000-4000-8000-000000000001', 'admin', '管理员', '管理用户、角色、产品、SKU、BOM 等基础资料'),
  ('00000000-0000-4000-8000-000000000002', 'operator', '运营', '创建和查看 FBA 备货需求'),
  ('00000000-0000-4000-8000-000000000003', 'factory_manager', '厂长', '接收备货需求并安排生产任务'),
  ('00000000-0000-4000-8000-000000000004', 'purchaser', '采购', '查看缺料并创建采购单'),
  ('00000000-0000-4000-8000-000000000005', 'warehouse', '仓库', '管理库存和出入库流水')
on conflict (id) do update set
  code = excluded.code,
  name = excluded.name,
  description = excluded.description;

-- 2. Warehouses
insert into public.warehouses (id, warehouse_code, name, warehouse_type, address, status)
values
  ('10000000-0000-4000-8000-000000000001', 'WH-MATERIAL', '原材料仓', 'material', '测试园区 A 栋 1 楼', 'active'),
  ('10000000-0000-4000-8000-000000000002', 'WH-FINISHED', '成品仓', 'finished_product', '测试园区 A 栋 2 楼', 'active'),
  ('10000000-0000-4000-8000-000000000003', 'WH-SEMI', '半成品仓', 'semi_finished', '测试园区 B 栋 1 楼', 'active'),
  ('10000000-0000-4000-8000-000000000004', 'WH-FBA-STAGING', 'FBA 发货暂存仓', 'fba', '测试园区发货区', 'active')
on conflict (id) do update set
  warehouse_code = excluded.warehouse_code,
  name = excluded.name,
  warehouse_type = excluded.warehouse_type,
  address = excluded.address,
  status = excluded.status;

-- 3. Suppliers
insert into public.suppliers (id, supplier_code, name, contact_name, phone, email, address, status, notes)
values
  ('20000000-0000-4000-8000-000000000001', 'SUP-PACKAGING', '包材供应商', '测试联系人 A', '13800000001', 'packaging@example.test', '测试包材工业园', 'active', '纸箱、说明书、包装袋等测试供应商'),
  ('20000000-0000-4000-8000-000000000002', 'SUP-HARDWARE', '五金供应商', '测试联系人 B', '13800000002', 'hardware@example.test', '测试五金市场', 'active', '螺丝、不锈钢管等测试供应商'),
  ('20000000-0000-4000-8000-000000000003', 'SUP-RAW', '原料供应商', '测试联系人 C', '13800000003', 'raw@example.test', '测试原料园区', 'active', '塑料件等测试供应商')
on conflict (id) do update set
  supplier_code = excluded.supplier_code,
  name = excluded.name,
  contact_name = excluded.contact_name,
  phone = excluded.phone,
  email = excluded.email,
  address = excluded.address,
  status = excluded.status,
  notes = excluded.notes;

-- 4. Products
insert into public.products (id, product_code, name, category, description, status)
values
  ('30000000-0000-4000-8000-000000000001', 'PROD-STORAGE-BOX', '折叠收纳箱', '家居收纳', '用于亚马逊 FBA 备货测试的折叠收纳箱产品', 'active'),
  ('30000000-0000-4000-8000-000000000002', 'PROD-PET-COMB', '宠物梳', '宠物用品', '用于亚马逊 FBA 备货测试的宠物梳产品', 'active'),
  ('30000000-0000-4000-8000-000000000003', 'PROD-KITCHEN-RACK', '厨房置物架', '厨房用品', '用于亚马逊 FBA 备货测试的厨房置物架产品', 'active')
on conflict (id) do update set
  product_code = excluded.product_code,
  name = excluded.name,
  category = excluded.category,
  description = excluded.description,
  status = excluded.status;

-- 5. Finished product SKUs
insert into public.skus (id, product_id, sku_code, sku_name, sku_type, amazon_sku, fnsku, unit, specs, status)
values
  ('40000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', 'STORAGE-BOX-BLACK', '折叠收纳箱 黑色', 'finished_good', 'AMZ-STORAGE-BOX-BLACK', 'FNSKU-BOX-BLK', 'pcs', '黑色 / 标准款', 'active'),
  ('40000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', 'STORAGE-BOX-WHITE', '折叠收纳箱 白色', 'finished_good', 'AMZ-STORAGE-BOX-WHITE', 'FNSKU-BOX-WHT', 'pcs', '白色 / 标准款', 'active'),
  ('40000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', 'PET-COMB-BLUE', '宠物梳 蓝色', 'finished_good', 'AMZ-PET-COMB-BLUE', 'FNSKU-COMB-BLU', 'pcs', '蓝色 / 常规齿', 'active'),
  ('40000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000002', 'PET-COMB-PINK', '宠物梳 粉色', 'finished_good', 'AMZ-PET-COMB-PINK', 'FNSKU-COMB-PNK', 'pcs', '粉色 / 常规齿', 'active'),
  ('40000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000003', 'KITCHEN-RACK-S', '厨房置物架 小号', 'finished_good', 'AMZ-KITCHEN-RACK-S', 'FNSKU-RACK-S', 'pcs', '小号 / 单层', 'active'),
  ('40000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000003', 'KITCHEN-RACK-L', '厨房置物架 大号', 'finished_good', 'AMZ-KITCHEN-RACK-L', 'FNSKU-RACK-L', 'pcs', '大号 / 双层', 'active')
on conflict (id) do update set
  product_id = excluded.product_id,
  sku_code = excluded.sku_code,
  sku_name = excluded.sku_name,
  sku_type = excluded.sku_type,
  amazon_sku = excluded.amazon_sku,
  fnsku = excluded.fnsku,
  unit = excluded.unit,
  specs = excluded.specs,
  status = excluded.status;

-- 6. Material SKUs
-- There is no separate materials table in the current schema.
-- Materials are stored in skus with sku_type = 'material'.
insert into public.skus (id, product_id, sku_code, sku_name, sku_type, unit, specs, status)
values
  ('50000000-0000-4000-8000-000000000001', null, 'MAT-CARTON', '纸箱', 'material', 'pcs', '通用外箱', 'active'),
  ('50000000-0000-4000-8000-000000000002', null, 'MAT-MANUAL', '说明书', 'material', 'pcs', '通用说明书', 'active'),
  ('50000000-0000-4000-8000-000000000003', null, 'MAT-SCREW', '螺丝', 'material', 'pcs', 'M4 测试螺丝', 'active'),
  ('50000000-0000-4000-8000-000000000004', null, 'MAT-PLASTIC-PART', '塑料件', 'material', 'pcs', '收纳箱塑料件', 'active'),
  ('50000000-0000-4000-8000-000000000005', null, 'MAT-PACKING-BAG', '包装袋', 'material', 'pcs', '透明包装袋', 'active'),
  ('50000000-0000-4000-8000-000000000006', null, 'MAT-STEEL-TUBE', '不锈钢管', 'material', 'pcs', '置物架不锈钢管', 'active')
on conflict (id) do update set
  product_id = excluded.product_id,
  sku_code = excluded.sku_code,
  sku_name = excluded.sku_name,
  sku_type = excluded.sku_type,
  unit = excluded.unit,
  specs = excluded.specs,
  status = excluded.status;

-- 7. BOM headers
insert into public.bom_headers (id, product_sku_id, bom_code, version, status, effective_from, notes)
values
  ('60000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', 'BOM-STORAGE-BOX-BLACK-V1', 'v1', 'active', '2026-05-20', '折叠收纳箱黑色测试 BOM'),
  ('60000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000005', 'BOM-KITCHEN-RACK-S-V1', 'v1', 'active', '2026-05-20', '厨房置物架小号测试 BOM')
on conflict (id) do update set
  product_sku_id = excluded.product_sku_id,
  bom_code = excluded.bom_code,
  version = excluded.version,
  status = excluded.status,
  effective_from = excluded.effective_from,
  notes = excluded.notes;

-- 7. BOM items
insert into public.bom_items (id, bom_header_id, component_sku_id, quantity_per, unit, loss_rate, notes)
values
  ('61000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 1, 'pcs', 0, '每个收纳箱 1 个纸箱'),
  ('61000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 1, 'pcs', 0, '每个收纳箱 1 张说明书'),
  ('61000000-0000-4000-8000-000000000003', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', 4, 'pcs', 0, '每个收纳箱 4 个塑料件'),
  ('61000000-0000-4000-8000-000000000004', '60000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000005', 1, 'pcs', 0, '每个收纳箱 1 个包装袋'),
  ('61000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 1, 'pcs', 0, '每个置物架 1 个纸箱'),
  ('61000000-0000-4000-8000-000000000006', '60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000003', 8, 'pcs', 0, '每个置物架 8 个螺丝'),
  ('61000000-0000-4000-8000-000000000007', '60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000006', 4, 'pcs', 0, '每个置物架 4 根不锈钢管'),
  ('61000000-0000-4000-8000-000000000008', '60000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 1, 'pcs', 0, '每个置物架 1 张说明书')
on conflict (id) do update set
  bom_header_id = excluded.bom_header_id,
  component_sku_id = excluded.component_sku_id,
  quantity_per = excluded.quantity_per,
  unit = excluded.unit,
  loss_rate = excluded.loss_rate,
  notes = excluded.notes;

-- 8. Inventory items
insert into public.inventory_items (id, warehouse_id, sku_id, item_type, quantity_on_hand, reserved_quantity, safety_stock_quantity, unit)
values
  ('92000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'material', 300, 0, 80, 'pcs'),
  ('92000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002', 'material', 1000, 0, 200, 'pcs'),
  ('92000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'material', 100, 0, 200, 'pcs'),
  ('92000000-0000-4000-8000-000000000004', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', 'material', 150, 0, 200, 'pcs'),
  ('92000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000005', 'material', 500, 0, 100, 'pcs'),
  ('92000000-0000-4000-8000-000000000006', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000006', 'material', 40, 0, 120, 'pcs'),
  ('92000000-0000-4000-8000-000000000007', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', 'finished_product', 20, 0, 10, 'pcs'),
  ('92000000-0000-4000-8000-000000000008', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', 'finished_product', 8, 0, 10, 'pcs'),
  ('92000000-0000-4000-8000-000000000009', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000005', 'finished_product', 5, 0, 10, 'pcs'),
  ('92000000-0000-4000-8000-000000000010', '10000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', 'finished_product', 12, 0, 0, 'pcs')
on conflict (id) do update set
  warehouse_id = excluded.warehouse_id,
  sku_id = excluded.sku_id,
  item_type = excluded.item_type,
  quantity_on_hand = excluded.quantity_on_hand,
  reserved_quantity = excluded.reserved_quantity,
  safety_stock_quantity = excluded.safety_stock_quantity,
  unit = excluded.unit;

-- 9. FBA replenishment requests
insert into public.fba_replenishment_requests (
  id,
  request_no,
  requested_by,
  sku_id,
  target_warehouse_id,
  fba_warehouse_code,
  requested_quantity,
  target_ship_date,
  priority,
  status,
  accepted_by,
  accepted_at,
  rejected_reason,
  notes
)
values
  ('70000000-0000-4000-8000-000000000001', 'FBA-RQ-20260520-001', null, '40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000004', 'ONT8', 80, '2026-06-05', 'normal', 'submitted', null, null, null, '白色收纳箱测试备货需求，等待厂长排产'),
  ('70000000-0000-4000-8000-000000000002', 'FBA-RQ-20260520-002', null, '40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000004', 'LAX9', 50, '2026-06-08', 'high', 'accepted', null, '2026-05-20 10:00:00+08', null, '黑色收纳箱测试备货需求，已接单'),
  ('70000000-0000-4000-8000-000000000003', 'FBA-RQ-20260520-003', null, '40000000-0000-4000-8000-000000000005', '10000000-0000-4000-8000-000000000004', 'SMF3', 20, '2026-06-10', 'urgent', 'in_production', null, '2026-05-20 11:00:00+08', null, '厨房置物架小号测试备货需求，生产中')
on conflict (id) do update set
  request_no = excluded.request_no,
  requested_by = excluded.requested_by,
  sku_id = excluded.sku_id,
  target_warehouse_id = excluded.target_warehouse_id,
  fba_warehouse_code = excluded.fba_warehouse_code,
  requested_quantity = excluded.requested_quantity,
  target_ship_date = excluded.target_ship_date,
  priority = excluded.priority,
  status = excluded.status,
  accepted_by = excluded.accepted_by,
  accepted_at = excluded.accepted_at,
  rejected_reason = excluded.rejected_reason,
  notes = excluded.notes;

-- 10. Production orders
insert into public.production_orders (
  id,
  production_order_no,
  replenishment_request_id,
  sku_id,
  bom_header_id,
  planned_quantity,
  completed_quantity,
  planned_start_date,
  planned_end_date,
  actual_start_at,
  actual_completed_at,
  status,
  assigned_to,
  notes
)
values
  ('80000000-0000-4000-8000-000000000001', 'MO-20260520-001', '70000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 50, 0, '2026-05-22', '2026-05-28', null, null, 'material_pending', null, '黑色收纳箱生产任务，塑料件不足'),
  ('80000000-0000-4000-8000-000000000002', 'MO-20260520-002', '70000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000005', '60000000-0000-4000-8000-000000000002', 20, 5, '2026-05-20', '2026-05-25', '2026-05-20 13:00:00+08', null, 'in_progress', null, '厨房置物架小号生产任务，螺丝和不锈钢管不足')
on conflict (id) do update set
  production_order_no = excluded.production_order_no,
  replenishment_request_id = excluded.replenishment_request_id,
  sku_id = excluded.sku_id,
  bom_header_id = excluded.bom_header_id,
  planned_quantity = excluded.planned_quantity,
  completed_quantity = excluded.completed_quantity,
  planned_start_date = excluded.planned_start_date,
  planned_end_date = excluded.planned_end_date,
  actual_start_at = excluded.actual_start_at,
  actual_completed_at = excluded.actual_completed_at,
  status = excluded.status,
  assigned_to = excluded.assigned_to,
  notes = excluded.notes;

-- 11. Material requirements
insert into public.material_requirements (
  id,
  production_order_id,
  replenishment_request_id,
  material_sku_id,
  required_quantity,
  available_quantity,
  shortage_quantity,
  reserved_quantity,
  unit,
  status,
  notes
)
values
  ('81000000-0000-4000-8000-000000000001', '80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000001', 50, 300, 0, 50, 'pcs', 'ready', '纸箱库存足够'),
  ('81000000-0000-4000-8000-000000000002', '80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000002', 50, 1000, 0, 50, 'pcs', 'ready', '说明书库存足够'),
  ('81000000-0000-4000-8000-000000000003', '80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000004', 200, 150, 50, 0, 'pcs', 'shortage', '塑料件缺 50 个'),
  ('81000000-0000-4000-8000-000000000004', '80000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', '50000000-0000-4000-8000-000000000005', 50, 500, 0, 50, 'pcs', 'ready', '包装袋库存足够'),
  ('81000000-0000-4000-8000-000000000005', '80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000001', 20, 300, 0, 20, 'pcs', 'ready', '纸箱库存足够'),
  ('81000000-0000-4000-8000-000000000006', '80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000003', 160, 100, 60, 0, 'pcs', 'shortage', '螺丝缺 60 个'),
  ('81000000-0000-4000-8000-000000000007', '80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000006', 80, 40, 40, 0, 'pcs', 'shortage', '不锈钢管缺 40 根'),
  ('81000000-0000-4000-8000-000000000008', '80000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000002', 20, 1000, 0, 20, 'pcs', 'ready', '说明书库存足够')
on conflict (id) do update set
  production_order_id = excluded.production_order_id,
  replenishment_request_id = excluded.replenishment_request_id,
  material_sku_id = excluded.material_sku_id,
  required_quantity = excluded.required_quantity,
  available_quantity = excluded.available_quantity,
  shortage_quantity = excluded.shortage_quantity,
  reserved_quantity = excluded.reserved_quantity,
  unit = excluded.unit,
  status = excluded.status,
  notes = excluded.notes;

-- 12. Purchase order and items for shortage materials
insert into public.purchase_orders (
  id,
  purchase_order_no,
  supplier_id,
  warehouse_id,
  created_by,
  status,
  ordered_at,
  expected_arrival_date,
  received_at,
  notes
)
values
  ('90000000-0000-4000-8000-000000000001', 'PO-20260520-001', '20000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', null, 'ordered', '2026-05-20 15:00:00+08', '2026-05-24', null, '补充螺丝和不锈钢管等缺料测试采购单')
on conflict (id) do update set
  purchase_order_no = excluded.purchase_order_no,
  supplier_id = excluded.supplier_id,
  warehouse_id = excluded.warehouse_id,
  created_by = excluded.created_by,
  status = excluded.status,
  ordered_at = excluded.ordered_at,
  expected_arrival_date = excluded.expected_arrival_date,
  received_at = excluded.received_at,
  notes = excluded.notes;

insert into public.purchase_order_items (
  id,
  purchase_order_id,
  sku_id,
  material_requirement_id,
  ordered_quantity,
  received_quantity,
  unit,
  unit_price,
  notes
)
values
  ('91000000-0000-4000-8000-000000000001', '90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000004', '81000000-0000-4000-8000-000000000003', 100, 0, 'pcs', 0.8, '补塑料件缺料'),
  ('91000000-0000-4000-8000-000000000002', '90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', '81000000-0000-4000-8000-000000000006', 200, 0, 'pcs', 0.12, '补螺丝缺料'),
  ('91000000-0000-4000-8000-000000000003', '90000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000006', '81000000-0000-4000-8000-000000000007', 100, 0, 'pcs', 3.5, '补不锈钢管缺料')
on conflict (id) do update set
  purchase_order_id = excluded.purchase_order_id,
  sku_id = excluded.sku_id,
  material_requirement_id = excluded.material_requirement_id,
  ordered_quantity = excluded.ordered_quantity,
  received_quantity = excluded.received_quantity,
  unit = excluded.unit,
  unit_price = excluded.unit_price,
  notes = excluded.notes;

-- 13. Inventory transactions
insert into public.inventory_transactions (
  id,
  transaction_no,
  warehouse_id,
  sku_id,
  transaction_type,
  quantity,
  production_order_id,
  purchase_order_id,
  replenishment_request_id,
  operator_id,
  occurred_at,
  notes
)
values
  ('93000000-0000-4000-8000-000000000001', 'INV-20260520-001', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'material_in', 300, null, null, null, null, '2026-05-20 09:00:00+08', '纸箱测试入库'),
  ('93000000-0000-4000-8000-000000000002', 'INV-20260520-002', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000001', 'material_out', 20, '80000000-0000-4000-8000-000000000002', null, '70000000-0000-4000-8000-000000000003', null, '2026-05-20 13:30:00+08', '厨房置物架生产领用纸箱'),
  ('93000000-0000-4000-8000-000000000003', 'INV-20260520-003', '10000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000005', 'product_in', 5, '80000000-0000-4000-8000-000000000002', null, '70000000-0000-4000-8000-000000000003', null, '2026-05-20 17:00:00+08', '厨房置物架小号部分成品入库'),
  ('93000000-0000-4000-8000-000000000004', 'INV-20260520-004', '10000000-0000-4000-8000-000000000004', '40000000-0000-4000-8000-000000000001', 'product_out', 5, null, null, '70000000-0000-4000-8000-000000000002', null, '2026-05-20 18:00:00+08', '黑色收纳箱测试发往 FBA'),
  ('93000000-0000-4000-8000-000000000005', 'INV-20260520-005', '10000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000003', 'adjustment', 10, null, null, null, null, '2026-05-20 18:30:00+08', '盘点后螺丝库存调整')
on conflict (id) do update set
  transaction_no = excluded.transaction_no,
  warehouse_id = excluded.warehouse_id,
  sku_id = excluded.sku_id,
  transaction_type = excluded.transaction_type,
  quantity = excluded.quantity,
  production_order_id = excluded.production_order_id,
  purchase_order_id = excluded.purchase_order_id,
  replenishment_request_id = excluded.replenishment_request_id,
  operator_id = excluded.operator_id,
  occurred_at = excluded.occurred_at,
  notes = excluded.notes;

commit;
