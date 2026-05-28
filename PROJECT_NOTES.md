# 项目进度说明

最后整理日期：2026-05-26

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
| `/dashboard` | 已完成角色待办中心版 | 后台首页已从单纯数据看板改为按当前模拟角色展示待办事项。运营、厂长、采购、仓库、管理员会看到不同的重点卡片、待办列表、异常提醒和快捷入口；暂时继续使用 `MockRoleProvider`，不涉及真实登录和权限。 |
| `/debug/master-data` | 已完成调试页 | Supabase 基础资料读取测试页。读取角色、产品、成品 SKU、原材料 SKU、供应商、仓库。这个页面用于排查 Supabase 连接、anon key、RLS 策略问题，后续不要删除。 |
| `/replenishment` | 已完成列表和创建升级版 | FBA 备货需求列表。支持按状态筛选、品牌筛选、SKU 搜索、查看详情；右上角“+ 创建备货单”打开创建弹窗，支持 CSV 模板导入多 SKU 明细、单个添加 SKU、明细编辑和提交整张备货单。编辑和删除按钮目前禁用，当前阶段不做修改和删除。 |
| `/replenishment/new` | 过渡提示页 | 当前引导到 `/replenishment` 创建整张 FBA 备货单，避免保留两套创建入口。 |
| `/production/planning` | 已完成排产第一版 | 厂长查看已提交/已接单的 FBA 备货需求，可以按品牌筛选，可以接单、拒绝、创建生产任务。创建生产任务时会按 BOM 自动生成物料需求，并把 FBA 备货需求状态更新为 `in_production`。 |
| `/production/orders` | 已完成跟踪和领料第一版 | 生产任务列表。显示品牌、FBA 备货需求数量、计划生产数量、超量生产数量、已入库数量、待入库数量、物料状态、领料状态、生产状态。支持按品牌筛选、查看详情、确认领料弹窗、自动扣原材料库存、写 `material_out` 库存流水，并把生产任务更新为 `in_progress`。 |
| `/bom` | 已完成辅料拆表第二阶段 | BOM 管理页面。读取 `bom_headers` 和 `bom_items`，显示成品 SKU 所属品牌，支持按品牌筛选、新增 BOM、查看明细、添加辅料、编辑 BOM 明细的单位用量/损耗率/备注、启用/停用 BOM、CSV 批量导入、删除明细、删除/批量删除或停用 BOM，并在删除前检查生产任务引用。阶段二起 BOM 明细优先引用 `bom_items.material_id -> materials.id`，旧 `component_sku_id` 暂时保留用于兼容旧数据和生产算料过渡。 |
| `/materials/requirements` | 已完成查询第一版 | 物料需求列表。读取 `material_requirements`，并回查 `bom_items` 显示 BOM 单位用量和损耗率。支持按状态筛选。当前是查询页，不直接新增、编辑、删除。 |
| `/purchase/orders` | 已完成辅料拆表第四阶段 | 采购单页面。支持从缺料物料生成采购单、采购人员手动创建采购单、CSV 批量导入、CSV 导出、采购单 PNG 图片导出、列表分页、按供应商筛选、详情弹窗和状态按钮。阶段四起采购明细优先写入 `purchase_order_items.material_id -> materials.id`，旧 `sku_id` 继续保留兼容历史数据和未迁移库存链路。手动选择辅料、批量导入和从缺料生成采购单都优先读取 `materials.default_supplier_id` 自动带出供应商；旧物料需求没有 `material_id` 时继续 fallback 到 `material_sku_id`。实际库存入库建议走 `/inventory/inbound`，库存结构第五阶段再迁移。 |
| `/inventory/overview` | 已完成库存总览第一版 | 库存总览页面。复用当前库存查询组件，可按“全部 / 原材料 / 成品”切换查看当前库存，并从每行快速进入库存流水、库存调整、其他入库和其他出库。 |
| `/inventory/inbound` | 已完成入库升级版 | 入库管理。分为采购入库、生产入库和其他入库。采购入库会写 `material_in` 库存流水、更新 `inventory_items`、采购明细到货数量、采购单状态和物料需求状态。生产入库会写 `product_in` 库存流水、更新成品库存、更新生产任务 `completed_quantity` 和状态。其他入库改为“新建其他入库单”弹窗，弹窗内可选择仓库和 SKU 单条录入，也可进入批量上传；支持通过 URL 参数 `tab=other`、`skuKeyword`、`warehouseId` 预填入口。 |
| `/inventory/fba-outbound` | 已完成出库管理升级版 | 出库管理。路径暂时仍为 `/inventory/fba-outbound`，页面和导航名称改为“出库管理”。页面分为 FBA 出库和其他出库：FBA 出库继续关联 FBA 备货需求并在完成后更新备货状态；其他出库改为“新建其他出库单”弹窗，弹窗内可选择仓库和 SKU 单条录入，也可进入批量上传；支持通过 URL 参数 `tab=other`、`skuKeyword`、`warehouseId` 预填入口。 |
| `/inventory/transactions` | 已完成查询优化版 | 库存流水页面。读取 `inventory_transactions`，支持按流水类型、仓库、品牌、SKU、日期筛选，也支持 `skuKeyword` 和 `warehouseId` URL 参数预筛选。主表简化为操作时间、流水类型、SKU、产品/品牌、仓库、数量变化、关联单据、备注和操作，操作人、单位、SKU 类型等放在详情弹窗。 |
| `/inventory/adjustments` | 已完成调整升级版 | 库存调整页面。主要用于系统上线期初库存录入和后续盘点。页面提供“新建调整单”弹窗，先选仓库和 SKU，再填写调整方式、数量、原因和备注；没有 `inventory_items` 记录时可从 0 库存开始调整。新增批量上传库存调整，CSV 先预览和逐行校验，通过后更新 `inventory_items.quantity_on_hand` 并写入 `transaction_type = adjustment` 的库存流水。支持 `skuKeyword` 和 `warehouseId` URL 参数预填筛选和调整入口。 |
| `/inventory/materials` | 已完成查询优化版 | 原材料当前库存页面。读取 `inventory_items`，按 SKU 类型筛选原材料，显示原材料编码、名称、品牌/所属产品、仓库、当前库存、可用库存、占用库存、安全库存和库存状态，并提供查看流水、库存调整、其他入库、其他出库入口。 |
| `/inventory/products` | 已完成查询优化版 | 成品当前库存页面。读取 `inventory_items`，按成品 SKU 和品牌筛选，显示 SKU 编码、SKU 名称、产品名称、品牌、仓库、当前库存、可用库存和占用库存，并提供查看流水、库存调整、其他入库、其他出库入口。 |
| `/admin/brands` | 已完成管理和批量维护第一版 | 品牌基础资料管理页面。读取 `brands` 和 `products`，支持品牌列表、搜索、状态筛选、汇总卡片、新增品牌、编辑品牌、查看品牌详情、启用/停用、CSV 批量导入、删除/批量删除或停用，并在删除前检查产品引用。 |
| `/admin/products` | 已完成管理和批量维护第一版 | 产品基础资料管理页面。读取 `products`、`brands` 和 `skus`，支持产品列表显示品牌、搜索、品牌筛选、状态筛选、汇总卡片、新增产品选择品牌、编辑产品修改品牌、启用/停用产品、查看产品关联 SKU、CSV 批量导入品牌字段、删除/批量删除或停用，并在删除前检查 SKU 引用。 |
| `/admin/skus` | 已完成管理和批量维护第一版 | SKU 基础资料管理页面。读取 `skus`、`products`、`brands`、`suppliers`、`inventory_items`、`bom_headers`、`bom_items`，品牌通过 SKU 所属产品继承，不在 SKU 表重复保存。material 类型 SKU 可显示和编辑默认供应商，成品和半成品可保持为空。页面支持 SKU 列表显示品牌、默认供应商、按品牌筛选、搜索筛选、汇总卡片、新增 SKU、编辑 SKU、启用/停用 SKU、查看库存入口、查看 BOM/详情关联、CSV 批量导入、删除/批量删除或停用，并在删除前检查 BOM、FBA、生产、采购、库存和库存流水引用。 |
| `/admin/materials` | 已完成独立辅料表和采购引用统计 | 辅料管理页面。阶段一改为直接读取新的 `materials` 表，支持维护辅料编码、名称、分类、单位、规格、默认供应商、状态、备注，支持按供应商筛选、搜索筛选、汇总卡片、新增辅料、编辑辅料、启用/停用和 CSV 批量导入。BOM、物料需求、采购统计优先读取对应表里的 `material_id`，旧 SKU 字段只作为历史 fallback。库存统计暂时仍按同编码旧 SKU 兼容，库存结构第五阶段再迁移。 |
| `/admin/suppliers` | 已完成管理和批量维护第一版 | 供应商基础资料管理页面。读取 `suppliers`、`materials.default_supplier_id` 和 `purchase_orders`，支持供应商列表、搜索、状态筛选、汇总卡片、新增供应商、编辑供应商、启用/停用供应商、查看关联辅料和关联采购单、CSV 批量导入、删除/批量删除或停用，并在删除前检查采购单引用和辅料默认供应商引用。 |
| `/admin/warehouses` | 已完成管理和批量维护第一版 | 仓库基础资料管理页面。读取 `warehouses`、`inventory_items`、`inventory_transactions` 和 `skus`，支持仓库列表、搜索筛选、汇总卡片、新增仓库、编辑仓库、启用/停用仓库、查看仓库库存、跳转查看流水、CSV 批量导入、删除/批量删除或停用，并在删除前检查库存、流水、FBA 备货和采购单引用。 |
| `/admin/users` | 已完成管理第一版 | 用户管理页面。读取 `profiles` 和 `roles`，支持用户资料列表、搜索筛选、汇总卡片、新增/编辑 profiles、启用/停用用户、分配角色，并只读展示角色列表。当前不创建 Supabase Auth 登录账号。 |

### 当前还是占位或待完善的页面

| 页面 | 当前状态 | 说明 |
| --- | --- | --- |
| `/login` | 待完善 | 当前只是登录页面样式，点击后进入后台，还没有真实 Supabase Auth 登录。 |

用户管理页面已经新增到导航，管理员可以看到入口。品牌管理页面已经新增到“基础资料”，管理员可以看到入口。仓库管理页面已经新增到导航，管理员和仓库角色都可以看到入口。辅料管理页面已经新增到“基础资料”，管理员、采购和仓库角色可以看到入口，其中仓库当前只做查看。

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

### 3.3.1 库存出入库补齐（2026-05-25）

本次继续优化库存模块，没有新增数据库字段，没有关闭 RLS，也没有自动打开浏览器。

已完成：

- `/inventory/inbound`：新增“其他入库”标签，用于初始库存录入、盘点补录、退货入库和其他非采购 / 非生产来源入库。
- 其他入库支持单个录入：选择仓库、搜索并选择 SKU、填写数量、入库原因和备注；支持成品和辅料 SKU。
- 其他入库支持 `BulkImportDialog` 批量导入，文案为“批量导入初始库存 / 其他入库”。导入模板中文字段：`仓库编码`、`SKU 编码`、`入库数量`、`入库原因`、`备注`；兼容英文表头：`warehouse_code`、`sku_code`、`quantity`、`reason`、`remark`。
- `/inventory/fba-outbound`：页面标题和导航名称改为“出库管理”，路径暂时保留 `/inventory/fba-outbound`。
- 出库管理新增 Tab：`FBA 出库` 和 `其他出库`。FBA 出库原逻辑保持：关联 FBA 备货需求，写 `product_out`，扣库存，完成后更新备货需求状态。
- 其他出库支持单个出库：选择仓库、搜索并选择 SKU、填写数量、出库原因和备注；支持成品和辅料 SKU。
- 其他出库支持 `BulkImportDialog` 批量导入。导入模板中文字段：`仓库编码`、`SKU 编码`、`出库数量`、`出库原因`、`备注`；兼容英文表头：`warehouse_code`、`sku_code`、`quantity`、`reason`、`remark`。
- 其他出库会按 `quantity_on_hand - reserved_quantity` 校验可用库存；没有 `inventory_items` 记录时视为库存 0，不能出库；同一仓库 + SKU 多行导入时会合并校验总出库数量不能超过可用库存。
- `/inventory/adjustments`：新增“按仓库 + SKU 调整”入口。即使某个仓库 + SKU 没有 `inventory_items` 记录，也能按当前库存 0 处理，并通过“增加库存”或“直接修正库存”创建库存记录；不允许减少成负数。
- 库存调整直接修正到 0 且原来没有库存记录时，不创建库存记录和流水，页面提示“库存数量没有变化”。
- 其他入库 / 其他出库 / 库存调整都会写 `inventory_transactions`，备注中标明来源、原因和操作备注，方便在 `/inventory/transactions` 追溯。

本次库存写入一致性说明：

- 新增的其他入库、其他出库、库存调整会在写库存后写流水；如果流水写入失败，会尝试把库存数量回滚到提交前。
- 当前前端直连 Supabase，仍不是数据库级事务。后续如果要做到完全原子一致，建议迁移到 Supabase RPC，在数据库事务里同时更新 `inventory_items` 和插入 `inventory_transactions`。

本次修改文件：

- `src/lib/api/inventory.ts`
- `src/app/(app)/inventory/inbound/page.tsx`
- `src/app/(app)/inventory/fba-outbound/page.tsx`
- `src/app/(app)/inventory/adjustments/page.tsx`
- `src/lib/api/dashboard.ts`
- `src/lib/navigation.ts`
- `PROJECT_NOTES.md`

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户要求不要自动打开浏览器检查，所以本次不做浏览器自动检查。

后续建议：

- 采购单供应商选择后续也可以改成可搜索选择器，适合供应商数量变多后继续优化。
- 入库、出库、库存调整弹窗后续可以增加打印/导出单据能力。

### 3.3.2 库存批量导入 RPC 优化（2026-05-26）

本次统一优化库存模块的三个批量导入入口，没有改产品、SKU、辅料、供应商、仓库、品牌、BOM、采购单和 FBA 备货单导入，也没有关闭 RLS。

已完成：

- 新增 `supabase/dev-inventory-bulk-rpc.sql`，提供 3 个 Supabase RPC：
  - `bulk_create_other_inbound(payload jsonb)`：批量处理其他入库 / 初始库存导入。
  - `bulk_create_other_outbound(payload jsonb)`：批量处理其他出库。
  - `bulk_adjust_inventory(payload jsonb)`：批量处理库存调整。
- 三个 RPC 都在数据库函数内统一更新 `inventory_items` 并写入 `inventory_transactions`，如果中途失败，数据库会整体回滚，避免库存余额成功但流水失败，或流水成功但库存余额失败。
- 其他入库允许同一文件内同仓库同 SKU 重复：库存按仓库 + SKU 合计增加，流水仍按原始导入明细逐行写入。
- 其他出库允许同一文件内同仓库同 SKU 重复：导入校验和 RPC 都按合计数量检查 `quantity_on_hand - reserved_quantity`，不能扣成负数或扣超过可用库存。
- 库存调整仍不允许同仓库同 SKU 重复，避免 `set_to`、`increase`、`decrease` 混用时产生顺序歧义。
- `src/lib/api/inventory.ts` 保留单个操作函数 `createOtherInbound`、`createOtherOutbound`、`adjustInventoryByWarehouseSku`，只把 `bulkCreateOtherInbound`、`bulkCreateOtherOutbound`、`bulkAdjustInventory` 改成一次性调用对应 RPC。
- `/inventory/inbound`、`/inventory/fba-outbound`、`/inventory/adjustments` 的批量导入成功后不再默认整页刷新，只显示成功消息；手动“刷新”按钮继续保留，单个入库 / 出库 / 调整原逻辑不变。
- `BulkImportDialog` 增强了导入过程提示，区分“正在校验文件”和“正在批量写入数据库”，避免大文件导入时用户误以为页面卡死。

使用方式：

1. 先在 Supabase SQL Editor 执行 `supabase/dev-inventory-bulk-rpc.sql`。
2. 再使用库存页面的批量导入功能。

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户明确要求不要自动打开浏览器，所以本次没有做浏览器自动检查。

如果批量导入提示 RPC 不存在，优先检查：

- `supabase/dev-inventory-bulk-rpc.sql` 是否已经在 Supabase SQL Editor 执行。
- 当前 Supabase 项目的 URL 和 anon key 是否指向同一个数据库。
- RLS 策略文件是否执行过；本次 SQL 文件保持 RLS 开启，并补充了开发阶段需要的函数执行和库存写入权限。
- 库存流水后续可以增加“导出当前筛选结果”。
- 浏览器人工检查建议重点看 `/inventory/inbound`、`/inventory/fba-outbound`、`/inventory/adjustments` 和 `/purchase/orders` 的弹窗打开、关闭、提交按钮状态。

### 3.4 后台页面顶部紧凑化（2026-05-25）

本次只调整后台页面顶部视觉和文案，没有修改数据库字段、Supabase 查询或业务写入逻辑。

已完成：

- 全局压缩旧版 `pageHero` 大横幅样式：去掉白色大卡片、阴影、大段说明和状态胶囊，只保留紧凑标题和右侧操作按钮。
- 全局压缩新版 `PageHeader`：标题字号改为后台常用尺寸，说明文字不再占据顶部空间。
- 列表卡片和筛选区域向标题靠近，减少顶部空白，让页面更像日常使用的企业后台。
- 页面文案精简：`FBA 备货需求` 改为 `备货需求`，`FBA 出库` 改为 `备货出库` 或 `出库管理`，生产、入库、排产相关页面同步去掉不必要的 FBA 字样。
- 本次覆盖的主要页面包括：备货需求、备货出库、生产任务、厂长排产、采购单、采购入库、生产入库、原材料库存、成品库存、库存流水、产品管理、SKU 管理、BOM 管理、辅料管理、供应商管理和仓库管理。

本次验证：

- 已运行 `npm run typecheck`，通过。

### 3.4 后台 UI 现代化第一阶段（2026-05-25）

本次按“先统一框架和样板页，再逐步替换业务页”的顺序处理，没有修改数据库 schema，没有关闭 RLS，也没有做浏览器自动测试。

已完成第一阶段：

- 优化统一后台外壳：左侧固定导航改为白底 SaaS 后台样式，当前菜单蓝色高亮，菜单增加图标，底部显示当前模拟登录用户。
- 优化顶部栏：新增全局搜索框，占位文字为“搜索功能、单据、产品、SKU等”，增加通知按钮和用户头像区域，保留开发阶段模拟角色切换。
- 新增通用 UI 组件：`PageHeader`、`StatCard`、`DataTable`、`SearchFilterBar`、`StatusBadge`、`ModalForm`、`DrawerForm`、`ImportDialog`、`ProductImage` 和一组本地 SVG 图标。
- `/dashboard` 后台首页改为现代 Dashboard 样式：顶部统计卡片、最近 7 天趋势图、待办卡片、异常提醒和最新业务单据表格。
- `/admin/products` 产品管理页作为列表型样板页改造：顶部 PageHeader、统计卡片、搜索筛选栏、产品图片、状态 Tag、统一表格和分页，新增/编辑/导入仍沿用原有弹窗和真实 Supabase 写入逻辑。

本次保持不变：

- 没有新增数据库字段。
- 产品图片继续使用真实字段 `products.product_image_url`。
- 产品新增、编辑、启用/停用、查看关联 SKU、批量导入和删除保护逻辑继续沿用原有 API。
- 批量导入仍是上传后先预览和校验，不会直接写入数据库。

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户要求不使用浏览器自动测试，所以本阶段不做浏览器自动检查。

后续按同一套样板继续改：

- 第二批：`/admin/skus`、`/bom`、`/replenishment`、`/production/planning`、`/production/orders`、`/purchase/orders`、库存相关页面。
- 第三批：`/admin/users`、角色权限、系统设置。

### 3.5 后台 UI 现代化第二阶段（2026-05-25）

本次继续按第一阶段样板推进，先改基础资料里最核心的 SKU 和 BOM 页面，没有修改数据库 schema，没有关闭 RLS，也没有做浏览器自动测试。

已完成页面：

- `/admin/skus`：页面顶部改为统一 `PageHeader`，新增统计卡片，列表区域改为白色现代卡片；筛选区使用统一 `SearchFilterBar`；表格新增产品图片缩略图；SKU 类型和状态改为统一 `StatusBadge`；新增、编辑、批量导入、查看库存、查看 BOM、删除保护逻辑继续沿用原有实现。
- `/bom`：页面顶部改为统一 `PageHeader`，新增 BOM 汇总统计卡片；列表区域改为白色现代卡片；新增 BOM / 批量导入入口移动到页面右上角；新增 BOM 搜索，可按 BOM 编号、版本、SKU、产品名称筛选；表格新增产品图片缩略图；BOM 状态改为统一 `StatusBadge`；BOM 明细弹窗和原材料维护逻辑继续沿用原有实现。

本次兼容性处理：

- 没有新增字段，只是在现有 `products.product_image_url` 基础上，让 SKU 和 BOM 的产品关联查询一起读取产品图片 URL。
- SKU 品牌仍然通过 `sku.product.brand` 显示，不在 SKU 表重复保存品牌。
- BOM 仍然使用真实表 `bom_headers` 和 `bom_items`，不新增额外表。

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户要求不使用浏览器自动测试，所以本阶段不做浏览器自动检查。

后续继续：

- 业务高频页：`/replenishment`、`/production/planning`、`/production/orders`、`/purchase/orders`。
- 库存页：`/inventory/inbound`、`/inventory/fba-outbound`、`/inventory/adjustments`、`/inventory/transactions`、`/inventory/materials`、`/inventory/products`。
- 系统页：`/admin/users`、角色权限、系统设置。

### 3.6 后台 UI 细节优化：全局搜索、通知和工作台（2026-05-25）

本次继续优化后台 UI 细节，没有修改数据库 schema，没有新增 notifications 表，没有关闭 RLS，也没有做浏览器自动测试。

已完成：

- 顶部全局搜索框从纯样式改成真实搜索组件 `GlobalSearch`。
- 新增 `src/lib/api/global-search.ts`，基于现有表动态搜索，不新增数据库字段。
- 全局搜索目前支持：
  - 功能菜单：后台首页、备货需求、备货出库、厂长排产、生产任务、生产入库、采购单、采购入库、库存、产品管理、SKU 管理、BOM 管理、原材料管理、供应商管理、仓库管理、用户管理等。
  - 产品：搜索 `products.product_code` 和 `products.name`。
  - SKU / 原材料：搜索 `skus.sku_code`、`sku_name`、`amazon_sku`、`fnsku`、`specs`，其中 `sku_type = material` 的结果归到“原材料”。
  - 单据：搜索 `fba_replenishment_requests.request_no`、`production_orders.production_order_no`、`purchase_orders.purchase_order_no`。
- 搜索结果按“功能 / 单据 / 产品/SKU / 原材料”分组，下拉展示；点击结果后跳转到对应页面并带 `keyword` 查询参数。
- 顶部通知铃铛从纯图标改成 `NotificationDropdown`。
- 新增 `src/lib/api/notifications.ts`，通知内容基于现有 `getRoleDashboard(role)` 的真实待办和异常动态生成，不新增 notifications 表。
- 通知目前覆盖待排产备货单、待采购物料、待入库采购单、待出库备货单、库存预警、生产缺料/异常等待办和异常；未读状态暂存在浏览器 `localStorage`。
- 首页删除“业务趋势 / 最近 7 天备货趋势”图表模块，改成更偏实际工作台的待办布局。
- 首页顶部统计卡片改成短标题：待排产、生产中、待采购、待入库、待出库、库存预警；卡片高度统一，文字过长会省略。
- 侧边栏去掉“FBA 备货需求”的特殊主按钮样式，菜单名称简化为“备货需求”，新增“备货管理”分组，并整理生产、采购、库存、基础资料和系统管理分组。

本次保持不变：

- 没有新增数据库表或字段。
- 没有改动业务写入流程。
- 通知未读状态只是前端本地记录，不影响任何业务表。

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户要求不使用浏览器自动测试，所以本阶段不做浏览器自动检查。

### 3.4 辅料管理页面（2026-05-24）

本次新增 `/admin/materials` 辅料管理页面，没有新增数据库表，也没有修改数据库 schema。

当前逻辑：

- 辅料资料继续存在 `skus` 表，通过 `skus.sku_type = material` 和成品 SKU 区分。
- 辅料默认供应商存放在 `skus.default_supplier_id`，关联 `suppliers.id`；只有 `sku_type = material` 的记录使用，成品和半成品可为空。
- 页面只展示和维护 `sku_type = material` 的记录，不把辅料做成产品 SPU，也不强制绑定 `products.product_id`。
- 新增辅料时固定写入 `sku_type = material`、`product_id = null`、`amazon_sku = null`、`fnsku = null`，并可选择默认供应商。
- 编辑辅料时允许修改辅料名称、单位、规格、默认供应商和状态；辅料编码锁定，避免影响 BOM、采购、库存和流水记录。
- 列表显示辅料编码、辅料名称、从规格里临时解析的分类、单位、规格、默认供应商、供应商联系人、供应商电话、状态、当前库存汇总、安全库存汇总、BOM 引用次数和采购引用次数。
- 顶部支持按辅料编码、名称、规格搜索，支持状态筛选、单位筛选、供应商筛选、刷新、新增和批量导入。
- 汇总卡片显示辅料总数、启用辅料、停用辅料、有库存辅料、低库存辅料。
- 详情弹窗展示基础资料、当前库存汇总、被哪些 BOM 使用、最近采购记录和最近库存流水。
- 删除前检查 `bom_items.component_sku_id`、`material_requirements.material_sku_id`、`purchase_order_items.sku_id`、`inventory_items.sku_id`、`inventory_transactions.sku_id`，有引用时禁止硬删除并提示改为停用。
- 批量导入复用 `BulkImportDialog`，上传后先预览和行级校验，有错误行时可下载错误报告，确认后才写入 Supabase。
- 批量导入模板中文字段：`辅料编码`、`辅料名称`、`单位`、`规格`、`默认供应商编码`、`默认供应商名称`、`状态`。
- 批量导入也兼容英文表头：`sku_code`、`sku_name`、`unit`、`specs`、`supplier_code`、`supplier_name`、`status`。
- 批量导入规则：辅料编码和辅料名称必填，单位为空默认 `pcs`，状态为空默认 `active`；导入时固定写入 `sku_type = material`；如果填写供应商编码，优先按 `suppliers.supplier_code` 匹配；没有编码但填写名称时，按 `suppliers.name` 匹配；供应商为空允许导入为未设置供应商；供应商匹配不到时该行报错，不会自动创建供应商。
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
- 是否已经在 Supabase SQL Editor 执行 `scripts/add-material-default-supplier.sql`；如果没有执行，页面读取 `skus.default_supplier_id` 会失败。
- `inventory_items.safety_stock_quantity` 是否有数据；没有数据时低库存统计可能为 0。
- 导入 CSV 是否使用了模板字段，或者英文兼容字段 `sku_code`、`sku_name`、`unit`、`specs`、`supplier_code`、`supplier_name`、`status`。

### 3.4.1 辅料默认供应商联动（2026-05-25）

本次给辅料补充默认供应商能力，仍然不新建 `materials` 表，辅料继续由 `skus.sku_type = material` 区分。

当前逻辑：

- 新增 SQL 脚本 `scripts/add-material-default-supplier.sql`，给 `skus` 增加 `default_supplier_id uuid references suppliers(id) on delete set null`，并增加索引和字段说明。
- `supabase/schema.sql` 已同步完整结构：`skus.default_supplier_id` 是辅料默认供应商字段，老数据允许为空。
- `/admin/materials` 新增默认供应商维护、供应商筛选、列表供应商联系人和电话展示，新增/编辑弹窗里的供应商选择是可搜索选择器，只展示 active 供应商；如果旧辅料已绑定 inactive 供应商，详情和编辑仍能显示。
- `/admin/materials` 批量导入模板新增 `默认供应商编码`、`默认供应商名称`，英文兼容 `supplier_code`、`supplier_name`；导入不会自动创建供应商，匹配不到会按行报错并支持下载错误报告。
- `/purchase/orders` 手动新建采购单时，选择辅料后会根据辅料默认供应商自动带出供应商；多条辅料默认供应商一致时自动填入，一致性不满足时提示手动选择或拆分。
- `/purchase/orders` 从缺料生成采购单时，会优先读取缺料辅料的默认供应商；多个缺料辅料默认供应商不同且都已设置时，提交会按供应商拆分生成多张采购单；未设置默认供应商的辅料仍可手动选择供应商，不阻止采购。
- `/admin/suppliers` 详情弹窗显示该供应商关联了哪些辅料和关联辅料数量；删除供应商前会检查 `skus.default_supplier_id`，被辅料设置为默认供应商时禁止硬删除并提示改为停用。
- `/admin/skus` 对 material 类型显示和编辑默认供应商，成品 SKU 和其他类型可为空，不强制绑定供应商。

本次修改文件：

- `scripts/add-material-default-supplier.sql`
- `supabase/schema.sql`
- `src/components/SupplierSearchSelect.tsx`
- `src/lib/api/materials.ts`
- `src/app/(app)/admin/materials/page.tsx`
- `src/lib/api/purchase.ts`
- `src/app/(app)/purchase/orders/page.tsx`
- `src/lib/api/suppliers.ts`
- `src/app/(app)/admin/suppliers/page.tsx`
- `src/lib/api/skus.ts`
- `src/app/(app)/admin/skus/page.tsx`
- `src/lib/api/bulk-management.ts`
- `PROJECT_NOTES.md`

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户要求不要自动打开浏览器检查，所以本次不做浏览器自动检查。

### 3.4.2 辅料数据模型阶段一拆表（2026-05-26）

本次按阶段一把辅料基础资料从 `skus` 拆到独立 `materials` 表。旧 `skus` 里的原辅料数据不删除，BOM、采购、生产、库存仍然先走旧 SKU 引用，避免一次性牵动业务流程。

当前逻辑：

- 新增 `materials` 表，字段为 `material_code`、`material_name`、`category`、`unit`、`specs`、`default_supplier_id`、`status`、`notes`、`created_at`、`updated_at`。
- 新增 `trg_materials_updated_at`，更新辅料时自动刷新 `updated_at`。
- 新增脚本 `scripts/add-materials-table.sql`，会创建 `materials` 表，并把现有 `skus.sku_type = material` 的资料复制过去：`sku_code -> material_code`、`sku_name -> material_name`、`unit -> unit`、`specs -> specs`、`default_supplier_id -> default_supplier_id`、`status -> status`。
- `/admin/materials` 和 `src/lib/api/materials.ts` 已改为读取、创建、编辑、启用/停用、批量导入 `materials` 表。
- `/admin/materials` 批量导入模板新增 `分类`、`备注`，也兼容 `material_code`、`material_name`、`category`、`notes` 等英文表头。
- 阶段一暂不迁移 BOM、采购、生产、库存引用；页面里的库存数量、BOM 引用、采购引用和详情记录先按 0 或空记录展示。
- 阶段一暂不做辅料物理删除，页面删除入口会提示先停用，等业务引用迁移完成后再统一定删除规则。

本次修改文件：

- `scripts/add-materials-table.sql`
- `supabase/schema.sql`
- `src/lib/api/materials.ts`
- `src/app/(app)/admin/materials/page.tsx`
- `PROJECT_NOTES.md`

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

第二阶段建议：

- 把 BOM 明细从 `bom_items.component_sku_id -> skus.id` 迁到可引用 `materials.id` 的新关系，或新增过渡映射字段。
- 把 `material_requirements.material_sku_id` 的来源从旧 `skus` 逐步切到 `materials`。
- 把 `purchase_order_items.sku_id` 和采购单辅料选择改成读取 `materials`。
- 把 `inventory_items`、`inventory_transactions`、入库、出库、库存调整里的原材料维度从旧 SKU 迁到 `materials`。
- 同步调整 `/admin/skus`、`/admin/suppliers`、`/dashboard`、全局搜索等仍读取旧辅料信息的页面。

### 3.4.3 辅料数据模型第二阶段：BOM 明细接 materials（2026-05-26）

本次继续辅料拆表重构，只处理 BOM 明细和生产算料兼容，不改采购、库存、出入库主流程，也不删除旧 `skus.sku_type = material` 数据。

当前逻辑：

- `bom_items` 新增 `material_id uuid references materials(id) on delete restrict`，并新增索引 `idx_bom_items_material_id`。
- 旧字段 `bom_items.component_sku_id` 保留，注释改为兼容旧数据字段；阶段二后 BOM 辅料优先使用 `material_id`。
- 新增脚本 `scripts/migrate-bom-items-to-materials.sql`，会按 `skus.sku_code = materials.material_code` 把旧 BOM 明细回填到 `bom_items.material_id`，最后查询仍未匹配到 `material_id` 的 BOM 明细，方便人工检查。
- `/bom` 页面添加 BOM 明细时，选择器改为读取 `materials` 表；页面文案从“原材料 SKU”调整为“辅料”。
- BOM 明细列表优先显示 `materials.material_code`、`material_name`、`specs`、`unit`；旧数据如果还没有 `material_id`，继续 fallback 显示旧 `component_sku_id -> skus`。
- BOM 批量导入改为按 `materials.material_code` 校验和写入 `material_id`；旧表头 `material_sku_code` 仍兼容。
- 生产自动算料已做过渡兼容：BOM 明细有 `material_id` 时优先按新辅料取单位和说明；因为 `material_requirements` 还没迁移，写入时仍会用同编码旧 SKU 作为过渡。找不到同编码旧 SKU 时会明确报错，避免写错库存链路。
- 开发阶段 RLS 文件 `supabase/dev-bom-policies.sql` 和基础读取策略 `supabase/dev-policies.sql` 已补充 `materials` 的读取权限。

本次修改文件：

- `scripts/migrate-bom-items-to-materials.sql`
- `supabase/schema.sql`
- `supabase/dev-bom-policies.sql`
- `supabase/dev-policies.sql`
- `src/lib/api/bom.ts`
- `src/app/(app)/bom/page.tsx`
- `src/lib/api/bulk-management.ts`
- `src/lib/api/production.ts`
- `PROJECT_NOTES.md`

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

第三阶段已完成：见下一节“辅料数据模型第三阶段：物料需求接 materials”。

### 3.4.4 辅料数据模型第三阶段：物料需求接 materials（2026-05-26）

本次继续辅料拆表重构，只处理物料需求链路，不改采购单结构，不改库存结构，不删除旧 `material_sku_id`，也不删除旧 `skus.sku_type = material` 数据。

当前逻辑：

- `material_requirements` 新增 `material_id uuid references public.materials(id) on delete restrict`，并新增索引 `idx_material_requirements_material_id`。
- 旧字段 `material_requirements.material_sku_id` 保留，注释改为兼容旧数据字段；阶段三起辅料需求优先使用 `material_id`。
- 新增脚本 `scripts/migrate-material-requirements-to-materials.sql`，会按 `material_requirements.material_sku_id -> skus.sku_code -> materials.material_code` 回填 `material_requirements.material_id`，最后查询仍未匹配到 `material_id` 的物料需求，方便人工检查。
- 生产任务创建时，读取 BOM 明细优先使用 `bom_items.material_id`，生成物料需求时写入 `material_requirements.material_id`。
- 如果旧 BOM 明细只有 `component_sku_id`，仍会 fallback 到旧 SKU 逻辑；如果能按旧 SKU 编码匹配到 `materials.material_code`，也会顺手写入 `material_id`。
- 物料需求数量算法保持不变：计划数量 × BOM 单位用量 × (1 + 损耗率)。
- 当前库存结构还没迁移，所以可用库存仍按旧 `inventory_items.sku_id` 计算。新辅料如果没有同编码旧 SKU，物料需求会显示缺料，领料会提示等待库存链路迁移或补齐同编码旧 SKU。
- `/materials/requirements` 列表和详情优先显示 `materials.material_code`、`material_name`、`specs`、`unit`，旧历史数据继续 fallback 显示旧 `material_sku_id -> skus`。
- `/production/orders` 生产任务详情里的物料需求摘要和领料预览优先显示新辅料信息；领料状态、缺料状态继续沿用现有判断。
- `/dashboard` 和通知来源的缺料待办优先显示新辅料信息；未设置默认供应商、停用供应商引用等辅料异常统计改为基于 `materials` 表。
- `/admin/materials` 的引用统计补充“物料需求引用次数”，统计时优先看 `material_requirements.material_id`，旧 `material_sku_id` 只作为历史 fallback。

本次修改文件：

- `scripts/migrate-material-requirements-to-materials.sql`
- `supabase/schema.sql`
- `supabase/dev-material-requirements-policies.sql`
- `supabase/dev-production-orders-policies.sql`
- `src/lib/api/production.ts`
- `src/lib/api/material-requirements.ts`
- `src/lib/api/materials.ts`
- `src/lib/api/dashboard.ts`
- `src/app/(app)/materials/requirements/page.tsx`
- `src/app/(app)/production/orders/page.tsx`
- `src/app/(app)/admin/materials/page.tsx`
- `PROJECT_NOTES.md`

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 按用户要求，本阶段不自动打开浏览器检查。

第四阶段采购重构清单（已完成）：

- 已给 `purchase_order_items` 增加 `material_id`，并新增索引 `idx_purchase_order_items_material_id`；旧 `sku_id` 保留为兼容字段。
- 已新增 `scripts/migrate-purchase-items-to-materials.sql`，先按 `material_requirement_id -> material_requirements.material_id` 回填，再按旧 `sku_id -> skus.sku_code -> materials.material_code` 回填，最后输出仍未匹配的采购明细。
- `/purchase/orders` 的缺料生成采购单优先读取 `material_requirements.material_id` 和 `materials.default_supplier_id`，旧 `material_sku_id` 只作为 fallback。
- 手动创建采购单和批量导入采购单的辅料选择已改为读取 `materials` 表；导入模板主字段为 `material_code`，兼容旧 `material_sku_code` / `sku_code` 表头。
- 采购单详情、CSV/PNG 导出、供应商拆单和到货状态更新继续保留 `purchase_order_items.material_requirement_id` 的追溯关系。
- 本阶段不改库存结构；新采购明细会尽量保留同编码旧 `sku_id`，方便第五阶段前的旧库存入库链路继续过渡。

### 3.4.5 辅料数据模型第四阶段：采购链路接 materials（2026-05-26）

本次继续辅料拆表重构，只处理采购链路，不改库存结构，不改出入库结构，不删除 `purchase_order_items.sku_id`，也不删除旧 `skus.sku_type = material` 数据。

当前逻辑：

- `purchase_order_items` 新增 `material_id uuid references public.materials(id) on delete restrict`，并新增索引 `idx_purchase_order_items_material_id`。
- 旧字段 `purchase_order_items.sku_id` 保留，注释改为兼容旧数据字段；阶段四起采购明细优先使用 `material_id`。
- 新增脚本 `scripts/migrate-purchase-items-to-materials.sql`，会优先从已关联的 `material_requirements.material_id` 回填采购明细；如果没有，再按旧 SKU 编码匹配 `materials.material_code`。
- `/purchase/orders` 手动创建采购单的辅料选择器改为读取 `materials` 表；保存采购明细时写入 `material_id`，如果存在同编码旧 SKU，也同步写入旧 `sku_id` 作为库存阶段前的兼容。
- `/purchase/orders` 从缺料生成采购单时，基于 `material_requirements.material_id` 写采购明细，并按 `materials.default_supplier_id` 自动带出或拆分供应商；旧物料需求没有 `material_id` 时继续 fallback 到 `material_sku_id`。
- 采购单详情、CSV 导出和 PNG 采购单图片优先显示 `material_code`、`material_name`、`specs`、`unit`；旧数据没有 `material_id` 时继续 fallback 显示旧 SKU 信息。
- 批量导入采购单模板主字段改为 `material_code` / 辅料编码，仍兼容旧 `material_sku_code` 和 `sku_code` 表头；导入时优先匹配 `materials.material_code`。
- `/admin/suppliers` 关联辅料数量和详情改为读取 `materials.default_supplier_id`；删除保护仍兼容旧 `skus.default_supplier_id`，避免旧引用被误删。
- `/admin/materials` 的采购引用统计和详情采购记录优先读取 `purchase_order_items.material_id`，旧 `sku_id` 只作为历史 fallback。

本次修改文件：

- `scripts/migrate-purchase-items-to-materials.sql`
- `supabase/schema.sql`
- `supabase/dev-purchase-policies.sql`
- `supabase/dev-suppliers-policies.sql`
- `src/lib/api/purchase.ts`
- `src/app/(app)/purchase/orders/page.tsx`
- `src/lib/api/materials.ts`
- `src/lib/api/suppliers.ts`
- `src/lib/api/bulk-management.ts`
- `PROJECT_NOTES.md`

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 按用户要求，本阶段不自动打开浏览器检查。

第五阶段库存重构清单：

- 已完成数据库结构规划和代码接入：`inventory_items`、`inventory_transactions` 新增 `product_sku_id`、`material_id`，旧 `sku_id` 保留兼容。
- 已新增 `scripts/migrate-inventory-to-materials.sql`，按旧 `sku_id -> skus.sku_code -> materials.material_code` 回填辅料 `material_id`，成品回填 `product_sku_id = sku_id`，并输出仍未匹配的库存余额和库存流水。
- `/inventory/materials` 现在优先读取 `materials + inventory_items.material_id`，显示辅料编码、名称、规格、默认供应商和库存数量；旧库存未迁移时继续 fallback 到旧 SKU。
- `/inventory/products` 现在优先读取 `skus + inventory_items.product_sku_id`，旧数据没有新字段时继续 fallback 到 `sku_id`。
- 采购入库优先按 `purchase_order_items.material_id` 写辅料库存和 `material_in` 流水；生产入库、FBA 出库继续按成品 SKU 写 `product_sku_id`。
- 其他入库、其他出库、库存调整、库存流水筛选已经支持成品 SKU 和辅料两种库存对象；写入时尽量同步旧 `sku_id`，但业务判断优先使用新字段。
- 生产领料已改为优先按 `material_requirements.material_id` 找 `inventory_items.material_id` 扣库存，旧需求没有 `material_id` 时继续 fallback 到旧 `material_sku_id`。
- `/dashboard` 的低库存辅料提醒改为优先显示 `materials` 信息；global search 搜索辅料改为读取 `materials` 表，成品 SKU 仍读取 `skus` 表。
- 第五阶段仍不要删除旧 SKU 辅料；因为 `inventory_items.sku_id` 和 `inventory_transactions.sku_id` 目前仍是非空字段，后续清理前要先评估是否把旧字段改为可空，并确认所有历史数据都已迁移。

本阶段验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 尚未自动打开浏览器逐页手动操作。上线前建议按顺序人工检查：辅料库存列表、成品库存列表、采购入库、生产入库、生产领料、FBA 出库、其他入库、其他出库、库存调整、库存流水。

剩余旧字段清理计划：

- 第一步：在测试库执行 `scripts/migrate-inventory-to-materials.sql`，先处理脚本输出的未匹配余额和流水。
- 第二步：观察一段时间，确认新增库存写入都稳定写入 `material_id` 或 `product_sku_id`。
- 第三步：把批量库存 RPC 也升级到新字段，避免批量导入还只依赖旧 `sku_id`。
- 第四步：确认没有页面再依赖旧辅料 SKU 后，再单独讨论是否把 `inventory_items.sku_id`、`inventory_transactions.sku_id` 改为可空或只做历史字段；此阶段不删除旧字段、不删旧数据。

### 3.4.6 首页角色待办中心（2026-05-25）

本次把 `/dashboard` 从“统计数字看板”升级为“员工每天进系统先看的待办中心”，没有修改数据库 schema，没有修改 RLS，没有改真实登录，也没有大改导航。

当前逻辑：

- 首页继续使用当前项目的模拟角色 `MockRoleProvider`，根据 `operations`、`plant_manager`、`procurement`、`warehouse`、`admin` 展示不同内容。
- 顶部欢迎区显示当前模拟角色、今日日期、待处理事项总数和刷新按钮。
- 待办汇总卡片会按角色展示 4 到 6 个重点事项，卡片可点击跳转到对应业务页面。
- 快捷入口按角色展示常用页面，例如创建/查看 FBA 备货、厂长排产、采购单、入库管理、库存流水等。
- 重点待办列表每块最多读取首页需要的前几条，避免首页变成长报表。
- 异常提醒区展示超期、缺 BOM、未设置供应商、低库存、库存异常等问题；没有异常时显示友好空状态。

各角色首页重点：

- 运营：待厂长接单的 FBA 备货需求、生产中的 FBA 备货需求、已生产完成待 FBA 出库、已超期但未 shipped 的备货单、可判断的成品库存异常；快捷入口包含创建 FBA 备货单、查看 FBA 备货需求、库存总览、出库管理。
- 厂长：待接单/待排产、已接单但未创建生产任务、缺 BOM、缺料生产任务、可开工生产任务、生产中超期任务、待生产入库任务；快捷入口包含厂长排产、生产任务、BOM 管理、物料需求。
- 采购：缺料待采购、已生成但未下单采购单、已下单待到货采购单、超期未到货采购单、未设置默认供应商辅料、停用供应商仍被辅料引用的异常；快捷入口包含采购单、物料需求、辅料管理、供应商管理。
- 仓库：待采购入库、待生产入库、待 FBA 出库、原材料低库存、成品库存异常、最近库存调整记录；快捷入口包含库存总览、入库管理、出库管理、库存调整、库存流水。
- 管理员：综合视角，展示待排产 FBA、生产中任务、缺料物料、待采购/待到货采购单、待采购入库、待生产入库、待 FBA 出库、未设置品牌产品、未设置默认供应商辅料、低库存辅料、最近库存流水。

本次新增或修改的 API：

- 重写 `src/lib/api/dashboard.ts`，新增 `getRoleDashboard(role)`。
- 首页统计尽量使用 Supabase count；列表只读取首页需要的少量记录。
- 品牌继续通过 `skus -> products -> brands` 读取，不在业务表里重复存品牌。
- 缺 BOM、未设置供应商、低库存、超期 FBA、超期生产、超期采购等都基于现有真实字段判断。

本次修改文件：

- `src/lib/api/dashboard.ts`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/globals.css`
- `PROJECT_NOTES.md`

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 按本次要求没有自动打开浏览器检查。

### 3.5 品牌管理和产品品牌关联（2026-05-24）

本次新增品牌管理功能，并把品牌按 SPU 产品维度接入系统。

当前逻辑：

- 新增 `/admin/brands` 品牌管理页面，放在“基础资料”下面。
- 品牌基础资料存放在 `brands` 表，字段为 `brand_code`、`name`、`english_name`、`logo_url`、`status`、`notes`。
- 产品通过 `products.brand_id` 关联品牌，`brand_id` 允许为空，兼容已有未绑定品牌的产品。
- SKU 不新增 `brand_id`。SKU 的品牌从 `skus.product_id -> products.brand_id -> brands` 查出来。
- 辅料 SKU 一般不绑定产品，页面显示为“无品牌 / 辅料”。
- BOM、库存、FBA 备货单、生产任务、采购单等业务表没有新增 `brand_id`，需要品牌时都通过 SKU 或产品关联查询。
- `/admin/brands` 支持列表、搜索、状态筛选、新增、编辑、查看、启用/停用、删除前检查产品引用、批量导入。
- 品牌批量导入模板字段：`brand_code`、`name`、`english_name`、`logo_url`、`status`、`notes`。
- `/admin/products` 列表显示品牌，新增/编辑产品可选择品牌，支持按品牌筛选；产品批量导入模板新增 `brand` 字段，可填写品牌编码或品牌名称，匹配不到会报错，不会自动创建品牌。
- `/admin/skus` 列表显示继承来的品牌，支持按品牌筛选；新增/编辑 SKU 时不选择品牌，只选择所属产品。
- 已展示或筛选品牌的业务页面：`/replenishment`、`/production/planning`、`/production/orders`、`/bom`、`/inventory/products`、`/inventory/fba-outbound`、`/inventory/transactions`。

本次新增 SQL 脚本：

- `scripts/add-brands.sql`：创建 `brands` 表，给 `products` 增加可空 `brand_id`，增加索引、更新时间触发器、开发阶段 RLS 策略。执行前建议先备份数据库。

本次修改文件：

- `supabase/schema.sql`
- `supabase/dev-policies.sql`
- `supabase/dev-products-policies.sql`
- `supabase/dev-bulk-import-delete-policies.sql`
- `scripts/add-brands.sql`
- `src/lib/api/brands.ts`
- `src/lib/api/products.ts`
- `src/lib/api/skus.ts`
- `src/lib/api/bom.ts`
- `src/lib/api/replenishment.ts`
- `src/lib/api/production.ts`
- `src/lib/api/inventory.ts`
- `src/lib/api/master-data.ts`
- `src/lib/api/bulk-management.ts`
- `src/lib/brand-utils.ts`
- `src/lib/navigation.ts`
- `src/app/(app)/admin/brands/page.tsx`
- `src/app/(app)/admin/products/page.tsx`
- `src/app/(app)/admin/skus/page.tsx`
- `src/app/(app)/bom/page.tsx`
- `src/app/(app)/replenishment/page.tsx`
- `src/app/(app)/production/planning/page.tsx`
- `src/app/(app)/production/orders/page.tsx`
- `src/app/(app)/inventory/_components/current-inventory-page.tsx`
- `src/app/(app)/inventory/fba-outbound/page.tsx`
- `src/app/(app)/inventory/transactions/page.tsx`
- `PROJECT_NOTES.md`

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 用户要求不要自动打开浏览器检查，所以本次不做浏览器自动检查。

如果品牌页面或品牌字段读取失败，优先检查：

- 是否已在 Supabase SQL Editor 执行 `scripts/add-brands.sql`。
- 当前 Supabase RLS 是否已有 `brands` 的 select/insert/update/delete 开发阶段策略。
- 产品导入 CSV 的品牌字段是否能匹配已有品牌编码或品牌名称。

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
- 批量导入校验：`SKU编码` 必填、`本次备货数量` 必填且必须是大于 0 的整数、SKU 编码必须存在于系统成品 SKU、可选期望发货日期必须是 `YYYY-MM-DD`、可选目的仓库必须匹配仓库编码或仓库名称。
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

已完成升级版。

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

已完成辅料拆表第三阶段。

入口：创建生产任务时自动触发。

当前逻辑：

- 根据生产任务的成品 SKU 查找启用中的 `bom_headers`。
- 读取对应 `bom_items`，优先使用 `bom_items.material_id`。
- 按 `production_orders.planned_quantity` 计算物料需求，而不是按 FBA 备货需求数量计算。
- 计算公式：计划生产数量 × BOM 单位用量 × (1 + 损耗率)。
- 读取 `inventory_items`，按 `quantity_on_hand - reserved_quantity` 计算可用库存；库存结构尚未迁移，所以这里仍通过旧 `material_sku_id` 查库存。
- 写入 `material_requirements`，优先写入 `material_id`，旧 `material_sku_id` 继续保留做采购和库存过渡兼容。
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
- 采购单列表显示采购单号、供应商、采购负责人、状态、下单日期、预计到货日期、总金额、明细数量、创建来源、创建时间和操作，并支持按供应商筛选。
- 详情使用弹窗展示，包含采购单主信息、供应商完整信息、采购明细、合计数量、合计金额、关联物料需求和状态操作。
- 每行采购单和详情弹窗都支持导出 CSV，文件名格式为 `采购单号-供应商名称.csv`，字段用中文，方便直接发给供应商。
- 详情弹窗新增“导出采购单图片”，采购单列表和缺料生成成功提示里也提供图片导出入口。图片预览使用正式采购单版式，支持下载 PNG，并在浏览器支持时复制图片。
- 采购单图片文件名格式为 `采购单_采购单号_供应商名称.png`，内容包含公司名称、采购单号、下单日期、预计到货日期、供应商信息、明细表、合计数量、合计金额、备注、制单人和生成时间。
- 图片导出使用前端依赖 `html-to-image`，只把当前详情数据渲染成 PNG，不写数据库，也不新增导出表。
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
- `package.json`
- `package-lock.json`
- `PROJECT_NOTES.md`

测试方式：

- 手动创建采购单：打开 `/purchase/orders`，点击“+ 新建采购单”，选择供应商、可选采购负责人、下单日期、预计到货日期和备注，添加一条或多条原材料 SKU 明细，确认数量大于 0、单价不小于 0 后保存，再回到采购单列表确认能看到新采购单。
- 批量导入采购单：打开 `/purchase/orders`，点击“批量导入采购单”，先下载模板，填写 CSV 后上传，确认页面先显示预览、行级校验和将生成的采购单数量；有错误时不能导入，全部通过后点击“确认导入”。
- 导出采购单 CSV：在采购单列表点击“导出”，或点“查看详情”后在详情弹窗点击“导出 CSV”，确认下载的 CSV 表头是中文，且明细小计等于采购数量乘以单价。
- 导出采购单图片：点“查看详情”后点击“导出采购单图片”，确认弹窗里展示正式采购单版式，再点击“下载图片”下载 PNG；如果浏览器支持，也可以点“复制采购单图片”后直接粘贴到微信或钉钉。
- 缺料生成采购单：在“待采购清单”勾选缺料物料，点击“生成采购单”，确认仍会写入 `purchase_order_items.material_requirement_id`，并把对应缺料需求更新为 `purchased`。
- 侧边栏：确认顺序为首页、创建备货需求、FBA 备货需求、生产管理、采购管理、仓库库存、基础资料、系统管理，且不再出现不可点击的“FBA 备货”分组标题。

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 已启动本地页面到 `/purchase/orders` 做快速检查；页面能打开，但当前 Supabase 数据库尚未执行 `scripts/add-material-default-supplier.sql`，真实数据请求返回 400，所以没有继续点开真实采购单图片预览。

注意：

- 采购单页面的状态按钮主要用于采购单状态流转。
- 真正会增加库存、生成库存流水的采购入库，请优先走 `/inventory/inbound`。
- 如果页面读写失败，优先确认 `supabase/dev-purchase-policies.sql` 是否已经在 Supabase SQL Editor 执行。该文件已包含采购单、采购明细、供应商、SKU、物料需求和 profiles 的开发阶段读写策略。
- 如果采购单页面读取失败且 Supabase 返回 `default_supplier_id` 或 `skus_default_supplier_id_fkey` 相关错误，先执行 `scripts/add-material-default-supplier.sql`，因为采购单会读取辅料默认供应商。
- 本地浏览器检查时，如果数据库尚未执行 `scripts/add-material-default-supplier.sql`，采购单页面会因真实 Supabase 字段缺失返回 400，导致无法完整验证图片弹窗。

后续待优化：

- 正式登录后，把 `created_by` 自动写成当前采购人员，而不是手动选择。
- 采购单编辑第一版只编辑草稿主信息和已有明细数量/单价/备注，后续如需编辑时新增或删除明细，需要单独设计业务规则。
- 批量导入当前按采购单逐张写入，后续可升级为数据库事务或 RPC，避免极端情况下主表成功但明细失败。
- 后续可增加打印版 PDF、供应商确认回传等功能。

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
- 确认前会弹出领料清单，显示生产任务单号、成品 SKU、计划生产数量、辅料编码、辅料名称、应领数量、当前库存、领料后库存、扣减仓库和足够/不足状态。
- 库存足够判断使用 `inventory_items.quantity_on_hand - inventory_items.reserved_quantity` 作为可用库存。
- 扣库存时按真实字段使用 `inventory_items.warehouse_id + sku_id` 的库存记录。优先选择 `warehouse_type = material` 的原材料仓；如果没有明确原材料仓，则选择第一条单仓可用库存足够的库存记录。
- 第一版不跨仓扣料。如果所有仓库合计够，但没有单个仓库够扣，会提示先手动调整仓库库存。
- 确认领料时会再次检查是否已经有 `material_out` 流水，防止重复扣料。
- 确认领料时会再次读取库存，防止页面打开后库存发生变化。
- 每一种辅料都会扣减对应旧 SKU 的 `inventory_items.quantity_on_hand`。如果新辅料还没有同编码旧 SKU，当前阶段不会强行扣库存。
- 每一种辅料都会写一条 `inventory_transactions`，`transaction_type = material_out`，`quantity` 按现有出库逻辑继续记录正数，并通过 `production_order_id` 关联生产任务。
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

### 4.7.1 其他入库 / 初始库存批量导入

已完成升级版。

入口：`/inventory/inbound` 的“其他入库”标签。

当前逻辑：

- 用于初始库存录入、盘点补录、退货入库和其他非采购、非生产来源的库存增加。
- 单个其他入库通过弹窗完成，字段包括入库仓库、SKU、入库数量、入库原因和备注。
- SKU 可选择 `material`、`finished_good`、`finished_product`，也就是辅料和成品。
- 如果仓库 + SKU 已经有 `inventory_items` 记录，则增加 `quantity_on_hand`。
- 如果仓库 + SKU 没有 `inventory_items` 记录，则新增库存记录，`reserved_quantity = 0`，`safety_stock_quantity = 0`，单位使用 SKU 单位。
- SKU 为 `material` 时流水类型写 `material_in`；SKU 为 `finished_good` / `finished_product` 时流水类型写 `product_in`。
- 其他入库不关联 `purchase_order_id`、`production_order_id`、`replenishment_request_id`。
- notes 会写明“其他入库”或“初始库存导入”、入库原因、单位和操作备注。
- 批量导入复用 `BulkImportDialog`，上传后先预览和行级校验，有错误行时可下载错误报告，确认后才写库存和流水。
- 批量导入模板中文字段：`仓库编码`、`SKU 编码`、`入库数量`、`入库原因`、`备注`。
- 批量导入兼容英文表头：`warehouse_code`、`sku_code`、`quantity`、`reason`、`remark`。

### 4.8 出库管理

已完成升级版。

入口：`/inventory/fba-outbound`

页面名称和导航名称：出库管理。路径暂时保留 `/inventory/fba-outbound`。

当前逻辑：

FBA 出库：

- 读取状态为 `accepted`、`in_production`、`completed` 的 FBA 备货需求。
- 统计该备货需求已经 `product_out` 的数量。
- 读取成品库存可用数量。
- 计算待出库数量：FBA 备货需求数量 - 已出库数量。
- 提交后写入 `inventory_transactions`，流水类型为 `product_out`。
- 扣减 `inventory_items.quantity_on_hand`。
- 累计出库数量达到 FBA 备货需求数量后，更新备货需求状态为 `shipped`。
- 第一版不允许超出库存，也不允许超发。

其他出库：

- 用于样品出库、损耗出库、退货给供应商、借出和其他非 FBA 出库。
- 单个其他出库通过弹窗完成，字段包括出库仓库、SKU、出库数量、出库原因和备注。
- SKU 可选择 `material`、`finished_good`、`finished_product`，也就是辅料和成品。
- 出库前按 `inventory_items.quantity_on_hand - inventory_items.reserved_quantity` 校验可用库存。
- 如果仓库 + SKU 没有 `inventory_items` 记录，视为库存 0，不能出库。
- 出库数量不能大于可用库存，库存不能扣成负数。
- SKU 为 `material` 时流水类型写 `material_out`；SKU 为 `finished_good` / `finished_product` 时流水类型写 `product_out`。
- 其他出库不关联 FBA 备货单，不更新 `fba_replenishment_requests` 状态。
- notes 会写明“其他出库”、出库原因、单位和操作备注。
- 批量导入复用 `BulkImportDialog`，上传后先预览和行级校验，有错误行时可下载错误报告，确认后才扣减库存和写流水。
- 批量导入模板中文字段：`仓库编码`、`SKU 编码`、`出库数量`、`出库原因`、`备注`。
- 批量导入兼容英文表头：`warehouse_code`、`sku_code`、`quantity`、`reason`、`remark`。
- 同一仓库 + SKU 多行导入时，先合并校验总出库数量不能超过可用库存，再逐行写库存流水。

### 4.9 库存流水记录

已完成第一版。

入口：`/inventory/transactions`

当前逻辑：

- 采购入库写 `material_in`。
- 其他入库按 SKU 类型写 `material_in` 或 `product_in`，notes 标明“其他入库”或“初始库存导入”。
- 生产领料写 `material_out`。
- 生产入库写 `product_in`。
- FBA 出库写 `product_out`。
- 其他出库按 SKU 类型写 `material_out` 或 `product_out`，notes 标明“其他出库”。
- 页面可以查看流水类型、SKU、仓库、数量、关联单据、操作时间、备注。
- 关联单据通过真实字段判断：`purchase_order_id`、`production_order_id`、`replenishment_request_id`。
- 库存调整写 `adjustment`，调整原因、调整方式、调整前库存、调整后库存、调整差异和操作备注写入 `notes`，方便后续追溯。

### 4.9.1 库存调整

已完成第一版。

入口：`/inventory/adjustments`

当前逻辑：

- 页面先读取 `inventory_items` 当前库存，并关联 `skus`、`products`、`warehouses` 显示 SKU 编码、名称、类型、产品、仓库、库存数量、单位和最后更新时间。
- 支持按 SKU 编码 / 名称搜索，按 SKU 类型筛选全部 / 原材料 / 成品，按仓库筛选，并支持刷新列表。
- 页面顶部新增“按仓库 + SKU 调整”入口，可直接选择仓库和 SKU 后打开调整弹窗，不再要求该 SKU 已经有库存记录。
- SKU 类型展示规则：`material` 显示为“原材料”，`finished_good` / `finished_product` 显示为“成品”，其他值按原值显示。
- 点击“调整库存”后打开调整表单，显示 SKU、仓库、当前库存和单位等只读信息。
- 支持三种调整方式：增加库存、减少库存、直接修正为指定库存。
- 增加库存时，调整数量必须大于 0，调整后库存 = 当前库存 + 调整数量。
- 减少库存时，调整数量必须大于 0，且不能大于当前库存，调整后库存 = 当前库存 - 调整数量。
- 直接修正库存时，用户输入调整后库存，系统计算差异数量 = 调整后库存 - 当前库存；差异为 0 时禁止提交。
- 不允许调整后库存小于 0。
- 如果仓库 + SKU 没有 `inventory_items` 记录，系统按当前库存 0 处理；允许“增加库存”或“直接修正库存”创建库存记录，不允许“减少库存”把 0 扣成负数。
- 新建库存记录时会写入 `warehouse_id`、`sku_id`、`item_type`、`quantity_on_hand`、`reserved_quantity = 0`、`safety_stock_quantity = 0`、`unit = SKU 单位`。
- 如果直接修正到 0 且原来没有库存记录，系统不创建库存记录、不创建流水，并提示“库存数量没有变化”。
- 调整提交时先按真实仓库 + SKU 重新读取当前库存，再更新或新增 `inventory_items`，并写入一条 `inventory_transactions.transaction_type = adjustment` 的流水。
- 当前 schema 中 `inventory_transactions.quantity` 的注释说明是“入库为正数，出库也先记录正数，由类型判断方向”，所以库存调整流水的 `quantity` 也继续记录正数；实际增加或减少通过 `notes` 里的“调整差异：+数量 / -数量”追溯。
- 当前没有真实登录，`operator_id` 仍暂时写 `null`；页面最近调整记录会兼容显示操作人。
- 页面下方显示最近 `adjustment` 流水，包含操作时间、SKU、仓库、调整数量、调整原因、备注和操作人。

本次修改文件：

- `src/lib/api/inventory.ts`
- `src/app/(app)/inventory/adjustments/page.tsx`
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
- 如果是减少库存，先确认 `inventory_items` 是否有对应仓库和 SKU 的库存记录且可用库存足够；如果是增加库存或直接修正，可以从 0 库存创建记录。
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
- `/inventory/overview`

当前逻辑：

- 当前库存来自 `inventory_items`。
- 原材料库存按原材料 SKU 查询。
- 成品库存按成品 SKU 查询。
- 可以按仓库、关键词和库存状态筛选。
- 成品库存品牌来自 `sku.product.brand`，显示时使用统一的品牌编码 / 名称格式。
- 可用库存 = `quantity_on_hand - reserved_quantity`，`reserved_quantity` 为空时按 0 处理。
- 当前库存行可以跳转查看对应 SKU + 仓库的库存流水、库存调整、其他入库和其他出库。
- 库存总览新增到“库存管理”导航第一项；原材料库存和成品库存页面路由保留，但不再作为库存管理下的单独子菜单展示。

### 4.11 BOM 管理

已完成第一版。

入口：`/bom`

当前逻辑：

- 页面读取真实 `bom_headers` 和 `bom_items`，不再使用占位页或 mock 数据。
- BOM 主表通过 `bom_headers.product_sku_id` 关联成品 SKU。
- BOM 明细通过 `bom_items.bom_header_id` 关联 BOM 主表；阶段二起辅料优先通过 `bom_items.material_id -> materials.id` 关联，旧 `component_sku_id` 暂时保留兼容历史数据。
- 新增 BOM 时，成品 SKU 下拉框只读取 `skus.sku_type = finished_good` 的 SKU。
- 新增 BOM 会自动生成 `bom_code`，写入 `bom_headers.product_sku_id`、`version`、`status`、`notes`。
- 如果同一个成品 SKU 已有启用 BOM，页面会在新增启用 BOM 前显示提示。
- 添加 BOM 辅料时，辅料选择器读取 `materials` 表。
- 添加 BOM 辅料会写入 `bom_items.material_id`、`quantity_per`、`unit`、`loss_rate`、`notes`；如果能按 `materials.material_code = skus.sku_code` 找到旧辅料 SKU，也会同步写入 `component_sku_id` 作为过渡兼容。
- 页面会校验单位用量必须大于 0，损耗率不能小于 0。
- 页面和 API 都会检查同一个 BOM 下不能重复添加同一个辅料。
- BOM 明细支持编辑 `quantity_per`、`loss_rate` 和 `notes`，保存后刷新当前 BOM 明细。
- BOM 启用/停用使用 `bom_headers.status`，启用为 `active`，停用为 `inactive`。
- BOM 主表编辑按钮当前只是预留，暂不做删除。

本次修改文件：

- `src/lib/api/bom.ts`
- `src/app/(app)/bom/page.tsx`
- `src/lib/api/bulk-management.ts`
- `src/lib/api/production.ts`
- `supabase/schema.sql`
- `supabase/dev-bom-policies.sql`
- `supabase/dev-policies.sql`
- `scripts/migrate-bom-items-to-materials.sql`
- `PROJECT_NOTES.md`

测试方式：

- 运行 `npm run typecheck`。
- 运行 `npm run build`。
- 打开 `/bom`，确认 BOM 列表能读取真实数据。
- 新增一个 BOM，确认写入 `bom_headers`。
- 查看 BOM 明细，添加一个辅料，确认写入 `bom_items.material_id`。
- 编辑 BOM 明细的单位用量、损耗率、备注，确认保存后页面刷新。
- 点击启用/停用，确认 `bom_headers.status` 变化。

如果页面读不到或写不进去，优先检查：

- `.env.local` 里的 `NEXT_PUBLIC_SUPABASE_URL` 和 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否正确。
- Supabase 里是否已经执行基础 `dev-policies.sql`。
- 如果写入 BOM 报 RLS 权限问题，请在 Supabase SQL Editor 执行 `supabase/dev-bom-policies.sql`。
- `skus` 表里是否真的有 `sku_type = finished_good` 的成品 SKU 和 `sku_type = material` 的原材料 SKU。
- 是否已经执行 `scripts/add-materials-table.sql` 和 `scripts/migrate-bom-items-to-materials.sql`。
- `bom_headers.product_sku_id` 是否关联真实存在的成品 `skus.id`。
- `bom_items.material_id` 是否关联真实存在的 `materials.id`；旧数据没有迁移时再检查 `component_sku_id` 是否关联旧 `skus.id`。

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
- `/inventory/adjustments` 库存调整批量导入已实现。导入仍必须写 `inventory_transactions`，不能只改 `inventory_items`。

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
| 仓库库存 | 库存总览 `/inventory/overview`、入库管理 `/inventory/inbound`、出库管理 `/inventory/fba-outbound`、库存调整 `/inventory/adjustments`、库存流水 `/inventory/transactions` |
| 基础资料 | 产品管理 `/admin/products`、SKU 管理 `/admin/skus`、仓库管理 `/admin/warehouses` |
| 系统管理 | 用户管理 `/admin/users` |

侧边栏实现说明：

- 菜单配置集中在 `src/lib/navigation.ts`。
- 折叠交互在 `src/components/layout/sidebar.tsx`。
- Sidebar 会读取当前 `pathname`，先找出最精确匹配的菜单链接。
- 例如访问 `/inventory/overview` 时，会匹配到“库存总览”，并自动展开“仓库库存”分组。
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
- 打开 `/inventory/overview`，确认“仓库库存”自动展开，“库存总览”高亮。
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
| `schema.sql` | 数据库建表文件。定义角色、用户资料、品牌、产品、SKU、供应商、仓库、BOM、FBA 备货需求、生产任务、物料需求、采购单、库存当前表、库存流水表等。 |
| `seed.sql` | 测试数据文件。插入开发阶段测试角色、仓库、供应商、产品、SKU、BOM、库存、FBA 备货需求、生产任务、物料需求、采购单和库存流水。 |
| `README.md` | Supabase 数据库结构说明，解释为什么本系统不是传统销售订单系统，以及主要表关系。 |
| `dev-policies.sql` | 开发阶段基础读取策略。主要给 `anon` 和 `authenticated` 开放 select，方便调试基础资料和页面读取，已包含 `materials` 读取。 |
| `dev-fba-replenishment-insert-policy.sql` | 开发阶段允许前端创建 FBA 备货需求，用于 `/replenishment/new`。 |
| `dev-production-planning-policies.sql` | 开发阶段允许厂长排产页面更新 FBA 备货需求状态、创建生产任务。 |
| `dev-material-requirements-policies.sql` | 开发阶段允许读取、创建、更新物料需求，支持创建生产任务后自动生成物料需求和物料需求列表页。 |
| `dev-bom-policies.sql` | 开发阶段允许 BOM 管理页面读取产品、SKU、辅料、BOM 主表和 BOM 明细，并新增或更新 BOM。不开放 delete。 |
| `dev-products-policies.sql` | 开发阶段允许产品管理页面读取产品和 SKU，并新增、编辑、启用/停用产品。不开放 delete。 |
| `dev-skus-policies.sql` | 开发阶段允许 SKU 管理页面读取产品、SKU、库存、BOM 关联，并新增、编辑、启用/停用 SKU。不开放 delete。 |
| `dev-suppliers-policies.sql` | 开发阶段允许供应商管理页面读取供应商、采购单和默认供应辅料，并新增、编辑、启用/停用供应商。不开放 delete。 |
| `dev-warehouses-policies.sql` | 开发阶段允许仓库管理页面读取仓库、库存、流水和 SKU，并新增、编辑、启用/停用仓库。不开放 delete。 |
| `dev-users-policies.sql` | 开发阶段允许用户管理页面读取 roles、profiles，并新增、编辑、启用/停用 profiles。不开放 delete，也不创建 Supabase Auth 账号。 |
| `dev-purchase-policies.sql` | 开发阶段允许采购页面读取缺料、辅料、创建采购单、写采购明细、更新采购单和物料需求状态。 |
| `dev-inventory-inbound-policies.sql` | 开发阶段允许入库页面写库存流水、更新当前库存、更新采购单/采购明细/物料需求/生产任务。 |
| `dev-fba-outbound-policies.sql` | 开发阶段允许 FBA 出库页面读取待出库需求、写出库流水、扣减成品库存、标记已发往 FBA。 |
| `dev-production-orders-policies.sql` | 开发阶段允许生产任务页面读取生产任务、物料需求、入库流水，并更新生产任务状态。 |
| `dev-inventory-transactions-policies.sql` | 开发阶段允许库存流水页面读取库存流水和关联基础资料，只开放查询，不开放新增、更新、删除。 |
| `dev-inventory-adjustment-policies.sql` | 开发阶段允许库存调整页面读取当前库存和调整流水、更新当前库存、写入 adjustment 流水。不开放删除，也不开放直接修改库存流水。 |
| `dev-bulk-import-delete-policies.sql` | 开发阶段允许产品、SKU、供应商、仓库、BOM 做批量导入、停用和受保护删除；业务流水和库存流水只开放读取用于删除保护检查，不开放 delete。 |
| `scripts/add-brands.sql` | 品牌功能迁移脚本。创建 `brands` 表，给 `products` 增加可空 `brand_id`，并附带开发阶段 RLS 策略。 |
| `scripts/add-materials-table.sql` | 辅料拆表阶段一脚本。创建 `materials` 表，把旧 `skus.sku_type = material` 的辅料资料复制到新表，并附带开发阶段 RLS 策略。 |
| `scripts/migrate-bom-items-to-materials.sql` | 辅料拆表阶段二脚本。给 `bom_items` 增加 `material_id`，按旧 SKU 编码回填新辅料 ID，并输出仍未匹配的 BOM 明细。 |
| `scripts/migrate-material-requirements-to-materials.sql` | 辅料拆表阶段三脚本。给 `material_requirements` 增加 `material_id`，按旧 SKU 编码回填新辅料 ID，并输出仍未匹配的物料需求。 |
| `scripts/migrate-purchase-items-to-materials.sql` | 辅料拆表阶段四脚本。给 `purchase_order_items` 增加 `material_id`，优先从物料需求回填，再按旧 SKU 编码匹配新辅料，并输出仍未匹配的采购明细。 |
| `scripts/migrate-inventory-to-materials.sql` | 辅料拆表阶段五脚本。给库存余额和库存流水补充 `product_sku_id`、`material_id`，按旧 SKU 编码回填新辅料引用，并输出未匹配的库存余额和流水。 |

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
| `brands` | 品牌基础资料表。品牌属于产品 SPU，不直接挂在 SKU 或业务单据上。 |
| `products` | 产品基础资料表，是 SKU、BOM、库存的上层产品归类。通过可空字段 `brand_id` 关联品牌。 |
| `skus` | SKU 表，保存成品 SKU、原材料 SKU、半成品 SKU。通过 `sku_type` 区分类型。当前代码里成品 SKU 主要按 `finished_good` 使用；SKU 不单独存品牌。 |
| `materials` | 辅料基础资料表。阶段一给 `/admin/materials` 使用；阶段二起 BOM 明细优先通过 `bom_items.material_id` 引用它；阶段三起物料需求优先通过 `material_requirements.material_id` 引用它；阶段四起采购明细优先通过 `purchase_order_items.material_id` 引用它。旧 `skus.sku_type = material` 数据仍保留，库存引用后续阶段再迁移。 |
| `suppliers` | 供应商表，给采购单使用。 |
| `warehouses` | 仓库表，保存原材料仓、成品仓、FBA 备发仓等。通过 `warehouse_type` 区分类型。 |
| `bom_headers` | BOM 主表，表示某个成品 SKU 的某个 BOM 版本。 |
| `bom_items` | BOM 明细表，表示生产 1 个成品需要哪些辅料或半成品，以及单位用量和损耗率。阶段二新增 `material_id` 引用 `materials`，旧 `component_sku_id` 保留兼容旧数据。 |
| `fba_replenishment_requests` | FBA 备货需求表。运营发起的内部备货生产需求，不是销售订单。 |
| `production_orders` | 生产任务表。厂长根据 FBA 备货需求创建和安排生产。 |
| `material_requirements` | 物料需求表。根据生产任务和 BOM 计算需要多少物料、库存够不够、缺多少。阶段三新增 `material_id` 引用 `materials`，旧 `material_sku_id` 保留兼容历史数据和未迁移的采购/库存链路。 |
| `purchase_orders` | 采购单主表。采购根据缺料情况创建采购单。 |
| `purchase_order_items` | 采购单明细表。阶段四新增 `material_id` 引用 `materials`，记录每个采购辅料、采购数量、到货数量、单价，并可关联物料需求；旧 `sku_id` 保留兼容历史采购和库存过渡。 |
| `inventory_items` | 当前库存表。阶段五起成品优先用 `product_sku_id`，辅料优先用 `material_id`；旧 `sku_id` 保留兼容历史数据。 |
| `inventory_transactions` | 库存流水表。阶段五起成品流水优先写 `product_sku_id`，辅料流水优先写 `material_id`；旧 `sku_id` 保留兼容历史数据。 |

## 7. 关键字段和数量关系

### 7.0 品牌和产品关系

品牌只在两个地方存：

- `brands`：品牌基础资料。
- `products.brand_id`：产品 SPU 关联哪个品牌。

SKU 不单独存品牌。成品 SKU 通过 `skus.product_id` 找到产品，再通过 `products.brand_id` 找到品牌。

BOM、库存、FBA 备货单、生产任务、采购单等业务表不要重复加 `brand_id`。需要显示品牌时，通过 SKU 或产品关联查询即可。

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

### 9.1 大数据量读取防 1000 条截断处理（2026-05-25）

已处理 `/admin/skus` 的 1000 条截断问题：

- `src/lib/api/skus.ts` 新增 `getSkusPage(params)`，使用 `select(..., { count: "exact" })`、`range(from, to)` 和 `sku_code` 排序。
- `/admin/skus` 不再一次性读取全部 SKU，也不再用前端 `slice` 做主列表分页；当前每页读取 100 条。
- SKU 搜索、类型、状态、品牌、所属产品、默认供应商筛选已经放到 Supabase 查询层处理。
- 页面顶部“当前筛选 SKU”显示当前筛选条件下的真实总数；成品/原材料/库存卡片明确为“本页”统计，避免误把当前页当全量数据。
- 批量导入、新增、编辑、启用/停用、删除后会按当前筛选条件重新读取第一页或当前页。

随后已新增统一分批读取工具 `src/lib/supabase/pagination.ts`，凡是系统确实需要读取完整集合、统计引用、导入校验或下拉基础资料的地方，统一用 `range(from, to)` 每批 1000 条循环读取，避免 Supabase 默认单次最多返回 1000 行导致漏数据。

本次已覆盖的高风险读取：

- `/admin/products`：产品列表、产品关联 SKU 统计、产品详情 SKU。
- `/admin/skus`：SKU 主列表服务端分页；旧兼容 `getSkus()`、产品下拉、SKU 库存汇总也改成分批读取。
- `/admin/materials`：辅料列表、库存汇总、引用统计、详情库存/BOM、导入校验。
- `/admin/brands`、`/admin/suppliers`、`/admin/warehouses`：关联产品、采购单、辅料、库存等统计改成分批读取。
- `/inventory/materials`、`/inventory/products`、`/inventory/adjustments`、`/inventory/transactions`：当前库存、可调整库存、SKU 搜索、库存流水改成分批读取。
- `/purchase/orders`：采购单列表和原材料 SKU 选项改成分批读取。
- `/replenishment`、`/production/planning`、`/inventory/fba-outbound`：FBA 备货、可备货 SKU、成品库存、已出库流水、待出库需求改成分批读取。
- `/production/orders`、`/inventory/inbound`：生产任务列表、可入库生产任务、生产领料库存和可用库存计算改成分批读取。
- 批量导入校验：产品、SKU、BOM、基础编码读取改成分批读取。
- `/debug/master-data` 使用的产品、SKU、供应商、仓库读取也改成分批读取。

说明：

- 没有修改 Supabase 后台 API 返回上限。
- 没有使用 `.limit(5000)` 作为解决方案。
- 对“最近 5 条 / 最近 8 条 / 是否存在引用”这类本来就只需要少量数据的查询，仍保留明确的 `.limit()`，这不是 1000 条截断风险。

本次验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- 按用户要求，本次没有自动打开浏览器检查。

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

### 3.8.6 辅料拆表第六阶段：清理旧 material SKU 依赖（2026-05-26）

本次只清理代码依赖，没有删除数据库旧字段，也没有删除 `skus` 里的旧 `sku_type = material` 数据。

已完成：

- `/admin/skus` 改为只管理成品和半成品 SKU，不再展示、新增、编辑或导入旧辅料 SKU；页面提供“辅料管理”入口跳转 `/admin/materials`。
- SKU 批量导入只允许 `finished_good` 和 `semi_finished`；辅料导入继续走 `/admin/materials`。
- 全局搜索里 SKU 搜索只查成品和半成品 SKU；辅料搜索直接读取 `materials` 表，结果分组显示为“辅料”。
- `/debug/master-data` 的辅料区改为读取 `materials` 表。
- BOM 新增和 BOM 批量导入只写 `bom_items.material_id`，不再为新明细写 `component_sku_id`。
- 生产算料生成新物料需求时，优先按 `material_id` 汇总和读取库存；新 BOM 明细生成的新需求不再额外写旧 `material_sku_id`。
- 采购新明细优先写 `purchase_order_items.material_id`；手动采购、批量导入和缺料生成采购单不再为新辅料明细写旧 `sku_id`。
- 新增 `scripts/check-legacy-material-sku-usage.sql`，只输出旧字段仍引用旧辅料 SKU 的清单，不自动删除。
- 新增 `docs/materials-refactor-cleanup-report.md` 作为本阶段清理报告。

保留兼容：

- `bom_items.component_sku_id`、`material_requirements.material_sku_id`、`purchase_order_items.sku_id`、`inventory_items.sku_id`、`inventory_transactions.sku_id` 仍保留历史读取。
- 当前真实 schema 里 `inventory_items.sku_id` 和 `inventory_transactions.sku_id` 仍是必填；在不改 schema 的前提下，辅料库存写入还不能完全停止写旧 `sku_id`。后续要彻底清理库存旧字段，需要单独把库存余额和流水的约束迁到 `material_id`。

验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

### 3.8.7 辅料拆表最终阶段：旧字段和旧 material SKU 删除准备（2026-05-27）

本次完成最终清理脚本和代码适配。由于本地只有 Supabase anon key，没有数据库管理员连接、Supabase CLI 或 `psql`，没有直接在数据库执行备份和删除 SQL。

已完成：

- 新增 `scripts/final-check-before-dropping-legacy-material-fields.sql`，用于删除前检查旧辅料字段是否还有未迁移记录。
- 新增 `scripts/backup-legacy-material-data-before-drop.sql`，会按 `backup_run_id` 备份旧 material SKU、BOM、物料需求、采购、库存和库存流水关键字段。
- 新增 `scripts/drop-legacy-material-fields.sql`，会在检查和备份通过后删除 `bom_items.component_sku_id`、`material_requirements.material_sku_id` 和旧 `skus.sku_type = material` 数据。
- `purchase_order_items.sku_id`、`inventory_items.sku_id`、`inventory_transactions.sku_id` 保留为可兼容历史数据的字段；其中库存和流水 `sku_id` 改为可空，辅料主逻辑使用 `material_id`。
- 代码已清理 BOM、物料需求、采购、Dashboard 和库存页面中的旧辅料 fallback；辅料来源统一读取 `materials`。
- 新增 `docs/materials-refactor-final-report.md`。

数据库执行顺序：

1. 先执行 `scripts/final-check-before-dropping-legacy-material-fields.sql`。
2. 检查结果为 0 后执行 `scripts/backup-legacy-material-data-before-drop.sql`。
3. 备份成功后执行 `scripts/drop-legacy-material-fields.sql`。

如果第一步有任何未迁移记录，必须停止，不要删除。

验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

### 3.8.8 数据读取性能优化第一轮（2026-05-27）

本次重点处理“大列表不要一次性拉全量”的第一轮高风险位置，没有删除文件，没有关闭 RLS。

已完成：

- 新增 `supabase/performance-rpc-and-indexes.sql`，包含性能索引、`pg_trgm` 搜索索引，以及 `get_skus_page`、`get_current_inventory_page`、`get_inventory_transactions_page`、`get_dashboard_summary`、`get_inventory_warning_summary` 等数据库端 RPC。
- `/admin/skus` 改为调用 `get_skus_page`，SKU 搜索、品牌、产品、状态、SKU 类型筛选和库存数量/占用/库存行数汇总由数据库端分页聚合完成；产品选择默认只取前 20 条，并支持输入后 300ms 远程搜索。
- `/inventory/materials`、`/inventory/products`、`/inventory/overview` 使用 `get_current_inventory_page` 读取当前页库存；仓库、SKU 关键词、品牌、库存状态在数据库端筛选，库存状态和汇总卡片由 RPC 计算。
- `/inventory/transactions` 使用 `get_inventory_transactions_page` 读取当前页流水；流水类型、仓库、SKU 关键词、品牌、日期范围在数据库端筛选，流水类型统计由 RPC 返回。
- `/dashboard` 的汇总数字改为调用 `get_dashboard_summary`，不再为了统计缺 BOM、低库存、待入库等数字拉整张业务表到前端计算。
- `/admin/products`、`/admin/suppliers`、`/admin/users` 列表改成服务端分页读取，搜索、状态/品牌/角色筛选进入 Supabase 查询层；关联数量只按当前页 ID 查询。
- 批量导入校验已优化一批大读取：品牌、产品、SKU、供应商、仓库、BOM、FBA 备货、其他入库、其他出库、库存调整等导入校验，改为只查询本次 CSV 出现过的编码或当前导入涉及的库存对象，不再先拉整张基础表。
- 新增通用分页结果类型 `src/lib/api/page-types.ts`，用于统一 `{ rows, total, page, pageSize, totalPages }` 返回结构。

需要在 Supabase 执行：

1. 打开 `supabase/performance-rpc-and-indexes.sql`。
2. 复制到 Supabase SQL Editor 执行。
3. 执行成功后，页面才会有对应 RPC；如果未执行，相关页面会提示需要先执行该 SQL。

本轮仍需继续优化：

- `/bom`、`/admin/materials`、`/admin/brands`、`/admin/warehouses`、`/purchase/orders`、`/production/planning`、`/production/orders`、`/replenishment`、`/materials/requirements` 的主列表还需要继续第二轮改成完整服务端分页。
- 部分业务创建弹窗里的 SKU / 辅料 / 供应商 / 仓库选择器还需要继续统一成远程搜索组件。
- 旧的 `fetchAllSupabaseRows` 仍保留给详情、引用检查、少量基础字典和还未改完的列表；后续继续按模块收敛。

验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。
- `npm run lint` 当前会进入 Next.js 15 的交互式 ESLint 配置提示，没有直接完成检查；本次未擅自选择 Strict/Base 生成配置。

### 3.8.9 数据读取性能优化第二轮：基础资料 + BOM（2026-05-27）

本轮只处理基础资料和 BOM，没有改采购、生产、备货、物料需求这些业务单据页面。

已完成：

- 新增 `supabase/performance-rpc-round-2-base-data.sql`，包含第二轮索引，以及 `get_materials_page`、`get_brands_page`、`get_warehouses_page`、`get_bom_page` 四个分页 RPC。
- `/admin/materials` 改为调用 `get_materials_page`，辅料列表不再读取整张 `materials` 后前端筛选分页；关键词、分类、供应商、状态在数据库端筛选，库存数量、BOM 引用、物料需求引用、采购引用由数据库端聚合后返回当前页。
- `/admin/brands` 改为调用 `get_brands_page`，品牌列表不再整表读取；关键词和状态在数据库端筛选，关联产品数由数据库端统计。
- `/admin/warehouses` 改为调用 `get_warehouses_page`，仓库列表不再整表读取；关键词、仓库类型、状态在数据库端筛选，当前库存 SKU 数和库存总数由数据库端聚合。
- `/bom` 改为调用 `get_bom_page`，BOM 主列表只读当前页摘要字段；BOM 明细仍只在打开详情或添加辅料时按 `bom_header_id` 单独读取。
- BOM 创建时的成品 SKU 选择、BOM 明细辅料选择、辅料管理里的供应商选择改为默认前 20 条，并支持输入后 300ms 远程搜索。
- 品牌下拉新增 `searchBrandOptions`，默认只返回前 20 条必要字段；原 `getBrandOptions` 改为复用该远程搜索能力。
- 仓库下拉新增 `searchWarehouseOptions`，默认只返回前 20 条启用仓库必要字段。
- 辅料批量导入校验改为只查询本次 CSV 里的辅料编码和供应商编码，不再为了校验编码读取整张 `materials` 或 `suppliers`。
- BOM 旧的 `getBomList`、`getFinishedGoodSkus`、`getBomMaterials` 已改为走分页或远程搜索兜底，不再在 BOM 页面触发全量读取。

需要在 Supabase 执行：

1. 打开 `supabase/performance-rpc-round-2-base-data.sql`。
2. 复制到 Supabase SQL Editor 执行。
3. 执行成功后，第二轮页面才会有对应 RPC；如果未执行，相关页面会提示找不到函数。

保留说明：

- `src/lib/api/materials.ts` 里详情、引用统计、采购记录读取仍保留 `fetchAllSupabaseRows`，因为它们只在打开单个辅料详情或做删除保护时按指定 ID 查询，不是主列表首次加载。
- `src/lib/api/warehouses.ts` 里仓库库存详情仍保留 `fetchAllSupabaseRows`，因为它只在点击某个仓库查看库存时按仓库 ID 查询。
- `src/lib/api/brands.ts` 和 `src/lib/api/warehouses.ts` 里的旧 `getBrands`、`getWarehouses` 仍暂时保留给未纳入本轮的旧调用；本轮页面已改用新的分页接口。
- 真实 `warehouses` 表没有 `contact_name` 和 `phone` 字段，所以仓库关键词搜索按真实字段支持 `warehouse_code`、`name`、`address`，没有凭空新增字段。
- 真实 `bom_items` 表当前以 `material_id` 为主，没有 `component_sku_id` 字段，所以第二轮索引新增了 `bom_items(material_id)`，没有创建不存在字段的索引。

验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

### 3.8.10 数据读取性能优化第三轮：业务单据主列表（2026-05-27）

本轮只处理业务单据主列表，没有继续改基础资料、BOM、SKU、当前库存、库存流水、权限或登录。

已完成：

- 新增 `supabase/performance-rpc-round-3-business-lists.sql`，包含第三轮业务列表索引，以及 `get_purchase_orders_page`、`get_production_orders_page`、`get_production_planning_page`、`get_replenishment_requests_page`、`get_material_requirements_page` 五个分页 RPC。
- `/purchase/orders` 改为调用 `getPurchaseOrdersPage`，采购单主列表不再读取全部 `purchase_orders`；关键词、状态、供应商筛选在数据库端处理，列表只返回采购单摘要、供应商、仓库、明细条数和数量汇总。采购明细仍在打开详情、编辑、图片导出或入库时按采购单 ID 加载。
- `/production/orders` 改为调用 `getProductionOrdersPage`，生产单主列表不再读取全部 `production_orders`；关键词、状态、品牌、物料状态筛选在数据库端处理，列表返回当前页生产任务摘要、SKU、产品、品牌、物料状态和入库/领料摘要。
- `/production/planning` 改为调用 `getProductionPlanningPage`，排产列表不再一次性读取全部待排产备货需求；关键词、状态、优先级、品牌筛选在数据库端处理，默认只看已提交和已接单的排产范围。
- `/replenishment` 改为调用 `getReplenishmentRequestsPage`，FBA 备货主列表不再读取全部备货单；关键词、状态、品牌筛选在数据库端处理，列表只返回当前页备货单摘要、SKU、产品、品牌、目标仓库和数量汇总。
- `/materials/requirements` 改为调用 `getMaterialRequirementsPage`，物料需求列表不再读取全部 `material_requirements` 后前端筛选；关键词和状态在数据库端处理。
- 采购单供应商选择、采购单辅料选择、备货单仓库选择、备货单 SKU 添加弹窗改为默认前 20 条，并支持输入后 300ms 远程搜索，不再为了一个下拉框读取整张基础资料表。

需要在 Supabase 执行：

1. 打开 `supabase/performance-rpc-round-3-business-lists.sql`。
2. 复制到 Supabase SQL Editor 执行。
3. 执行成功后，第三轮业务列表页面才会有对应 RPC；如果未执行，页面会提示找不到函数。

保留说明：

- `src/lib/api/purchase.ts` 里的旧 `getPurchaseOrders` 暂时保留给详情、导出或未迁移兼容入口；本轮 `/purchase/orders` 主列表已改用 `getPurchaseOrdersPage`。
- `src/lib/api/production.ts` 里的旧 `getProductionPlanningRequests`、`getProductionOrders` 暂时保留给兼容入口；本轮 `/production/planning` 和 `/production/orders` 主列表已改用分页 RPC。
- `src/lib/api/replenishment.ts` 里的旧 `getReplenishmentRequests` 暂时保留给可能的兼容入口；本轮 `/replenishment` 主列表已改用分页 RPC。
- 生产领料预览、库存扣减、采购缺料清单等操作型读取仍保留原逻辑，因为它们不是本轮“业务单据主列表首次加载”的范围；如果数据继续增大，建议第四轮按操作场景继续拆分为远程搜索或 RPC。

验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

### 3.8.11 数据读取性能优化第四轮收尾（2026-05-27）

本轮只做性能收尾，没有重做 UI，也没有大范围业务重构。

已完成：

- 审计剩余 `fetchAllSupabaseRows`。主列表已迁移过的旧函数统一加 `@deprecated` 注释，提醒后续不要再拿它们做页面主列表。
- 品牌、仓库、供应商统计改成数据库 `count` 或当前需要字段查询，不再为了统计数量读取整张基础资料表。
- 首页异常统计中“停用供应商仍被辅料引用”“成品 SKU 缺启用 BOM”“已接单 FBA 未创建生产任务”改为小 RPC，避免前端拉 ID 列表再对比。
- 产品批量导入的品牌校验改成只查本次 CSV 出现过的品牌编码/名称，不再读取全部品牌。
- 其他入库、其他出库、库存调整里的 SKU 选择器改成默认前 20 条；输入 SKU 关键词后 300ms 远程搜索成品 SKU 和辅料。
- `getInventoryItemByWarehouseAndSku` 改为按当前选择的 SKU/辅料 ID 查询，不再先加载整套库存 SKU 选项。
- 入库和出库页面的仓库选择改成默认前 20 条启用仓库，避免初始化读取全量仓库。

本轮新增 SQL：

- `supabase/performance-rpc-round-4-cleanup.sql`

需要在 Supabase 执行：

1. 打开 `supabase/performance-rpc-round-4-cleanup.sql`。
2. 复制到 Supabase SQL Editor 执行。
3. 执行成功后，首页第四轮新增的三个统计 RPC 才能正常使用。

保留说明：

- `src/lib/api/brands.ts`、`products.ts`、`skus.ts`、`materials.ts`、`suppliers.ts`、`warehouses.ts`、`purchase.ts`、`production.ts`、`replenishment.ts`、`master-data.ts` 里的旧全量函数已标记废弃，保留给 `/debug/master-data`、过渡页或旧兼容入口；主业务列表不要再使用。
- `src/lib/api/materials.ts` 的辅料详情、采购记录、库存汇总、引用统计按辅料 ID 或当前页 ID 限制范围查询，保留 `fetchAllSupabaseRows`；风险是单个辅料历史记录极多时仍会读取较多，后续可单独给详情弹窗加分页。
- `src/lib/api/warehouses.ts` 的仓库库存详情按单个仓库 ID 查询，保留 `fetchAllSupabaseRows`；风险是单仓库存 SKU 极多时详情弹窗可继续分页。
- `src/lib/api/suppliers.ts` 的供应商关联采购单和默认辅料按单个供应商 ID 查询，保留 `fetchAllSupabaseRows`；风险是单个供应商历史采购很多时详情弹窗可继续分页。
- `src/lib/api/production.ts` 的领料预览、BOM 算料、生产单旧兼容读取属于操作型流程或旧入口；已按物料 ID、BOM ID 或生产单关联范围限制，后续如果单据明细极大再拆 RPC。
- `src/lib/api/inventory.ts` 的库存流水旧兼容函数、可入库/可出库队列、FBA 出库数量统计仍保留；主库存列表和流水列表已走分页 RPC，操作队列后续可按页面分页继续优化。
- `src/lib/api/bulk-management.ts` 的 `getRowsByIds` 只按当前勾选 ID 读取，用于批量操作回显，不是整表读取。

验证：

- 已运行 `npm run typecheck`，通过。
- `npm run build` 等本轮最终验证结果见本次收尾输出。

### 3.9 渐进式 UI/UX 重构第一阶段（2026-05-28）

本轮只做前端外壳和公共组件，不改 Supabase 表结构，不改业务 API，不重写业务查询逻辑。

已完成：

- 全局后台外壳改为紧凑 ERP 风格：左侧固定 Sidebar、顶部 56px Header、主内容区使用浅灰背景和 16px/20px 级别间距。
- Sidebar 顶部只显示 Supabase Storage 里的 EMK logo，不再显示旧文字品牌、默认图标或介绍文案。
- Sidebar 支持 240px 展开和 64px 折叠；菜单按“核心 / 业务 / 基础 / 系统”整理。
- Header 增加折叠按钮、面包屑、全局搜索、通知、用户头像和用户名称；不再放大标题或系统介绍。
- 新增/升级公共组件：`PageHeader`、`SearchFilterBar`、`DataTable`、`RowActions`、`DetailDrawer`、`DrawerForm`、`StatusBadge`、`InfoCell`、`ImageCell`、`EllipsisText`。
- 全局样式统一为 `#F8FAFC` 背景、白色卡片、`#0F172A` 主文字、`#64748B` 次要文字、`#E2E8F0` 边框、`#2563EB` 主按钮。
- 表格、按钮、输入框统一压缩到更适合高频操作的密度：表格 13px、表头 12px、按钮/输入框约 32px-36px。
- 前端界面范围内清理旧系统介绍和旧品牌文案，例如“FBA 备货生产管理系统”“FBA 备货需求”等页面展示文案。
- 新增 `/data-dashboard` 和 `/ai-assistant` 轻量占位页，避免新菜单点击后直接 404；具体业务内容留到后续阶段接入。

本轮 logo 引用：

- `https://wrxqiaphfxihjclqnged.supabase.co/storage/v1/object/public/public-assets/emk_logo.png`

验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

后续建议：

- 第二阶段再逐步把备货、生产、采购、库存等页面的旧表格和筛选区套到新公共组件上。
- `/data-dashboard` 和 `/ai-assistant` 当前只是占位页，后续需要按真实业务逐步接入数据和功能。

### 3.10 渐进式 UI/UX 重构第二阶段：首页 / 工作台（2026-05-28）

本轮把 `/dashboard` 从偏 Dashboard 展示继续改成实际 ERP 工作台，没有修改数据库结构，没有关闭 RLS，也没有改业务写入逻辑。

已完成：

- 首页继续复用第一阶段的 `PageHeader`、`DataTable`、`StatusBadge`、`DetailDrawer` 和统一后台外壳。
- 顶部改为 4 个固定快照卡片：待排产、生产中、待采购、库存预警。卡片统一尺寸，窄屏自动换行。
- 删除旧首页的大图表、业务趋势、花哨分析卡片和大面积介绍文字，不再展示“跨境电商工贸一体管理系统”“备货、生产、采购、库存协同”等旧首页文案。
- KPI 下方新增通栏阻断性预警 Banner，按库存预警、交期延误、采购延迟组合统计，右侧提供“立即处理”入口。
- 中间新增 4 列核心业务管道：运营待办、厂长排产、采购跟踪、仓库收发。每个管道项可点击，优先打开右侧详情抽屉，抽屉内展示对应的前 5 条真实业务记录，并提供“查看全部”跳转。
- 底部保留紧凑三列表：最近备货单、最近生产任务、最近采购单，每块最多 5 行，字段控制为单号、状态、日期，点击单号跳转到对应业务页面。
- 响应式规则：1366px 下保持无页面横向滚动；宽度不足时 KPI、四列管道、最近列表会自动变成两列或一列。

数据来源：

- 快照和管道统计仍基于现有 `get_dashboard_summary` RPC 和当前真实状态字段。
- 待排产读取 `fba_replenishment_requests.status in ('submitted', 'accepted')`。
- 生产中读取 `production_orders.status = 'in_progress'`。
- 待采购组合缺料 `material_requirements.status = 'shortage'` 和未下单采购 `purchase_orders.status = 'draft'`。
- 库存预警组合低库存辅料和成品库存异常，继续沿用 `inventory_items.quantity_on_hand - reserved_quantity` 与 `safety_stock_quantity` 的当前判断。
- 最近业务列表分别读取备货单、生产任务、采购单现有表，每块只取首页需要的 5 行。

本次修改文件：

- `src/lib/api/dashboard.ts`
- `src/app/(app)/dashboard/page.tsx`
- `src/app/globals.css`
- `PROJECT_NOTES.md`

验证：

- 已运行 `npm run typecheck`，通过。
- 已运行 `npm run build`，通过。

### 3.11 渐进式 UI/UX 重构第三阶段：备货需求 / 厂长排产（2026-05-28）

本轮只重构两个核心业务页面，没有修改 Supabase 数据库 schema，没有关闭 RLS，没有改 seed。

已完成：

- `/replenishment` 改为“总单聚合模式”：列表一行代表一张备货单，不再把所有 SKU 明细铺在主列表。
- 备货需求页复用第一阶段公共组件：`PageHeader`、`SearchFilterBar`、`DataTable`、`DetailDrawer`、`DrawerForm`、`StatusBadge`、`RowActions`、`InfoCell`、`ImageCell`、`EllipsisText`。
- 备货需求列表字段压缩为：备货单号、平台、产品/SKU 汇总、SKU数/总数量、运营、计划发货、状态、操作；备注、创建时间、库存和缺口等细节移入详情抽屉。
- 备货单详情改为 `DetailDrawer`，展示基本信息和 SKU 明细；SKU 明细展示产品信息、SKU、需求数量、当前成品库存、预计可生产、缺口和备注。
- 新增备货单改为 `DrawerForm`，保留原有 `createFbaReplenishmentDocument` 写入逻辑；明细仍支持 SKU 搜索添加、数量/备注编辑、删除行、CSV 上传预览和错误行提示。
- `/production/planning` 改为“待排产池 + 排产汇总/规则建议”布局，主表一行代表一张备货单，厂长可勾选整张备货单后合并生成生产任务。
- 厂长排产页复用公共组件：`PageHeader`、`SearchFilterBar`、`DataTable`、`DrawerForm`、`DetailDrawer`、`StatusBadge`、`RowActions`、`InfoCell`、`EllipsisText`。
- 待排产池列表字段压缩为：选择框、备货单号、产品/SKU 汇总、总数量、交期、缺料状态、建议优先级、操作。
- 新增轻量缺料预估读取：基于现有 BOM、`inventory_items.quantity_on_hand - reserved_quantity` 计算当前页备货单的齐料/缺料提示，只读查询，不新增字段。
- 缺料标签支持 hover 查看前几条缺料明细，更多明细继续引导到物料需求页面。
- 右侧汇总展示已选单据数、合计 SKU、合计数量、预计工时、缺料 SKU 数、缺料物料项、齐料 SKU 数，以及高/中/低优先级分布和排产建议。
- 合并生成生产任务改为 `DrawerForm`，要求计划开始日期和负责人必填，展示已选单据和合并后预估。

业务逻辑说明：

- 新增备货单仍复用 `createFbaReplenishmentDocument`，继续写 `fba_replenishment_requests` 主表和 `fba_replenishment_request_items` 明细表。
- 单张备货单生成生产任务仍复用原 `createProductionOrder`。
- 多张备货单合并生成生产任务新增 `createMergedProductionOrder` 薄封装，仍写现有 `production_orders`、`production_order_items`，并复用现有 BOM 自动生成 `material_requirements` 的规则；受当前 schema 限制，生产任务主表仍只能挂一个主来源备货单，其他来源会通过生产任务明细和备注保留。
- 本轮没有实现编辑备货单的写入逻辑；原阶段禁用的编辑入口仍保持禁用，没有删除。

验证：

- 已运行 `npm run typecheck`，通过。
- `npm run build` 等本轮最终验证结果见本次收尾输出。

### 3.12 渐进式 UI/UX 重构第四阶段：采购管理 / 库存管理（2026-05-28）

本轮只处理采购和库存相关页面，没有修改 Supabase schema、RLS 或 seed，没有重写现有采购、入库、库存调整、库存流水的写入逻辑。

已完成：

- `/purchase/orders` 采购单页改为第一阶段公共组件风格：`PageHeader`、`SearchFilterBar`、`DataTable`、`DetailDrawer`、`StatusBadge`、`RowActions`、`InfoCell`。
- 采购单主列表压缩为：采购单号、供应商信息、物料数量、采购金额、交期、状态、创建时间、操作；采购负责人、来源、备注、明细等信息移入详情抽屉或更多操作。
- 采购单详情改为右侧 `DetailDrawer`，展示供应商信息、基本信息、采购明细、已到货数量、金额汇总，并保留导出采购单、导出图片、状态更新和跳转采购入库入口。
- 新增采购单、缺料生成采购单、批量导入、CSV 导出和 PNG 图片导出继续沿用原页面逻辑；没有改采购单写入 API。
- `/inventory/inbound?tab=purchase` 采购入库页增加统一 `PageHeader`、`SearchFilterBar` 和 `DataTable`，保留原 `receivePurchaseOrderItems` 入库写入逻辑。
- `/inventory/materials` 和 `/inventory/products` 当前库存页改为统一 `PageHeader`、`SearchFilterBar`、统计卡片、`DataTable` 和 `DetailDrawer`；列表字段压缩为物料/产品信息、仓库、当前库存、可用库存、安全库存、安全状态、最近变动、操作。
- 原材料库存安全状态显示“充足 / 偏低 / 预警”，并加轻量安全库存进度条；库存调整入口继续跳转到现有 `/inventory/adjustments`。
- 成品库存产品信息复用 `InfoCell`，可读取产品图片字段 `products.product_image_url`；图片字段只做读取展示，没有新增字段。
- `/inventory/transactions` 库存流水页改为统一 `PageHeader`、`SearchFilterBar`、`DataTable` 和 `DetailDrawer`；备注、单位、操作人等细节放入抽屉，数量变化按入库绿色、出库红色、调整蓝色展示。
- 新增 `/inventory/warnings` 库存预警页，并把导航里的“库存预警”指向该页面；页面读取现有当前库存分页 RPC，按当前库存、安全库存和仓库筛选展示预警列表。

验证：

- 已运行 `npm run typecheck`，通过。首次运行时 `.next/types` 本地缓存存在重复 `* 2.ts` 文件导致报错；运行 `npm run build` 后 Next 重新整理缓存，再次 `npm run typecheck` 通过。
- 已运行 `npm run build`，通过。
- 已运行 `git diff --check`，通过结果见本次收尾输出。

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
