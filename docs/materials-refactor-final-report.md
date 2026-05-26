# 辅料拆表最终阶段报告

日期：2026-05-27

## 本次完成

- 新增最终检查脚本：`scripts/final-check-before-dropping-legacy-material-fields.sql`。
- 新增删除前备份脚本：`scripts/backup-legacy-material-data-before-drop.sql`。
- 新增最终清理脚本：`scripts/drop-legacy-material-fields.sql`。
- `supabase/schema.sql` 已更新为最终结构：BOM 和物料需求只保留 `material_id`；库存和流水以 `product_sku_id / material_id` 为主。
- 代码已清理 `bom_items.component_sku_id` 和 `material_requirements.material_sku_id` 主逻辑和 fallback。
- SKU 管理继续只管理成品和半成品；辅料统一来自 `materials` 表。
- Dashboard、通知来源、缺料、采购、库存低库存读取已改为基于 `materials` 和 `inventory_items.material_id`。

## 数据库执行状态

本地没有数据库管理员连接信息，也没有 Supabase CLI / `psql`，当前 `.env.local` 只有前端 anon key，不能执行建备份表、删字段、删旧数据这类数据库管理员 SQL。

因此本次已经完成脚本和代码，但没有直接在数据库里执行备份、删字段、删旧 material SKU 数据。请只在当前开发库的 Supabase SQL Editor 中按顺序执行：

1. `scripts/final-check-before-dropping-legacy-material-fields.sql`
2. `scripts/backup-legacy-material-data-before-drop.sql`
3. `scripts/drop-legacy-material-fields.sql`

如果第一步有任何结果不是 0，必须停止，不要执行第二步和第三步。

## 删除内容

清理脚本会删除：

- `bom_items.component_sku_id` 外键、索引、唯一约束和字段。
- `material_requirements.material_sku_id` 外键、索引、唯一约束和字段。
- `skus` 表中 `sku_type = 'material'` 的旧辅料 SKU 数据。

清理脚本会先把以下已迁移记录的旧 material SKU 引用清空，再删除旧 SKU：

- `purchase_order_items.sku_id`
- `inventory_items.sku_id`
- `inventory_transactions.sku_id`

## 保留字段

- `purchase_order_items.sku_id` 保留：用于历史采购或以后可能存在的非辅料采购记录；新辅料采购使用 `material_id`。
- `inventory_items.sku_id` 保留但改为可空：用于历史库存和成品兼容；辅料库存使用 `material_id`。
- `inventory_transactions.sku_id` 保留但改为可空：用于历史流水和成品兼容；辅料流水使用 `material_id`。

## 旧 material SKU 数量

本地没有直接执行数据库删除，所以旧 material SKU 删除数量暂时不能在本报告里写死。执行备份脚本后可查看：

```sql
select backup_run_id, count(*) as old_material_sku_count
from public.legacy_material_skus_backup
group by backup_run_id
order by backup_run_id desc;
```

第三步删除脚本执行成功后，可再确认：

```sql
select count(*) from public.skus where sku_type = 'material';
```

结果应为 `0`。

## 备份表

备份脚本会生成并按 `backup_run_id` 区分每次备份：

- `legacy_material_backup_runs`
- `legacy_material_skus_backup`
- `legacy_bom_items_material_fields_backup`
- `legacy_material_requirements_fields_backup`
- `legacy_purchase_order_items_material_fields_backup`
- `legacy_inventory_items_material_fields_backup`
- `legacy_inventory_transactions_material_fields_backup`

## 恢复说明

如果执行后发现问题，先找到本次 `backup_run_id`，再按备份表的 `id` 回写关键字段。

示例：恢复 BOM 旧字段时，可以用备份表里的 `id` 对应 `bom_items.id`；恢复采购、库存、流水时，也按各自备份表的 `id` 对应原表 `id`。正式恢复前请先复制当前数据或做数据库快照。

## 需要人工测试

1. `/admin/materials`
2. `/bom`
3. `/materials/requirements`
4. `/production/planning`
5. `/production/orders`
6. `/purchase/orders`
7. `/inventory/inbound`
8. `/inventory/fba-outbound`
9. `/inventory/adjustments`
10. `/inventory/materials`
11. `/inventory/products`
12. `/inventory/transactions`
13. `/dashboard`
14. 全局搜索

## 本地验证

- `npm run typecheck`：通过。
- `npm run build`：通过。
