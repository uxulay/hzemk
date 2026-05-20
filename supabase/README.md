# Supabase 数据库结构说明

完整建表 SQL 在 `supabase/schema.sql`。

测试数据 SQL 在 `supabase/seed.sql`。

## 设计原则

这个系统不是传统销售订单系统，所以没有 `sales_orders`。

运营创建的是内部 FBA 备货需求，对应表：

- `fba_replenishment_requests`

原材料、半成品、成品先统一放在 `skus` 表里，用 `sku_type` 区分：

- `finished_good`：成品
- `material`：原材料
- `semi_finished`：半成品

这样前期结构更简单，后续如果原材料资料变复杂，再单独拆材料表。

## 每张表做什么

### 基础权限

- `roles`：角色表，保存运营、厂长、采购、仓库、管理员。
- `profiles`：用户资料表，和 Supabase 自带的 `auth.users` 关联，保存姓名、邮箱、角色、账号状态。

### 基础资料

- `products`：产品表，是产品层级的基础资料。
- `skus`：SKU 表，保存成品 SKU、原材料 SKU、半成品 SKU。
- `suppliers`：供应商表，给采购单使用。
- `warehouses`：仓库表，保存原材料仓、成品仓、FBA 备发仓等。

### BOM

- `bom_headers`：BOM 主表，表示某个成品 SKU 的某个 BOM 版本。
- `bom_items`：BOM 明细表，表示生产 1 个成品需要哪些原材料、半成品，以及用量。

### FBA 备货

- `fba_replenishment_requests`：FBA 备货需求表。运营发起，厂长接收。状态包含草稿、已提交、已接单、生产中、已完成、已发往 FBA。

### 生产

- `production_orders`：生产任务表。厂长根据 FBA 备货需求创建生产任务。
- `material_requirements`：物料需求表。根据生产任务和 BOM 计算需要多少物料、库存够不够、缺多少。

### 采购

- `purchase_orders`：采购单主表。采购根据缺料情况创建。
- `purchase_order_items`：采购单明细表。保存每个采购 SKU 的数量、到货数量、单价。

### 库存

- `inventory_items`：库存表。保存每个仓库里每个 SKU 当前有多少、占用了多少、安全库存是多少。
- `inventory_transactions`：库存流水表。保存每一次入库、出库、调整记录。

## 表之间的主要关系

1. 用户和角色
   - `profiles.role_id` 关联 `roles.id`
   - `profiles.id` 关联 Supabase 自带的 `auth.users.id`

2. 产品和 SKU
   - `skus.product_id` 关联 `products.id`

3. BOM
   - `bom_headers.product_sku_id` 关联成品 `skus.id`
   - `bom_items.bom_header_id` 关联 `bom_headers.id`
   - `bom_items.component_sku_id` 关联原材料或半成品 `skus.id`

4. FBA 备货到生产
   - `fba_replenishment_requests.sku_id` 关联要备货的成品 `skus.id`
   - `production_orders.replenishment_request_id` 关联 `fba_replenishment_requests.id`
   - `production_orders.bom_header_id` 关联本次生产使用的 BOM

5. 生产到物料需求
   - `material_requirements.production_order_id` 关联 `production_orders.id`
   - `material_requirements.material_sku_id` 关联原材料或半成品 `skus.id`

6. 缺料到采购
   - `purchase_orders.supplier_id` 关联 `suppliers.id`
   - `purchase_order_items.purchase_order_id` 关联 `purchase_orders.id`
   - `purchase_order_items.material_requirement_id` 可关联 `material_requirements.id`

7. 库存
   - `inventory_items.warehouse_id` 关联 `warehouses.id`
   - `inventory_items.sku_id` 关联 `skus.id`
   - `inventory_transactions` 可关联生产任务、采购单、FBA 备货需求，用来追踪库存变化来源

## 后续如何接到前端

建议按这个顺序接：

1. 先在 Supabase SQL Editor 执行 `supabase/schema.sql`。
2. 再执行 `supabase/seed.sql`，插入测试角色、仓库、供应商、产品、SKU、BOM、备货单、生产任务、物料需求、采购单和库存流水。
3. 在 Supabase Auth 里创建用户。
4. 给每个用户在 `profiles` 里补资料和角色。
5. 前端先接基础资料页面：产品、SKU、仓库、供应商。
6. 再接 BOM 页面：先做 BOM 列表、创建 BOM、维护 BOM 明细。
7. 再接 FBA 备货需求页面：运营创建，厂长接单。
8. 再接生产任务页面：厂长从备货需求生成生产任务。
9. 再接物料需求：根据 BOM 算缺料。
10. 最后接采购和库存流水。

第一版不要急着做复杂自动扣库存。建议先做到“页面能查、能新建、状态能流转”，确认业务跑顺后再加自动计算和自动扣减。

## 测试数据验证 SQL

执行 `seed.sql` 后，可以用下面几条 SQL 快速确认数据是否插入成功：

```sql
select count(*) from public.roles;
select count(*) from public.warehouses;
select count(*) from public.suppliers;
select count(*) from public.products;
select count(*) from public.skus;
select count(*) from public.bom_headers;
select count(*) from public.bom_items;
select count(*) from public.fba_replenishment_requests;
select count(*) from public.production_orders;
select count(*) from public.material_requirements;
select count(*) from public.purchase_orders;
select count(*) from public.purchase_order_items;
select count(*) from public.inventory_items;
select count(*) from public.inventory_transactions;
```

查看缺料效果：

```sql
select
  po.production_order_no,
  s.sku_name as material_name,
  mr.required_quantity,
  mr.available_quantity,
  mr.shortage_quantity,
  mr.status
from public.material_requirements mr
join public.production_orders po on po.id = mr.production_order_id
join public.skus s on s.id = mr.material_sku_id
order by po.production_order_no, s.sku_code;
```
