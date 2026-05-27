# FBA 备货生产管理系统

这是一个内部使用的跨境电商工贸一体 FBA 备货生产管理系统。

系统主要给运营、厂长、采购、仓库、管理员使用，用来管理 FBA 备货需求、排产、生产任务、BOM、物料需求、采购、入库、出库、库存流水、产品、SKU、仓库等业务。

## 当前生产环境说明

当前项目不再使用 Vercel 作为生产环境部署平台。

当前实际架构：

- 代码托管：GitHub。
- 应用运行：自有云服务器，系统为 Ubuntu 22.04。
- 前端和后端：Next.js + TypeScript，运行在自有服务器上。
- 数据库：阿里云上的 Supabase PostgreSQL。
- 文件存储：阿里云上的 Supabase Storage。
- 域名解析与 CDN / HTTPS 入口：Cloudflare。
- Web 服务：Nginx，公网 80 端口反向代理到 `127.0.0.1:3000`。
- Node.js 版本：Node.js 20。
- 包管理器：pnpm。
- 进程管理：PM2，应用名称为 `factory-app`。
- 项目部署目录：`/var/www/项目名`。
- 登录方式：SSH 登录服务器；当前常用登录用户是 `root`，后续可以再优化为普通用户。
- 环境变量文件：项目根目录下的 `.env.local`。

基础运维、服务器部署、PM2、Nginx、Cloudflare、备份和故障处理请看：

- [OPS_GUIDE.md](./OPS_GUIDE.md)

## 当前主要功能

- 按角色展示后台菜单和待办入口。
- FBA 备货需求创建、列表、状态跟踪和明细管理。
- 厂长排产和生产任务管理。
- BOM 管理和物料需求计算。
- 采购单创建、导入、导出和状态跟踪。
- 采购入库、生产入库、其他入库。
- FBA 出库、其他出库。
- 库存调整、库存流水、原材料库存、成品库存、库存总览。
- 品牌、产品、SKU、辅料、供应商、仓库、用户等基础资料管理。
- Supabase 客户端读取真实业务数据。

## 目录说明

- `src/app`：页面路由。一个文件夹基本对应一个页面地址。
- `src/app/(app)`：后台页面分组，里面的页面共用后台 Layout。
- `src/app/login`：登录页。
- `src/components/layout`：后台框架组件，比如左侧菜单和顶部导航。
- `src/components/auth`：临时 mock 角色逻辑，后面会换成 Supabase 登录。
- `src/components/pages`：通用页面组件，先用来做占位页。
- `src/lib`：菜单、页面文案、Supabase 客户端等基础配置。
- `src/types`：系统里的角色、用户等类型定义。
- `supabase`：数据库 schema、开发策略和相关 SQL 脚本。
- `scripts`：一次性维护或迁移脚本，执行前必须先确认数据库已备份。
- `docs`：阶段性开发说明或迁移报告。
- `OPS_GUIDE.md`：生产环境部署和日常运维说明。

## 页面路由

- `/login`：登录页
- `/dashboard`：后台首页
- `/replenishment`：FBA 备货需求列表
- `/replenishment/new`：创建 FBA 备货需求
- `/production/planning`：厂长排产
- `/production/orders`：生产任务
- `/bom`：BOM 管理
- `/materials/requirements`：物料需求
- `/purchase/orders`：采购单
- `/inventory/materials`：原材料库存
- `/inventory/products`：成品库存
- `/inventory/overview`：库存总览
- `/inventory/transactions`：出入库记录
- `/inventory/inbound`：入库管理
- `/inventory/fba-outbound`：出库管理
- `/inventory/adjustments`：库存调整
- `/admin/users`：用户管理
- `/admin/brands`：品牌管理
- `/admin/products`：产品管理
- `/admin/skus`：SKU 管理
- `/admin/materials`：辅料管理
- `/admin/suppliers`：供应商管理
- `/admin/warehouses`：仓库管理

## 本地开发启动方式

当前电脑环境需要先安装 Node.js 和 pnpm。安装后运行：

```bash
pnpm install
pnpm dev
```

然后打开：

```text
http://localhost:3000
```

## 环境变量

本地开发和服务器生产环境都需要配置 `.env.local`。

当前项目使用：

```bash
NEXT_PUBLIC_SUPABASE_URL="https://你的-supabase-项目地址"
NEXT_PUBLIC_SUPABASE_ANON_KEY="你的-supabase-anon-key"
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL`：阿里云 Supabase 项目的访问地址。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase anon key。

不要把真实密钥、服务器密码、数据库密码、Token、Service Role Key 写入 README、OPS_GUIDE 或提交到 GitHub。

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

## 生产部署入口

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

## 服务器常用维护命令

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

## 后续建议开发方向

1. 接入真实 Supabase Auth 登录，替换当前 mock 角色。
2. 继续完善角色权限和 RLS 策略。
3. 把关键库存写入流程逐步迁移到数据库事务或 RPC，减少中途失败导致的数据不一致风险。
4. 完善 Supabase Storage 文件上传、预览和备份流程。
5. 增加更完整的生产环境监控、数据库备份和恢复演练。
