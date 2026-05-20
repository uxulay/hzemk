-- Cross-border ecommerce FBA replenishment production management system
-- Basic Supabase/PostgreSQL schema.
-- This system is NOT a traditional sales order system.
-- Internal FBA replenishment demand is stored in fba_replenishment_requests.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.roles is '角色表：保存运营、厂长、采购、仓库、管理员等角色。';
comment on column public.roles.id is '主键 ID。';
comment on column public.roles.code is '角色编码，例如 operations、plant_manager、procurement、warehouse、admin。';
comment on column public.roles.name is '角色中文名称。';
comment on column public.roles.description is '角色说明。';
comment on column public.roles.created_at is '创建时间。';
comment on column public.roles.updated_at is '更新时间。';

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role_id uuid references public.roles(id) on delete set null,
  full_name text not null,
  email text not null unique,
  phone text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is '用户资料表：扩展 Supabase Auth 用户，保存姓名、邮箱、角色和状态。';
comment on column public.profiles.id is '用户 ID，和 auth.users.id 保持一致。';
comment on column public.profiles.role_id is '用户所属角色 ID。';
comment on column public.profiles.full_name is '用户姓名。';
comment on column public.profiles.email is '登录邮箱。';
comment on column public.profiles.phone is '联系电话。';
comment on column public.profiles.status is '账号状态，例如 active、disabled。';
comment on column public.profiles.created_at is '创建时间。';
comment on column public.profiles.updated_at is '更新时间。';

create table public.products (
  id uuid primary key default gen_random_uuid(),
  product_code text not null unique,
  name text not null,
  category text,
  description text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is '产品表：保存产品基础资料，是 SKU、BOM、库存的上层归类。';
comment on column public.products.id is '主键 ID。';
comment on column public.products.product_code is '内部产品编码。';
comment on column public.products.name is '产品名称。';
comment on column public.products.category is '产品分类。';
comment on column public.products.description is '产品说明。';
comment on column public.products.status is '产品状态，例如 active、inactive。';
comment on column public.products.created_at is '创建时间。';
comment on column public.products.updated_at is '更新时间。';

create table public.skus (
  id uuid primary key default gen_random_uuid(),
  product_id uuid references public.products(id) on delete set null,
  sku_code text not null unique,
  sku_name text not null,
  sku_type text not null default 'finished_product',
  amazon_sku text,
  fnsku text,
  unit text not null default 'pcs',
  specs text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.skus is 'SKU 表：保存成品 SKU、原材料 SKU、半成品 SKU。用 sku_type 区分类型。';
comment on column public.skus.id is '主键 ID。';
comment on column public.skus.product_id is '所属产品 ID，原材料可为空。';
comment on column public.skus.sku_code is '内部 SKU 编码。';
comment on column public.skus.sku_name is 'SKU 名称。';
comment on column public.skus.sku_type is 'SKU 类型，例如 finished_product、material、semi_finished。';
comment on column public.skus.amazon_sku is '亚马逊 SKU 或 MSKU。';
comment on column public.skus.fnsku is '亚马逊 FNSKU。';
comment on column public.skus.unit is '单位，例如 pcs、kg、m。';
comment on column public.skus.specs is '规格说明。';
comment on column public.skus.status is '状态，例如 active、inactive。';
comment on column public.skus.created_at is '创建时间。';
comment on column public.skus.updated_at is '更新时间。';

create table public.suppliers (
  id uuid primary key default gen_random_uuid(),
  supplier_code text not null unique,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  status text not null default 'active',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.suppliers is '供应商表：保存采购用的供应商资料。';
comment on column public.suppliers.id is '主键 ID。';
comment on column public.suppliers.supplier_code is '供应商编码。';
comment on column public.suppliers.name is '供应商名称。';
comment on column public.suppliers.contact_name is '联系人。';
comment on column public.suppliers.phone is '联系电话。';
comment on column public.suppliers.email is '邮箱。';
comment on column public.suppliers.address is '地址。';
comment on column public.suppliers.status is '状态，例如 active、inactive。';
comment on column public.suppliers.notes is '备注。';
comment on column public.suppliers.created_at is '创建时间。';
comment on column public.suppliers.updated_at is '更新时间。';

create table public.warehouses (
  id uuid primary key default gen_random_uuid(),
  warehouse_code text not null unique,
  name text not null,
  warehouse_type text not null default 'internal',
  address text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.warehouses is '仓库表：保存原材料仓、成品仓、FBA 备发仓等仓库资料。';
comment on column public.warehouses.id is '主键 ID。';
comment on column public.warehouses.warehouse_code is '仓库编码。';
comment on column public.warehouses.name is '仓库名称。';
comment on column public.warehouses.warehouse_type is '仓库类型，例如 internal、material、finished_product、fba。';
comment on column public.warehouses.address is '仓库地址。';
comment on column public.warehouses.status is '状态，例如 active、inactive。';
comment on column public.warehouses.created_at is '创建时间。';
comment on column public.warehouses.updated_at is '更新时间。';

create table public.bom_headers (
  id uuid primary key default gen_random_uuid(),
  product_sku_id uuid not null references public.skus(id) on delete restrict,
  bom_code text not null unique,
  version text not null default 'v1',
  status text not null default 'active',
  effective_from date,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (product_sku_id, version)
);

comment on table public.bom_headers is 'BOM 主表：一个成品 SKU 对应一个或多个 BOM 版本。';
comment on column public.bom_headers.id is '主键 ID。';
comment on column public.bom_headers.product_sku_id is '成品 SKU ID。';
comment on column public.bom_headers.bom_code is 'BOM 编码。';
comment on column public.bom_headers.version is 'BOM 版本。';
comment on column public.bom_headers.status is 'BOM 状态，例如 active、inactive。';
comment on column public.bom_headers.effective_from is '生效日期。';
comment on column public.bom_headers.notes is '备注。';
comment on column public.bom_headers.created_at is '创建时间。';
comment on column public.bom_headers.updated_at is '更新时间。';

create table public.bom_items (
  id uuid primary key default gen_random_uuid(),
  bom_header_id uuid not null references public.bom_headers(id) on delete cascade,
  component_sku_id uuid not null references public.skus(id) on delete restrict,
  quantity_per numeric(18, 4) not null,
  unit text not null default 'pcs',
  loss_rate numeric(8, 4) not null default 0,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bom_header_id, component_sku_id)
);

comment on table public.bom_items is 'BOM 明细表：记录生产 1 个成品 SKU 需要哪些原材料或半成品。';
comment on column public.bom_items.id is '主键 ID。';
comment on column public.bom_items.bom_header_id is '所属 BOM 主表 ID。';
comment on column public.bom_items.component_sku_id is '组件 SKU ID，通常是原材料或半成品。';
comment on column public.bom_items.quantity_per is '生产 1 个成品需要的用量。';
comment on column public.bom_items.unit is '用量单位。';
comment on column public.bom_items.loss_rate is '损耗率，例如 0.03 表示 3%。';
comment on column public.bom_items.notes is '备注。';
comment on column public.bom_items.created_at is '创建时间。';
comment on column public.bom_items.updated_at is '更新时间。';

create table public.fba_replenishment_requests (
  id uuid primary key default gen_random_uuid(),
  request_no text not null unique,
  requested_by uuid references public.profiles(id) on delete set null,
  sku_id uuid not null references public.skus(id) on delete restrict,
  target_warehouse_id uuid references public.warehouses(id) on delete set null,
  fba_warehouse_code text,
  requested_quantity numeric(18, 4) not null,
  target_ship_date date,
  priority text not null default 'normal',
  status text not null default 'draft',
  accepted_by uuid references public.profiles(id) on delete set null,
  accepted_at timestamptz,
  rejected_reason text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.fba_replenishment_requests is 'FBA 备货需求表：运营发起的内部备货生产需求，不是销售订单。';
comment on column public.fba_replenishment_requests.id is '主键 ID。';
comment on column public.fba_replenishment_requests.request_no is '备货单号。';
comment on column public.fba_replenishment_requests.requested_by is '创建备货需求的运营用户 ID。';
comment on column public.fba_replenishment_requests.sku_id is '需要备货的成品 SKU ID。';
comment on column public.fba_replenishment_requests.target_warehouse_id is '目标仓库 ID，可用于 FBA 备发仓或内部成品仓。';
comment on column public.fba_replenishment_requests.fba_warehouse_code is '亚马逊 FBA 仓库代码。';
comment on column public.fba_replenishment_requests.requested_quantity is '备货数量。';
comment on column public.fba_replenishment_requests.target_ship_date is '希望发往 FBA 的日期。';
comment on column public.fba_replenishment_requests.priority is '优先级，例如 low、normal、high、urgent。';
comment on column public.fba_replenishment_requests.status is '状态：draft、submitted、accepted、rejected、in_production、completed、shipped。';
comment on column public.fba_replenishment_requests.accepted_by is '接单的厂长用户 ID。';
comment on column public.fba_replenishment_requests.accepted_at is '接单时间。';
comment on column public.fba_replenishment_requests.rejected_reason is '拒绝原因。';
comment on column public.fba_replenishment_requests.notes is '备注。';
comment on column public.fba_replenishment_requests.created_at is '创建时间。';
comment on column public.fba_replenishment_requests.updated_at is '更新时间。';

create table public.production_orders (
  id uuid primary key default gen_random_uuid(),
  production_order_no text not null unique,
  replenishment_request_id uuid references public.fba_replenishment_requests(id) on delete set null,
  sku_id uuid not null references public.skus(id) on delete restrict,
  bom_header_id uuid references public.bom_headers(id) on delete set null,
  planned_quantity numeric(18, 4) not null,
  completed_quantity numeric(18, 4) not null default 0,
  planned_start_date date,
  planned_end_date date,
  actual_start_at timestamptz,
  actual_completed_at timestamptz,
  status text not null default 'planned',
  assigned_to uuid references public.profiles(id) on delete set null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.production_orders is '生产任务表：厂长根据 FBA 备货需求创建和安排生产。';
comment on column public.production_orders.id is '主键 ID。';
comment on column public.production_orders.production_order_no is '生产任务单号。';
comment on column public.production_orders.replenishment_request_id is '来源 FBA 备货需求 ID。';
comment on column public.production_orders.sku_id is '需要生产的成品 SKU ID。';
comment on column public.production_orders.bom_header_id is '生产使用的 BOM ID。';
comment on column public.production_orders.planned_quantity is '计划生产数量。';
comment on column public.production_orders.completed_quantity is '已完成数量。';
comment on column public.production_orders.planned_start_date is '计划开工日期。';
comment on column public.production_orders.planned_end_date is '计划完工日期。';
comment on column public.production_orders.actual_start_at is '实际开工时间。';
comment on column public.production_orders.actual_completed_at is '实际完工时间。';
comment on column public.production_orders.status is '状态：planned、material_pending、in_progress、completed、cancelled。';
comment on column public.production_orders.assigned_to is '生产负责人或厂长用户 ID。';
comment on column public.production_orders.notes is '备注。';
comment on column public.production_orders.created_at is '创建时间。';
comment on column public.production_orders.updated_at is '更新时间。';

create table public.material_requirements (
  id uuid primary key default gen_random_uuid(),
  production_order_id uuid not null references public.production_orders(id) on delete cascade,
  replenishment_request_id uuid references public.fba_replenishment_requests(id) on delete set null,
  material_sku_id uuid not null references public.skus(id) on delete restrict,
  required_quantity numeric(18, 4) not null,
  available_quantity numeric(18, 4) not null default 0,
  shortage_quantity numeric(18, 4) not null default 0,
  reserved_quantity numeric(18, 4) not null default 0,
  unit text not null default 'pcs',
  status text not null default 'pending',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (production_order_id, material_sku_id)
);

comment on table public.material_requirements is '物料需求表：根据生产任务和 BOM 计算需要多少原材料，并记录缺料情况。';
comment on column public.material_requirements.id is '主键 ID。';
comment on column public.material_requirements.production_order_id is '来源生产任务 ID。';
comment on column public.material_requirements.replenishment_request_id is '来源 FBA 备货需求 ID，方便追踪。';
comment on column public.material_requirements.material_sku_id is '原材料或半成品 SKU ID。';
comment on column public.material_requirements.required_quantity is '需要数量。';
comment on column public.material_requirements.available_quantity is '计算时可用库存数量。';
comment on column public.material_requirements.shortage_quantity is '缺料数量。';
comment on column public.material_requirements.reserved_quantity is '已预留给生产的数量。';
comment on column public.material_requirements.unit is '单位。';
comment on column public.material_requirements.status is '状态，例如 pending、ready、shortage、purchased、reserved。';
comment on column public.material_requirements.notes is '备注。';
comment on column public.material_requirements.created_at is '创建时间。';
comment on column public.material_requirements.updated_at is '更新时间。';

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  purchase_order_no text not null unique,
  supplier_id uuid references public.suppliers(id) on delete set null,
  warehouse_id uuid references public.warehouses(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  status text not null default 'draft',
  ordered_at timestamptz,
  expected_arrival_date date,
  received_at timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.purchase_orders is '采购单主表：采购根据缺料情况创建采购单。';
comment on column public.purchase_orders.id is '主键 ID。';
comment on column public.purchase_orders.purchase_order_no is '采购单号。';
comment on column public.purchase_orders.supplier_id is '供应商 ID。';
comment on column public.purchase_orders.warehouse_id is '到货入库仓库 ID。';
comment on column public.purchase_orders.created_by is '创建采购单的采购用户 ID。';
comment on column public.purchase_orders.status is '状态：draft、ordered、partially_received、received、cancelled。';
comment on column public.purchase_orders.ordered_at is '下单时间。';
comment on column public.purchase_orders.expected_arrival_date is '预计到货日期。';
comment on column public.purchase_orders.received_at is '全部到货时间。';
comment on column public.purchase_orders.notes is '备注。';
comment on column public.purchase_orders.created_at is '创建时间。';
comment on column public.purchase_orders.updated_at is '更新时间。';

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  sku_id uuid not null references public.skus(id) on delete restrict,
  material_requirement_id uuid references public.material_requirements(id) on delete set null,
  ordered_quantity numeric(18, 4) not null,
  received_quantity numeric(18, 4) not null default 0,
  unit text not null default 'pcs',
  unit_price numeric(18, 4),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.purchase_order_items is '采购单明细表：记录采购单里每个原材料 SKU 的采购数量和到货数量。';
comment on column public.purchase_order_items.id is '主键 ID。';
comment on column public.purchase_order_items.purchase_order_id is '所属采购单 ID。';
comment on column public.purchase_order_items.sku_id is '采购的原材料或半成品 SKU ID。';
comment on column public.purchase_order_items.material_requirement_id is '关联的物料需求 ID，可为空。';
comment on column public.purchase_order_items.ordered_quantity is '采购数量。';
comment on column public.purchase_order_items.received_quantity is '已到货数量。';
comment on column public.purchase_order_items.unit is '单位。';
comment on column public.purchase_order_items.unit_price is '采购单价。';
comment on column public.purchase_order_items.notes is '备注。';
comment on column public.purchase_order_items.created_at is '创建时间。';
comment on column public.purchase_order_items.updated_at is '更新时间。';

create table public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  warehouse_id uuid not null references public.warehouses(id) on delete cascade,
  sku_id uuid not null references public.skus(id) on delete restrict,
  item_type text not null default 'material',
  quantity_on_hand numeric(18, 4) not null default 0,
  reserved_quantity numeric(18, 4) not null default 0,
  safety_stock_quantity numeric(18, 4) not null default 0,
  unit text not null default 'pcs',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (warehouse_id, sku_id)
);

comment on table public.inventory_items is '库存表：保存每个仓库里每个 SKU 当前库存数量。';
comment on column public.inventory_items.id is '主键 ID。';
comment on column public.inventory_items.warehouse_id is '仓库 ID。';
comment on column public.inventory_items.sku_id is '库存 SKU ID。';
comment on column public.inventory_items.item_type is '库存类型，例如 material、semi_finished、finished_product。';
comment on column public.inventory_items.quantity_on_hand is '账面现有库存。';
comment on column public.inventory_items.reserved_quantity is '已被生产或备货占用的数量。';
comment on column public.inventory_items.safety_stock_quantity is '安全库存数量。';
comment on column public.inventory_items.unit is '单位。';
comment on column public.inventory_items.created_at is '创建时间。';
comment on column public.inventory_items.updated_at is '更新时间。';

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  transaction_no text not null unique,
  warehouse_id uuid not null references public.warehouses(id) on delete restrict,
  sku_id uuid not null references public.skus(id) on delete restrict,
  transaction_type text not null,
  quantity numeric(18, 4) not null,
  production_order_id uuid references public.production_orders(id) on delete set null,
  purchase_order_id uuid references public.purchase_orders(id) on delete set null,
  replenishment_request_id uuid references public.fba_replenishment_requests(id) on delete set null,
  operator_id uuid references public.profiles(id) on delete set null,
  occurred_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.inventory_transactions is '出入库流水表：记录原材料入库、原材料领料、成品入库、成品出库和库存调整。';
comment on column public.inventory_transactions.id is '主键 ID。';
comment on column public.inventory_transactions.transaction_no is '库存流水单号。';
comment on column public.inventory_transactions.warehouse_id is '发生库存变化的仓库 ID。';
comment on column public.inventory_transactions.sku_id is '发生库存变化的 SKU ID。';
comment on column public.inventory_transactions.transaction_type is '流水类型：material_in、material_out、product_in、product_out、adjustment。';
comment on column public.inventory_transactions.quantity is '变动数量。入库为正数，出库也先记录正数，由类型判断方向。';
comment on column public.inventory_transactions.production_order_id is '关联生产任务 ID，例如生产领料或成品入库。';
comment on column public.inventory_transactions.purchase_order_id is '关联采购单 ID，例如采购到货入库。';
comment on column public.inventory_transactions.replenishment_request_id is '关联 FBA 备货需求 ID，例如成品发往 FBA。';
comment on column public.inventory_transactions.operator_id is '操作人用户 ID。';
comment on column public.inventory_transactions.occurred_at is '实际发生时间。';
comment on column public.inventory_transactions.notes is '备注。';
comment on column public.inventory_transactions.created_at is '创建时间。';
comment on column public.inventory_transactions.updated_at is '更新时间。';

create index idx_profiles_role_id on public.profiles(role_id);
create index idx_skus_product_id on public.skus(product_id);
create index idx_bom_headers_product_sku_id on public.bom_headers(product_sku_id);
create index idx_bom_items_bom_header_id on public.bom_items(bom_header_id);
create index idx_bom_items_component_sku_id on public.bom_items(component_sku_id);
create index idx_fba_requests_sku_id on public.fba_replenishment_requests(sku_id);
create index idx_fba_requests_status on public.fba_replenishment_requests(status);
create index idx_production_orders_request_id on public.production_orders(replenishment_request_id);
create index idx_production_orders_status on public.production_orders(status);
create index idx_material_requirements_order_id on public.material_requirements(production_order_id);
create index idx_material_requirements_material_sku_id on public.material_requirements(material_sku_id);
create index idx_purchase_orders_supplier_id on public.purchase_orders(supplier_id);
create index idx_purchase_orders_status on public.purchase_orders(status);
create index idx_purchase_order_items_order_id on public.purchase_order_items(purchase_order_id);
create index idx_inventory_items_warehouse_sku on public.inventory_items(warehouse_id, sku_id);
create index idx_inventory_transactions_warehouse_id on public.inventory_transactions(warehouse_id);
create index idx_inventory_transactions_sku_id on public.inventory_transactions(sku_id);
create index idx_inventory_transactions_type on public.inventory_transactions(transaction_type);

create trigger trg_roles_updated_at
before update on public.roles
for each row execute function public.set_updated_at();

create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger trg_products_updated_at
before update on public.products
for each row execute function public.set_updated_at();

create trigger trg_skus_updated_at
before update on public.skus
for each row execute function public.set_updated_at();

create trigger trg_suppliers_updated_at
before update on public.suppliers
for each row execute function public.set_updated_at();

create trigger trg_warehouses_updated_at
before update on public.warehouses
for each row execute function public.set_updated_at();

create trigger trg_bom_headers_updated_at
before update on public.bom_headers
for each row execute function public.set_updated_at();

create trigger trg_bom_items_updated_at
before update on public.bom_items
for each row execute function public.set_updated_at();

create trigger trg_fba_replenishment_requests_updated_at
before update on public.fba_replenishment_requests
for each row execute function public.set_updated_at();

create trigger trg_production_orders_updated_at
before update on public.production_orders
for each row execute function public.set_updated_at();

create trigger trg_material_requirements_updated_at
before update on public.material_requirements
for each row execute function public.set_updated_at();

create trigger trg_purchase_orders_updated_at
before update on public.purchase_orders
for each row execute function public.set_updated_at();

create trigger trg_purchase_order_items_updated_at
before update on public.purchase_order_items
for each row execute function public.set_updated_at();

create trigger trg_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create trigger trg_inventory_transactions_updated_at
before update on public.inventory_transactions
for each row execute function public.set_updated_at();
