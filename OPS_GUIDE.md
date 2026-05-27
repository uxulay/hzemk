# 基础运维文档

本文档给不熟悉运维的人使用，用来说明这个系统现在如何部署、如何启动、如何检查，以及服务器坏了以后怎么恢复。

请注意：

- 不要把真实密码、数据库密码、Token、Service Role Key 写进本文档。
- 本项目生产环境不再部署在 Vercel。
- 本项目生产环境运行在自有云服务器上。
- Supabase PostgreSQL 和 Supabase Storage 使用的是阿里云上的 Supabase。
- 本文档不会记录服务器密码、Supabase key 真实值或任何敏感信息。

## 1. 当前项目部署结构

当前生产环境可以理解为下面这条链路：

```text
用户浏览器
  -> Cloudflare 域名 / CDN / HTTPS
  -> 自有云服务器 Nginx
  -> Next.js 服务
  -> 阿里云 Supabase PostgreSQL
  -> 阿里云 Supabase Storage
```

各部分职责：

- GitHub：保存项目代码。
- 自有云服务器：运行 Next.js 项目，也就是系统本身。
- Next.js + TypeScript：前端页面和项目逻辑。
- 阿里云 Supabase PostgreSQL：保存业务数据，例如备货单、生产单、采购单、库存等。
- 阿里云 Supabase Storage：保存上传的文件或图片。
- Cloudflare：负责域名解析、CDN、HTTPS 入口。
- Nginx：服务器上的入口，把外部访问转发给 Next.js。
- PM2：让 Next.js 服务在服务器上长期运行，并方便重启和查看日志。

当前服务器真实部署信息：

| 项目 | 当前值 |
| --- | --- |
| 服务器系统 | Ubuntu 22.04 |
| 登录方式 | SSH 登录服务器 |
| 常用登录用户 | `root`，后续可以再优化为普通用户 |
| 项目部署目录 | `/var/www/项目名` |
| Web 服务 | Nginx |
| Node.js 版本 | Node.js 20 |
| 包管理器 | pnpm |
| 进程管理 | PM2 |
| PM2 应用名称 | `factory-app` |
| Next.js 默认端口 | `3000` |
| Nginx 反向代理 | 公网 `80` 端口代理到 `127.0.0.1:3000` |
| 环境变量文件 | 项目根目录下的 `.env.local` |
| 数据库 | 阿里云上的 Supabase PostgreSQL |
| 文件存储 | 阿里云上的 Supabase Storage |
| 域名解析 | Cloudflare |

## 2. 服务器需要安装的基础环境

当前服务器基础环境：

- Node.js 20：运行 Next.js 项目。
- pnpm：安装依赖和执行项目命令。
- Git：用来从 GitHub 拉取代码。
- PM2：用来管理 Next.js 服务。
- Nginx：用来做反向代理。
- curl、wget、unzip：常用下载和解压工具。
- ufw 或云服务器安全组：用来控制开放端口。

当前服务器是 Ubuntu 22.04，常用初始化命令如下：

```bash
# 查看系统版本
lsb_release -a

# 更新系统
apt update && apt upgrade -y

# 安装基础工具和 Nginx
apt install -y curl wget git unzip nginx

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# 查看 Node.js 和 npm 版本
node -v
npm -v

# 全局安装 pnpm 和 PM2
npm install -g pnpm pm2

# 查看 pnpm 和 PM2 是否安装成功
pnpm -v
pm2 -v
```

说明：

- 当前常用登录用户是 `root`，所以示例命令没有写 `sudo`。
- 后续如果改成普通用户登录，部分命令需要加 `sudo`。
- 服务器安全组需要放行 SSH 端口、80 端口和 443 端口；3000 端口通常不需要直接对公网开放。

## 2.1 当前服务器初始化流程

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

然后配置 Nginx，把公网 `80` 端口反向代理到：

```text
http://127.0.0.1:3000
```

## 3. .env 环境变量说明

项目需要在服务器项目目录里创建 `.env.local` 文件。

创建方式：

```bash
cd /var/www/项目名
nano .env.local
```

当前项目已使用的变量：

```bash
NEXT_PUBLIC_SUPABASE_URL="https://你的-supabase-项目地址"
NEXT_PUBLIC_SUPABASE_ANON_KEY="你的-supabase-anon-key"
```

说明：

- `NEXT_PUBLIC_SUPABASE_URL`：阿里云 Supabase 项目的访问地址。
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`：Supabase 的 anon key，用于前端访问受 RLS 规则保护的数据。

安全提醒：

- 不要把真实 `.env.local` 提交到 GitHub。
- 不要把数据库密码写进 README 或 OPS_GUIDE。
- 不要把 Supabase Service Role Key 放到前端变量里。
- `NEXT_PUBLIC_` 开头的变量会被浏览器看到，所以只能放允许公开使用的 anon key。

## 4. 如何从 GitHub 拉取代码

第一次部署时：

```bash
cd /var/www
git clone https://github.com/你的组织或账号/你的仓库名.git 项目名
cd 项目名
```

如果服务器上已经有项目，以后更新代码：

```bash
cd /var/www/项目名
git pull
```

建议生产环境固定使用一个明确分支，例如 `main`：

```bash
git branch
git checkout main
git pull origin main
```

## 5. 如何安装依赖、构建、启动项目

进入项目目录：

```bash
cd /var/www/项目名
```

安装依赖：

```bash
pnpm install
```

检查 TypeScript：

```bash
pnpm typecheck
```

构建生产版本：

```bash
pnpm build
```

临时启动项目：

```bash
pnpm start
```

默认情况下，Next.js 会监听：

```text
http://localhost:3000
```

如果需要指定端口：

```bash
pnpm start -- -p 3000
```

生产环境建议用 PM2 启动，不建议一直手动执行 `pnpm start`。

## 6. 如何使用 PM2 管理 Next.js 服务

第一次用 PM2 启动：

```bash
cd /var/www/项目名
pm2 start "pnpm start" --name factory-app
```

查看服务状态：

```bash
pm2 list
```

查看日志：

```bash
pm2 logs factory-app
```

重启服务：

```bash
pm2 restart factory-app
```

停止服务：

```bash
pm2 stop factory-app
```

删除 PM2 服务记录：

```bash
pm2 delete factory-app
```

保存 PM2 当前服务列表，方便服务器重启后恢复：

```bash
pm2 save
```

设置开机自启：

```bash
pm2 startup
```

执行 `pm2 startup` 后，PM2 通常会输出一行需要复制执行的命令。按它提示的命令再执行一次，然后运行：

```bash
pm2 save
```

重新构建并重启：

```bash
cd /var/www/项目名
git pull
pnpm install
pnpm build
pm2 restart factory-app
```

## 7. 如何配置 Nginx 反向代理

Nginx 的作用是：外部用户访问域名时，Nginx 把请求转给本机的 Next.js 服务。

当前方式是公网 `80` 端口代理到 `127.0.0.1:3000`。

示例配置：

```nginx
server {
    listen 80;
    server_name example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

把 `example.com` 换成真实域名。

保存后检查 Nginx 配置：

```bash
nginx -t
```

重启 Nginx：

```bash
systemctl restart nginx
```

如果使用宝塔、1Panel 等服务器面板，也可以在面板里创建网站，然后把反向代理目标设置为：

```text
http://127.0.0.1:3000
```

## 8. 如何配合 Cloudflare 使用域名和 HTTPS

Cloudflare 建议设置：

- DNS 里添加 `A` 记录，指向自有云服务器公网 IP。
- 小云朵可以开启代理，让流量先经过 Cloudflare。
- SSL/TLS 模式建议使用 `Full` 或 `Full (strict)`。
- 如果服务器本身没有证书，可以先用 Cloudflare 的 HTTPS 入口；更稳妥的方式是在服务器 Nginx 也配置证书。

简单流程：

1. 在 Cloudflare 添加域名。
2. 把域名 DNS 指到自有服务器 IP。
3. 确认 Cloudflare DNS 记录生效。
4. Nginx 配好对应域名。
5. PM2 确认 Next.js 服务在 3000 端口运行。
6. 浏览器访问 `https://你的域名`。

常见注意点：

- Cloudflare 指向的是服务器公网 IP，不是 Supabase 地址。
- Supabase 地址只写在 `.env.local` 里。
- 如果出现重定向或 HTTPS 异常，先检查 Cloudflare SSL/TLS 模式和 Nginx 配置。

## 9. 如何检查服务状态

检查 PM2：

```bash
pm2 list
```

检查 Next.js 日志：

```bash
pm2 logs factory-app
```

检查端口是否监听：

```bash
ss -lntp | grep 3000
```

检查 Nginx：

```bash
systemctl status nginx
nginx -t
```

本机测试 Next.js：

```bash
curl http://localhost:3000
```

查看公网是否走 Nginx：

```text
浏览器访问 http://服务器公网IP
```

测试域名：

```bash
curl -I https://你的域名
```

检查磁盘：

```bash
df -h
```

检查内存：

```bash
free -h
```

## 10. 常见故障处理流程

### 页面打不开

按顺序检查：

```bash
pm2 list
pm2 logs factory-app
systemctl status nginx
nginx -t
curl http://localhost:3000
```

如果 `curl http://localhost:3000` 正常，但域名打不开，重点检查 Nginx、Cloudflare、服务器安全组。

如果本机 3000 都打不开，重点检查 PM2 和 Next.js 日志。

### 页面提示 Supabase 环境变量没有配置

检查服务器项目目录下是否有 `.env.local`：

```bash
cd /var/www/项目名
ls -la
```

检查变量名是否正确：

```bash
nano .env.local
```

修改 `.env.local` 后需要重新构建和重启：

```bash
pnpm build
pm2 restart factory-app
```

### 构建失败

先看错误信息，然后按顺序执行：

```bash
pnpm install
pnpm typecheck
pnpm build
```

如果是代码类型错误，先不要强行上线，应先修复代码。

如果是依赖安装失败，检查 Node.js 版本、网络、npm 源。

### 数据读取失败

常见原因：

- `.env.local` 里的 Supabase 地址或 anon key 不对。
- Supabase RLS 策略没有允许当前操作。
- 阿里云 Supabase 服务异常。
- 浏览器访问的是旧构建，需要重新构建并重启 PM2。

建议检查：

```bash
pm2 logs factory-app
```

同时在浏览器开发者工具里查看请求报错。

### 修改代码后页面没有变化

生产环境不是保存代码就立刻生效。需要：

```bash
cd /var/www/项目名
git pull
pnpm install
pnpm build
pm2 restart factory-app
```

如果还有缓存问题，可以清理浏览器缓存，或检查 Cloudflare 缓存规则。

## 11. 数据库备份建议

数据库是最重要的数据资产，建议定期备份。

建议策略：

- 每天至少备份一次 PostgreSQL 数据库。
- 每次大版本上线前手动备份一次。
- 每次执行 SQL 脚本前手动备份一次。
- 备份文件不要只放在同一台服务器上，最好另存一份到安全位置。
- 定期做恢复演练，确认备份真的能用。

如果阿里云 Supabase 提供控制台备份功能，优先使用官方备份。

如果需要命令行备份，可以参考 PostgreSQL 的 `pg_dump`，但不要把真实数据库密码写进文档：

```bash
pg_dump "postgresql://用户名:密码@数据库地址:端口/数据库名" > backup.sql
```

恢复示例：

```bash
psql "postgresql://用户名:密码@数据库地址:端口/数据库名" < backup.sql
```

执行备份和恢复前，请先确认连接的是正确数据库，避免把生产数据误覆盖。

## 12. Supabase Storage 文件备份建议

Supabase Storage 里可能保存产品图片、附件或后续业务文件，也需要备份。

建议策略：

- 定期导出 Storage bucket 文件。
- 文件备份和数据库备份放在同一日期目录，方便一起恢复。
- 记录 bucket 名称、文件路径和备份时间。
- 不要只备份数据库而忘记备份 Storage 文件。

如果阿里云 Supabase 控制台支持 Storage 导出，优先使用控制台。

如果后续写脚本备份，建议使用 Supabase 官方 API 或对象存储工具，并把密钥保存在服务器环境变量里，不要写进代码仓库。

## 13. 服务器安全注意事项

基础安全建议：

- 服务器密码要足够复杂，能用 SSH Key 就尽量用 SSH Key。
- 不要把服务器密码、数据库密码、Token 发到聊天软件或写进项目文件。
- 只开放必要端口，通常是 80、443、SSH 端口。
- 数据库不要随便开放公网访问。
- 定期更新服务器系统安全补丁。
- 给重要操作账号设置最小权限。
- GitHub 仓库权限只给需要的人。
- `.env.local` 只放在服务器上，不提交到 GitHub。
- 定期检查 PM2、Nginx、系统登录日志。

查看开放端口示例：

```bash
ufw status
ss -lntp
```

## 14. 新服务器重建项目的恢复流程

如果需要换服务器，可以按这个顺序恢复：

1. 准备新服务器。
2. 安装 Node.js 20、pnpm、Git、Nginx、PM2。
3. 从 GitHub 拉取项目代码。
4. 创建 `.env.local`，填入 Supabase URL 和 anon key。
5. 安装依赖。
6. 运行类型检查和构建。
7. 用 PM2 启动 Next.js，应用名称使用 `factory-app`。
8. 配置 Nginx 反向代理到 `127.0.0.1:3000`。
9. 在 Cloudflare 把域名指向新服务器 IP。
10. 检查 HTTPS 和页面访问。
11. 检查 Supabase 数据读取和 Storage 文件访问。
12. 确认无误后，再停掉旧服务器服务。

可复制命令示例：

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
pnpm typecheck
pnpm build
pm2 start "pnpm start" --name factory-app
pm2 save
pm2 startup
```

## 15. 日常运维检查清单

建议每天或每周按这个清单看一遍：

- PM2 服务是否在线：`pm2 list`
- 最近日志是否有大量报错：`pm2 logs factory-app`
- Nginx 是否正常：`systemctl status nginx`
- 域名是否能访问：浏览器打开生产域名
- Supabase 数据是否能正常读取：进入后台页面查看列表
- 磁盘空间是否够用：`df -h`
- 内存是否正常：`free -h`
- Cloudflare DNS 和 HTTPS 是否正常
- 数据库备份是否按计划生成
- Storage 文件备份是否按计划生成
- 上线前是否已执行 `pnpm typecheck` 和 `pnpm build`
- 改 `.env.local` 后是否重新构建并重启 PM2

最常用的上线更新命令：

```bash
cd /var/www/项目名
git pull
pnpm install
pnpm build
pm2 restart factory-app
```
