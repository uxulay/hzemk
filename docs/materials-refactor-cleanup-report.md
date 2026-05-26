# 辅料拆表第六阶段清理报告

日期：2026-05-26

## 本阶段目标

本阶段只清理代码对旧 `skus.sku_type = 'material'` 的业务依赖，不删除数据库字段，不删除 `skus` 表里的旧辅料数据。

## 已完成清理

- SKU 管理页 `/admin/skus` 改为只管理成品和半成品 SKU，不再展示、筛选、新增或编辑 `sku_type = material` 的旧辅料 SKU。
- SKU 管理页新增“辅料管理”入口，辅料资料统一跳转到 `/admin/materials` 维护。
- SKU 批量导入限制为 `finished_good` 和 `semi_finished`，辅料批量导入改由辅料管理页面负责。
- 全局搜索中，SKU 搜索只查成品、半成品相关 SKU；辅料搜索直接查 `materials` 表，并显示在“辅料”分组。
- 调试页 `/debug/master-data` 的辅料区改为读取 `materials` 表，不再读取旧辅料 SKU。
- BOM 新增和 BOM 批量导入现在只写 `bom_items.material_id`，不再为新明细写入 `bom_items.component_sku_id`。
- 物料需求生成优先按 `material_id` 读取库存并写入 `material_requirements.material_id`；新 BOM 明细生成的新需求不再额外写旧 `material_sku_id`。
- 采购手动创建、批量导入和缺料生成采购单时，辅料明细优先写 `purchase_order_items.material_id`，新辅料采购不再写旧 `purchase_order_items.sku_id`。
- 页面文案把主要业务入口里的“原材料 SKU”调整为“辅料”或“辅料编码 / 辅料名称”。
- 新增只读检查脚本 `scripts/check-legacy-material-sku-usage.sql`，用于统计旧字段还引用了哪些旧辅料 SKU。

## 保留的兼容读取

以下旧字段仍保留读取，用来显示历史数据或做迁移前兜底：

- `bom_items.component_sku_id`
- `material_requirements.material_sku_id`
- `purchase_order_items.sku_id`
- `inventory_items.sku_id`
- `inventory_transactions.sku_id`

这些读取不代表新业务继续以旧辅料 SKU 为主，只是为了旧单据、旧库存、旧流水还能看得懂。

## 仍需后续阶段处理

真实 schema 里 `inventory_items.sku_id` 和 `inventory_transactions.sku_id` 目前仍是 `not null`。在不改数据库结构的前提下，辅料库存写入还不能完全停止写旧 `sku_id`，否则入库、出库、调整和领料会被数据库必填约束拦住。

建议下一阶段单独处理：

- 将库存余额和库存流水的辅料链路彻底迁到 `material_id`。
- 确认历史库存数据已经完成回填。
- 再考虑把 `inventory_items.sku_id`、`inventory_transactions.sku_id` 改为兼容可空，或拆出新的唯一约束。
- 最后再评估是否清理旧 `skus.sku_type = material` 行。

## 验证

- `npm run typecheck`：通过。
- `npm run build`：通过。
