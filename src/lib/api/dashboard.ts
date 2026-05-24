import { getSupabaseClient } from "@/lib/supabase/client";

export type DashboardStats = {
  pendingProductionReplenishmentCount: number;
  activeProductionOrderCount: number;
  shortageMaterialCount: number;
  purchasePendingMaterialCount: number;
  pendingInboundPurchaseOrderCount: number;
  finishedGoodStockSkuCount: number;
  lowStockMaterialCount: number;
};

export type DashboardSku = {
  id: string;
  sku_code: string;
  sku_name: string;
  sku_type?: string;
  unit?: string;
};

export type LatestReplenishmentRequest = {
  id: string;
  request_no: string;
  sku_id: string;
  requested_quantity: number;
  notes: string | null;
  status: string;
  created_at: string;
  sku: DashboardSku | null;
  items: Array<{
    id: string;
    requested_quantity: number;
  }>;
  sku_count: number;
  total_requested_quantity: number;
};

export type ActiveProductionOrder = {
  id: string;
  production_order_no: string;
  sku_id: string;
  planned_quantity: number;
  status: string;
  planned_end_date: string | null;
  created_at: string;
  sku: DashboardSku | null;
  items: Array<{
    id: string;
    planned_quantity: number;
  }>;
  sku_count: number;
  total_planned_quantity: number;
};

export type ShortageMaterial = {
  id: string;
  production_order_id: string;
  material_sku_id: string;
  shortage_quantity: number;
  status: string;
  created_at: string;
  production_order: {
    id: string;
    production_order_no: string;
  } | null;
  material_sku: DashboardSku | null;
};

export type RecentInventoryTransaction = {
  id: string;
  transaction_no: string;
  warehouse_id: string;
  sku_id: string;
  transaction_type: string;
  quantity: number;
  occurred_at: string;
  sku: DashboardSku | null;
  warehouse: {
    id: string;
    warehouse_code: string;
    name: string;
  } | null;
};

type MaybeRelation<T> = T | T[] | null;

type CountResult = {
  count: number | null;
  error: { message: string } | null;
};

type RawLatestReplenishmentRequest = Omit<
  LatestReplenishmentRequest,
  "sku" | "sku_count" | "total_requested_quantity"
> & {
  sku: MaybeRelation<DashboardSku>;
};

type RawActiveProductionOrder = Omit<
  ActiveProductionOrder,
  "sku" | "sku_count" | "total_planned_quantity"
> & {
  sku: MaybeRelation<DashboardSku>;
};

type RawShortageMaterial = Omit<
  ShortageMaterial,
  "production_order" | "material_sku"
> & {
  production_order: MaybeRelation<
    NonNullable<ShortageMaterial["production_order"]>
  >;
  material_sku: MaybeRelation<DashboardSku>;
};

type RawRecentInventoryTransaction = Omit<
  RecentInventoryTransaction,
  "sku" | "warehouse"
> & {
  sku: MaybeRelation<DashboardSku>;
  warehouse: MaybeRelation<NonNullable<RecentInventoryTransaction["warehouse"]>>;
};

type InventoryStockRow = {
  sku_id: string;
  item_type: string;
  quantity_on_hand: number;
  safety_stock_quantity: number | null;
  sku: MaybeRelation<Pick<DashboardSku, "id" | "sku_type">>;
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

function isFinishedGoodStock(row: InventoryStockRow) {
  const sku = singleRelation(row.sku);
  const stockType = row.item_type;
  const skuType = sku?.sku_type;

  return (
    Number(row.quantity_on_hand) > 0 &&
    (stockType === "finished_good" ||
      stockType === "finished_product" ||
      skuType === "finished_good" ||
      skuType === "finished_product")
  );
}

function isLowStockMaterial(row: InventoryStockRow) {
  const sku = singleRelation(row.sku);
  const isMaterial = row.item_type === "material" || sku?.sku_type === "material";

  if (!isMaterial) {
    return false;
  }

  const quantity = Number(row.quantity_on_hand);

  if (row.safety_stock_quantity === null) {
    return quantity <= 0;
  }

  return quantity < Number(row.safety_stock_quantity);
}

async function getFinishedGoodStockSkuCount() {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .select(
        `
          sku_id,
          item_type,
          quantity_on_hand,
          safety_stock_quantity,
          sku:skus!inventory_items_sku_id_fkey (
            id,
            sku_type
          )
        `
      )
      .gt("quantity_on_hand", 0),
    "统计成品库存 SKU 数量"
  );

  if (error) {
    throw formatSupabaseError("统计成品库存 SKU 数量", error);
  }

  const skuIds = new Set<string>();

  for (const row of (data ?? []) as unknown as InventoryStockRow[]) {
    if (isFinishedGoodStock(row)) {
      skuIds.add(row.sku_id);
    }
  }

  return skuIds.size;
}

async function getLowStockMaterialCount() {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("inventory_items").select(
      `
        sku_id,
        item_type,
        quantity_on_hand,
        safety_stock_quantity,
        sku:skus!inventory_items_sku_id_fkey (
          id,
          sku_type
        )
      `
    ),
    "统计原材料低库存数量"
  );

  if (error) {
    throw formatSupabaseError("统计原材料低库存数量", error);
  }

  return ((data ?? []) as unknown as InventoryStockRow[]).filter(isLowStockMaterial)
    .length;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const supabase = getSupabaseClient();

  const [
    pendingProductionReplenishmentCount,
    activeProductionOrderCount,
    shortageMaterialCount,
    purchasePendingMaterialCount,
    pendingInboundPurchaseOrderCount,
    finishedGoodStockSkuCount,
    lowStockMaterialCount
  ] = await Promise.all([
    getExactCount(
      supabase
        .from("fba_replenishment_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "submitted"),
      "统计待排产 FBA 备货需求数量"
    ),
    getExactCount(
      supabase
        .from("production_orders")
        .select("id", { count: "exact", head: true })
        .eq("status", "in_progress"),
      "统计生产中任务数量"
    ),
    getExactCount(
      supabase
        .from("material_requirements")
        .select("id", { count: "exact", head: true })
        .eq("status", "shortage"),
      "统计缺料物料数量"
    ),
    getExactCount(
      supabase
        .from("material_requirements")
        .select("id", { count: "exact", head: true })
        .in("status", ["shortage", "purchased"]),
      "统计待采购或已采购待到货数量"
    ),
    getExactCount(
      supabase
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .in("status", ["ordered", "partially_received"]),
      "统计待入库采购单数量"
    ),
    getFinishedGoodStockSkuCount(),
    getLowStockMaterialCount()
  ]);

  return {
    pendingProductionReplenishmentCount,
    activeProductionOrderCount,
    shortageMaterialCount,
    purchasePendingMaterialCount,
    pendingInboundPurchaseOrderCount,
    finishedGoodStockSkuCount,
    lowStockMaterialCount
  };
}

export async function getLatestReplenishmentRequests(): Promise<
  LatestReplenishmentRequest[]
> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .select(
        `
          id,
          request_no,
          sku_id,
          requested_quantity,
          notes,
          status,
          created_at,
          sku:skus!fba_replenishment_requests_sku_id_fkey (
            id,
            sku_code,
            sku_name
          ),
          items:fba_replenishment_request_items!fba_replenishment_request_items_request_id_fkey (
            id,
            requested_quantity
          )
        `
      )
      .order("created_at", { ascending: false })
      .limit(5),
    "读取最新 FBA 备货需求"
  );

  if (error) {
    throw formatSupabaseError("读取最新 FBA 备货需求", error);
  }

  return ((data ?? []) as unknown as RawLatestReplenishmentRequest[]).map(
    (request) => ({
      ...request,
      sku: singleRelation(request.sku),
      sku_count: request.items?.length ?? 0,
      total_requested_quantity:
        request.items && request.items.length > 0
          ? request.items.reduce(
              (sum, item) => sum + Number(item.requested_quantity),
              0
            )
          : Number(request.requested_quantity)
    })
  );
}

export async function getActiveProductionOrders(): Promise<
  ActiveProductionOrder[]
> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("production_orders")
      .select(
        `
          id,
          production_order_no,
          sku_id,
          planned_quantity,
          status,
          planned_end_date,
          created_at,
          sku:skus!production_orders_sku_id_fkey (
            id,
            sku_code,
            sku_name
          ),
          items:production_order_items!production_order_items_production_order_id_fkey (
            id,
            planned_quantity
          )
        `
      )
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(5),
    "读取进行中的生产任务"
  );

  if (error) {
    throw formatSupabaseError("读取进行中的生产任务", error);
  }

  return ((data ?? []) as unknown as RawActiveProductionOrder[]).map((order) => ({
    ...order,
    sku: singleRelation(order.sku),
    sku_count: order.items?.length ?? 0,
    total_planned_quantity:
      order.items && order.items.length > 0
        ? order.items.reduce((sum, item) => sum + Number(item.planned_quantity), 0)
        : Number(order.planned_quantity)
  }));
}

export async function getShortageMaterials(): Promise<ShortageMaterial[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("material_requirements")
      .select(
        `
          id,
          production_order_id,
          material_sku_id,
          shortage_quantity,
          status,
          created_at,
          production_order:production_orders!material_requirements_production_order_id_fkey (
            id,
            production_order_no
          ),
          material_sku:skus!material_requirements_material_sku_id_fkey (
            id,
            sku_code,
            sku_name
          )
        `
      )
      .eq("status", "shortage")
      .order("created_at", { ascending: false })
      .limit(5),
    "读取缺料提醒"
  );

  if (error) {
    throw formatSupabaseError("读取缺料提醒", error);
  }

  return ((data ?? []) as unknown as RawShortageMaterial[]).map((material) => ({
    ...material,
    production_order: singleRelation(material.production_order),
    material_sku: singleRelation(material.material_sku)
  }));
}

export async function getRecentInventoryTransactions(): Promise<
  RecentInventoryTransaction[]
> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_transactions")
      .select(
        `
          id,
          transaction_no,
          warehouse_id,
          sku_id,
          transaction_type,
          quantity,
          occurred_at,
          sku:skus!inventory_transactions_sku_id_fkey (
            id,
            sku_code,
            sku_name
          ),
          warehouse:warehouses!inventory_transactions_warehouse_id_fkey (
            id,
            warehouse_code,
            name
          )
        `
      )
      .order("occurred_at", { ascending: false })
      .limit(8),
    "读取最近库存流水"
  );

  if (error) {
    throw formatSupabaseError("读取最近库存流水", error);
  }

  return ((data ?? []) as unknown as RawRecentInventoryTransaction[]).map(
    (transaction) => ({
      ...transaction,
      sku: singleRelation(transaction.sku),
      warehouse: singleRelation(transaction.warehouse)
    })
  );
}
