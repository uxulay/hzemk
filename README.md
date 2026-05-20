# FBA 备货生产管理系统

这是一个内部使用的跨境电商工贸一体 FBA 备货生产管理系统。第一阶段只做基础结构，不做完整 ERP。

## 当前已完成

- Next.js + TypeScript 项目结构
- 后台 Layout
- 左侧菜单 Sidebar
- 顶部导航 Header
- `/login` 登录页
- `/dashboard` 后台首页
- 各业务模块的预留页面
- mock 当前用户角色，并按角色显示不同菜单
- Supabase 客户端预留入口

## 目录说明

- `src/app`：页面路由。一个文件夹基本对应一个页面地址。
- `src/app/(app)`：后台页面分组，里面的页面共用后台 Layout。
- `src/app/login`：登录页。
- `src/components/layout`：后台框架组件，比如左侧菜单和顶部导航。
- `src/components/auth`：临时 mock 角色逻辑，后面会换成 Supabase 登录。
- `src/components/pages`：通用页面组件，先用来做占位页。
- `src/lib`：菜单、页面文案、Supabase 客户端等基础配置。
- `src/types`：系统里的角色、用户等类型定义。

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
- `/inventory/transactions`：出入库记录
- `/admin/users`：用户管理
- `/admin/products`：产品管理
- `/admin/skus`：SKU 管理

## 启动方式

当前电脑环境需要先安装 npm 或 pnpm。安装后运行：

```bash
npm install
npm run dev
```

然后打开：

```text
http://localhost:3000
```

## 后续建议开发顺序

1. 接入 Supabase 登录，替换 mock 用户。
2. 建基础资料表：用户、角色、产品、SKU、BOM、仓库、库位。
3. 做 FBA 备货单的创建、列表、状态流转。
4. 做厂长排产，把备货单转成生产任务。
5. 根据 BOM 计算物料需求，并检查库存。
6. 缺料生成采购需求或采购单。
7. 做原材料入库、生产扣料、成品入库、FBA 出库。
