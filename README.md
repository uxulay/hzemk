# FBA 备货生产管理系统

这是一个内部使用的跨境电商工贸一体 FBA 备货、生产、采购、库存协同管理系统。

本项目不是传统销售订单系统。核心业务入口是 **FBA 备货需求**：运营根据亚马逊 FBA 补货需要提交备货单，厂长接单并安排生产，系统根据 BOM 自动计算物料需求，采购根据缺料创建采购单，仓库处理采购入库、生产入库、出库管理和库存流水。

系统主要给运营、厂长、采购、仓库、管理员使用，用来管理 FBA 备货需求、排产、生产任务、BOM、物料需求、采购、入库、出库、库存流水、产品、SKU、仓库等业务。

> 给下次 Codex 的重点：后续改代码前，请先阅读本文和 `PROJECT_NOTES.md`。README 用来说明当前部署环境和开发注意事项；`PROJECT_NOTES.md` 用来记录页面、数据库和业务进度细节。

---

## 1. 当前真实部署环境

当前项目已经不再使用 Vercel 作为主要部署环境。

### 线上环境现状

- 代码仓库：GitHub `uxulay/hzemk`
- 主分支：`main`
- 前端/服务端运行：自有服务器，系统为 Ubuntu 22.04
- 登录方式：SSH 登录服务器；当前常用登录用户是 `root`，后续可以再优化为普通用户
- 项目部署目录：`/var/www/项目名`
- Web 服务：Nginx，公网 80 端口反向代理到 `127.0.0.1:3000`
- Node.js 版本：Node.js 20
- 包管理器：pnpm
- 进程管理：PM2，应用名称为 `factory-app`
- Next.js 默认运行端口：`3000`
- 环境变量文件：项目根目录下的 `.env.local`
- 数据库和 Supabase 服务：已经迁移到阿里云上的 Supabase 环境
- 文件存储：阿里云上的 Supabase Storage
- 域名解析：Cloudflare
- 静态资源：项目中 logo 等公共资源优先使用 Supabase Storage 的公开 URL，不要依赖本地上传文件

基础运维、服务器部署、PM2、Nginx、Cloudflare、备份和故障处理请看 [OPS_GUIDE.md](./OPS_GUIDE.md)。

### 重要说明

- 不要默认把部署目标写成 Vercel。
- 不要把数据库理解成 Supabase 官方云默认项目。
- 不要在 README、代码注释或提交记录里写入 Supabase Service Role Key、数据库密码、服务器 SSH 信息等敏感信息。
- 线上环境变量以服务器实际配置为准，仓库里只应保留 `.env.example` 这类示例文件。

---

## 2. 技术栈

- Next.js 15
- React 19
- TypeScript
- Supabase JS Client
- Supabase 数据库 / Storage / 后续 Auth
- Cloudflare DNS
- 自有服务器部署

`package.json` 当前主要脚本：

```bash
pnpm dev        # 本地开发
pnpm build      # 构建生产版本
pnpm start      # 启动生产版本
pnpm lint       # 代码检查
pnpm typecheck  # TypeScript 类型检查
```

---

## 3. 环境变量说明

本项目通过 Supabase JS Client 连接 Supabase。至少需要：

```bash
NEXT_PUBLIC_SUPABASE_URL="https://你的-supabase-项目地址"
NEXT_PUBLIC_SUPABASE_ANON_KEY="你的-supabase-anon-key"
```

注意：

- `NEXT_PUBLIC_SUPABASE_URL` 应填写当前阿里云 Supabase 环境的访问地址。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` 应填写当前阿里云 Supabase 环境的 anon key。
- 前端只能使用 anon key。
- 不要把 service role key 暴露给浏览器端代码。
- 不要把真实 `.env` 提交到仓库。

如需新增环境变量，请同步更新 `.env.example`，并在 README 或 `PROJECT_NOTES.md` 里说明用途。

---

## 4. 本地开发启动

当前电脑环境需要先安装 Node.js 和 pnpm。安装后运行：

```bash
pnpm install
pnpm dev
```

然后打开：

```text
http://localhost:3000
```

开发前建议先确认：

1. `.env.local` 已经填入当前阿里云 Supabase 环境变量。
2. 本地能正常访问 Supabase URL。
3. 数据表结构与 `supabase/schema.sql`、迁移记录、`PROJECT_NOTES.md` 中描述一致。

## 常用检查命令

```bash
pnpm typecheck
pnpm build
```

如果要在本机临时以生产方式启动：

```bash
pnpm build
pnpm start
```

## 5. 生产部署入口

生产环境部署在自有云服务器，不使用 Vercel。

当前服务器初始化大致流程：

```bash
apt update && apt upgrade -y
apt install -y curl wget git unzip nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm pm2
cd /var/www
git clone https://github.com/你的组织或账号/你的仓库名.git 项目名
cd 项目名
nano .env.local
pnpm install
pnpm build
pm2 start "pnpm start" --name factory-app
pm2 save
pm2 startup
```

当前服务器常见上线流程是：

```bash
cd /var/www/项目名
git pull
pnpm install
pnpm build
pm2 restart factory-app
```

完整步骤请看 [OPS_GUIDE.md](./OPS_GUIDE.md)。

## 6. 服务器常用维护命令

查看 PM2 状态：

```bash
pm2 list
```

查看项目日志：

```bash
pm2 logs factory-app
```

重启项目：

```bash
pm2 restart factory-app
```

停止项目：

```bash
pm2 stop factory-app
```

重新构建并重启：

```bash
cd /var/www/项目名
git pull
pnpm install
pnpm build
pm2 restart factory-app
```

查看 Nginx 状态：

```bash
systemctl status nginx
```

检查 Nginx 配置：

```bash
nginx -t
```

重启 Nginx：

```bash
systemctl restart nginx
```

本机测试 Next.js：

```bash
curl http://localhost:3000
```

查看公网是否走 Nginx：

```text
浏览器访问 http://服务器公网IP
```

---

## 7. 目录说明

```text
src/app                  页面路由
src/app/(app)            后台页面分组，共用后台 Layout
src/app/login            登录页
src/components           通用组件和业务组件
src/components/layout    后台框架组件，比如侧边栏和顶部区域
src/components/auth      当前模拟角色 / 后续登录相关逻辑
src/lib                  Supabase 客户端、菜单、API、工具函数等
src/types                类型定义
supabase                 数据库 schema、seed、迁移相关文件
scripts                  一次性维护或迁移脚本，执行前必须先确认数据库已备份
docs                     阶段性开发说明或迁移报告
PROJECT_NOTES.md         当前进度、业务逻辑、页面说明和后续开发重点
OPS_GUIDE.md             生产环境部署和日常运维说明
```

---

## 8. 当前主要业务模块

### FBA 备货

- `/replenishment`：FBA 备货需求列表和创建入口
- 创建备货单已改为弹窗方式
- 支持整张备货单、多 SKU 明细、CSV 模板导入
- `/replenishment/new` 当前只是过渡提示页，避免保留两套创建入口

### 生产

- `/production/planning`：厂长排产、接单、拒绝、创建生产任务
- `/production/orders`：生产任务跟踪、确认领料、生产状态和入库进度

### BOM 和物料

- `/bom`：BOM 管理
- `/materials/requirements`：物料需求查询
- `/admin/materials`：独立辅料管理

### 采购

- `/purchase/orders`：采购单管理
- 支持从缺料生成采购单
- 支持采购人员手动创建采购单
- 支持 CSV 批量导入和导出
- 支持采购单图片导出

### 库存

- `/inventory/overview`：库存总览
- `/inventory/inbound`：入库管理，包括采购入库、生产入库、其他入库
- `/inventory/fba-outbound`：出库管理，包括 FBA 出库和其他出库
- `/inventory/transactions`：库存流水
- `/inventory/adjustments`：库存调整
- `/inventory/materials`：原材料库存
- `/inventory/products`：成品库存

### 基础资料 / 后台管理

- `/admin/brands`：品牌管理
- `/admin/products`：产品管理，产品相当于 SPU
- `/admin/skus`：SKU 管理，SKU 是具体规格、米数等细分编码
- `/admin/materials`：辅料管理
- `/admin/suppliers`：供应商管理
- `/admin/warehouses`：仓库管理
- `/admin/users`：用户资料和角色分配，目前不直接创建 Supabase Auth 登录账号

### 调试页

- `/debug/master-data`：Supabase 基础资料读取测试页

这个页面用于排查 Supabase 连接、anon key、RLS、基础资料读取问题。后续不要随便删除。

---

## 9. 业务建模约定

### 产品、SKU、辅料的区别

- 产品管理：成品 SPU，例如某一类音频线产品。
- SKU 管理：成品或原材料的具体编码和规格，例如不同米数、颜色、包装等。
- 辅料管理：已经逐步从旧 SKU 体系拆出到独立 `materials` 表。

### FBA 备货单

- 备货需求按“整张单”处理，不应让厂长逐个 SKU 单独创建生产任务。
- 一张 FBA 备货单可以包含多个产品和多个 SKU 明细。
- 厂长端应该看到产品图、产品信息、不同米数 SKU、数量等关键信息。

### BOM 和生产算料

- 创建生产任务时，系统根据 BOM 自动生成物料需求。
- 新逻辑优先使用 `materials` 和 `material_id`。
- 旧的 `component_sku_id`、`material_sku_id` 等字段暂时保留，用于历史数据兼容和迁移过渡。

### 库存流水

任何会改变库存数量的动作，都应该写库存流水，例如：

- `material_in`：原材料 / 辅料入库
- `material_out`：生产领料扣料
- `product_in`：成品入库
- `product_out`：FBA 出库或其他出库
- `adjustment`：库存调整

不要只改库存余额而不写流水。

---

## 10. UI 和交互约定

- 后台页面应以表格列表为主。
- 新增、编辑、查看详情优先使用弹窗，不要在页面上方堆大段表单。
- 批量导入是高频功能，产品、SKU、BOM、采购、库存等页面应优先保留 CSV 模板导入能力。
- 页面顶部不要保留大段解释文案，避免和表格割裂。
- 侧边栏顶部只保留 logo，不要恢复多余系统标题文字。
- logo 应使用 Supabase Storage 公共 URL，避免因为服务器迁移或本地文件丢失导致图片失效。
- 当前 logo 地址：`https://wrxqiaphfxihjclqnged.supabase.co/storage/v1/object/public/public-assets/emk_logo.png`

---

## 11. 给 Codex 的开发注意事项

后续 Codex 修改代码时，请遵守以下原则：

1. **先读 `PROJECT_NOTES.md`**
   里面记录了已完成页面、数据库字段兼容关系、历史迁移阶段和下一步计划。

2. **不要破坏现有业务链路**
   FBA 备货需求 → 厂长排产 → 生产任务 → BOM 算料 → 物料需求 → 采购单 → 入库 → 生产入库 → 出库 → 库存流水。

3. **不要随意删除旧字段 fallback**
   当前处于辅料拆表和库存结构迁移过程，部分旧字段仍用于兼容历史数据。

4. **不要把页面重新做成大表单堆在顶部**
   用户偏好是：列表优先，新增/编辑/详情弹窗化，批量上传入口明显。

5. **提交前至少检查**

   ```bash
   pnpm typecheck
   pnpm build
   ```

   如果环境暂时无法执行，请在提交说明或回复中明确说明没有执行成功的原因。

6. **涉及数据库时要同步说明**

   如果新增表、字段、索引、RLS 策略或 seed 数据，请同步更新：

   - `supabase/schema.sql`
   - 相关 seed / migration 文件
   - `PROJECT_NOTES.md`
   - 必要时更新 README

7. **不要提交敏感信息**

   禁止提交：

   - `.env.local`
   - Supabase service role key
   - 数据库密码
   - 服务器 SSH 信息
   - Cloudflare Token

---

## 12. 当前后续重点

建议后续优先级：

1. 补齐 Supabase Auth 登录。
2. 做真实用户角色权限和页面访问控制。
3. 完善 RLS 策略，避免上线后前端 anon key 权限过大。
4. 继续优化 FBA 备货单导入、SKU 匹配、产品图展示和父体/子体编码映射。
5. 完成辅料、SKU、库存结构的历史字段迁移和清理。
6. 优化自有服务器部署流程，包括构建、重启、日志、备份和回滚说明。

---

## 13. 维护提醒

- README 只写稳定约定和部署现状。
- 详细开发进度写入 `PROJECT_NOTES.md`。
- 每次完成较大功能后，请更新 `PROJECT_NOTES.md`，让下一次 Codex 能接着做，不要重复推翻已有逻辑。
