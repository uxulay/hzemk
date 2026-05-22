# 项目进度说明

最后整理日期：2026-05-22

本文档根据当前项目代码、页面路由、`src/lib/api`、`supabase` 目录、`schema.sql`、`seed.sql` 和已实现页面整理。后续 Codex 开发前请先阅读本文件。

## 1. 项目简介

本项目是一个内部使用的跨境电商工贸一体 FBA 备货生产管理系统。

它不是传统销售订单系统。系统的核心入口是“FBA 备货需求”：运营根据亚马逊 FBA 补货需要提交备货数量，厂长根据实际产能安排生产，采购根据缺料情况采购，仓库负责采购入库、生产入库、FBA 出库和库存流水追踪。

适合使用角色：

- 运营：创建 FBA 备货需求，查看备货状态和成品库存。
- 厂长：接收或拒绝备货需求，创建生产任务，查看生产和物料状态。
- 采购：根据缺料生成采购单，跟踪采购状态。
- 仓库：处理采购入库、生产入库、FBA 出库，查看库存和库存流水。
- 管理员：后续维护基础资料、用户、角色和权限。

## 2. 技术栈

当前技术栈：

- Next.js：Web 后台管理系统框架。
- TypeScript：前端代码类型约束。
- Supabase：数据库、RLS 权限策略、后续 Supabase Auth 登录。
- Supabase JS Client：前端通过 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 连接 Supabase。

当前项目仍处于开发阶段，页面主要是浏览器端直接调用 Supabase。正式上线前需要补齐登录、角色权限和生产级 RLS 策略。

## 3. 当前已完成的核心页面

### 已接入真实 Supabase 数据的页面

| 页面 | 当前状态 | 说明 |
| --- | --- | --- |
| `/dashboard` | 已完成第一版 | 后台首页数据看板。读取待排产 FBA 备货需求、生产中任务、缺料物料、待采购/待到货物料、待入库采购单、有库存成品 SKU、原材料低库存，并展示最新备货需求、进行中生产任务、缺料提醒、最近库存流水。 |
| `/debug/master-data` | 已完成调试页 | Supabase 基础资料读取测试页。读取角色、产品、成品 SKU、原材料 SKU、供应商、仓库。这个页面用于排查 Supabase 连接、anon key、RLS 策略问题，后续不要删除。 |
| `/replenishment` | 已完成列表第一版 | FBA 备货需求列表。支持按状态筛选、SKU 搜索、查看详情。编辑和删除按钮目前禁用，当前阶段不做修改和删除。 |
| `/replenishment/new` | 已完成创建第一版 | 运营创建 FBA 备货需求。读取产品、成品 SKU、仓库，提交后写入 `fba_replenishment_requests`，状态为 `submitted`。当前还没有真实登录，所以 `requested_by` 暂时写 `null`。 |
| `/production/planning` | 已完成排产第一版 | 厂长查看已提交/已接单的 FBA 备货需求，可以接单、拒绝、创建生产任务。创建生产任务时会按 BOM 自动生成物料需求，并把 FBA 备货需求状态更新为 `in_production`。 |
| `/production/orders` | 已完成跟踪第一版 | 生产任务列表。显示 FBA 备货需求数量、计划生产数量、超量生产数量、已入库数量、待入库数量、物料状态、生产状态。支持查看详情和把 `planned` 标记为 `in_progress`。 |
| `/bom` | 已完成管理第一版 | BOM 管理页面。读取 `bom_headers` 和 `bom_items`，支持新增 BOM、查看明细、添加原材料、编辑 BOM 明细的单位用量/损耗率/备注，以及启用/停用 BOM。 |
| `/materials/requirements` | 已完成查询第一版 | 物料需求列表。读取 `material_requirements`，并回查 `bom_items` 显示 BOM 单位用量和损耗率。支持按状态筛选。当前是查询页，不直接新增、编辑、删除。 |
| `/purchase/orders` | 已完成采购第一版 | 采购单页面。可以从缺料物料生成采购单，写入 `purchase_orders` 和 `purchase_order_items`，并把对应物料需求状态更新为 `purchased`。支持采购单列表、详情和状态按钮。实际库存入库建议走 `/inventory/inbound`。 |
| `/inventory/inbound` | 已完成入库第一版 | 入库管理。分为采购入库和生产入库。采购入库会写 `material_in` 库存流水、更新 `inventory_items`、采购明细到货数量、采购单状态和物料需求状态。生产入库会写 `product_in` 库存流水、更新成品库存、更新生产任务 `completed_quantity` 和状态。 |
| `/inventory/fba-outbound` | 已完成 FBA 出库第一版 | FBA 出库单独处理。读取可出库 FBA 备货需求，按成品库存和已出库数量计算待出库数量。提交后写 `product_out` 库存流水、扣减 `inventory_items`，累计出库数量达到备货需求数量后把备货需求标记为 `shipped`。 |
| `/inventory/transactions` | 已完成查询第一版 | 库存流水页面。读取 `inventory_transactions`，支持按流水类型、仓库、SKU、日期筛选，显示关联采购单、生产任务或 FBA 备货单。当前只查询，不新增、编辑、删除。 |
| `/inventory/materials` | 已完成查询第一版 | 原材料当前库存页面。读取 `inventory_items`，按 SKU 类型筛选原材料，显示当前库存、安全库存、库存状态、仓库和查看流水入口。 |
| `/inventory/products` | 已完成查询第一版 | 成品当前库存页面。读取 `inventory_items`，按成品 SKU 筛选，显示当前成品库存、仓库和查看流水入口。 |
| `/admin/products` | 已完成管理第一版 | 产品基础资料管理页面。读取 `products` 和 `skus`，支持产品列表、搜索、状态筛选、汇总卡片、新增产品、编辑产品、启用/停用产品、查看产品关联 SKU。 |
| `/admin/skus` | 已完成管理第一版 | SKU 基础资料管理页面。读取 `skus`、`products`、`inventory_items`、`bom_headers`、`bom_items`，支持 SKU 列表、搜索筛选、汇总卡片、新增 SKU、编辑 SKU、启用/停用 SKU、查看库存入口和查看 BOM 关联。 |

### 当前还是占位或待完善的页面

| 页面 | 当前状态 | 说明 |
| --- | --- | --- |
| `/admin/users` | 待完善 | 当前使用通用预留页面，还没有接入 Supabase Auth 和真实用户管理。 |
| `/login` | 待完善 | 当前只是登录页面样式，点击后进入后台，还没有真实 Supabase Auth 登录。 |

当前导航里还没有看到 `/admin/suppliers` 和 `/admin/warehouses` 页面文件，后续需要新增或补齐。

## 4. 当前已完成的业务流程

### 4.1 运营提交 FBA 备货需求

已完成第一版。

入口：`/replenishment/new`

当前逻辑：

- 运营选择产品、成品 SKU、亚马逊站点、目标 FBA 仓库、FBA 仓库代码、备货数量、期望完成日期、优先级和备注。
- 写入 `fba_replenishment_requests`。
- 自动生成 `request_no`。
- 新需求状态为 `submitted`。
- 亚马逊站点当前写进 `notes` 文本里，不是单独字段。
- 当前还没有真实登录，所以 `requested_by` 暂时为空。

### 4.2 厂长接单 / 拒绝

已完成第一版。

入口：`/production/planning`

当前逻辑：

- 页面读取状态为 `submitted` 和 `accepted` 的 FBA 备货需求。
- 接单会把状态更新为 `accepted`，并写入 `accepted_at`。
- 拒绝会把状态更新为 `rejected`。
- 当前拒绝流程还没有填写拒绝原因的弹窗或表单，`rejected_reason` 暂未完善。
- 当前还没有真实登录，所以 `accepted_by` 暂未真正绑定当前厂长。

### 4.3 创建生产任务

已完成第一版。

入口：`/production/planning`

当前逻辑：

- 厂长从 FBA 备货需求创建生产任务。
- 写入 `production_orders`。
- 自动生成 `production_order_no`。
- `production_orders.replenishment_request_id` 关联来源 FBA 备货需求。
- `production_orders.planned_quantity` 使用厂长填写的计划生产数量。
- 创建后 FBA 备货需求状态更新为 `in_production`。

重要说明：

- 计划生产数量可以大于 FBA 备货需求数量。
- 例如运营要 100 件，厂长可以计划生产 150 件。
- 多生产出来的 50 件后续进入成品库存，不会自动发往 FBA。

### 4.4 BOM 自动计算物料需求

已完成第一版。

入口：创建生产任务时自动触发。

当前逻辑：

- 根据生产任务的成品 SKU 查找启用中的 `bom_headers`。
- 读取对应 `bom_items`。
- 按 `production_orders.planned_quantity` 计算物料需求，而不是按 FBA 备货需求数量计算。
- 计算公式：计划生产数量 × BOM 单位用量 × (1 + 损耗率)。
- 读取 `inventory_items`，按 `quantity_on_hand - reserved_quantity` 计算可用库存。
- 写入 `material_requirements`。
- 缺料时状态为 `shortage`，库存足够时当前代码会写 `enough`。
- 如果没有启用 BOM 或 BOM 明细为空，会直接报错，不会静默跳过。
- 如果该生产任务已经有物料需求，会停止生成，避免重复写入。

注意：

- BOM 管理页面已完成第一版。后续生产任务仍依赖 Supabase 里启用中的 BOM 和完整 `bom_items` 明细。

### 4.5 缺料生成采购单

已完成第一版。

入口：`/purchase/orders`

当前逻辑：

- 读取 `material_requirements` 中状态为 `shortage` 且 `shortage_quantity > 0` 的缺料记录。
- 可以选择缺料物料生成采购单。
- 写入 `purchase_orders` 和 `purchase_order_items`。
- `purchase_order_items.material_requirement_id` 关联来源物料需求。
- 创建采购单后，对应物料需求状态更新为 `purchased`。

注意：

- 采购单页面的状态按钮主要用于采购单状态流转。
- 真正会增加库存、生成库存流水的采购入库，请优先走 `/inventory/inbound`。

### 4.6 采购入库

已完成第一版。

入口：`/inventory/inbound` 的“采购入库”标签。

当前逻辑：

- 读取状态为 `ordered` 或 `partially_received` 的采购单。
- 用户填写本次入库数量和入库仓库。
- 写入 `inventory_transactions`，流水类型为 `material_in`。
- 更新或新增 `inventory_items` 当前库存。
- 更新 `purchase_order_items.received_quantity`。
- 根据是否全部到货，更新采购单状态为 `partially_received` 或 `received`。
- 关联物料需求到货后，更新 `material_requirements.status` 为 `received`。

### 4.7 生产入库

已完成第一版。

入口：`/inventory/inbound` 的“生产入库”标签。

当前逻辑：

- 读取可入库生产任务。
- 用户选择成品入库仓库，填写本次成品入库数量。
- 写入 `inventory_transactions`，流水类型为 `product_in`。
- 更新或新增 `inventory_items` 成品库存。
- 更新 `production_orders.completed_quantity`。
- 如果累计完成数量达到计划生产数量，生产任务状态更新为 `completed`；否则更新为 `in_progress`。

重要说明：

- 生产完成后，成品只是进入成品库存。
- 生产入库不等于发往 FBA。
- 发往 FBA 必须单独走 `/inventory/fba-outbound`。

### 4.8 FBA 出库

已完成第一版。

入口：`/inventory/fba-outbound`

当前逻辑：

- 读取状态为 `accepted`、`in_production`、`completed` 的 FBA 备货需求。
- 统计该备货需求已经 `product_out` 的数量。
- 读取成品库存可用数量。
- 计算待出库数量：FBA 备货需求数量 - 已出库数量。
- 提交后写入 `inventory_transactions`，流水类型为 `product_out`。
- 扣减 `inventory_items.quantity_on_hand`。
- 累计出库数量达到 FBA 备货需求数量后，更新备货需求状态为 `shipped`。
- 第一版不允许超出库存，也不允许超发。

### 4.9 库存流水记录

已完成第一版。

入口：`/inventory/transactions`

当前逻辑：

- 采购入库写 `material_in`。
- 生产入库写 `product_in`。
- FBA 出库写 `product_out`。
- 页面可以查看流水类型、SKU、仓库、数量、关联单据、操作时间、备注。
- 关联单据通过真实字段判断：`purchase_order_id`、`production_order_id`、`replenishment_request_id`。

待完善：

- `material_out` 原材料出库，也就是生产领料，目前还没有正式操作页面。
- `adjustment` 库存调整，目前还没有正式操作页面。

### 4.10 当前库存查看

已完成第一版。

入口：

- `/inventory/materials`
- `/inventory/products`

当前逻辑：

- 当前库存来自 `inventory_items`。
- 原材料库存按原材料 SKU 查询。
- 成品库存按成品 SKU 查询。
- 可以按仓库、关键词和库存状态筛选。
- 可以跳转查看对应 SKU 的库存流水。

### 4.11 BOM 管理

已完成第一版。

入口：`/bom`

当前逻辑：

- 页面读取真实 `bom_headers` 和 `bom_items`，不再使用占位页或 mock 数据。
- BOM 主表通过 `bom_headers.product_sku_id` 关联成品 SKU。
- BOM 明细通过 `bom_items.bom_header_id` 关联 BOM 主表，通过 `bom_items.component_sku_id` 关联原材料 SKU。
- 新增 BOM 时，成品 SKU 下拉框只读取 `skus.sku_type = finished_good` 的 SKU。
- 新增 BOM 会自动生成 `bom_code`，写入 `bom_headers.product_sku_id`、`version`、`status`、`notes`。
- 如果同一个成品 SKU 已有启用 BOM，页面会在新增启用 BOM 前显示提示。
- 添加 BOM 原材料时，原材料下拉框只读取 `skus.sku_type = material` 的 SKU。
- 添加 BOM 原材料会写入 `bom_items.component_sku_id`、`quantity_per`、`unit`、`loss_rate`、`notes`。
- 页面会校验单位用量必须大于 0，损耗率不能小于 0。
- 页面和 API 都会阻止把非 `material` SKU 加入 BOM，避免把成品 SKU 当成原材料。
- 页面和 API 都会检查同一个 BOM 下不能重复添加同一个原材料 SKU。
- BOM 明细支持编辑 `quantity_per`、`loss_rate` 和 `notes`，保存后刷新当前 BOM 明细。
- BOM 启用/停用使用 `bom_headers.status`，启用为 `active`，停用为 `inactive`。
- BOM 主表编辑按钮当前只是预留，暂不做删除。

本次修改文件：

- `src/lib/api/bom.ts`
- `src/app/(app)/bom/page.tsx`
- `src/app/globals.css`
- `supabase/dev-bom-policies.sql`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/bom`，确认 BOM 列表能读取真实数据。
- 新增一个 BOM，确认写入 `bom_headers`。
- 查看 BOM 明细，添加一个原材料，确认写入 `bom_items`。
- 编辑 BOM 明细的单位用量、损耗率、备注，确认保存后页面刷新。
- 点击启用/停用，确认 `bom_headers.status` 变化。

如果页面读不到或写不进去，优先检查：

- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- Supabase 里是否已经执行基础 `dev-policies.sql`。
- 如果写入 BOM 报 RLS 权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-bom-policies.sql`。
- `skus` 表里是否真的有 `sku_type = finished_good` 的成品 SKU 和 `sku_type = material` 的原材料 SKU。
- `bom_headers.product_sku_id` 和 `bom_items.component_sku_id` 是否关联真实存在的 `skus.id`。

后续待优化：

- 补 BOM 主表编辑弹窗，例如修改版本、备注、生效日期。
- 正式登录后按管理员/厂长角色收紧 BOM 写入权限。
- 后续如果要允许半成品加入 BOM，需要先统一 SKU 类型规则，再扩展 `component_sku_id` 的选择范围。
- 可以增加 BOM 历史版本对比和复制上一版本功能。

### 4.12 首页统计看板

已完成第一版。

入口：`/dashboard`

当前逻辑：

- 统计待排产 FBA 备货需求、生产中任务、缺料、待采购/待到货物料、待入库采购单、有库存成品 SKU、原材料低库存。
- 展示最新 FBA 备货需求。
- 展示进行中的生产任务。
- 展示缺料提醒。
- 展示最近库存流水。

### 4.13 产品管理

已完成第一版。

入口：`/admin/products`

当前逻辑：

- 页面读取真实 `products` 和 `skus`，不再使用占位页或 mock 数据。
- 产品列表显示产品编码、产品名称、产品状态、关联 SKU 数量、创建时间、更新时间、备注和操作。
- 产品备注使用真实字段 `products.description`，没有新增 `notes` 字段。
- 支持按产品名称或产品编码搜索。
- 支持按 `products.status` 筛选，当前状态主要使用 `active` 和 `inactive`。
- 顶部汇总产品总数、启用产品数、停用产品数和 SKU 总数。
- 新增产品会写入 `products.product_code`、`products.name`、`products.description` 和 `products.status`。
- 新增产品前会检查 `product_code` 是否重复。
- 编辑产品支持修改产品名称、备注和状态，不修改产品编码。
- 启用/停用产品通过更新 `products.status` 实现。
- 查看关联 SKU 通过 `skus.product_id = products.id` 查询。
- 原材料 SKU 如果没有 `product_id`，不会出现在某个产品的关联 SKU 列表里，也不会导致页面报错。
- SKU 类型展示规则：`finished_good` 显示为“成品”，`material` 显示为“原材料”，其他值按原值显示。

本次修改文件：

- `src/lib/api/products.ts`
- `src/app/(app)/admin/products/page.tsx`
- `src/app/globals.css`
- `supabase/dev-products-policies.sql`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/admin/products`，确认产品列表能读取真实数据。
- 使用搜索框按产品名称或产品编码筛选。
- 按状态筛选启用/停用产品。
- 新增一个产品，确认写入 `products` 并刷新列表。
- 编辑产品名称、备注或状态，确认保存后刷新列表。
- 点击“查看 SKU”，确认能看到该产品下 `skus.product_id` 关联的 SKU。

如果页面读不到或写不进去，优先检查：

- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- Supabase 里是否已经执行基础 `dev-policies.sql`。
- 如果新增、编辑或启用/停用产品报 RLS 权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-products-policies.sql`。
- `products` 表里是否存在 `product_code`、`name`、`description`、`status` 等真实字段。
- `skus.product_id` 是否正确关联到 `products.id`。

后续待优化：

- 增加产品分类 `category` 的管理入口。
- 增加产品图片、负责人或生命周期字段前，需要先确认是否真的要改 schema。
- 正式登录后按管理员角色收紧产品和 SKU 的写入权限。

### 4.14 SKU 管理

已完成第一版。

入口：`/admin/skus`

当前逻辑：

- 页面读取真实 `skus`、`products`、`inventory_items`、`bom_headers` 和 `bom_items`，不再使用占位页或 mock 数据。
- SKU 列表显示 SKU 编码、SKU 名称、SKU 类型、所属产品、单位、状态、当前库存数量、创建时间、更新时间、备注和操作。
- SKU 备注使用真实字段 `skus.specs`，因为当前 schema 没有单独的 `notes` 字段。
- SKU 类型展示规则：`finished_good` 显示为“成品”，`material` 显示为“原材料”，其他值按原值显示。
- `skus.product_id` 关联 `products.id`，数据库设置为可空；原材料 SKU 可以不绑定产品。
- 顶部汇总 SKU 总数、成品 SKU 数量、原材料 SKU 数量、有库存 SKU 数量和无库存 SKU 数量。
- 支持按 SKU 编码 / 名称搜索。
- 支持按 SKU 类型筛选：全部、成品、原材料。
- 支持按所属产品筛选，也支持筛选未绑定产品。
- 支持按 `skus.status` 筛选，当前状态主要使用 `active` 和 `inactive`。
- 新增 SKU 会写入 `skus.sku_code`、`sku_name`、`sku_type`、`product_id`、`unit`、`specs` 和 `status`。
- 新增 SKU 前会检查 `sku_code` 是否重复。
- 成品 SKU 新增时要求选择所属产品；原材料 SKU 不强制绑定产品。
- 编辑 SKU 支持修改 SKU 名称、所属产品、单位、备注和状态，不修改 SKU 编码。
- 编辑时 SKU 类型字段锁定，不允许随意修改，避免影响已有关联的 BOM、库存、采购和生产记录。
- 启用/停用 SKU 通过更新 `skus.status` 实现。
- 查看库存会按 SKU 类型跳转：原材料到 `/inventory/materials`，成品到 `/inventory/products`。
- 查看 BOM 关联时，成品 SKU 查询它作为成品被哪些 `bom_headers.product_sku_id` 使用；原材料 SKU 查询它作为原材料被哪些 `bom_items.component_sku_id` 使用。

成品 SKU 和原材料 SKU 的区别：

- 成品 SKU：`skus.sku_type = finished_good`，用于 FBA 备货、生产任务、成品入库和 FBA 出库。
- 原材料 SKU：`skus.sku_type = material`，用于 BOM、物料需求、采购和原材料库存。
- 当前系统没有单独的 `materials` 表，原材料也放在 `skus` 表里，通过 `sku_type = material` 区分。

本次修改文件：

- `src/lib/api/skus.ts`
- `src/app/(app)/admin/skus/page.tsx`
- `src/app/globals.css`
- `supabase/dev-skus-policies.sql`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/admin/skus`，确认 SKU 列表能读取真实数据。
- 使用搜索框按 SKU 编码或名称筛选。
- 按 SKU 类型、所属产品、状态筛选。
- 新增一个成品 SKU，确认必须选择所属产品，并写入 `skus`。
- 新增一个原材料 SKU，确认可以不选择所属产品，并写入 `skus`。
- 编辑 SKU 名称、所属产品、单位、备注或状态，确认保存后刷新列表。
- 点击启用/停用，确认 `skus.status` 变化。
- 点击查看库存，确认原材料跳转 `/inventory/materials`，成品跳转 `/inventory/products`。
- 点击查看 BOM，确认成品显示 `bom_headers` 关联，原材料显示 `bom_items` 关联。

如果页面读不到或写不进去，优先检查：

- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- Supabase 里是否已经执行基础 `dev-policies.sql`。
- 如果新增、编辑或启用/停用 SKU 报 RLS 权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-skus-policies.sql`。
- `skus` 表里是否存在 `sku_code`、`sku_name`、`sku_type`、`product_id`、`unit`、`specs`、`status` 等真实字段。
- `products` 表里是否有可选产品；成品 SKU 新增时需要选择产品。
- `inventory_items.sku_id` 是否正确关联到 `skus.id`，否则库存汇总会显示为 0。
- `bom_headers.product_sku_id` 和 `bom_items.component_sku_id` 是否正确关联到 `skus.id`。

后续待优化：

- 如果库存页面后续支持 URL 参数，可以从 SKU 管理页跳转时带上 SKU 编码自动筛选。
- 如果确实要允许修改 `sku_type`，需要先增加业务占用检查，确认该 SKU 没有被 BOM、库存、采购单、生产任务使用。
- 可以补充 Amazon SKU、FNSKU 的管理入口；当前第一版先按本次需求维护基础字段。
- 正式登录后按管理员角色收紧 SKU 写入权限。

## 5. Supabase 相关文件说明

`supabase` 目录当前文件用途如下：

| 文件 | 用途 |
| --- | --- |
| `schema.sql` | 数据库建表文件。定义角色、用户资料、产品、SKU、供应商、仓库、BOM、FBA 备货需求、生产任务、物料需求、采购单、库存当前表、库存流水表等。 |
| `seed.sql` | 测试数据文件。插入开发阶段测试角色、仓库、供应商、产品、SKU、BOM、库存、FBA 备货需求、生产任务、物料需求、采购单和库存流水。 |
| `README.md` | Supabase 数据库结构说明，解释为什么本系统不是传统销售订单系统，以及主要表关系。 |
| `dev-policies.sql` | 开发阶段基础读取策略。主要给 `anon` 和 `authenticated` 开放 select，方便调试基础资料和页面读取。 |
| `dev-fba-replenishment-insert-policy.sql` | 开发阶段允许前端创建 FBA 备货需求，用于 `/replenishment/new`。 |
| `dev-production-planning-policies.sql` | 开发阶段允许厂长排产页面更新 FBA 备货需求状态、创建生产任务。 |
| `dev-material-requirements-policies.sql` | 开发阶段允许读取、创建、更新物料需求，支持创建生产任务后自动生成物料需求和物料需求列表页。 |
| `dev-bom-policies.sql` | 开发阶段允许 BOM 管理页面读取产品/SKU/BOM，并新增或更新 BOM 主表和 BOM 明细。不开放 delete。 |
| `dev-products-policies.sql` | 开发阶段允许产品管理页面读取产品和 SKU，并新增、编辑、启用/停用产品。不开放 delete。 |
| `dev-skus-policies.sql` | 开发阶段允许 SKU 管理页面读取产品、SKU、库存、BOM 关联，并新增、编辑、启用/停用 SKU。不开放 delete。 |
| `dev-purchase-policies.sql` | 开发阶段允许采购页面读取缺料、创建采购单、写采购明细、更新采购单和物料需求状态。 |
| `dev-inventory-inbound-policies.sql` | 开发阶段允许入库页面写库存流水、更新当前库存、更新采购单/采购明细/物料需求/生产任务。 |
| `dev-fba-outbound-policies.sql` | 开发阶段允许 FBA 出库页面读取待出库需求、写出库流水、扣减成品库存、标记已发往 FBA。 |
| `dev-production-orders-policies.sql` | 开发阶段允许生产任务页面读取生产任务、物料需求、入库流水，并更新生产任务状态。 |
| `dev-inventory-transactions-policies.sql` | 开发阶段允许库存流水页面读取库存流水和关联基础资料，只开放查询，不开放新增、更新、删除。 |

重要提醒：

- 这些 `dev-xxx-policies.sql` 都是开发阶段策略。
- 它们是为了方便前端用 anon 或 authenticated 调试页面。
- 生产环境必须按真实登录用户、角色、仓库范围和操作权限收紧。
- 不要为了方便调试关闭 RLS。
- 当前这些策略文件通常不开放 delete，是为了降低误删风险。

## 6. 主要数据表说明

以下说明根据当前 `supabase/schema.sql` 整理。

| 表名 | 用途 |
| --- | --- |
| `roles` | 角色表，保存运营、厂长、采购、仓库、管理员等角色。 |
| `profiles` | 用户资料表，关联 Supabase Auth 的 `auth.users.id`，保存姓名、邮箱、角色、账号状态。当前页面还没有真实登录，所以很多操作人字段暂时为空。 |
| `products` | 产品基础资料表，是 SKU、BOM、库存的上层产品归类。 |
| `skus` | SKU 表，保存成品 SKU、原材料 SKU、半成品 SKU。通过 `sku_type` 区分类型。当前代码里成品 SKU 主要按 `finished_good` 使用。 |
| `suppliers` | 供应商表，给采购单使用。 |
| `warehouses` | 仓库表，保存原材料仓、成品仓、FBA 备发仓等。通过 `warehouse_type` 区分类型。 |
| `bom_headers` | BOM 主表，表示某个成品 SKU 的某个 BOM 版本。 |
| `bom_items` | BOM 明细表，表示生产 1 个成品需要哪些原材料或半成品，以及单位用量和损耗率。 |
| `fba_replenishment_requests` | FBA 备货需求表。运营发起的内部备货生产需求，不是销售订单。 |
| `production_orders` | 生产任务表。厂长根据 FBA 备货需求创建和安排生产。 |
| `material_requirements` | 物料需求表。根据生产任务和 BOM 计算需要多少物料、库存够不够、缺多少。 |
| `purchase_orders` | 采购单主表。采购根据缺料情况创建采购单。 |
| `purchase_order_items` | 采购单明细表。记录每个采购 SKU、采购数量、到货数量、单价，并可关联物料需求。 |
| `inventory_items` | 当前库存表。保存每个仓库、每个 SKU 当前账面库存、已占用数量、安全库存。 |
| `inventory_transactions` | 库存流水表。记录每一次原材料入库、原材料出库、成品入库、成品出库、库存调整。 |

## 7. 关键字段和数量关系

### 7.1 FBA 备货需求数量

`fba_replenishment_requests.requested_quantity` 表示运营想发往 FBA 的数量。

它不是客户销售订单数量，也不是必须生产的唯一数量。

### 7.2 生产任务计划数量

`production_orders.planned_quantity` 表示厂长实际安排生产的数量。

这个数量可以大于 FBA 备货需求数量。

例如：

- 运营 FBA 备货需求：100 件。
- 厂长计划生产：150 件。
- BOM 物料需求按 150 件计算。
- 生产入库 150 件。
- FBA 出库 100 件。
- 剩余 50 件留在成品库存。

### 7.3 BOM 和物料需求

`material_requirements` 由 BOM 和生产任务计划数量计算出来。

当前计算依据：

- `production_orders.planned_quantity`
- `bom_items.quantity_per`
- `bom_items.loss_rate`
- `inventory_items.quantity_on_hand`
- `inventory_items.reserved_quantity`

不要按 `fba_replenishment_requests.requested_quantity` 计算 BOM 用料。

### 7.4 当前库存和库存流水

`inventory_items` 表示当前库存余额。

简单理解：

- 当前某个仓库某个 SKU 现在有多少，看 `inventory_items`。
- 这些库存为什么变多或变少，看 `inventory_transactions`。

`inventory_transactions` 表示库存流水历史。

当前真实关联字段是：

- `purchase_order_id`：关联采购单。
- `production_order_id`：关联生产任务。
- `replenishment_request_id`：关联 FBA 备货需求。

不要凭空新增或使用不存在的 `related_order_type` 数据库字段。页面里展示的关联类型是前端根据上述真实字段推出来的。

### 7.5 成品入库和 FBA 出库必须分开

生产完成后，成品先进入成品库存。

FBA 出库是单独动作，不能把成品入库自动等同于发往 FBA。

当前代码也是这样分开的：

- `/inventory/inbound` 的生产入库写 `product_in`，增加成品库存。
- `/inventory/fba-outbound` 的 FBA 出库写 `product_out`，扣减成品库存。

## 8. 当前开发阶段注意事项

### 8.1 登录和权限

当前还没有正式 Supabase Auth 登录和真实角色权限。

现状：

- `/login` 只是登录界面样式。
- 后台使用 `MockRoleProvider` 模拟角色。
- 默认测试用户是 `内部测试用户`，默认角色是 `admin`。
- 角色切换保存在浏览器 `localStorage` 的 `mock-role` 中。

后续需要接入：

- Supabase Auth 登录。
- 用户资料 `profiles`。
- 角色菜单权限。
- 生产级 RLS 策略。

### 8.2 RLS 策略

当前部分权限使用开发阶段 RLS policy。

这些策略只是方便调试，不是生产环境最终权限。

生产环境需要做到：

- 运营只能创建和查看自己权限范围内的 FBA 备货需求。
- 厂长才能接单、拒绝、排产、更新生产任务。
- 采购才能创建和更新采购单。
- 仓库才能入库、出库、调整库存。
- 管理员拥有完整后台管理权限。

### 8.3 环境变量和密钥

不要上传 `.env.local`。

当前 `.gitignore` 已经忽略：

- `.env`
- `.env.local`
- `.env*.local`

前端只能使用：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

不要把 `service_role` key 放到前端。

`service_role` key 权限非常大，只能放在安全的服务端环境中，不能暴露给浏览器。

### 8.4 业务概念不能跑偏

不要把系统做成传统 `sales_orders` 销售订单系统。

本系统核心概念是：

- FBA 备货需求
- 生产任务
- BOM 物料需求
- 采购
- 库存
- FBA 出库

运营创建的是内部 FBA 备货需求，不是客户销售订单。

### 8.5 SKU 类型注意

当前代码里成品 SKU 主要按 `skus.sku_type = finished_good` 查询。

库存的 `inventory_items.item_type` 中，生产入库会写 `finished_product`。

后续如果要统一命名，不要直接乱改数据或代码；必须先检查 `schema.sql`、`seed.sql`、现有页面查询逻辑和 Supabase 当前数据，再做小范围调整。

## 9. 后续待做功能列表

建议按下面顺序继续开发：

1. BOM 管理后续优化 `/bom`
   - BOM 主表编辑弹窗。
   - BOM 版本复制。
   - BOM 版本对比。
   - 正式角色权限收紧。

2. 产品管理后续优化 `/admin/products`
   - 增加产品分类 `category` 的管理入口。
   - 增加产品图片或更多产品资料前，先确认是否真的需要改 schema。
   - 正式登录后按管理员角色收紧产品写入权限。

3. SKU 管理后续优化 `/admin/skus`
   - 库存页面支持 URL 参数后，从 SKU 管理页跳转时自动带 SKU 筛选。
   - 如需允许修改 `sku_type`，先补业务占用检查。
   - 按需要补 Amazon SKU、FNSKU 的编辑入口。

4. 供应商管理 `/admin/suppliers`
   - 当前还未看到页面文件。
   - 后续需要新增供应商列表、新增、编辑、启用/停用。

5. 仓库管理 `/admin/warehouses`
   - 当前还未看到页面文件。
   - 后续需要新增仓库列表、新增、编辑、启用/停用。

6. 用户管理 `/admin/users`
   - 当前只是占位页。
   - 后续接入 Supabase Auth 和 `profiles`。
   - 支持用户角色分配、账号启停。

7. Supabase Auth 登录
   - 替换当前 mock 登录。
   - 登录后读取当前用户资料和角色。

8. 角色菜单权限
   - 现在只是前端 mock 角色控制菜单。
   - 后续需要结合真实登录和 RLS。

9. 生产领料 / 原材料出库
   - 当前 `inventory_transactions` 支持 `material_out` 类型。
   - 但还没有正式页面处理生产领料和扣减原材料库存。

10. 库存调整
   - 当前 `inventory_transactions` 支持 `adjustment` 类型。
   - 但还没有正式库存调整页面。

11. 页面细节优化
   - 表单校验。
   - 弹窗交互。
   - 状态文案。
   - 分页和搜索性能。
   - 移动端和窄屏适配。
   - 更完整的错误提示。

12. 部署上线
   - 整理环境变量。
   - 收紧 Supabase RLS。
   - 区分开发、测试、生产环境。
   - 检查 build。
   - 部署到正式 Web 环境。

## 10. 给后续 Codex 的开发提醒

后续开发前请先阅读 `PROJECT_NOTES.md`。

每完成一个模块后，请更新 `PROJECT_NOTES.md`，让它保持和真实代码同步。

开发规则：

- 必须先检查 `supabase/schema.sql` 的真实字段，不要凭空编字段。
- 如果页面要写 Supabase，也要检查现有 `src/lib/api` 的写法，沿用当前风格。
- 不要重构无关页面。
- 不要修改数据库 schema，除非真实字段完全无法支持当前业务。
- 不要删除 `/debug/master-data` 页面。
- 不要把系统改成传统销售订单系统。
- 不要上传 `.env.local`。
- 不要把 `service_role` key 放到前端。
- 删除文件必须一个一个删除，并且需要先得到用户同意。

每次改完请运行：

```bash
npm run typecheck
npm run build
```

至少要先通过 `npm run typecheck`，再说明当前改动是否影响构建。
