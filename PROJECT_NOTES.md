# 项目进度说明

最后整理日期：2026-05-24

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
| `/replenishment` | 已完成列表和创建升级版 | FBA 备货需求列表。支持按状态筛选、SKU 搜索、查看详情；右上角“+ 创建备货单”打开创建弹窗，支持 CSV 模板导入多 SKU 明细、单个添加 SKU、明细编辑和提交整张备货单。编辑和删除按钮目前禁用，当前阶段不做修改和删除。 |
| `/replenishment/new` | 过渡提示页 | 当前引导到 `/replenishment` 创建整张 FBA 备货单，避免保留两套创建入口。 |
| `/production/planning` | 已完成排产第一版 | 厂长查看已提交/已接单的 FBA 备货需求，可以接单、拒绝、创建生产任务。创建生产任务时会按 BOM 自动生成物料需求，并把 FBA 备货需求状态更新为 `in_production`。 |
| `/production/orders` | 已完成跟踪和领料第一版 | 生产任务列表。显示 FBA 备货需求数量、计划生产数量、超量生产数量、已入库数量、待入库数量、物料状态、领料状态、生产状态。支持查看详情、确认领料弹窗、自动扣原材料库存、写 `material_out` 库存流水，并把生产任务更新为 `in_progress`。 |
| `/bom` | 已完成管理和批量维护第一版 | BOM 管理页面。读取 `bom_headers` 和 `bom_items`，支持新增 BOM、查看明细、添加原材料、编辑 BOM 明细的单位用量/损耗率/备注、启用/停用 BOM、CSV 批量导入、删除明细、删除/批量删除或停用 BOM，并在删除前检查生产任务引用。 |
| `/materials/requirements` | 已完成查询第一版 | 物料需求列表。读取 `material_requirements`，并回查 `bom_items` 显示 BOM 单位用量和损耗率。支持按状态筛选。当前是查询页，不直接新增、编辑、删除。 |
| `/purchase/orders` | 已完成采购升级版 | 采购单页面。支持从缺料物料生成采购单、采购人员手动创建采购单、CSV 批量导入、CSV 导出给供应商、列表分页、详情弹窗和状态按钮。缺料生成仍会写入 `purchase_order_items.material_requirement_id` 并把对应物料需求状态更新为 `purchased`。实际库存入库建议走 `/inventory/inbound`。 |
| `/inventory/inbound` | 已完成入库第一版 | 入库管理。分为采购入库和生产入库。采购入库会写 `material_in` 库存流水、更新 `inventory_items`、采购明细到货数量、采购单状态和物料需求状态。生产入库会写 `product_in` 库存流水、更新成品库存、更新生产任务 `completed_quantity` 和状态。 |
| `/inventory/fba-outbound` | 已完成 FBA 出库第一版 | FBA 出库单独处理。读取可出库 FBA 备货需求，按成品库存和已出库数量计算待出库数量。提交后写 `product_out` 库存流水、扣减 `inventory_items`，累计出库数量达到备货需求数量后把备货需求标记为 `shipped`。 |
| `/inventory/transactions` | 已完成查询第一版 | 库存流水页面。读取 `inventory_transactions`，支持按流水类型、仓库、SKU、日期筛选，显示关联采购单、生产任务或 FBA 备货单。当前只查询，不新增、编辑、删除。 |
| `/inventory/adjustments` | 已完成调整第一版 | 库存调整页面。读取当前库存，支持增加库存、减少库存、直接修正库存，每次调整都会更新 `inventory_items.quantity_on_hand` 并写入 `transaction_type = adjustment` 的库存流水。 |
| `/inventory/materials` | 已完成查询第一版 | 原材料当前库存页面。读取 `inventory_items`，按 SKU 类型筛选原材料，显示当前库存、安全库存、库存状态、仓库和查看流水入口。 |
| `/inventory/products` | 已完成查询第一版 | 成品当前库存页面。读取 `inventory_items`，按成品 SKU 筛选，显示当前成品库存、仓库和查看流水入口。 |
| `/admin/products` | 已完成管理和批量维护第一版 | 产品基础资料管理页面。读取 `products` 和 `skus`，支持产品列表、搜索、状态筛选、汇总卡片、新增产品、编辑产品、启用/停用产品、查看产品关联 SKU、CSV 批量导入、删除/批量删除或停用，并在删除前检查 SKU 引用。 |
| `/admin/skus` | 已完成管理和批量维护第一版 | SKU 基础资料管理页面。读取 `skus`、`products`、`inventory_items`、`bom_headers`、`bom_items`，支持 SKU 列表、搜索筛选、汇总卡片、新增 SKU、编辑 SKU、启用/停用 SKU、查看库存入口、查看 BOM 关联、CSV 批量导入、删除/批量删除或停用，并在删除前检查 BOM、FBA、生产、采购、库存和库存流水引用。 |
| `/admin/materials` | 已完成管理和批量维护第一版 | 辅料管理页面。直接读取 `skus.sku_type = material` 的辅料资料，支持搜索筛选、汇总卡片、新增辅料、编辑辅料、启用/停用、查看库存/BOM/采购/流水详情、CSV 批量导入、删除/批量删除或停用，并在删除前检查 BOM、物料需求、采购、库存和库存流水引用。 |
| `/admin/suppliers` | 已完成管理和批量维护第一版 | 供应商基础资料管理页面。读取 `suppliers` 和 `purchase_orders`，支持供应商列表、搜索、状态筛选、汇总卡片、新增供应商、编辑供应商、启用/停用供应商、查看关联采购单、CSV 批量导入、删除/批量删除或停用，并在删除前检查采购单引用。 |
| `/admin/warehouses` | 已完成管理和批量维护第一版 | 仓库基础资料管理页面。读取 `warehouses`、`inventory_items`、`inventory_transactions` 和 `skus`，支持仓库列表、搜索筛选、汇总卡片、新增仓库、编辑仓库、启用/停用仓库、查看仓库库存、跳转查看流水、CSV 批量导入、删除/批量删除或停用，并在删除前检查库存、流水、FBA 备货和采购单引用。 |
| `/admin/users` | 已完成管理第一版 | 用户管理页面。读取 `profiles` 和 `roles`，支持用户资料列表、搜索筛选、汇总卡片、新增/编辑 profiles、启用/停用用户、分配角色，并只读展示角色列表。当前不创建 Supabase Auth 登录账号。 |

### 当前还是占位或待完善的页面

| 页面 | 当前状态 | 说明 |
| --- | --- | --- |
| `/login` | 待完善 | 当前只是登录页面样式，点击后进入后台，还没有真实 Supabase Auth 登录。 |

用户管理页面已经新增到导航，管理员可以看到入口。仓库管理页面已经新增到导航，管理员和仓库角色都可以看到入口。辅料管理页面已经新增到“基础资料”，管理员、采购和仓库角色可以看到入口，其中仓库当前只做查看。

### 3.1 列表分页和弹窗详情统一优化（2026-05-24）

已完成一轮后台主要列表页交互优化，目标是解决“点查看后详情堆在页面最下面、数据多时要一直滚动”的问题。

本次完成：

- 新增通用分页组件 `src/components/Pagination.tsx`，主要列表默认每页显示 20 条。
- 新增通用弹窗组件 `src/components/Modal.tsx`，用于查看详情和编辑表单。
- 新增分页工具 `src/lib/utils/pagination.ts`，先采用稳定、改动小的前端分页。
- 已应用分页的页面：`/replenishment`、`/production/orders`、`/materials/requirements`、`/purchase/orders`、`/inventory/transactions`、`/inventory/materials`、`/inventory/products`、`/bom`、`/admin/products`、`/admin/skus`、`/admin/suppliers`、`/admin/warehouses`、`/admin/users`。
- 已改成弹窗详情或弹窗编辑的页面：`/replenishment`、`/production/orders`、`/materials/requirements`、`/purchase/orders`、`/inventory/transactions`、`/inventory/materials`、`/inventory/products`、`/bom`、`/admin/products`、`/admin/skus`、`/admin/suppliers`、`/admin/warehouses`、`/admin/users`。
- 主要列表的“查看 / 查看详情 / 查看明细 / 查看 BOM / 查看库存 / 查看采购单 / 查看 SKU”不再把详情长期展示在页面底部。
- `/admin/products`、`/admin/skus`、`/admin/suppliers`、`/admin/warehouses`、`/admin/users` 的编辑表单已改为弹窗显示，保存逻辑沿用原有函数。
- 保持 RLS、Supabase 表结构和现有 API 逻辑不变，没有修改数据库 schema。

测试方式：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户要求跳过继续浏览器检查，所以未继续做完整手动浏览器逐页验证。

如果分页或弹窗不生效，优先检查：

- 页面是否正确引入 `Pagination`、`Modal` 和 `paginateItems`。
- 表格渲染是否使用 `paginated...` 数据，而不是原始完整数组。
- 筛选条件变化后是否调用 `setPage(1)`。
- 行内“查看”按钮是否设置对应的 selected 状态。
- 弹窗是否传入 `open`、`title` 和 `onClose`。

后续待优化：

- 数据量继续增大后，可把前端 `slice` 分页升级成 Supabase `range(from, to)` 服务端分页。
- 更复杂筛选可统一抽成查询参数，便于刷新后保留条件。
- 表格列配置、列显隐和固定操作列可后续单独做，不建议和业务写入逻辑混在一起改。

### 3.2 基础资料管理页列表优先和弹窗化优化（2026-05-24）

本次按“先完成第一批基础资料页面”的优先级处理，没有自动打开浏览器，也没有执行任何清空数据 SQL。

已完成页面：

- `/admin/products`：新增产品表单改为弹窗；列表首列新增产品图片缩略图；搜索文案调整为按 SPU / 产品名称搜索；新增和编辑弹窗支持分类、图片 URL、备注和状态；批量导入模板改为 `spu`、`name`、`category`、`image_url`、`description`、`status`，其中 `image_url` 会写入真实字段 `products.product_image_url`。
- `/admin/skus`：新增 SKU 表单改为弹窗；所属产品选择从长下拉改为可搜索选择器；编辑 SKU 弹窗里的所属产品也改为可搜索选择器；列表顶部保留搜索、筛选、批量导入、刷新，并新增“新增 SKU”按钮。
- `/bom`：新增 BOM 主表表单改为弹窗；成品 SKU 和 BOM 明细里的原材料 SKU 选择改为可搜索选择器；批量导入继续使用统一 `BulkImportDialog`；BOM 明细仍在详情弹窗里维护。
- `/admin/suppliers`：新增供应商表单改为弹窗；列表顶部保留搜索、状态筛选、批量导入、刷新，并新增“新增供应商”按钮。
- `/admin/warehouses`：新增仓库表单改为弹窗；列表顶部保留搜索、仓库类型筛选、状态筛选、批量导入、刷新，并新增“新增仓库”按钮。

本次新增或复用的通用组件：

- 新增 `src/components/ImageCell.tsx`：统一展示 56px 产品图片缩略图，图片为空或加载失败时显示灰色占位。
- 继续复用 `Modal`、`BulkImportDialog`、`ConfirmDialog`、`BulkActionBar`、`Pagination`。
- 本次没有新增单独 `DataTable` / `PageToolbar`，因为当前页面已经稳定复用现有表格样式和弹窗组件，先避免大范围重构。

本次新增 SQL 脚本：

- `scripts/clear-business-demo-data.sql`：只清理业务测试单据和库存流水/库存余额，保留产品、SKU、BOM、供应商、仓库、用户和角色。当前 `inventory_items` 没有“是否样本数据”的来源字段，所以这个脚本会清空当前库存余额；如果库存里已有真实数据，不要直接执行。
- `scripts/clear-all-demo-data.sql`：清空业务单据、库存、BOM、产品、SKU、供应商和仓库，保留 `roles`、`profiles` 和 `auth.users`。

样本数据清理脚本使用方法：

1. 执行前先确认 Supabase 数据库已经备份。
2. 在项目里打开对应 SQL 文件，复制内容。
3. 到 Supabase SQL Editor 粘贴。
4. 再次确认清理范围无误后手动执行。

本次没有新增数据库字段。`products` 表当前已经有 `product_image_url text`，它就是产品图片 URL 字段；为避免重复字段，本次没有再新增 `image_url`。导入模板里的 `image_url` 只是给业务人员填写的表头，程序会映射到真实字段 `product_image_url`。

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

后续待优化：

- 第二批业务核心页面还可以继续统一增强：`/replenishment`、`/purchase/orders`、`/production/planning`、`/production/orders`。其中 `/replenishment` 和 `/purchase/orders` 已经有弹窗创建和批量导入基础，但还可以继续优化 SKU 搜索、模板导入错误报告和生产任务按产品聚合展示。
- 第三批库存和出入库页面还可以继续统一增强：`/inventory/inbound`、`/inventory/fba-outbound`、`/inventory/adjustments`、`/inventory/transactions`、`/inventory/materials`、`/inventory/products`。库存流水和当前库存页主要是查询页，不一定需要新增弹窗。
- 产品图片后续可以接 Supabase Storage 上传，现在先支持填写图片 URL。
- 批量导入可以进一步增强错误报告下载、重复数据跳过/更新策略和 Excel 文件支持。
- 生产任务页面可以继续优化为按产品聚合展示，同时保留 SKU 明细数量，避免丢失 SKU 维度。

### 3.3 业务核心和库存出入库页面弹窗化优化（2026-05-24）

本次继续完成第二批和第三批页面优化，没有自动打开浏览器，也没有执行任何 SQL。

第二批业务核心页面：

- `/replenishment`：已保持列表优先；创建 FBA 备货单、SKU 明细导入、SKU 选择和详情都继续使用弹窗。
- `/purchase/orders`：采购单列表和缺料清单保持列表优先；手动新建/编辑采购单继续使用弹窗；缺料生成采购单的草稿窗口改为统一 `Modal`；手动采购单里的原材料选择从长下拉改为可搜索选择器；批量导入继续使用 `BulkImportDialog`。
- `/production/planning`：保持列表优先；创建生产任务和查看 FBA 备货单明细使用弹窗；生产任务创建弹窗已按产品聚合展示，同时保留每个 SKU 的计划生产数量。
- `/production/orders`：生产任务列表补充统一列表标题；查看详情继续使用 `Modal`；确认领料弹窗改为统一 `Modal`。
- `/materials/requirements`：物料需求查询页补充统一列表标题，仍保持只读筛选页面，不新增写入入口。

第三批库存和出入库页面：

- `/inventory/inbound`：采购入库和生产入库不再默认铺开表单。页面先展示待入库采购单/生产任务列表，点击“办理入库”后打开弹窗，在弹窗里选择仓库、填写本次入库数量并提交。
- `/inventory/fba-outbound`：FBA 出库表单从页面底部改为弹窗；页面默认展示可出库备货需求列表，点击“发往 FBA”后再填写出库数量和备注。
- `/inventory/adjustments`：库存调整继续从当前库存列表进入，调整表单改为统一 `Modal`。
- `/inventory/transactions`：库存流水是只读追踪页，补充统一列表标题，继续只提供筛选、刷新、查看详情。
- `/inventory/materials`、`/inventory/products`：当前库存页面补充统一列表标题，继续只展示库存、筛选和详情弹窗，不新增写入入口。

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

本次没有新增数据库字段，也没有新增 Supabase SQL。所有改动都沿用当前真实表结构：采购入库、生产入库、FBA 出库和库存调整仍通过 `inventory_items` 与 `inventory_transactions` 记录库存变化。

后续建议：

- 采购单供应商选择后续也可以改成可搜索选择器，适合供应商数量变多后继续优化。
- 入库、出库、库存调整弹窗后续可以增加打印/导出单据能力。
- 库存流水后续可以增加“导出当前筛选结果”。
- 浏览器人工检查建议重点看 `/inventory/inbound`、`/inventory/fba-outbound`、`/inventory/adjustments` 和 `/purchase/orders` 的弹窗打开、关闭、提交按钮状态。

### 3.4 辅料管理页面（2026-05-24）

本次新增 `/admin/materials` 辅料管理页面，没有新增数据库表，也没有修改数据库 schema。

当前逻辑：

- 辅料资料继续存在 `skus` 表，通过 `skus.sku_type = material` 和成品 SKU 区分。
- 页面只展示和维护 `sku_type = material` 的记录，不把辅料做成产品 SPU，也不强制绑定 `products.product_id`。
- 新增辅料时固定写入 `sku_type = material`、`product_id = null`、`amazon_sku = null`、`fnsku = null`。
- 编辑辅料时允许修改辅料名称、单位、规格和状态；辅料编码锁定，避免影响 BOM、采购、库存和流水记录。
- 列表显示辅料编码、辅料名称、从规格里临时解析的分类、单位、规格、状态、当前库存汇总、安全库存汇总、BOM 引用次数和采购引用次数。
- 顶部支持按辅料编码、名称、规格搜索，支持状态筛选、单位筛选、刷新、新增和批量导入。
- 汇总卡片显示辅料总数、启用辅料、停用辅料、有库存辅料、低库存辅料。
- 详情弹窗展示基础资料、当前库存汇总、被哪些 BOM 使用、最近采购记录和最近库存流水。
- 删除前检查 `bom_items.component_sku_id`、`material_requirements.material_sku_id`、`purchase_order_items.sku_id`、`inventory_items.sku_id`、`inventory_transactions.sku_id`，有引用时禁止硬删除并提示改为停用。
- 批量导入复用 `BulkImportDialog`，上传后先预览和行级校验，有错误行时可下载错误报告，确认后才写入 Supabase。
- 批量导入模板中文字段：`辅料编码`、`辅料名称`、`单位`、`规格`、`状态`。
- 批量导入也兼容英文表头：`sku_code`、`sku_name`、`unit`、`specs`、`status`。
- 批量导入规则：辅料编码和辅料名称必填，单位为空默认 `pcs`，状态为空默认 `active`，辅料编码重复时阻止导入并提示。
- 导航位置：基础资料 -> 辅料管理；角色可见范围为 `admin`、`procurement`、`warehouse`。当前页面里 admin 和 procurement 可新增/编辑/导入/删除，warehouse 只查看。

本次修改文件：

- `src/app/(app)/admin/materials/page.tsx`
- `src/lib/api/materials.ts`
- `src/lib/navigation.ts`
- `src/components/BulkImportDialog.tsx`
- `src/lib/utils/csv.ts`
- `PROJECT_NOTES.md`

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户要求不要自动打开浏览器检查，所以本次不做浏览器自动检查。

如果辅料管理读写失败，优先检查：

- 当前 Supabase RLS 是否已经执行 `supabase/dev-skus-policies.sql` 或 `supabase/dev-bulk-import-delete-policies.sql` 中针对 `skus` 的开发阶段读写策略。
- `inventory_items.safety_stock_quantity` 是否有数据；没有数据时低库存统计可能为 0。
- 导入 CSV 是否使用了模板字段，或者英文兼容字段 `sku_code`、`sku_name`、`unit`、`specs`、`status`。

## 4. 当前已完成的业务流程

### 4.1 运营提交 FBA 备货需求

已完成“一张备货单 + 多个 SKU 明细”创建流程，并在 2026-05-24 优化为以 CSV 批量导入明细为主、弹窗单个添加为辅。

入口：

- `/replenishment`：FBA 备货需求列表，右上角“+ 创建备货单”打开创建弹窗。
- `/replenishment/new`：当前保留为过渡提示页，引导到 `/replenishment` 创建整张备货单。

当前逻辑：

- 侧边栏主入口为“FBA 备货需求”，直接进入 `/replenishment`。
- `/replenishment` 页面右上角有绿色“+ 创建备货单”按钮。
- 创建弹窗顶部是备货单基础信息：备货单号提交时自动生成、需求人显示当前模拟登录用户、需求日期默认今天、目的仓库、期望发货日期和备注。
- 创建弹窗下方只显示已经导入或添加成功的 SKU 明细，不再在主页面直接展开所有产品和 SKU。
- 明细区按钮顺序为：下载导入模板、批量导入、添加产品/SKU、清空明细。批量导入是主功能。
- CSV 模板当前采用中文表头：`SKU编码`、`本次备货数量`、`备注`；程序也兼容 `sku_code`、`quantity`、`remark` 等英文表头。
- 点击“下载导入模板”会下载 CSV 示例，示例行是 `100001,300,1米黑色备货` 和 `100002,500,2米黑色备货`。
- 点击“批量导入”上传 CSV 后，页面会按 SKU 编码匹配系统里的成品 SKU，自动带出产品图片、产品名称/SPU、SKU 名称、SKU 编码、规格、当前成品库存和 BOM 提示。
- 批量导入会在写入数据库前先生成当前备货单明细，用户确认无误后再提交整张备货单。
- 同一个 CSV 里重复 SKU 会自动合并数量并提示；如果导入 SKU 已经存在于当前明细，也会自动合并数量并提示。
- 有错误行时，成功行会先加入当前明细，错误行会在弹窗展示行号、SKU 编码和错误原因，并支持下载错误报告 CSV。
- 单个添加作为备用功能：点击“添加产品/SKU”打开“选择产品和 SKU”弹窗，顶部支持按产品名称、SPU、SKU 名称、SKU 编码、规格搜索，左侧选产品，右侧勾选 SKU 并填写数量后确认添加。
- 主页面明细表格字段：产品图片、产品名称/SPU、SKU 名称、SKU 编码、规格/米数、当前成品库存、本次备货数量、备注、操作。
- 明细表格支持直接修改本次备货数量和备注，支持删除单行、清空全部，并在底部显示 SKU 种类数量和备货总数量。
- 提交整张备货单时写入 `fba_replenishment_requests` 主表和 `fba_replenishment_request_items` 明细表。
- 主表的 `requested_quantity` 现在保存明细总数量，兼容仍读取主表数量的旧页面；主表的 `sku_id` 仍使用第一条明细 SKU 作为兼容字段。
- 新需求状态为 `submitted`。
- 亚马逊站点当前仍按默认 `US` 写进 `notes` 文本里，不是单独字段。
- 优先级当前仍按默认 `normal` 写入。
- 当前还没有真实登录，所以 `requested_by` 暂时为空。
- 批量导入校验：`SKU编码` 必填、`本次备货数量` 必填且必须大于 0、SKU 编码必须存在于系统成品 SKU、可选期望发货日期必须是 `YYYY-MM-DD`、可选目的仓库必须匹配仓库编码或仓库名称。
- 如果导入 SKU 暂未找到启用 BOM，当前不阻止创建备货单，但会提示后续排产算料前需要补齐 BOM。
- 厂长排产和生产任务仍保持“一张生产任务 + 多个 SKU 明细”，不要改成一个 SKU 一张生产任务。

本次修改文件：

- `src/app/(app)/replenishment/page.tsx`
- `src/lib/api/replenishment.ts`
- `src/app/globals.css`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/replenishment`，点击“+ 创建备货单”，确认弹窗顶部显示备货单号、需求人、需求日期、目的仓库、期望发货日期和备注。
- 点击“下载导入模板”，确认下载的 CSV 表头是 `SKU编码`、`本次备货数量`、`备注`。
- 填写真实 SKU 编码和数量后点击“批量导入”，确认成功行进入主页面明细表格，且重复 SKU 会自动合并。
- 上传包含错误数据的 CSV，例如空 SKU、空数量、数量为 0、数量为负数、不存在的 SKU、错误日期或不存在的仓库，确认弹窗展示错误行号和原因。
- 在导入弹窗点击“下载错误报告”，确认能下载失败行 CSV。
- 点击“添加产品/SKU”，确认可以搜索、左侧选产品、右侧勾选 SKU 并填写数量，确认添加后进入明细表格。
- 在明细表格修改数量和备注，删除单行，清空明细，确认底部 SKU 种类数量和备货总数量同步变化。
- 提交前不选目的仓库、没有明细、数量为空或数量小于等于 0，确认页面会阻止提交并提示。
- 提交成功后回到 `/replenishment` 列表，确认能看到新备货单，详情里能看到多 SKU 明细。

如果批量导入没生效，优先检查：

- CSV 表头是否是 `SKU编码`、`本次备货数量`、`备注`，或兼容英文表头 `sku_code`、`quantity`、`remark`。
- `skus.sku_code` 是否真实存在，且对应 SKU 是否为成品 SKU。
- 如果填写了目的仓库，确认仓库编码或名称在 `warehouses` 里真实存在。
- Supabase RLS 是否已经允许读取 `skus`、`products`、`warehouses`、`inventory_items`、`bom_headers`，并允许插入 `fba_replenishment_requests` 和 `fba_replenishment_request_items`。
- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- 浏览器控制台或页面错误提示里是否有更具体的 Supabase 报错。

### 4.2 厂长接单 / 拒绝

已完成第一版，并在 2026-05-24 调整 FBA 菜单层级。

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

### 4.5 采购单创建、导入和导出

已完成升级版。

入口：`/purchase/orders`

当前逻辑：

- 采购单支持三种来源展示：缺料生成、手动创建、批量导入。
- 旧流程仍然保留：读取 `material_requirements` 中状态为 `shortage` 且 `shortage_quantity > 0` 的缺料记录，可以选择缺料物料生成采购单。
- 缺料生成采购单时，写入 `purchase_orders` 和 `purchase_order_items`，并继续让 `purchase_order_items.material_requirement_id` 关联来源物料需求。
- 缺料生成采购单成功后，对应 `material_requirements.status` 更新为 `purchased`。
- 手动创建采购单通过页面右上角“+ 新建采购单”打开弹窗，不再跳到底部表单。表单读取真实 `suppliers`、`profiles` 和 `skus`，明细只能选择 `skus.sku_type = material` 的原材料 SKU。
- 手动创建采购单默认写入 `purchase_orders.status = draft`，采购单号自动使用 `PUR-年月日-随机数`，例如 `PUR-20260601-1234`。
- 手动创建和批量导入的采购明细 `material_requirement_id` 为空，不影响缺料需求。
- 草稿采购单支持编辑供应商、采购负责人、日期、备注、采购数量、单价和明细备注。第一版不做删除采购单，不开放业务单据 delete。
- 采购单列表显示采购单号、供应商、采购负责人、状态、下单日期、预计到货日期、总金额、明细数量、创建来源、创建时间和操作。
- 详情使用弹窗展示，包含采购单主信息、供应商联系人信息、采购明细、总金额、关联物料需求和状态操作。
- 每行采购单和详情弹窗都支持导出 CSV，文件名格式为 `采购单号-供应商名称.csv`，字段用中文，方便直接发给供应商。
- 批量导入采购单复用 `BulkImportDialog` 和 `src/lib/utils/csv.ts`，上传后先预览和逐行校验，不会直接写入数据库。
- 批量导入模板字段：`purchase_order_no`、`supplier_code`、`order_date`、`expected_arrival_date`、`material_sku_code`、`quantity`、`unit_price`、`remark`。
- 批量导入分组规则：填写了 `purchase_order_no` 的行按采购单号合并；未填写采购单号的行按 `supplier_code + expected_arrival_date` 合并为一张采购单。
- 批量导入校验供应商编码、原材料 SKU、日期格式、数量、单价、数据库中已存在的采购单号，并提示同一采购单内重复原材料。
- 导出 CSV 字段：采购单号、供应商、联系人、联系电话、邮箱、下单日期、预计到货日期、原材料编码、原材料名称、单位、采购数量、单价、小计、备注。

本次修改文件：

- `src/lib/navigation.ts`
- `src/components/layout/sidebar.tsx`
- `src/app/(app)/purchase/orders/page.tsx`
- `src/lib/api/purchase.ts`
- `src/app/globals.css`
- `PROJECT_NOTES.md`

测试方式：

- 手动创建采购单：打开 `/purchase/orders`，点击“+ 新建采购单”，选择供应商、可选采购负责人、下单日期、预计到货日期和备注，添加一条或多条原材料 SKU 明细，确认数量大于 0、单价不小于 0 后保存，再回到采购单列表确认能看到新采购单。
- 批量导入采购单：打开 `/purchase/orders`，点击“批量导入采购单”，先下载模板，填写 CSV 后上传，确认页面先显示预览、行级校验和将生成的采购单数量；有错误时不能导入，全部通过后点击“确认导入”。
- 导出采购单：在采购单列表点击“导出”，或点“查看详情”后在详情弹窗点击“导出采购单”，确认下载的 CSV 表头是中文，且明细小计等于采购数量乘以单价。
- 缺料生成采购单：在“待采购清单”勾选缺料物料，点击“生成采购单”，确认仍会写入 `purchase_order_items.material_requirement_id`，并把对应缺料需求更新为 `purchased`。
- 侧边栏：确认顺序为首页、创建备货需求、FBA 备货需求、生产管理、采购管理、仓库库存、基础资料、系统管理，且不再出现不可点击的“FBA 备货”分组标题。

注意：

- 采购单页面的状态按钮主要用于采购单状态流转。
- 真正会增加库存、生成库存流水的采购入库，请优先走 `/inventory/inbound`。
- 如果页面读写失败，优先确认 `supabase/dev-purchase-policies.sql` 是否已经在 Supabase SQL Editor 执行。该文件已包含采购单、采购明细、供应商、SKU、物料需求和 profiles 的开发阶段读写策略。

后续待优化：

- 正式登录后，把 `created_by` 自动写成当前采购人员，而不是手动选择。
- 采购单编辑第一版只编辑草稿主信息和已有明细数量/单价/备注，后续如需编辑时新增或删除明细，需要单独设计业务规则。
- 批量导入当前按采购单逐张写入，后续可升级为数据库事务或 RPC，避免极端情况下主表成功但明细失败。
- 后续可增加 Excel 导出、打印版 PDF、供应商确认回传等功能。

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

### 4.6.1 生产领料 / 原材料出库

已完成第一版。

入口：`/production/orders`

当前逻辑：

- 厂长在生产任务页面点击“确认领料”，不需要手动输入领料数量。
- 系统读取该生产任务已经生成的 `material_requirements`，按 `required_quantity` 作为应领数量。
- 领料状态优先通过 `inventory_transactions` 判断：同一生产任务只要已经存在 `transaction_type = material_out` 且 `production_order_id = production_orders.id` 的流水，就视为已领料。
- 确认前会弹出领料清单，显示生产任务单号、成品 SKU、计划生产数量、原材料 SKU、原材料名称、应领数量、当前库存、领料后库存、扣减仓库和足够/不足状态。
- 库存足够判断使用 `inventory_items.quantity_on_hand - inventory_items.reserved_quantity` 作为可用库存。
- 扣库存时按真实字段使用 `inventory_items.warehouse_id + sku_id` 的库存记录。优先选择 `warehouse_type = material` 的原材料仓；如果没有明确原材料仓，则选择第一条单仓可用库存足够的库存记录。
- 第一版不跨仓扣料。如果所有仓库合计够，但没有单个仓库够扣，会提示先手动调整仓库库存。
- 确认领料时会再次检查是否已经有 `material_out` 流水，防止重复扣料。
- 确认领料时会再次读取库存，防止页面打开后库存发生变化。
- 每一种原材料都会扣减对应 `inventory_items.quantity_on_hand`。
- 每一种原材料都会写一条 `inventory_transactions`，`transaction_type = material_out`，`quantity` 按现有出库逻辑继续记录正数，并通过 `production_order_id` 关联生产任务。
- 领料成功后，`production_orders.status` 更新为 `in_progress`。
- 领料成功后，`material_requirements.status` 更新为 `issued`。真实 schema 中 `status` 是 `text`，没有额外枚举限制，所以当前可以写入 `issued`。

本次修改文件：

- `src/lib/api/production.ts`
- `src/app/(app)/production/orders/page.tsx`
- `src/app/globals.css`
- `supabase/dev-material-out-policies.sql`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/production/orders`，确认列表显示领料状态。
- 对未领料且库存足够的生产任务点击“确认领料”，确认弹窗显示原材料领料清单。
- 点击“确认领料并开始生产”，确认原材料库存减少、生成 `material_out` 流水、生产任务变为 `in_progress`、物料需求变为 `issued`。
- 再次打开同一生产任务，确认按钮显示“已领料”且不能重复扣库存。

如果页面读不到或写不进去，优先检查：

- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- Supabase 里是否已经执行基础 `dev-policies.sql`。
- 如果确认领料报 RLS 权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-material-out-policies.sql`。
- `material_requirements` 是否已经按生产任务生成。
- `inventory_items` 是否有对应原材料 SKU 的库存记录。
- `warehouses.warehouse_type` 是否有 `material` 原材料仓；如果没有，系统会退回选择第一条单仓足够的库存记录。
- `inventory_transactions` 是否已经存在该生产任务的 `material_out` 流水；如果存在，系统会禁止重复领料。

后续待优化：

- 增加补料流程，例如生产过程中发现损耗超出 BOM 时追加领料。
- 增加退料流程，例如生产结束后把多领原材料退回库存。
- 增加跨仓扣料能力，但需要先设计仓库调拨或批次规则，避免账务混乱。
- 正式登录后按厂长/管理员角色收紧确认领料权限。
- 后续可以把扣库存、写流水、更新状态收进数据库事务或 RPC，进一步降低中途失败造成的数据不一致风险。

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
- 生产领料写 `material_out`。
- 生产入库写 `product_in`。
- FBA 出库写 `product_out`。
- 页面可以查看流水类型、SKU、仓库、数量、关联单据、操作时间、备注。
- 关联单据通过真实字段判断：`purchase_order_id`、`production_order_id`、`replenishment_request_id`。
- 库存调整写 `adjustment`，调整原因、调整方式、调整前库存、调整后库存、调整差异和操作备注写入 `notes`，方便后续追溯。

### 4.9.1 库存调整

已完成第一版。

入口：`/inventory/adjustments`

当前逻辑：

- 页面先读取 `inventory_items` 当前库存，并关联 `skus`、`products`、`warehouses` 显示 SKU 编码、名称、类型、产品、仓库、库存数量、单位和最后更新时间。
- 支持按 SKU 编码 / 名称搜索，按 SKU 类型筛选全部 / 原材料 / 成品，按仓库筛选，并支持刷新列表。
- SKU 类型展示规则：`material` 显示为“原材料”，`finished_good` / `finished_product` 显示为“成品”，其他值按原值显示。
- 点击“调整库存”后打开调整表单，显示 SKU、仓库、当前库存和单位等只读信息。
- 支持三种调整方式：增加库存、减少库存、直接修正为指定库存。
- 增加库存时，调整数量必须大于 0，调整后库存 = 当前库存 + 调整数量。
- 减少库存时，调整数量必须大于 0，且不能大于当前库存，调整后库存 = 当前库存 - 调整数量。
- 直接修正库存时，用户输入调整后库存，系统计算差异数量 = 调整后库存 - 当前库存；差异为 0 时禁止提交。
- 不允许调整后库存小于 0。
- 调整提交时先按真实库存记录重新读取当前库存，再更新 `inventory_items.quantity_on_hand`，并写入一条 `inventory_transactions.transaction_type = adjustment` 的流水。
- 当前 schema 中 `inventory_transactions.quantity` 的注释说明是“入库为正数，出库也先记录正数，由类型判断方向”，所以库存调整流水的 `quantity` 也继续记录正数；实际增加或减少通过 `notes` 里的“调整差异：+数量 / -数量”追溯。
- 当前没有真实登录，`operator_id` 仍暂时写 `null`；页面最近调整记录会兼容显示操作人。
- 页面下方显示最近 `adjustment` 流水，包含操作时间、SKU、仓库、调整数量、调整原因、备注和操作人。

本次修改文件：

- `src/lib/api/inventory.ts`
- `src/app/(app)/inventory/adjustments/page.tsx`
- `src/lib/navigation.ts`
- `src/app/globals.css`
- `supabase/dev-inventory-adjustment-policies.sql`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/inventory/adjustments`，确认当前库存列表能读取真实数据。
- 使用 SKU 搜索、SKU 类型筛选、仓库筛选和刷新列表。
- 对一条库存执行增加库存，确认 `inventory_items.quantity_on_hand` 增加，并新增 `adjustment` 流水。
- 对一条库存执行减少库存，确认不能超过当前库存，成功后当前库存减少，并新增 `adjustment` 流水。
- 对一条库存执行直接修正库存，确认系统按目标库存自动计算差异，目标库存不能小于 0，数量不变时不能提交。
- 在页面下方最近调整记录和 Supabase Table Editor 中确认流水备注里有调整原因、方式、调整前库存、调整后库存、调整差异和操作备注。

如果页面读不到或写不进去，优先检查：

- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- Supabase 里是否已经执行基础 `dev-policies.sql`。
- 如果读取或写入库存调整报 RLS 权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-inventory-adjustment-policies.sql`。
- `inventory_items` 是否有对应仓库和 SKU 的库存记录。
- `inventory_transactions` 是否有 `transaction_no`、`warehouse_id`、`sku_id`、`transaction_type`、`quantity`、`operator_id`、`occurred_at`、`notes` 等真实字段。
- 如果页面提示“这条库存刚刚发生了变化”，说明提交期间库存被其他操作改过，需要刷新页面后重新调整。

后续待优化：

- 正式登录后把 `operator_id` 写成当前登录用户。
- 后续可以把更新当前库存和写库存流水收进数据库事务或 RPC，进一步降低中途失败导致的数据不一致风险。
- 如需审批流，可以后续增加库存调整单据表；当前 schema 已支持第一版直接调整和留痕。

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

### 4.15 供应商管理

已完成第一版。

入口：`/admin/suppliers`

当前逻辑：

- 页面读取真实 `suppliers` 和 `purchase_orders`，不再使用占位页或 mock 数据。
- 供应商列表显示供应商编码、供应商名称、联系人、联系电话、邮箱、地址、状态、关联采购单数量、创建时间、更新时间、备注和操作。
- `purchase_orders.supplier_id` 关联 `suppliers.id`，页面通过这个关系统计采购单数量并查看某个供应商的关联采购单。
- 顶部汇总供应商总数、启用供应商数、停用供应商数和已产生采购单的供应商数量。
- 支持按供应商名称、供应商编码、联系人搜索。
- 支持按 `suppliers.status` 筛选，当前状态主要使用 `active` 和 `inactive`。
- 新增供应商会写入 `suppliers.supplier_code`、`name`、`contact_name`、`phone`、`email`、`address`、`notes` 和 `status`。
- 新增供应商前会检查 `supplier_code` 是否重复。
- 供应商编码和供应商名称都是必填，因为当前 schema 中 `supplier_code` 和 `name` 都是非空字段。
- 编辑供应商支持修改供应商名称、联系人、联系电话、邮箱、地址、备注和状态，不修改供应商编码。
- 启用/停用供应商通过更新 `suppliers.status` 实现。
- 查看采购单通过 `purchase_orders.supplier_id = suppliers.id` 查询，显示采购单号、状态、下单日期、预计到货日期、创建时间和备注。

本次修改文件：

- `src/lib/api/suppliers.ts`
- `src/app/(app)/admin/suppliers/page.tsx`
- `src/lib/navigation.ts`
- `src/app/globals.css`
- `supabase/dev-suppliers-policies.sql`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/admin/suppliers`，确认供应商列表能读取真实数据。
- 使用搜索框按供应商名称、编码或联系人筛选。
- 按状态筛选启用/停用供应商。
- 新增一个供应商，确认写入 `suppliers` 并刷新列表。
- 编辑供应商名称、联系人、电话、邮箱、地址、备注或状态，确认保存后刷新列表。
- 点击启用/停用，确认 `suppliers.status` 变化。
- 点击“查看采购单”，确认能看到该供应商下 `purchase_orders.supplier_id` 关联的采购单。

如果页面读不到或写不进去，优先检查：

- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- Supabase 里是否已经执行基础 `dev-policies.sql`。
- 如果新增、编辑或启用/停用供应商报 RLS 权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-suppliers-policies.sql`。
- `suppliers` 表里是否存在 `supplier_code`、`name`、`contact_name`、`phone`、`email`、`address`、`status`、`notes` 等真实字段。
- `purchase_orders.supplier_id` 是否正确关联到 `suppliers.id`。
- 如果供应商编码重复，页面会阻止新增，请换一个 `supplier_code`。

后续待优化：

- 正式登录后按管理员/采购角色收紧供应商写入权限。
- 如果采购单页面后续支持 URL 参数，可以从供应商管理页跳转到 `/purchase/orders` 并自动筛选供应商。
- 如果需要供应商分类、付款条款或账期等字段，需要先确认业务是否真的需要改 schema。

### 4.16 仓库管理

已完成第一版。

入口：`/admin/warehouses`

当前逻辑：

- 页面读取真实 `warehouses`、`inventory_items`、`inventory_transactions` 和 `skus`，不再使用占位页或 mock 数据。
- 仓库列表显示仓库编码、仓库名称、仓库类型、地址、状态、当前库存 SKU 数量、当前库存总数量、创建时间、更新时间和操作。
- 当前 `warehouses` 表没有 `notes` 备注字段，所以页面没有新增或保存仓库备注，避免凭空编字段。
- `inventory_items.warehouse_id` 关联 `warehouses.id`，表示某个仓库里某个 SKU 当前有多少库存。
- `inventory_transactions.warehouse_id` 关联 `warehouses.id`，表示某次库存变化发生在哪个仓库。
- 仓库类型中文展示：`material` 为原材料仓，`finished_product` / `finished_good` 为成品仓，`semi_finished` 为半成品仓，`fba` / `fba_staging` 为 FBA 发货暂存仓，`internal` 为内部仓，其他值按原值显示。
- 顶部汇总仓库总数、原材料仓数量、成品仓数量、FBA 暂存仓数量和有库存的仓库数量。
- 支持按仓库名称 / 编码搜索。
- 支持按 `warehouses.warehouse_type` 筛选。
- 支持按 `warehouses.status` 筛选，当前状态主要使用 `active` 和 `inactive`。
- 新增仓库会写入 `warehouses.warehouse_code`、`name`、`warehouse_type`、`address` 和 `status`。
- 新增仓库前会检查 `warehouse_code` 是否重复。
- 仓库编码和仓库名称都是必填，因为当前 schema 中 `warehouse_code` 和 `name` 都是非空字段。
- 编辑仓库支持修改仓库名称、仓库类型、地址和状态，不修改仓库编码。
- 启用/停用仓库通过更新 `warehouses.status` 实现。
- 点击“查看库存”会读取该仓库下的 `inventory_items` 并关联 `skus`，显示 SKU 编码、SKU 名称、SKU 类型、当前库存数量、单位和最后更新时间。
- 点击“查看流水”会跳转到 `/inventory/transactions?warehouseId=仓库ID`，库存流水页面已支持读取这个 URL 参数并自动按仓库筛选。

本次修改文件：

- `src/lib/api/warehouses.ts`
- `src/app/(app)/admin/warehouses/page.tsx`
- `src/app/(app)/inventory/transactions/page.tsx`
- `src/lib/navigation.ts`
- `src/app/globals.css`
- `supabase/dev-warehouses-policies.sql`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/admin/warehouses`，确认仓库列表能读取真实数据。
- 使用搜索框按仓库名称或仓库编码筛选。
- 按仓库类型、状态筛选。
- 新增一个仓库，确认写入 `warehouses` 并刷新列表。
- 编辑仓库名称、仓库类型、地址或状态，确认保存后刷新列表。
- 点击启用/停用，确认 `warehouses.status` 变化。
- 点击“查看库存”，确认能看到该仓库下 `inventory_items.warehouse_id` 关联的当前库存。
- 点击“查看流水”，确认跳转到库存流水页面后按该仓库筛选。

如果页面读不到或写不进去，优先检查：

- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- Supabase 里是否已经执行基础 `dev-policies.sql`。
- 如果新增、编辑或启用/停用仓库报 RLS 权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-warehouses-policies.sql`。
- `warehouses` 表里是否存在 `warehouse_code`、`name`、`warehouse_type`、`address`、`status` 等真实字段。
- `inventory_items.warehouse_id` 是否正确关联到 `warehouses.id`。
- `inventory_transactions.warehouse_id` 是否正确关联到 `warehouses.id`。
- 如果仓库编码重复，页面会阻止新增，请换一个 `warehouse_code`。

后续待优化：

- 正式登录后按管理员/仓库角色收紧仓库写入权限。
- 如果后续要加仓库负责人、库位、备注等字段，需要先确认业务是否真的需要改 schema。
- 可以给仓库库存详情增加按 SKU 类型或 SKU 关键词筛选。

### 4.17 基础资料批量导入和删除保护

已完成第一版。

入口：

- `/admin/products`
- `/admin/skus`
- `/bom`
- `/admin/suppliers`
- `/admin/warehouses`

通用能力：

- 新增 `src/lib/utils/csv.ts`，提供 `parseCsv()`、`generateCsvTemplate()`、`downloadCsvTemplate()`、`normalizeCsvValue()`。
- 新增 `src/components/BulkImportDialog.tsx`，统一处理 CSV 上传、前端解析、预览、行级校验、确认导入和导入结果展示。
- 新增 `src/components/BulkActionBar.tsx`，统一处理表格勾选、全选当前页、批量停用、批量删除、二次确认和逐条结果展示。
- 新增 `src/components/ConfirmDialog.tsx`，统一处理删除等危险操作的二次确认。
- 新增 `src/lib/api/bulk-management.ts`，集中放产品、SKU、BOM、供应商、仓库的批量导入校验、批量写入、删除保护、批量停用和批量删除逻辑。

批量导入规则：

- 当前第一版支持 CSV，不引入额外 Excel 依赖。
- 每个页面都有“下载模板”和“批量导入”按钮。
- 上传 CSV 后先预览，不会直接写入数据库。
- 预览表格显示每一行数据和行级错误。
- 有错误时不能确认导入，用户需要修改 CSV 后重新上传。
- 用户点击“确认导入”后才写入 Supabase。
- 导入完成后显示成功数量和失败数量，并刷新当前列表。

各页面模板字段：

- 产品：`product_code`、`product_name`、`remark`、`status`。
- SKU：`sku_code`、`sku_name`、`sku_type`、`product_code`、`unit`、`remark`、`status`。
- BOM：`finished_sku_code`、`bom_version`、`material_sku_code`、`quantity_per_unit`、`loss_rate`、`remark`、`status`。
- 供应商：`supplier_code`、`supplier_name`、`contact_name`、`phone`、`email`、`address`、`remark`、`status`。
- 仓库：`warehouse_code`、`warehouse_name`、`warehouse_type`、`address`、`status`。当前 `warehouses` 真实表没有备注字段，所以模板不包含 `remark`。

导入校验重点：

- 产品：产品编码和产品名称必填；产品编码不能和已有 `products.product_code` 重复，也不能在同一个 CSV 内重复；状态只能是 `active` 或 `inactive`。
- SKU：SKU 编码、名称、类型必填；`sku_type` 只能是 `finished_good` 或 `material`；成品 SKU 必须填写已存在的 `product_code`；原材料仍写入 `skus`，不新增 `materials` 表；SKU 编码不能重复。
- BOM：按 `finished_sku_code + bom_version` 分组；成品 SKU 必须是 `sku_type = finished_good`；原材料 SKU 必须是 `sku_type = material`；同一个 BOM 内不能重复同一个原材料；`quantity_per_unit` 必须大于 0；`loss_rate` 不能小于 0；预览会显示会创建几个 BOM 主表和多少条 BOM 明细。
- 供应商：供应商编码和名称必填；供应商编码不能重复；邮箱如果填写会做简单格式校验。
- 仓库：仓库编码和名称必填；仓库编码不能重复；仓库类型支持 `material`、`finished_good`、`finished_product`、`semi_finished`、`fba_staging`、`fba`、`internal`。

删除和批量处理规则：

- 五个页面都支持单条删除、勾选后批量删除、勾选后批量停用。
- 所有删除都会先弹出确认框，批量删除会显示将要处理的数据列表。
- 批量删除逐条校验，能删除的删除，不能删除的显示具体失败原因。
- 因为这些基础资料表都有 `status` 字段，被业务使用过的数据优先停用，不允许硬删。

删除保护规则：

- 产品：如果已经有 `skus.product_id` 关联 SKU，不允许物理删除，建议停用。
- SKU：如果被 `bom_headers.product_sku_id`、`bom_items.component_sku_id`、`fba_replenishment_requests.sku_id`、`production_orders.sku_id`、`material_requirements.material_sku_id`、`purchase_order_items.sku_id`、`inventory_items.sku_id`、`inventory_transactions.sku_id` 任意引用，不允许物理删除，建议停用。
- BOM：如果已有 `production_orders.bom_header_id` 引用，不允许物理删除 BOM 主表或 BOM 明细，建议停用 BOM。未被使用时，删除 BOM 主表会先删 `bom_items`，再删 `bom_headers`。
- 供应商：如果已有 `purchase_orders.supplier_id` 引用，不允许物理删除，建议停用。
- 仓库：如果已有 `inventory_items.warehouse_id`、`inventory_transactions.warehouse_id`、`fba_replenishment_requests.target_warehouse_id`、`purchase_orders.warehouse_id` 任意引用，不允许物理删除，建议停用。

库存流水规则：

- `inventory_transactions` 是库存历史账本，绝对不能删除。
- 库存流水页面仍只做查看和筛选，不增加删除、编辑、批量删除、批量编辑。
- `inventory_items` 是当前库存，基础资料删除功能不删除它。
- 库存数量变化必须继续通过入库、出库和库存调整流程写流水，不绕过库存流水直接删库存。

测试批量导入：

- 打开对应页面，点击“下载模板”。
- 填写 CSV 后点击“批量导入”，选择 CSV 文件。
- 确认预览表格能显示每行数据和校验结果。
- 故意填重复编码、缺必填项、错误状态或不存在的外键，确认行级错误能显示，并且不能确认导入。
- 修正 CSV 后重新上传，确认可以点击“确认导入”。
- 导入完成后确认成功/失败数量显示正确，列表刷新后能看到新增数据。

测试删除和批量删除：

- 先对没有任何业务引用的测试数据点“删除”，确认二次确认后可以删除。
- 对已有 SKU 的产品、已有库存或流水的 SKU、已有采购单的供应商、已有库存或流水的仓库、已有生产任务引用的 BOM 点“删除”，确认会被阻止并提示建议停用。
- 勾选多条数据后点击“批量删除”，确认每条会单独处理，成功和失败原因都能显示。
- 勾选多条数据后点击“批量停用”，确认 `status` 更新为 `inactive`，历史业务数据不受影响。

RLS 策略：

- 如果批量导入、删除或停用报权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-bulk-import-delete-policies.sql`。
- 这个策略文件只用于开发阶段，生产环境必须按真实用户、角色和操作权限收紧。
- 该策略文件不开放 `inventory_transactions`、`inventory_items`、采购单、生产任务、FBA 备货需求等业务流水/业务单据的 delete 权限。

后续待完善：

- `/admin/users` 用户资料批量导入先不完整实现。当前阶段仍只管理 `profiles`，不创建 Supabase Auth 用户，不使用 `service_role`。
- `/replenishment` FBA 备货需求批量导入先预留。业务单据不建议随便删除，后续实现时必须校验 SKU、仓库、数量和流程状态。
- `/inventory/adjustments` 库存调整批量导入先预留。后续实现时必须写 `inventory_transactions`，不能只改 `inventory_items`。

### 4.18 用户管理

已完成第一版。

入口：`/admin/users`

当前逻辑：

- 页面读取真实 `profiles` 和 `roles`，不再使用占位页或 mock 数据。
- `profiles.role_id` 关联 `roles.id`，页面通过这个关系显示角色名称和角色编码。
- `profiles.id` 关联 Supabase Auth 的 `auth.users.id`，这是 schema 里的真实外键。
- 用户列表显示用户名称、邮箱、角色、手机号、状态、创建时间、更新时间和操作。
- 顶部汇总用户总数、管理员数量、运营数量、厂长数量、采购数量和仓库数量。
- 角色统计按 `roles.code` 计算，兼容当前测试角色里的 `admin`、`operator`、`factory_manager`、`purchaser`、`warehouse`，也兼容旧导航里出现过的 `operations`、`plant_manager`、`procurement`。
- 支持按用户名称或邮箱搜索。
- 支持按角色筛选。
- 支持按 `profiles.status` 筛选，当前页面主要使用 `active` 和 `disabled`。
- 新增用户资料会写入 `profiles.id`、`full_name`、`email`、`role_id`、`phone` 和 `status`。
- 当前 schema 没有 `profiles.notes` 字段，所以页面没有备注输入，避免凭空编字段。
- 邮箱会做简单格式校验，新增和编辑前会检查邮箱是否重复。
- 因为 `profiles.id` 必须已经存在于 `auth.users.id`，当前新增用户资料时需要填写已存在的 Supabase Auth 用户 ID。
- 当前页面不调用 Supabase Auth Admin API，不使用 service_role key，也不在前端创建登录账号。
- 编辑用户资料支持修改用户名称、邮箱、角色、手机号和状态，不修改用户 ID。
- 分配角色通过编辑 `profiles.role_id` 实现。
- 启用/停用用户通过更新 `profiles.status` 实现。
- 角色列表只读展示 `roles.code`、`roles.name`、`roles.description` 和创建时间，当前阶段不新增角色。

本次修改文件：

- `src/lib/api/users.ts`
- `src/app/(app)/admin/users/page.tsx`
- `src/app/globals.css`
- `supabase/dev-users-policies.sql`
- `PROJECT_NOTES.md`

当前阶段和 Supabase Auth 的关系：

- `profiles` 是业务用户资料表，但它的 `id` 外键关联 `auth.users.id`。
- 当前页面只维护 profiles 资料和角色分配，不负责邀请用户、创建登录账号、重置密码。
- 后续接 Supabase Auth 登录时，再单独做账号创建、邀请、密码重置和真实权限。
- 这样做可以避免把 `service_role` key 放进前端，也避免浏览器直接调用 Supabase Auth Admin API。

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/admin/users`，确认用户列表和角色列表能读取真实数据。
- 使用搜索框按用户名称或邮箱筛选。
- 按角色、状态筛选。
- 如果 Supabase Auth 里已有测试用户，复制这个用户的 Auth 用户 ID，在页面新增 profiles 用户资料，确认写入 `profiles` 并刷新列表。
- 编辑用户名称、邮箱、角色、手机号或状态，确认保存后刷新列表。
- 点击“分配角色”，修改角色并保存，确认 `profiles.role_id` 变化。
- 点击启用/停用，确认 `profiles.status` 变化。

如果页面读不到或写不进去，优先检查：

- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- Supabase 里是否已经执行基础 `dev-policies.sql`。
- 如果读取或写入 profiles、roles 报 RLS 权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-users-policies.sql`。
- `roles` 表里是否已经有 `admin`、`operator`、`factory_manager`、`purchaser`、`warehouse` 这些测试角色。
- 新增 profiles 时填写的用户 ID 是否真的存在于 Supabase Auth 的 `auth.users.id`；如果不存在，数据库外键会阻止新增。
- `profiles.role_id` 是否正确关联到 `roles.id`。
- 如果邮箱重复，页面会阻止新增或编辑，请换一个邮箱。

后续待优化：

- 接入 Supabase Auth 登录后，补正式的创建账号、邀请用户、重置密码流程。
- 登录后读取当前用户的 `profiles` 和 `roles`，替换当前 mock 角色切换。
- 正式环境按管理员角色收紧 profiles 和 roles 的 RLS 策略。
- 后续如果要给用户加备注、部门、岗位等资料，需要先确认是否真的需要改 schema。

### 4.18 后台整体 UI 和侧边栏

已完成第一版。

本次优化重点：

- 后台整体视觉改成更简洁、圆润、浅灰白的现代内部管理系统风格。
- 侧边栏改为分组折叠菜单，不再把所有子菜单默认全部展开。
- “FBA 备货”不可点击分组标题已移除，避免用户误以为它是一个页面。
- FBA 相关入口直接放在首页下面，顺序是“创建备货需求”在上，“FBA 备货需求”在下。
- 当前页面所在分组会自动展开，当前页面对应菜单项会高亮。
- 刷新页面后，会根据当前 URL 重新判断应该展开哪个分组。
- 保持现有业务页面、Supabase 查询和数据库 schema 不变。
- `/debug/master-data` 调试页保留不删除。

当前菜单分组：

| 一级菜单 | 子菜单 |
| --- | --- |
| 首页 | 后台首页 `/dashboard` |
| 创建备货需求 | 直接入口 `/replenishment/new`，绿色主按钮样式 |
| FBA 备货需求 | 直接入口 `/replenishment` |
| 生产管理 | 厂长排产 `/production/planning`、生产任务 `/production/orders`、BOM 管理 `/bom`、物料需求 `/materials/requirements` |
| 采购管理 | 采购单 `/purchase/orders`、供应商管理 `/admin/suppliers` |
| 仓库库存 | 入库管理 `/inventory/inbound`、FBA 出库 `/inventory/fba-outbound`、原材料库存 `/inventory/materials`、成品库存 `/inventory/products`、库存流水 `/inventory/transactions`、库存调整 `/inventory/adjustments` |
| 基础资料 | 产品管理 `/admin/products`、SKU 管理 `/admin/skus`、仓库管理 `/admin/warehouses` |
| 系统管理 | 用户管理 `/admin/users` |

侧边栏实现说明：

- 菜单配置集中在 `src/lib/navigation.ts`。
- 折叠交互在 `src/components/layout/sidebar.tsx`。
- Sidebar 会读取当前 `pathname`，先找出最精确匹配的菜单链接。
- 例如访问 `/inventory/products` 时，会匹配到“成品库存”，并自动展开“仓库库存”分组。
- 点击一级菜单可以展开或收起；首页、创建备货需求、FBA 备货需求这类直接链接会直接跳转。
- 创建备货需求保持绿色主操作样式；FBA 备货需求保持普通菜单样式。
- 当前仍沿用开发阶段的 mock 角色菜单过滤。

本次修改文件：

- `src/lib/navigation.ts`
- `src/components/layout/sidebar.tsx`
- `src/components/layout/header.tsx`
- `src/app/globals.css`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/dashboard`，确认首页入口高亮。
- 打开 `/inventory/products`，确认“仓库库存”自动展开，“成品库存”高亮。
- 打开 `/inventory/adjustments`，确认“仓库库存”自动展开，“库存调整”高亮。
- 点击其他一级菜单，确认可以展开和收起，且不会影响业务页面。
- 切换模拟角色，确认菜单仍按角色过滤。

如果菜单不展开或高亮不对，优先检查：

- `src/lib/navigation.ts` 里的菜单 `href` 是否和真实页面路由一致。
- `src/components/layout/sidebar.tsx` 里的当前路径匹配逻辑是否匹配到了更短的父级路径。
- 当前模拟角色是否有权限看到这个菜单。
- 页面是否真的在 `src/app/(app)` 下存在。

后续 UI 待优化：

- 后续可以继续逐页细化表格列宽、详情区信息密度和表单校验文案。
- 后续接入真实登录后，可以把 Header 的 mock 角色切换替换为真实用户入口。
- 如果移动端使用频率变高，可以再补更完整的小屏侧边栏开关。

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
| `dev-suppliers-policies.sql` | 开发阶段允许供应商管理页面读取供应商和采购单，并新增、编辑、启用/停用供应商。不开放 delete。 |
| `dev-warehouses-policies.sql` | 开发阶段允许仓库管理页面读取仓库、库存、流水和 SKU，并新增、编辑、启用/停用仓库。不开放 delete。 |
| `dev-users-policies.sql` | 开发阶段允许用户管理页面读取 roles、profiles，并新增、编辑、启用/停用 profiles。不开放 delete，也不创建 Supabase Auth 账号。 |
| `dev-purchase-policies.sql` | 开发阶段允许采购页面读取缺料、创建采购单、写采购明细、更新采购单和物料需求状态。 |
| `dev-inventory-inbound-policies.sql` | 开发阶段允许入库页面写库存流水、更新当前库存、更新采购单/采购明细/物料需求/生产任务。 |
| `dev-fba-outbound-policies.sql` | 开发阶段允许 FBA 出库页面读取待出库需求、写出库流水、扣减成品库存、标记已发往 FBA。 |
| `dev-production-orders-policies.sql` | 开发阶段允许生产任务页面读取生产任务、物料需求、入库流水，并更新生产任务状态。 |
| `dev-inventory-transactions-policies.sql` | 开发阶段允许库存流水页面读取库存流水和关联基础资料，只开放查询，不开放新增、更新、删除。 |
| `dev-inventory-adjustment-policies.sql` | 开发阶段允许库存调整页面读取当前库存和调整流水、更新当前库存、写入 adjustment 流水。不开放删除，也不开放直接修改库存流水。 |
| `dev-bulk-import-delete-policies.sql` | 开发阶段允许产品、SKU、供应商、仓库、BOM 做批量导入、停用和受保护删除；业务流水和库存流水只开放读取用于删除保护检查，不开放 delete。 |

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
- 登录后读取当前用户资料 `profiles` 和角色 `roles`。
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

### 8.6 FBA 备货单和生产任务主从结构升级（2026-05-24）

本次已把核心业务从“一个 SKU 一张单”升级为“主表 + 明细表”的第一版。

已完成：

- `fba_replenishment_requests` 继续作为 FBA 备货单主表，代表一整张运营备货单。
- 新增 `fba_replenishment_request_items`，作为 FBA 备货单明细表，记录一张单下多个产品、多个成品 SKU 和每个 SKU 的备货数量。
- `production_orders` 继续作为生产任务主表，代表厂长为整张 FBA 备货单创建的一张生产任务。
- 新增 `production_order_items`，作为生产任务明细表，记录每个 SKU 的运营需求数量、厂长计划生产数量和后续已完成数量。
- `products` 新增 `product_image_url` 字段，用于排产和详情页显示产品图；当前只支持 URL，不做文件上传。
- `/replenishment` 现在按一张张 FBA 备货单展示，列表显示产品数量、SKU 数量和总备货数量。
- `/replenishment` 右上角绿色按钮已改为“+ 创建备货单”，弹窗内可添加多个产品；每个产品自动展示 `sku_type = finished_good` 的 SKU；数量为空或 0 的 SKU 不生成明细。
- 侧边栏只保留“FBA 备货需求”入口，不再单独显示“创建备货需求”。
- `/production/planning` 现在按一张张 FBA 备货单排产，详情按产品分组展示产品图、SKU 和运营需求数量。
- 厂长现在对整张 FBA 备货单点击一次“创建生产任务”，弹窗中可以逐个 SKU 调整计划生产数量。
- 计划生产数量可以大于运营需求数量，多出的数量后续进入成品库存。
- 创建生产任务时会写入 `production_orders` 主表和 `production_order_items` 明细，并把 FBA 备货单状态更新为 `in_production`。
- BOM 算料已适配 `production_order_items`：系统遍历生产任务明细，根据每个 SKU 的 `planned_quantity` 找启用 BOM，并按 `production_order_id + material_sku_id` 汇总写入 `material_requirements`。
- `/production/orders` 已兼容生产任务明细结构，列表显示产品数量、SKU 数量、总计划生产数量；详情按产品分组展示每个 SKU 的运营需求、计划数量、已入库数量和超量数量。
- `/dashboard` 已按主单显示最新 FBA 备货需求，SKU 数量和总数量优先来自明细表；生产任务数量汇总优先使用 `production_order_items.planned_quantity`。

新增 SQL 文件：

- `supabase/migrations/fba-and-production-items.sql`
- `supabase/dev-fba-production-items-policies.sql`

本次修改文件：

- `supabase/schema.sql`
- `supabase/migrations/fba-and-production-items.sql`
- `supabase/dev-fba-production-items-policies.sql`
- `src/lib/api/replenishment.ts`
- `src/lib/api/production.ts`
- `src/lib/api/dashboard.ts`
- `src/lib/api/master-data.ts`
- `src/app/(app)/replenishment/page.tsx`
- `src/app/(app)/replenishment/new/page.tsx`
- `src/app/(app)/production/planning/page.tsx`
- `src/app/(app)/production/orders/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/lib/navigation.ts`
- `src/app/globals.css`
- `PROJECT_NOTES.md`

兼容说明：

- 旧的 `fba_replenishment_requests.sku_id`、`requested_quantity` 等字段没有删除。
- 旧的 `production_orders.sku_id`、`planned_quantity`、`completed_quantity` 等字段没有删除。
- 新创建的主表仍会写入第一条 SKU 和汇总数量到旧字段，避免旧页面立刻报错。
- 旧数据如果还没有明细表记录，列表和详情会用旧主表字段临时生成一条兼容明细来展示。

后续待适配：

- `/inventory/inbound` 生产入库当前仍以生产任务主表为主，后续需要升级为按 `production_order_items` 多 SKU 分行入库，并更新每条明细的 `completed_quantity`。
- `/inventory/fba-outbound` 当前仍以 FBA 备货主表总量为主，后续需要升级为按 `fba_replenishment_request_items` 明细出库。
- 生产领料当前已按整张 `production_orders` 的 `material_requirements` 自动扣料；后续可以继续补跨仓扣料、补料、退料和更严格的数据库事务/RPC。

测试方式：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户要求不要自动打开浏览器、不要启动 dev server、不要截图，所以本次未做浏览器自动检查。

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

4. 仓库管理后续优化 `/admin/warehouses`
   - 正式登录后按管理员/仓库角色收紧仓库写入权限。
   - 如果确实需要仓库备注、负责人或库位字段，先确认业务是否需要改 schema。
   - 给仓库库存详情增加更多筛选。

5. 用户管理后续优化 `/admin/users`
   - 当前已完成 profiles / roles 管理第一版。
   - 后续接入 Supabase Auth 创建账号、邀请用户、重置密码。
   - 登录后用真实用户资料和角色替换 mock 角色。
   - 正式环境按管理员权限收紧 profiles / roles RLS。

6. Supabase Auth 登录
   - 替换当前 mock 登录。
   - 登录后读取当前用户资料和角色。

7. 角色菜单权限
   - 现在只是前端 mock 角色控制菜单。
   - 后续需要结合真实登录和 RLS。

8. 生产领料 / 原材料出库后续优化
   - 当前 `/production/orders` 已完成确认领料第一版。
   - 后续补补料、退料、跨仓扣料和更严格的数据库事务处理。

9. 库存调整后续优化
   - 当前 `/inventory/adjustments` 已完成第一版。
   - 正式登录后写入真实 `operator_id`。
   - 后续可增加审批流、附件和数据库事务/RPC。

10. 页面细节优化
   - 表单校验。
   - 弹窗交互。
   - 状态文案。
   - 分页和搜索性能。
   - 移动端和窄屏适配。
   - 更完整的错误提示。

11. 部署上线
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
