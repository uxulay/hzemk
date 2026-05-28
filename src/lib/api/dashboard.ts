import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import type { UserRole } from "@/types/roles";

export type DashboardTone = "neutral" | "info" | "warning" | "danger" | "success";

export type DashboardSummaryCard = {
  id: string;
  label: string;
  value: number;
  href: string;
  tone: DashboardTone;
};

export type DashboardQuickLink = {
  label: string;
  href: string;
};

export type DashboardTodoItem = {
  id: string;
  no: string;
  brand: string;
  title: string;
  quantity: number | null;
  unit: string;
  status: string;
  statusLabel: string;
  dateLabel: string;
  dateValue: string | null;
  href: string;
  actionLabel: string;
};

export type DashboardListSection = {
  id: string;
  eyebrow: string;
  title: string;
  href: string;
  emptyText: string;
  items: DashboardTodoItem[];
};

export type DashboardException = {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: DashboardTone;
};

export type RoleDashboardData = {
  role: UserRole;
  totalTodoCount: number;
  summaryCards: DashboardSummaryCard[];
  quickLinks: DashboardQuickLink[];
  listSections: DashboardListSection[];
  exceptions: DashboardException[];
  workbench: DashboardWorkbenchData;
};

export type DashboardKpiCard = {
  id: string;
  title: string;
  value: number;
  unit: string;
  hint: string;
  href: string;
  tone: DashboardTone;
};

export type DashboardPipelineItem = {
  id: string;
  label: string;
  count: number;
  href: string;
  tone: DashboardTone;
  items: DashboardTodoItem[];
  emptyText: string;
};

export type DashboardPipelineSection = {
  id: string;
  title: string;
  items: DashboardPipelineItem[];
};

export type DashboardRecentSection = {
  id: string;
  title: string;
  href: string;
  rows: DashboardTodoItem[];
};

export type DashboardAlertSummary = {
  total: number;
  parts: Array<{
    label: string;
    count: number;
  }>;
};

export type DashboardWorkbenchData = {
  kpiCards: DashboardKpiCard[];
  alertSummary: DashboardAlertSummary;
  pipelines: DashboardPipelineSection[];
  recentSections: DashboardRecentSection[];
};

type MaybeRelation<T> = T | T[] | null;

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

type DashboardBrand = {
  id: string;
  name: string;
  brand_code: string | null;
};

type DashboardProduct = {
  id: string;
  name: string;
  product_code: string;
  brand: MaybeRelation<DashboardBrand>;
};

type DashboardSku = {
  id: string;
  sku_code: string;
  sku_name: string;
  sku_type?: string;
  unit?: string;
  default_supplier_id?: string | null;
  product: MaybeRelation<DashboardProduct>;
  default_supplier?: MaybeRelation<{
    id: string;
    name: string;
    supplier_code: string;
    status: string;
  }>;
};

type FbaRequestRow = {
  id: string;
  request_no: string;
  requested_quantity: number;
  target_ship_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  sku: MaybeRelation<DashboardSku>;
  items: Array<{
    id: string;
    requested_quantity: number;
    sku: MaybeRelation<DashboardSku>;
    product: MaybeRelation<DashboardProduct>;
  }>;
};

type ProductionOrderRow = {
  id: string;
  production_order_no: string;
  planned_quantity: number;
  completed_quantity: number;
  planned_end_date: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  sku: MaybeRelation<DashboardSku>;
  replenishment_request: MaybeRelation<{
    id: string;
    request_no: string;
  }>;
  items: Array<{
    id: string;
    planned_quantity: number;
    completed_quantity: number;
    sku: MaybeRelation<DashboardSku>;
  }>;
};

type MaterialRequirementRow = {
  id: string;
  material_id: string | null;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  reserved_quantity: number;
  unit: string;
  status: string;
  created_at: string;
  material: MaybeRelation<{
    id: string;
    material_code: string;
    material_name: string;
    unit: string;
    default_supplier_id: string | null;
  }>;
  production_order: MaybeRelation<{
    id: string;
    production_order_no: string;
  }>;
};

type PurchaseOrderRow = {
  id: string;
  purchase_order_no: string;
  status: string;
  ordered_at: string | null;
  expected_arrival_date: string | null;
  created_at: string;
  supplier: MaybeRelation<{
    id: string;
    supplier_code: string;
    name: string;
    status?: string;
  }>;
  items: Array<{
    id: string;
    ordered_quantity: number;
    received_quantity: number;
    unit: string;
    material: MaybeRelation<{
      id: string;
      material_code: string;
      material_name: string;
      unit: string;
    }>;
  }>;
};

type InventoryItemRow = {
  id: string;
  sku_id: string;
  product_sku_id: string | null;
  material_id: string | null;
  item_type: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  safety_stock_quantity: number | null;
  unit: string;
  updated_at: string;
  sku: MaybeRelation<DashboardSku>;
  product_sku: MaybeRelation<DashboardSku>;
  material: MaybeRelation<{
    id: string;
    material_code: string;
    material_name: string;
    unit: string;
    specs: string | null;
  }>;
  warehouse: MaybeRelation<{
    id: string;
    warehouse_code: string;
    name: string;
  }>;
};

type InventoryTransactionRow = {
  id: string;
  transaction_no: string;
  transaction_type: string;
  quantity: number;
  occurred_at: string;
  sku: MaybeRelation<DashboardSku>;
  warehouse: MaybeRelation<{
    id: string;
    warehouse_code: string;
    name: string;
  }>;
};

const fbaStatusLabels: Record<string, string> = {
  draft: "草稿",
  submitted: "待厂长接单",
  accepted: "已接单",
  rejected: "已拒绝",
  in_production: "生产中",
  completed: "待 FBA 出库",
  shipped: "已发往 FBA"
};

const productionStatusLabels: Record<string, string> = {
  planned: "已计划",
  material_pending: "待物料",
  in_progress: "生产中",
  completed: "待生产入库",
  cancelled: "已取消"
};

const materialStatusLabels: Record<string, string> = {
  pending: "待处理",
  ready: "可开工",
  enough: "库存足够",
  shortage: "缺料",
  purchased: "已采购待到货",
  reserved: "已预留",
  received: "已到货"
};

const purchaseStatusLabels: Record<string, string> = {
  draft: "未下单",
  ordered: "已下单待到货",
  partially_received: "部分到货",
  received: "已到货",
  cancelled: "已取消"
};

const transactionTypeLabels: Record<string, string> = {
  material_in: "辅料入库",
  material_out: "辅料领料",
  product_in: "成品入库",
  product_out: "FBA 出库",
  adjustment: "库存调整"
};

function formatSupabaseError(action: string, error: { message: string }) {
  return new Error(`${action}失败：${error.message}`);
}

async function withTimeout<T>(promise: PromiseLike<T>, action: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(
        new Error(`${action}超时：请检查 Supabase 地址、anon key、网络和 RLS 策略。`)
      );
    }, 10000);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

function singleRelation<T>(value: MaybeRelation<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

async function getExactCount(
  query: PromiseLike<CountResult>,
  action: string
): Promise<number> {
  const { count, error } = await withTimeout(query, action);

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return count ?? 0;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function numberValue(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function getStatusLabel(labels: Record<string, string>, status: string) {
  return labels[status] ?? status;
}

function getSkuBrand(sku: DashboardSku | null) {
  const product = singleRelation(sku?.product ?? null);
  const brand = singleRelation(product?.brand ?? null);

  return brand?.name ?? "未设置品牌";
}

function getProductBrand(product: DashboardProduct | null) {
  const brand = singleRelation(product?.brand ?? null);

  return brand?.name ?? "未设置品牌";
}

function getSkuTitle(sku: DashboardSku | null) {
  if (!sku) {
    return "-";
  }

  return `${sku.sku_code} / ${sku.sku_name}`;
}

function sumFbaQuantity(row: FbaRequestRow) {
  if (row.items?.length) {
    return row.items.reduce(
      (sum, item) => sum + numberValue(item.requested_quantity),
      0
    );
  }

  return numberValue(row.requested_quantity);
}

function getFbaTitleAndBrand(row: FbaRequestRow) {
  const firstItem = row.items?.[0];
  const itemSku = singleRelation(firstItem?.sku ?? null);
  const itemProduct = singleRelation(firstItem?.product ?? null);
  const fallbackSku = singleRelation(row.sku);
  const sku = itemSku ?? fallbackSku;

  return {
    title:
      row.items?.length > 1
        ? `${row.items.length} 个 SKU`
        : getSkuTitle(sku),
    brand: itemProduct ? getProductBrand(itemProduct) : getSkuBrand(sku)
  };
}

function sumProductionPlanned(row: ProductionOrderRow) {
  if (row.items?.length) {
    return row.items.reduce(
      (sum, item) => sum + numberValue(item.planned_quantity),
      0
    );
  }

  return numberValue(row.planned_quantity);
}

function sumProductionCompleted(row: ProductionOrderRow) {
  if (row.items?.length) {
    return row.items.reduce(
      (sum, item) => sum + numberValue(item.completed_quantity),
      0
    );
  }

  return numberValue(row.completed_quantity);
}

function getProductionTitleAndBrand(row: ProductionOrderRow) {
  const firstItemSku = singleRelation(row.items?.[0]?.sku ?? null);
  const fallbackSku = singleRelation(row.sku);
  const sku = firstItemSku ?? fallbackSku;

  return {
    title:
      row.items?.length > 1
        ? `${row.items.length} 个 SKU`
        : getSkuTitle(sku),
    brand: getSkuBrand(sku)
  };
}

function getPurchaseQuantity(row: PurchaseOrderRow) {
  return row.items.reduce(
    (sum, item) =>
      sum +
      Math.max(
        0,
        numberValue(item.ordered_quantity) - numberValue(item.received_quantity)
      ),
    0
  );
}

function getPurchaseTitle(row: PurchaseOrderRow) {
  const firstMaterial = singleRelation(row.items?.[0]?.material ?? null);

  return row.items.length > 1
    ? `${row.items.length} 个辅料`
    : firstMaterial
      ? `${firstMaterial.material_code} / ${firstMaterial.material_name}`
      : "未设置辅料";
}

function toFbaTodo(row: FbaRequestRow): DashboardTodoItem {
  const { title, brand } = getFbaTitleAndBrand(row);

  return {
    id: row.id,
    no: row.request_no,
    brand,
    title,
    quantity: sumFbaQuantity(row),
    unit: "pcs",
    status: row.status,
    statusLabel: getStatusLabel(fbaStatusLabels, row.status),
    dateLabel: row.target_ship_date ? "期望发货" : "创建时间",
    dateValue: row.target_ship_date ?? row.created_at,
    href: "/replenishment",
    actionLabel: "查看"
  };
}

function toProductionTodo(row: ProductionOrderRow): DashboardTodoItem {
  const { title, brand } = getProductionTitleAndBrand(row);

  return {
    id: row.id,
    no: row.production_order_no,
    brand,
    title,
    quantity: Math.max(0, sumProductionPlanned(row) - sumProductionCompleted(row)),
    unit: "pcs",
    status: row.status,
    statusLabel: getStatusLabel(productionStatusLabels, row.status),
    dateLabel: row.planned_end_date ? "计划完成" : "创建时间",
    dateValue: row.planned_end_date ?? row.created_at,
    href: "/production/orders",
    actionLabel: "查看"
  };
}

function toMaterialTodo(row: MaterialRequirementRow): DashboardTodoItem {
  const material = singleRelation(row.material);

  return {
    id: row.id,
    no: singleRelation(row.production_order)?.production_order_no ?? "-",
    brand: "辅料",
    title: material ? `${material.material_code} / ${material.material_name}` : "未设置辅料",
    quantity:
      numberValue(row.shortage_quantity) > 0
        ? numberValue(row.shortage_quantity)
        : numberValue(row.required_quantity),
    unit: material?.unit ?? row.unit,
    status: row.status,
    statusLabel: getStatusLabel(materialStatusLabels, row.status),
    dateLabel: "生成时间",
    dateValue: row.created_at,
    href: "/materials/requirements",
    actionLabel: "查看"
  };
}

function toPurchaseTodo(row: PurchaseOrderRow): DashboardTodoItem {
  const supplier = singleRelation(row.supplier);

  return {
    id: row.id,
    no: row.purchase_order_no,
    brand: supplier?.name ?? "未设置供应商",
    title: getPurchaseTitle(row),
    quantity: getPurchaseQuantity(row),
    unit: row.items[0]?.unit ?? "pcs",
    status: row.status,
    statusLabel: getStatusLabel(purchaseStatusLabels, row.status),
    dateLabel: row.expected_arrival_date ? "预计到货" : "创建时间",
    dateValue: row.expected_arrival_date ?? row.created_at,
    href: "/purchase/orders",
    actionLabel: "查看"
  };
}

function toInventoryTodo(row: InventoryItemRow): DashboardTodoItem {
  const sku = singleRelation(row.sku);
  const productSku = singleRelation(row.product_sku);
  const material = singleRelation(row.material);
  const warehouse = singleRelation(row.warehouse);
  const availableQuantity =
    numberValue(row.quantity_on_hand) - numberValue(row.reserved_quantity);
  const status =
    availableQuantity < 0
      ? "out_of_stock"
      : row.safety_stock_quantity !== null &&
          availableQuantity < numberValue(row.safety_stock_quantity)
        ? "low_stock"
        : "normal";

  return {
    id: row.id,
    no: warehouse?.name ?? "-",
    brand: material ? "辅料" : getSkuBrand(productSku ?? sku),
    title: material
      ? `${material.material_code} / ${material.material_name}`
      : getSkuTitle(productSku ?? sku),
    quantity: availableQuantity,
    unit: material?.unit ?? productSku?.unit ?? sku?.unit ?? row.unit,
    status,
    statusLabel:
      status === "out_of_stock"
        ? "库存异常"
        : status === "low_stock"
          ? "低库存"
          : "正常",
    dateLabel: "更新时间",
    dateValue: row.updated_at,
    href:
      row.product_sku_id ||
      row.item_type === "finished_product" ||
      row.item_type === "finished_good"
        ? "/inventory/products"
        : "/inventory/materials",
    actionLabel: "查看"
  };
}

function toTransactionTodo(row: InventoryTransactionRow): DashboardTodoItem {
  const sku = singleRelation(row.sku);
  const warehouse = singleRelation(row.warehouse);

  return {
    id: row.id,
    no: row.transaction_no,
    brand: warehouse?.name ?? "-",
    title: getSkuTitle(sku),
    quantity: numberValue(row.quantity),
    unit: sku?.unit ?? "pcs",
    status: row.transaction_type,
    statusLabel: getStatusLabel(transactionTypeLabels, row.transaction_type),
    dateLabel: "发生时间",
    dateValue: row.occurred_at,
    href: "/inventory/transactions",
    actionLabel: "查看"
  };
}

const fbaSelect = `
  id,
  request_no,
  requested_quantity,
  target_ship_date,
  status,
  created_at,
  updated_at,
  sku:skus!fba_replenishment_requests_sku_id_fkey (
    id,
    sku_code,
    sku_name,
    unit,
    sku_type,
    product:products!skus_product_id_fkey (
      id,
      product_code,
      name,
      brand:brands!products_brand_id_fkey (
        id,
        brand_code,
        name
      )
    )
  ),
  items:fba_replenishment_request_items!fba_replenishment_request_items_request_id_fkey (
    id,
    requested_quantity,
    sku:skus!fba_replenishment_request_items_sku_id_fkey (
      id,
      sku_code,
      sku_name,
      unit,
      sku_type,
      product:products!skus_product_id_fkey (
        id,
        product_code,
        name,
        brand:brands!products_brand_id_fkey (
          id,
          brand_code,
          name
        )
      )
    ),
    product:products!fba_replenishment_request_items_product_id_fkey (
      id,
      product_code,
      name,
      brand:brands!products_brand_id_fkey (
        id,
        brand_code,
        name
      )
    )
  )
`;

const productionSelect = `
  id,
  production_order_no,
  planned_quantity,
  completed_quantity,
  planned_end_date,
  status,
  created_at,
  updated_at,
  replenishment_request:fba_replenishment_requests!production_orders_replenishment_request_id_fkey (
    id,
    request_no
  ),
  sku:skus!production_orders_sku_id_fkey (
    id,
    sku_code,
    sku_name,
    unit,
    sku_type,
    product:products!skus_product_id_fkey (
      id,
      product_code,
      name,
      brand:brands!products_brand_id_fkey (
        id,
        brand_code,
        name
      )
    )
  ),
  items:production_order_items!production_order_items_production_order_id_fkey (
    id,
    planned_quantity,
    completed_quantity,
    sku:skus!production_order_items_sku_id_fkey (
      id,
      sku_code,
      sku_name,
      unit,
      sku_type,
      product:products!skus_product_id_fkey (
        id,
        product_code,
        name,
        brand:brands!products_brand_id_fkey (
          id,
          brand_code,
          name
        )
      )
    )
  )
`;

const materialRequirementSelect = `
  id,
  material_id,
  required_quantity,
  available_quantity,
  shortage_quantity,
  reserved_quantity,
  unit,
  status,
  created_at,
  material:materials!material_requirements_material_id_fkey (
    id,
    material_code,
    material_name,
    unit,
    default_supplier_id
  ),
  production_order:production_orders!material_requirements_production_order_id_fkey (
    id,
    production_order_no
  )
`;

const purchaseSelect = `
  id,
  purchase_order_no,
  status,
  ordered_at,
  expected_arrival_date,
  created_at,
  supplier:suppliers!purchase_orders_supplier_id_fkey (
    id,
    supplier_code,
    name,
    status
  ),
  items:purchase_order_items!purchase_order_items_purchase_order_id_fkey (
    id,
    ordered_quantity,
    received_quantity,
    unit,
    material:materials!purchase_order_items_material_id_fkey (
      id,
      material_code,
      material_name,
      unit
    )
  )
`;

const inventorySelect = `
  id,
  sku_id,
  product_sku_id,
  material_id,
  item_type,
  quantity_on_hand,
  reserved_quantity,
  safety_stock_quantity,
  unit,
  updated_at,
  sku:skus!inventory_items_sku_id_fkey (
    id,
    sku_code,
    sku_name,
    sku_type,
    unit,
    product:products!skus_product_id_fkey (
      id,
      product_code,
      name,
      brand:brands!products_brand_id_fkey (
        id,
        brand_code,
        name
      )
    )
  ),
  product_sku:skus!inventory_items_product_sku_id_fkey (
    id,
    sku_code,
    sku_name,
    sku_type,
    unit,
    product:products!skus_product_id_fkey (
      id,
      product_code,
      name,
      brand:brands!products_brand_id_fkey (
        id,
        brand_code,
        name
      )
    )
  ),
  material:materials!inventory_items_material_id_fkey (
    id,
    material_code,
    material_name,
    unit,
    specs
  ),
  warehouse:warehouses!inventory_items_warehouse_id_fkey (
    id,
    warehouse_code,
    name
  )
`;

async function getFbaRequestsByStatus(
  statuses: string[],
  action: string,
  limit = 5
) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .select(fbaSelect)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as FbaRequestRow[];
}

async function getOverdueFbaRequests(limit = 5) {
  const supabase = getSupabaseClient();
  const action = "读取超期 FBA 备货需求";
  const { data, error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .select(fbaSelect)
      .in("status", ["submitted", "accepted", "in_production", "completed"])
      .lt("target_ship_date", todayIsoDate())
      .order("target_ship_date", { ascending: true })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as FbaRequestRow[];
}

async function getProductionOrdersByStatus(
  statuses: string[],
  action: string,
  limit = 5
) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("production_orders")
      .select(productionSelect)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as ProductionOrderRow[];
}

async function getPendingProductionInboundOrders(limit = 5) {
  const rows = await getProductionOrdersByStatus(
    ["in_progress", "completed"],
    "读取待生产入库任务",
    20
  );

  return rows
    .filter((row) => sumProductionCompleted(row) < sumProductionPlanned(row))
    .slice(0, limit);
}

async function getOverdueProductionOrders(limit = 5) {
  const supabase = getSupabaseClient();
  const action = "读取超期生产任务";
  const { data, error } = await withTimeout(
    supabase
      .from("production_orders")
      .select(productionSelect)
      .in("status", ["planned", "material_pending", "in_progress"])
      .lt("planned_end_date", todayIsoDate())
      .order("planned_end_date", { ascending: true })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as ProductionOrderRow[];
}

async function getMaterialRequirementsByStatus(
  statuses: string[],
  action: string,
  limit = 5
) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("material_requirements")
      .select(materialRequirementSelect)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as MaterialRequirementRow[];
}

async function getPurchaseOrdersByStatus(
  statuses: string[],
  action: string,
  limit = 5
) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("purchase_orders")
      .select(purchaseSelect)
      .in("status", statuses)
      .order("created_at", { ascending: false })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as PurchaseOrderRow[];
}

async function getOverduePurchaseOrders(limit = 5) {
  const supabase = getSupabaseClient();
  const action = "读取超期采购单";
  const { data, error } = await withTimeout(
    supabase
      .from("purchase_orders")
      .select(purchaseSelect)
      .in("status", ["ordered", "partially_received"])
      .lt("expected_arrival_date", todayIsoDate())
      .order("expected_arrival_date", { ascending: true })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as PurchaseOrderRow[];
}

async function getInventoryItems(
  itemTypes: string[],
  action: string,
  limit = 8
) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .select(inventorySelect)
      .in("item_type", itemTypes)
      .order("updated_at", { ascending: false })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as InventoryItemRow[];
}

async function getLowStockMaterials(limit = 5) {
  const rows = await getInventoryItems(["material"], "读取辅料低库存", 50);

  return rows
    .filter((row) => {
      const available =
        numberValue(row.quantity_on_hand) - numberValue(row.reserved_quantity);

      if (row.safety_stock_quantity === null) {
        return available <= 0;
      }

      return available < numberValue(row.safety_stock_quantity);
    })
    .slice(0, limit);
}

async function getAbnormalFinishedStock(limit = 5) {
  const rows = await getInventoryItems(
    ["finished_product", "finished_good"],
    "读取成品库存异常",
    50
  );

  return rows
    .filter(
      (row) =>
        numberValue(row.quantity_on_hand) < 0 ||
        numberValue(row.quantity_on_hand) < numberValue(row.reserved_quantity)
    )
    .slice(0, limit);
}

async function getRecentAdjustmentTransactions(limit = 5) {
  const supabase = getSupabaseClient();
  const action = "读取最近库存调整";
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_transactions")
      .select(
        `
          id,
          transaction_no,
          transaction_type,
          quantity,
          occurred_at,
          sku:skus!inventory_transactions_sku_id_fkey (
            id,
            sku_code,
            sku_name,
            unit,
            product:products!skus_product_id_fkey (
              id,
              product_code,
              name,
              brand:brands!products_brand_id_fkey (
                id,
                brand_code,
                name
              )
            )
          ),
          warehouse:warehouses!inventory_transactions_warehouse_id_fkey (
            id,
            warehouse_code,
            name
          )
        `
      )
      .eq("transaction_type", "adjustment")
      .order("occurred_at", { ascending: false })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as InventoryTransactionRow[];
}

async function getRecentInventoryTransactions(limit = 5) {
  const supabase = getSupabaseClient();
  const action = "读取最近库存流水";
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_transactions")
      .select(
        `
          id,
          transaction_no,
          transaction_type,
          quantity,
          occurred_at,
          sku:skus!inventory_transactions_sku_id_fkey (
            id,
            sku_code,
            sku_name,
            unit,
            product:products!skus_product_id_fkey (
              id,
              product_code,
              name,
              brand:brands!products_brand_id_fkey (
                id,
                brand_code,
                name
              )
            )
          ),
          warehouse:warehouses!inventory_transactions_warehouse_id_fkey (
            id,
            warehouse_code,
            name
          )
        `
      )
      .order("occurred_at", { ascending: false })
      .limit(limit),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []) as unknown as InventoryTransactionRow[];
}

async function countTableByStatus(table: string, statuses: string[], action: string) {
  const supabase = getSupabaseClient();

  return getExactCount(
    supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .in("status", statuses),
    action
  );
}

async function countOverdueFbaRequests() {
  const supabase = getSupabaseClient();

  return getExactCount(
    supabase
      .from("fba_replenishment_requests")
      .select("id", { count: "exact", head: true })
      .in("status", ["submitted", "accepted", "in_production", "completed"])
      .lt("target_ship_date", todayIsoDate()),
    "统计超期 FBA 备货需求"
  );
}

async function countOverdueProductionOrders() {
  const supabase = getSupabaseClient();

  return getExactCount(
    supabase
      .from("production_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["planned", "material_pending", "in_progress"])
      .lt("planned_end_date", todayIsoDate()),
    "统计超期生产任务"
  );
}

async function countOverduePurchaseOrders() {
  const supabase = getSupabaseClient();

  return getExactCount(
    supabase
      .from("purchase_orders")
      .select("id", { count: "exact", head: true })
      .in("status", ["ordered", "partially_received"])
      .lt("expected_arrival_date", todayIsoDate()),
    "统计超期采购单"
  );
}

async function countProductsWithoutBrand() {
  const supabase = getSupabaseClient();

  return getExactCount(
    supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .is("brand_id", null),
    "统计未设置品牌产品"
  );
}

async function countMaterialsWithoutSupplier() {
  const supabase = getSupabaseClient();

  return getExactCount(
    supabase
      .from("materials")
      .select("id", { count: "exact", head: true })
      .is("default_supplier_id", null),
    "统计未设置默认供应商辅料"
  );
}

async function countInactiveSupplierReferences() {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.rpc("count_inactive_supplier_references"),
    "统计停用供应商仍被辅料引用"
  );

  if (error) {
    throw formatSupabaseError("统计停用供应商仍被辅料引用", error);
  }

  return Number(data ?? 0);
}

async function countMissingBomSkus() {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.rpc("count_missing_bom_skus"),
    "统计缺少启用 BOM 的成品 SKU"
  );

  if (error) {
    throw formatSupabaseError("统计缺少启用 BOM 的成品 SKU", error);
  }

  return Number(data ?? 0);
}

async function countAcceptedFbaWithoutProduction() {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.rpc("count_accepted_fba_without_production"),
    "统计已接单未创建生产任务的 FBA 备货需求"
  );

  if (error) {
    throw formatSupabaseError("统计已接单未创建生产任务的 FBA 备货需求", error);
  }

  return Number(data ?? 0);
}

async function getAcceptedFbaWithoutProduction(limit = 5) {
  const rows = await getFbaRequestsByStatus(
    ["accepted"],
    "读取已接单未创建生产任务的 FBA 备货需求",
    20
  );

  if (!rows.length) {
    return [];
  }

  const supabase = getSupabaseClient();
  const requestIds = rows.map((request) => request.id);
  const { data, error } = await withTimeout(
    supabase
      .from("production_orders")
      .select("replenishment_request_id")
      .in("replenishment_request_id", requestIds),
    "读取 FBA 对应生产任务"
  );

  if (error) {
    throw formatSupabaseError("读取 FBA 对应生产任务", error);
  }

  const requestIdsWithOrder = new Set(
    (data ?? []).map((order) => order.replenishment_request_id).filter(Boolean)
  );

  return rows.filter((row) => !requestIdsWithOrder.has(row.id)).slice(0, limit);
}

async function getCounts() {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.rpc("get_dashboard_summary"),
    "读取首页汇总统计"
  );

  if (error) {
    throw new Error(
      `读取首页汇总统计失败：${error.message}。请确认已经在 Supabase SQL Editor 执行 supabase/performance-rpc-and-indexes.sql。`
    );
  }

  const counts = (data ?? {}) as Record<string, number | string | null>;
  const numberCount = (key: string) => Number(counts[key] ?? 0);

  return {
    fbaSubmitted: numberCount("fbaSubmitted"),
    fbaAccepted: numberCount("fbaAccepted"),
    fbaInProduction: numberCount("fbaInProduction"),
    fbaCompleted: numberCount("fbaCompleted"),
    overdueFba: numberCount("overdueFba"),
    productionPlanned: numberCount("productionPlanned"),
    productionMaterialPending: numberCount("productionMaterialPending"),
    productionInProgress: numberCount("productionInProgress"),
    shortageMaterials: numberCount("shortageMaterials"),
    readyMaterials: numberCount("readyMaterials"),
    purchaseDraft: numberCount("purchaseDraft"),
    purchaseOrdered: numberCount("purchaseOrdered"),
    overduePurchase: numberCount("overduePurchase"),
    productsWithoutBrand: numberCount("productsWithoutBrand"),
    materialsWithoutSupplier: numberCount("materialsWithoutSupplier"),
    inactiveSupplierReferences: numberCount("inactiveSupplierReferences"),
    missingBomSkus: numberCount("missingBomSkus"),
    acceptedFbaWithoutProduction: numberCount("acceptedFbaWithoutProduction"),
    lowStockMaterials: numberCount("lowStockMaterials"),
    abnormalFinishedStock: numberCount("abnormalFinishedStock"),
    pendingProductionInbound: numberCount("pendingProductionInbound"),
    overdueProduction: numberCount("overdueProduction")
  };
}

function card(
  id: string,
  label: string,
  value: number,
  href: string,
  tone: DashboardTone = "neutral"
): DashboardSummaryCard {
  return { id, label, value, href, tone };
}

function exception(
  id: string,
  label: string,
  count: number,
  href: string,
  tone: DashboardTone
): DashboardException {
  return { id, label, count, href, tone };
}

function section(
  id: string,
  eyebrow: string,
  title: string,
  href: string,
  emptyText: string,
  items: DashboardTodoItem[]
): DashboardListSection {
  return { id, eyebrow, title, href, emptyText, items };
}

function totalCards(cards: DashboardSummaryCard[]) {
  return cards.reduce((sum, item) => sum + item.value, 0);
}

async function getDashboardWorkbench(counts: Awaited<ReturnType<typeof getCounts>>) {
  const [
    pendingPlanning,
    activeProduction,
    shortageMaterials,
    draftPurchaseOrders,
    orderedPurchaseOrders,
    partialPurchaseOrders,
    overduePurchaseOrders,
    lowStockMaterials,
    overdueFba,
    overdueProduction,
    purchaseInbound,
    productionInbound,
    fbaOutbound,
    recentFba,
    recentProduction,
    recentPurchase,
    recentAdjustments
  ] = await Promise.all([
    getFbaRequestsByStatus(["submitted", "accepted"], "读取工作台待排产备货需求", 5),
    getProductionOrdersByStatus(["in_progress"], "读取工作台生产中任务", 5),
    getMaterialRequirementsByStatus(["shortage"], "读取工作台缺料需求", 5),
    getPurchaseOrdersByStatus(["draft"], "读取工作台待下单采购单", 5),
    getPurchaseOrdersByStatus(["ordered"], "读取工作台已下单未到货采购单", 5),
    getPurchaseOrdersByStatus(["partially_received"], "读取工作台部分到货采购单", 5),
    getOverduePurchaseOrders(5),
    getLowStockMaterials(5),
    getOverdueFbaRequests(5),
    getOverdueProductionOrders(5),
    getPurchaseOrdersByStatus(["ordered", "partially_received"], "读取工作台待采购入库", 5),
    getPendingProductionInboundOrders(5),
    getFbaRequestsByStatus(["completed"], "读取工作台待备货出库", 5),
    getFbaRequestsByStatus(["submitted", "accepted", "in_production", "completed"], "读取工作台最近备货单", 5),
    getProductionOrdersByStatus(["planned", "material_pending", "in_progress", "completed"], "读取工作台最近生产任务", 5),
    getPurchaseOrdersByStatus(["draft", "ordered", "partially_received", "received"], "读取工作台最近采购单", 5),
    getRecentAdjustmentTransactions(5)
  ]);

  const stockWarningCount = counts.lowStockMaterials + counts.abnormalFinishedStock;
  const alertParts = [
    { label: "库存预警", count: stockWarningCount },
    { label: "交期延误", count: counts.overdueFba + counts.overdueProduction },
    { label: "采购延迟", count: counts.overduePurchase }
  ];

  return {
    kpiCards: [
      {
        id: "pending-planning",
        title: "待排产",
        value: counts.fbaSubmitted + counts.fbaAccepted,
        unit: "单",
        hint: "待接单或待建生产任务",
        href: "/production/planning",
        tone: "info"
      },
      {
        id: "production-active",
        title: "生产中",
        value: counts.productionInProgress,
        unit: "单",
        hint: "正在生产的任务",
        href: "/production/orders",
        tone: "warning"
      },
      {
        id: "purchase-pending",
        title: "待采购",
        value: counts.shortageMaterials + counts.purchaseDraft,
        unit: "项",
        hint: "缺料与未下单",
        href: "/purchase/orders",
        tone: "danger"
      },
      {
        id: "stock-warning",
        title: "库存预警",
        value: stockWarningCount,
        unit: "条",
        hint: "低库存和异常库存",
        href: "/inventory/overview",
        tone: "warning"
      }
    ],
    alertSummary: {
      total: alertParts.reduce((sum, item) => sum + item.count, 0),
      parts: alertParts
    },
    pipelines: [
      {
        id: "operations",
        title: "运营待办",
        items: [
          {
            id: "confirm-replenishment",
            label: "待确认备货需求",
            count: counts.fbaSubmitted,
            href: "/production/planning",
            tone: "info",
            items: pendingPlanning.map(toFbaTodo),
            emptyText: "暂无待确认备货需求"
          },
          {
            id: "low-stock-suggestion",
            label: "低库存补货建议",
            count: counts.lowStockMaterials,
            href: "/inventory/materials",
            tone: "warning",
            items: lowStockMaterials.map(toInventoryTodo),
            emptyText: "暂无低库存补货建议"
          },
          {
            id: "overdue-outbound",
            label: "超期未出库单",
            count: counts.overdueFba,
            href: "/inventory/fba-outbound",
            tone: "danger",
            items: overdueFba.map(toFbaTodo),
            emptyText: "暂无超期未出库单"
          }
        ]
      },
      {
        id: "production",
        title: "厂长排产",
        items: [
          {
            id: "pending-production-plan",
            label: "待排产单",
            count: counts.fbaSubmitted + counts.fbaAccepted,
            href: "/production/planning",
            tone: "info",
            items: pendingPlanning.map(toFbaTodo),
            emptyText: "暂无待排产单"
          },
          {
            id: "shortage-production",
            label: "缺料生产单",
            count: counts.shortageMaterials,
            href: "/materials/requirements",
            tone: "danger",
            items: shortageMaterials.map(toMaterialTodo),
            emptyText: "暂无缺料生产单"
          },
          {
            id: "active-production",
            label: "生产中任务",
            count: counts.productionInProgress,
            href: "/production/orders",
            tone: "warning",
            items: activeProduction.map(toProductionTodo),
            emptyText: "暂无生产中任务"
          }
        ]
      },
      {
        id: "purchase",
        title: "采购跟踪",
        items: [
          {
            id: "pending-material-order",
            label: "待下单物料",
            count: counts.shortageMaterials + counts.purchaseDraft,
            href: "/purchase/orders",
            tone: "danger",
            items: [...shortageMaterials.map(toMaterialTodo), ...draftPurchaseOrders.map(toPurchaseTodo)].slice(0, 5),
            emptyText: "暂无待下单物料"
          },
          {
            id: "ordered-not-arrived",
            label: "已下单未到货",
            count: counts.purchaseOrdered,
            href: "/purchase/orders",
            tone: "info",
            items: orderedPurchaseOrders.map(toPurchaseTodo),
            emptyText: "暂无已下单未到货采购单"
          },
          {
            id: "partial-arrived",
            label: "部分到货",
            count: partialPurchaseOrders.length,
            href: "/purchase/orders",
            tone: "warning",
            items: partialPurchaseOrders.map(toPurchaseTodo),
            emptyText: "暂无部分到货采购单"
          },
          {
            id: "purchase-overdue",
            label: "采购延期",
            count: counts.overduePurchase,
            href: "/purchase/orders",
            tone: "danger",
            items: overduePurchaseOrders.map(toPurchaseTodo),
            emptyText: "暂无采购延期"
          }
        ]
      },
      {
        id: "warehouse",
        title: "仓库收发",
        items: [
          {
            id: "purchase-inbound",
            label: "待采购入库",
            count: counts.purchaseOrdered,
            href: "/inventory/inbound",
            tone: "info",
            items: purchaseInbound.map(toPurchaseTodo),
            emptyText: "暂无待采购入库"
          },
          {
            id: "production-inbound",
            label: "待生产入库",
            count: counts.pendingProductionInbound,
            href: "/inventory/inbound",
            tone: "warning",
            items: productionInbound.map(toProductionTodo),
            emptyText: "暂无待生产入库"
          },
          {
            id: "replenishment-outbound",
            label: "待备货出库",
            count: counts.fbaCompleted,
            href: "/inventory/fba-outbound",
            tone: "success",
            items: fbaOutbound.map(toFbaTodo),
            emptyText: "暂无待备货出库"
          },
          {
            id: "adjustment-review",
            label: "库存调整待审核",
            count: recentAdjustments.length,
            href: "/inventory/adjustments",
            tone: "neutral",
            items: recentAdjustments.map(toTransactionTodo),
            emptyText: "暂无库存调整记录"
          }
        ]
      }
    ],
    recentSections: [
      {
        id: "recent-fba",
        title: "最近备货单",
        href: "/replenishment",
        rows: recentFba.map(toFbaTodo).slice(0, 5)
      },
      {
        id: "recent-production",
        title: "最近生产任务",
        href: "/production/orders",
        rows: recentProduction.map(toProductionTodo).slice(0, 5)
      },
      {
        id: "recent-purchase",
        title: "最近采购单",
        href: "/purchase/orders",
        rows: recentPurchase.map(toPurchaseTodo).slice(0, 5)
      }
    ]
  } satisfies DashboardWorkbenchData;
}

export async function getRoleDashboard(
  role: UserRole
): Promise<RoleDashboardData> {
  const counts = await getCounts();
  const workbench = await getDashboardWorkbench(counts);

  if (role === "operations") {
    const [
      submittedFba,
      inProductionFba,
      completedFba,
      overdueFba,
      abnormalFinishedStock
    ] = await Promise.all([
      getFbaRequestsByStatus(["submitted"], "读取待厂长接单 FBA 备货需求"),
      getFbaRequestsByStatus(["in_production"], "读取生产中 FBA 备货需求"),
      getFbaRequestsByStatus(["completed"], "读取待 FBA 出库备货需求"),
      getOverdueFbaRequests(),
      getAbnormalFinishedStock()
    ]);

    const summaryCards = [
      card("fba-submitted", "待厂长接单", counts.fbaSubmitted, "/production/planning", "info"),
      card("fba-producing", "生产中的备货单", counts.fbaInProduction, "/replenishment", "warning"),
      card("fba-outbound", "待 FBA 出库", counts.fbaCompleted, "/inventory/fba-outbound", "success"),
      card("fba-overdue", "备货超期", counts.overdueFba, "/replenishment", "danger"),
      card("stock-abnormal", "成品库存异常", counts.abnormalFinishedStock, "/inventory/products", "warning")
    ];

    return {
      role,
      totalTodoCount: totalCards(summaryCards),
      summaryCards,
      quickLinks: [
        { label: "创建 FBA 备货单", href: "/replenishment" },
        { label: "查看 FBA 备货需求", href: "/replenishment" },
        { label: "查看成品库存", href: "/inventory/products" },
        { label: "出库管理", href: "/inventory/fba-outbound" }
      ],
      listSections: [
        section(
          "submitted-fba",
          "FBA 备货",
          "待厂长接单的备货需求",
          "/production/planning",
          "暂无待厂长接单的备货需求",
          submittedFba.map(toFbaTodo)
        ),
        section(
          "in-production-fba",
          "生产跟踪",
          "生产中的 FBA 备货需求",
          "/replenishment",
          "暂无生产中的备货需求",
          inProductionFba.map(toFbaTodo)
        ),
        section(
          "completed-fba",
          "仓库协同",
          "已生产完成、待 FBA 出库",
          "/inventory/fba-outbound",
          "暂无待 FBA 出库的备货需求",
          completedFba.map(toFbaTodo)
        ),
        section(
          "abnormal-stock",
          "库存提醒",
          "成品库存异常",
          "/inventory/products",
          "暂无可判断的成品库存异常",
          abnormalFinishedStock.map(toInventoryTodo)
        )
      ],
      exceptions: [
        exception("overdue-fba", "已超期但还没 shipped 的备货单", counts.overdueFba, "/replenishment", "danger"),
        exception("stock-abnormal", "成品库存不足或被占用过多", counts.abnormalFinishedStock, "/inventory/products", "warning"),
        exception("overdue-fba-list", "最近超期备货单", overdueFba.length, "/replenishment", "danger")
      ],
      workbench
    };
  }

  if (role === "plant_manager") {
    const [
      submittedFba,
      acceptedWithoutProduction,
      shortageMaterials,
      readyProductionOrders,
      overdueProduction,
      pendingProductionInbound
    ] = await Promise.all([
      getFbaRequestsByStatus(["submitted"], "读取待排产 FBA 备货需求"),
      getAcceptedFbaWithoutProduction(),
      getMaterialRequirementsByStatus(["shortage"], "读取缺料生产任务"),
      getProductionOrdersByStatus(["planned"], "读取可开工生产任务"),
      getOverdueProductionOrders(),
      getPendingProductionInboundOrders()
    ]);

    const summaryCards = [
      card("pending-planning", "待接单 / 待排产", counts.fbaSubmitted, "/production/planning", "info"),
      card("accepted-no-order", "已接单未建任务", counts.acceptedFbaWithoutProduction, "/production/planning", "warning"),
      card("missing-bom", "缺 BOM SKU", counts.missingBomSkus, "/bom", "danger"),
      card("shortage", "缺料任务", counts.shortageMaterials, "/materials/requirements", "danger"),
      card("ready-production", "可开工任务", counts.productionPlanned, "/production/orders", "success"),
      card("pending-product-inbound", "待生产入库", counts.pendingProductionInbound, "/inventory/inbound", "warning")
    ];

    return {
      role,
      totalTodoCount: totalCards(summaryCards),
      summaryCards,
      quickLinks: [
        { label: "厂长排产", href: "/production/planning" },
        { label: "生产任务", href: "/production/orders" },
        { label: "BOM 管理", href: "/bom" },
        { label: "物料需求", href: "/materials/requirements" }
      ],
      listSections: [
        section("planning-fba", "FBA 接单", "待接单 / 待排产需求", "/production/planning", "暂无待排产需求", submittedFba.map(toFbaTodo)),
        section("accepted-no-production", "排产提醒", "已接单但未创建生产任务", "/production/planning", "暂无已接单未建任务的备货需求", acceptedWithoutProduction.map(toFbaTodo)),
        section("shortage-production", "物料提醒", "缺料的生产任务", "/materials/requirements", "暂无缺料生产任务", shortageMaterials.map(toMaterialTodo)),
        section("ready-production", "生产任务", "可开工的生产任务", "/production/orders", "暂无可开工生产任务", readyProductionOrders.map(toProductionTodo)),
        section("pending-production-inbound", "入库协同", "待生产入库的生产任务", "/inventory/inbound", "暂无待生产入库任务", pendingProductionInbound.map(toProductionTodo))
      ],
      exceptions: [
        exception("missing-bom", "缺 BOM 的 SKU", counts.missingBomSkus, "/bom", "danger"),
        exception("shortage", "缺料生产任务", counts.shortageMaterials, "/materials/requirements", "danger"),
        exception("overdue-production", "生产中但已超期", counts.overdueProduction, "/production/orders", "danger"),
        exception("overdue-production-list", "最近超期生产任务", overdueProduction.length, "/production/orders", "danger")
      ],
      workbench
    };
  }

  if (role === "procurement") {
    const [
      shortageMaterials,
      draftPurchaseOrders,
      orderedPurchaseOrders,
      overduePurchaseOrders,
      lowStockMaterials
    ] = await Promise.all([
      getMaterialRequirementsByStatus(["shortage"], "读取缺料待采购"),
      getPurchaseOrdersByStatus(["draft"], "读取未下单采购单"),
      getPurchaseOrdersByStatus(["ordered", "partially_received"], "读取待到货采购单"),
      getOverduePurchaseOrders(),
      getLowStockMaterials()
    ]);

    const summaryCards = [
      card("shortage", "缺料待采购", counts.shortageMaterials, "/materials/requirements", "danger"),
      card("draft-po", "采购单未下单", counts.purchaseDraft, "/purchase/orders", "warning"),
      card("ordered-po", "已下单待到货", counts.purchaseOrdered, "/purchase/orders", "info"),
      card("overdue-po", "超期未到货", counts.overduePurchase, "/purchase/orders", "danger"),
      card("no-supplier", "辅料未设供应商", counts.materialsWithoutSupplier, "/admin/materials", "warning")
    ];

    return {
      role,
      totalTodoCount: totalCards(summaryCards),
      summaryCards,
      quickLinks: [
        { label: "采购单", href: "/purchase/orders" },
        { label: "物料需求", href: "/materials/requirements" },
        { label: "辅料管理", href: "/admin/materials" },
        { label: "供应商管理", href: "/admin/suppliers" }
      ],
      listSections: [
        section("shortage-materials", "缺料", "缺料待采购", "/materials/requirements", "暂无缺料待采购", shortageMaterials.map(toMaterialTodo)),
        section("draft-purchase", "采购单", "已生成但未下单", "/purchase/orders", "暂无未下单采购单", draftPurchaseOrders.map(toPurchaseTodo)),
        section("ordered-purchase", "到货跟踪", "已下单待到货采购单", "/purchase/orders", "暂无待到货采购单", orderedPurchaseOrders.map(toPurchaseTodo)),
        section("low-stock-materials", "库存提醒", "低库存辅料", "/inventory/materials", "暂无低库存辅料", lowStockMaterials.map(toInventoryTodo))
      ],
      exceptions: [
        exception("overdue-po", "超过预计到货日期但未完全到货", counts.overduePurchase, "/purchase/orders", "danger"),
        exception("no-supplier", "未设置默认供应商的辅料", counts.materialsWithoutSupplier, "/admin/materials", "warning"),
        exception("inactive-supplier", "停用供应商仍被辅料引用", counts.inactiveSupplierReferences, "/admin/materials", "danger"),
        exception("overdue-po-list", "最近超期采购单", overduePurchaseOrders.length, "/purchase/orders", "danger")
      ],
      workbench
    };
  }

  if (role === "warehouse") {
    const [
      purchaseInbound,
      productionInbound,
      fbaOutbound,
      lowStockMaterials,
      abnormalFinishedStock,
      recentAdjustments
    ] = await Promise.all([
      getPurchaseOrdersByStatus(["ordered", "partially_received"], "读取待采购入库采购单"),
      getPendingProductionInboundOrders(),
      getFbaRequestsByStatus(["completed"], "读取待 FBA 出库备货需求"),
      getLowStockMaterials(),
      getAbnormalFinishedStock(),
      getRecentAdjustmentTransactions()
    ]);

    const summaryCards = [
      card("purchase-inbound", "待采购入库", counts.purchaseOrdered, "/inventory/inbound", "info"),
      card("production-inbound", "待生产入库", counts.pendingProductionInbound, "/inventory/inbound", "warning"),
      card("fba-outbound", "待 FBA 出库", counts.fbaCompleted, "/inventory/fba-outbound", "success"),
      card("low-stock-material", "辅料低库存", counts.lowStockMaterials, "/inventory/materials", "warning"),
      card("stock-abnormal", "成品库存异常", counts.abnormalFinishedStock, "/inventory/products", "danger")
    ];

    return {
      role,
      totalTodoCount: totalCards(summaryCards),
      summaryCards,
      quickLinks: [
        { label: "入库管理", href: "/inventory/inbound" },
        { label: "出库管理", href: "/inventory/fba-outbound" },
        { label: "辅料库存", href: "/inventory/materials" },
        { label: "成品库存", href: "/inventory/products" },
        { label: "库存流水", href: "/inventory/transactions" }
      ],
      listSections: [
        section("purchase-inbound", "采购入库", "待采购入库的采购单", "/inventory/inbound", "暂无待采购入库采购单", purchaseInbound.map(toPurchaseTodo)),
        section("production-inbound", "生产入库", "待生产入库的生产任务", "/inventory/inbound", "暂无待生产入库任务", productionInbound.map(toProductionTodo)),
        section("fba-outbound", "FBA 出库", "待 FBA 出库的备货需求", "/inventory/fba-outbound", "暂无待 FBA 出库需求", fbaOutbound.map(toFbaTodo)),
        section("recent-adjustments", "库存调整", "最近库存调整记录", "/inventory/adjustments", "暂无最近库存调整记录", recentAdjustments.map(toTransactionTodo))
      ],
      exceptions: [
        exception("low-stock-material", "辅料低库存", counts.lowStockMaterials, "/inventory/materials", "warning"),
        exception("stock-abnormal", "成品库存异常", counts.abnormalFinishedStock, "/inventory/products", "danger")
      ],
      workbench
    };
  }

  const [
    submittedFba,
    activeProductionOrders,
    shortageMaterials,
    purchaseInbound,
    productionInbound,
    fbaOutbound,
    recentTransactions
  ] = await Promise.all([
    getFbaRequestsByStatus(["submitted"], "读取待排产 FBA 备货需求"),
    getProductionOrdersByStatus(["in_progress"], "读取生产中任务"),
    getMaterialRequirementsByStatus(["shortage"], "读取缺料物料"),
    getPurchaseOrdersByStatus(["ordered", "partially_received"], "读取待采购入库采购单"),
    getPendingProductionInboundOrders(),
    getFbaRequestsByStatus(["completed"], "读取待 FBA 出库备货需求"),
    getRecentInventoryTransactions()
  ]);

  const summaryCards = [
    card("pending-planning", "待排产 FBA", counts.fbaSubmitted, "/production/planning", "info"),
    card("production-active", "生产中任务", counts.productionInProgress, "/production/orders", "warning"),
    card("shortage", "缺料物料", counts.shortageMaterials, "/materials/requirements", "danger"),
    card("purchase-waiting", "待采购 / 待到货", counts.purchaseDraft + counts.purchaseOrdered, "/purchase/orders", "info"),
    card("inbound", "待入库", counts.purchaseOrdered + counts.pendingProductionInbound, "/inventory/inbound", "warning"),
    card("fba-outbound", "待 FBA 出库", counts.fbaCompleted, "/inventory/fba-outbound", "success")
  ];

  return {
    role,
    totalTodoCount: totalCards(summaryCards),
    summaryCards,
    quickLinks: [
      { label: "FBA 备货需求", href: "/replenishment" },
      { label: "厂长排产", href: "/production/planning" },
      { label: "采购单", href: "/purchase/orders" },
      { label: "入库管理", href: "/inventory/inbound" },
      { label: "库存流水", href: "/inventory/transactions" }
    ],
    listSections: [
      section("pending-planning", "FBA 备货", "待排产 FBA 备货需求", "/production/planning", "暂无待排产需求", submittedFba.map(toFbaTodo)),
      section("active-production", "生产跟踪", "生产中任务", "/production/orders", "暂无生产中任务", activeProductionOrders.map(toProductionTodo)),
      section("shortage-materials", "物料需求", "缺料物料", "/materials/requirements", "暂无缺料物料", shortageMaterials.map(toMaterialTodo)),
      section("purchase-inbound", "采购和入库", "待采购入库采购单", "/inventory/inbound", "暂无待采购入库采购单", purchaseInbound.map(toPurchaseTodo)),
      section("production-inbound", "生产入库", "待生产入库任务", "/inventory/inbound", "暂无待生产入库任务", productionInbound.map(toProductionTodo)),
      section("fba-outbound", "FBA 出库", "待 FBA 出库备货单", "/inventory/fba-outbound", "暂无待 FBA 出库备货单", fbaOutbound.map(toFbaTodo)),
      section("recent-transactions", "库存追踪", "最近库存流水", "/inventory/transactions", "暂无库存流水", recentTransactions.map(toTransactionTodo))
    ],
    exceptions: [
      exception("overdue-fba", "超期 FBA 备货单", counts.overdueFba, "/replenishment", "danger"),
      exception("overdue-production", "超期生产任务", counts.overdueProduction, "/production/orders", "danger"),
      exception("overdue-purchase", "超期采购单", counts.overduePurchase, "/purchase/orders", "danger"),
      exception("products-no-brand", "未设置品牌的产品", counts.productsWithoutBrand, "/admin/products", "warning"),
      exception("materials-no-supplier", "未设置默认供应商的辅料", counts.materialsWithoutSupplier, "/admin/materials", "warning"),
      exception("low-stock-material", "低库存辅料", counts.lowStockMaterials, "/inventory/materials", "warning")
    ],
    workbench
  };
}
