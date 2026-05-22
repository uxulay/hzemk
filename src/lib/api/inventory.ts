import { getSupabaseClient } from "@/lib/supabase/client";

export type InventoryTransactionType =
  | "material_in"
  | "material_out"
  | "product_in"
  | "product_out"
  | "adjustment";

export type InventoryTransactionTypeFilter =
  | InventoryTransactionType
  | "all";

export type InventoryTransactionRelatedOrderType =
  | "purchase_order"
  | "production_order"
  | "fba_replenishment_request";

export type InventoryTransactionFilters = {
  transactionType?: InventoryTransactionTypeFilter;
  warehouseId?: string;
  skuKeyword?: string;
  startDate?: string;
  endDate?: string;
};

export type InventoryTransactionWarehouse = {
  id: string;
  warehouse_code: string;
  name: string;
  warehouse_type: string;
  status: string;
};

export type InventoryTransactionRow = {
  id: string;
  transaction_no: string;
  warehouse_id: string;
  sku_id: string;
  transaction_type: InventoryTransactionType;
  quantity: number;
  production_order_id: string | null;
  purchase_order_id: string | null;
  replenishment_request_id: string | null;
  operator_id: string | null;
  occurred_at: string;
  notes: string | null;
  created_at: string;
  warehouse: InventoryTransactionWarehouse | null;
  sku: {
    id: string;
    sku_code: string;
    sku_name: string;
    sku_type: string;
    unit: string;
    product: {
      id: string;
      product_code: string;
      name: string;
    } | null;
  } | null;
  purchase_order: {
    id: string;
    purchase_order_no: string;
  } | null;
  production_order: {
    id: string;
    production_order_no: string;
  } | null;
  replenishment_request: {
    id: string;
    request_no: string;
  } | null;
  operator: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  related_order_type: InventoryTransactionRelatedOrderType | null;
  related_order_no: string | null;
};

export type InventoryStockStatus = "out_of_stock" | "low_stock" | "normal";

export type InventoryStockStatusFilter = InventoryStockStatus | "all";

export type CurrentInventoryFilters = {
  warehouseId?: string;
  skuKeyword?: string;
  stockStatus?: InventoryStockStatusFilter;
};

export type CurrentInventoryWarehouse = {
  id: string;
  warehouse_code: string;
  name: string;
  warehouse_type: string;
  status: string;
};

export type CurrentInventoryProduct = {
  id: string;
  product_code: string;
  name: string;
} | null;

export type CurrentInventorySku = {
  id: string;
  product_id: string | null;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  unit: string;
  product: CurrentInventoryProduct;
};

export type CurrentInventoryRow = {
  id: string;
  warehouse_id: string;
  sku_id: string;
  item_type: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  safety_stock_quantity: number | null;
  unit: string;
  updated_at: string;
  warehouse: CurrentInventoryWarehouse | null;
  sku: CurrentInventorySku | null;
};

export type MaterialInventoryRow = CurrentInventoryRow & {
  stock_status: InventoryStockStatus;
};

export type ProductInventoryRow = CurrentInventoryRow;

export type PurchaseOrderInboundStatus =
  | "ordered"
  | "partially_received"
  | "received";

export type ReceivablePurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  sku_id: string;
  material_requirement_id: string | null;
  ordered_quantity: number;
  received_quantity: number;
  unit: string;
  unit_price: number | null;
  sku: {
    id: string;
    sku_code: string;
    sku_name: string;
    unit: string;
  } | null;
  material_requirement: {
    id: string;
    status: string;
  } | null;
};

export type ReceivablePurchaseOrder = {
  id: string;
  purchase_order_no: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  status: PurchaseOrderInboundStatus;
  ordered_at: string | null;
  expected_arrival_date: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  supplier: {
    id: string;
    supplier_code: string;
    name: string;
  } | null;
  items: ReceivablePurchaseOrderItem[];
};

export type ReceivableProductionOrder = {
  id: string;
  production_order_no: string;
  replenishment_request_id: string | null;
  sku_id: string;
  planned_quantity: number;
  completed_quantity: number;
  status: string;
  planned_start_date: string | null;
  planned_end_date: string | null;
  notes: string | null;
  sku: {
    id: string;
    sku_code: string;
    sku_name: string;
    unit: string;
    product: {
      id: string;
      product_code: string;
      name: string;
    } | null;
  } | null;
  replenishment_request: {
    id: string;
    request_no: string;
    requested_quantity: number;
    status: string;
  } | null;
};

export type FbaOutboundRequest = {
  id: string;
  request_no: string;
  sku_id: string;
  target_warehouse_id: string | null;
  fba_warehouse_code: string | null;
  requested_quantity: number;
  target_ship_date: string | null;
  priority: string;
  status: string;
  notes: string | null;
  created_at: string;
  sku: {
    id: string;
    sku_code: string;
    sku_name: string;
    amazon_sku: string | null;
    fnsku: string | null;
    unit: string;
    product: {
      id: string;
      product_code: string;
      name: string;
    } | null;
  } | null;
  target_warehouse: {
    id: string;
    warehouse_code: string;
    name: string;
    warehouse_type: string;
  } | null;
  production_orders: Array<{
    id: string;
    production_order_no: string;
    planned_quantity: number;
    completed_quantity: number;
    status: string;
  }>;
  current_inventory_quantity: number;
  outbound_quantity: number;
  pending_outbound_quantity: number;
};

export type ReceivePurchaseOrderItemsInput = {
  purchaseOrderId: string;
  warehouseId: string;
  items: Array<{
    purchaseOrderItemId: string;
    receiveQuantity: number;
  }>;
};

export type ReceiveProductionOrderInput = {
  productionOrderId: string;
  warehouseId: string;
  receiveQuantity: number;
};

export type CreateFbaOutboundInput = {
  replenishmentRequestId: string;
  warehouseId: string;
  outboundQuantity: number;
  logisticsNotes?: string;
  operationNotes?: string;
};

type MaybeRelation<T> = T | T[] | null;

type RawReceivablePurchaseOrderItem = Omit<
  ReceivablePurchaseOrderItem,
  "sku" | "material_requirement"
> & {
  sku: MaybeRelation<NonNullable<ReceivablePurchaseOrderItem["sku"]>>;
  material_requirement: MaybeRelation<
    NonNullable<ReceivablePurchaseOrderItem["material_requirement"]>
  >;
};

type RawReceivablePurchaseOrder = Omit<
  ReceivablePurchaseOrder,
  "supplier" | "items"
> & {
  supplier: MaybeRelation<NonNullable<ReceivablePurchaseOrder["supplier"]>>;
  items: RawReceivablePurchaseOrderItem[] | null;
};

type RawReceivableProductionOrder = Omit<
  ReceivableProductionOrder,
  "sku" | "replenishment_request"
> & {
  sku: MaybeRelation<
    Omit<NonNullable<ReceivableProductionOrder["sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<NonNullable<ReceivableProductionOrder["sku"]>["product"]>
      >;
    }
  >;
  replenishment_request: MaybeRelation<
    NonNullable<ReceivableProductionOrder["replenishment_request"]>
  >;
};

type RawFbaOutboundRequest = Omit<
  FbaOutboundRequest,
  | "sku"
  | "target_warehouse"
  | "production_orders"
  | "current_inventory_quantity"
  | "outbound_quantity"
  | "pending_outbound_quantity"
> & {
  sku: MaybeRelation<
    Omit<NonNullable<FbaOutboundRequest["sku"]>, "product"> & {
      product: MaybeRelation<NonNullable<NonNullable<FbaOutboundRequest["sku"]>["product"]>>;
    }
  >;
  target_warehouse: MaybeRelation<
    NonNullable<FbaOutboundRequest["target_warehouse"]>
  >;
  production_orders: FbaOutboundRequest["production_orders"] | null;
};

type RawInventoryTransactionRow = Omit<
  InventoryTransactionRow,
  | "warehouse"
  | "sku"
  | "purchase_order"
  | "production_order"
  | "replenishment_request"
  | "operator"
  | "related_order_type"
  | "related_order_no"
> & {
  warehouse: MaybeRelation<InventoryTransactionRow["warehouse"]>;
  sku: MaybeRelation<
    Omit<NonNullable<InventoryTransactionRow["sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<NonNullable<InventoryTransactionRow["sku"]>["product"]>
      >;
    }
  >;
  purchase_order: MaybeRelation<InventoryTransactionRow["purchase_order"]>;
  production_order: MaybeRelation<InventoryTransactionRow["production_order"]>;
  replenishment_request: MaybeRelation<
    InventoryTransactionRow["replenishment_request"]
  >;
  operator: MaybeRelation<InventoryTransactionRow["operator"]>;
};

type RawCurrentInventoryRow = Omit<CurrentInventoryRow, "warehouse" | "sku"> & {
  warehouse: MaybeRelation<CurrentInventoryWarehouse>;
  sku: MaybeRelation<
    Omit<CurrentInventorySku, "product"> & {
      product: MaybeRelation<NonNullable<CurrentInventoryProduct>>;
    }
  >;
};

type InventoryItem = {
  id: string;
  warehouse_id: string;
  sku_id: string;
  item_type: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  safety_stock_quantity: number;
  unit: string;
};

type InventoryTransactionQuantity = {
  replenishment_request_id: string | null;
  sku_id: string;
  quantity: number;
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

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function createInventoryTransactionNo() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `INV-${datePart}-${randomPart}`;
}

function getPurchaseOrderSelect() {
  return `
    id,
    purchase_order_no,
    supplier_id,
    warehouse_id,
    status,
    ordered_at,
    expected_arrival_date,
    received_at,
    notes,
    created_at,
    supplier:suppliers!purchase_orders_supplier_id_fkey (
      id,
      supplier_code,
      name
    ),
    items:purchase_order_items!purchase_order_items_purchase_order_id_fkey (
      id,
      purchase_order_id,
      sku_id,
      material_requirement_id,
      ordered_quantity,
      received_quantity,
      unit,
      unit_price,
      sku:skus!purchase_order_items_sku_id_fkey (
        id,
        sku_code,
        sku_name,
        unit
      ),
      material_requirement:material_requirements!purchase_order_items_material_requirement_id_fkey (
        id,
        status
      )
    )
  `;
}

function normalizePurchaseOrderItem(
  item: RawReceivablePurchaseOrderItem
): ReceivablePurchaseOrderItem {
  return {
    ...item,
    sku: singleRelation(item.sku),
    material_requirement: singleRelation(item.material_requirement)
  };
}

function normalizePurchaseOrder(
  order: RawReceivablePurchaseOrder
): ReceivablePurchaseOrder {
  return {
    ...order,
    supplier: singleRelation(order.supplier),
    items: (order.items ?? []).map(normalizePurchaseOrderItem)
  };
}

function normalizeProductionOrder(
  order: RawReceivableProductionOrder
): ReceivableProductionOrder {
  const sku = singleRelation(order.sku);

  return {
    ...order,
    sku: sku
      ? {
          ...sku,
          product: singleRelation(sku.product)
        }
      : null,
    replenishment_request: singleRelation(order.replenishment_request)
  };
}

function normalizeFbaOutboundRequest(
  request: RawFbaOutboundRequest,
  inventoryBySku: Map<string, number>,
  outboundByRequest: Map<string, number>
): FbaOutboundRequest {
  const sku = singleRelation(request.sku);
  const outboundQuantity = outboundByRequest.get(request.id) ?? 0;
  const pendingOutboundQuantity = roundQuantity(
    Math.max(0, Number(request.requested_quantity) - outboundQuantity)
  );

  return {
    ...request,
    sku: sku
      ? {
          ...sku,
          product: singleRelation(sku.product)
        }
      : null,
    target_warehouse: singleRelation(request.target_warehouse),
    production_orders: request.production_orders ?? [],
    current_inventory_quantity: inventoryBySku.get(request.sku_id) ?? 0,
    outbound_quantity: outboundQuantity,
    pending_outbound_quantity: pendingOutboundQuantity
  };
}

function getDateBoundaryIso(dateValue: string, boundary: "start" | "end") {
  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return dateValue;
  }

  const date =
    boundary === "start"
      ? new Date(year, month - 1, day, 0, 0, 0, 0)
      : new Date(year, month - 1, day, 23, 59, 59, 999);

  return date.toISOString();
}

export function getTransactionRelatedOrderNo(transaction: {
  purchase_order_id: string | null;
  production_order_id: string | null;
  replenishment_request_id: string | null;
  purchase_order?: InventoryTransactionRow["purchase_order"];
  production_order?: InventoryTransactionRow["production_order"];
  replenishment_request?: InventoryTransactionRow["replenishment_request"];
}): {
  type: InventoryTransactionRelatedOrderType | null;
  orderNo: string | null;
} {
  if (transaction.purchase_order_id) {
    return {
      type: "purchase_order",
      orderNo: transaction.purchase_order?.purchase_order_no ?? null
    };
  }

  if (transaction.production_order_id) {
    return {
      type: "production_order",
      orderNo: transaction.production_order?.production_order_no ?? null
    };
  }

  if (transaction.replenishment_request_id) {
    return {
      type: "fba_replenishment_request",
      orderNo: transaction.replenishment_request?.request_no ?? null
    };
  }

  return {
    type: null,
    orderNo: null
  };
}

function normalizeInventoryTransaction(
  transaction: RawInventoryTransactionRow
): InventoryTransactionRow {
  const sku = singleRelation(transaction.sku);
  const purchaseOrder = singleRelation(transaction.purchase_order);
  const productionOrder = singleRelation(transaction.production_order);
  const replenishmentRequest = singleRelation(transaction.replenishment_request);
  const relatedOrder = getTransactionRelatedOrderNo({
    purchase_order_id: transaction.purchase_order_id,
    production_order_id: transaction.production_order_id,
    replenishment_request_id: transaction.replenishment_request_id,
    purchase_order: purchaseOrder,
    production_order: productionOrder,
    replenishment_request: replenishmentRequest
  });

  return {
    ...transaction,
    warehouse: singleRelation(transaction.warehouse),
    sku: sku
      ? {
          ...sku,
          product: singleRelation(sku.product)
        }
      : null,
    purchase_order: purchaseOrder,
    production_order: productionOrder,
    replenishment_request: replenishmentRequest,
    operator: singleRelation(transaction.operator),
    related_order_type: relatedOrder.type,
    related_order_no: relatedOrder.orderNo
  };
}

function getCurrentInventorySelect() {
  return `
    id,
    warehouse_id,
    sku_id,
    item_type,
    quantity_on_hand,
    reserved_quantity,
    safety_stock_quantity,
    unit,
    updated_at,
    warehouse:warehouses!inventory_items_warehouse_id_fkey (
      id,
      warehouse_code,
      name,
      warehouse_type,
      status
    ),
    sku:skus!inventory_items_sku_id_fkey (
      id,
      product_id,
      sku_code,
      sku_name,
      sku_type,
      unit,
      product:products!skus_product_id_fkey (
        id,
        product_code,
        name
      )
    )
  `;
}

function normalizeCurrentInventory(row: RawCurrentInventoryRow): CurrentInventoryRow {
  const sku = singleRelation(row.sku);

  return {
    ...row,
    quantity_on_hand: Number(row.quantity_on_hand),
    reserved_quantity: Number(row.reserved_quantity),
    safety_stock_quantity:
      row.safety_stock_quantity === null
        ? null
        : Number(row.safety_stock_quantity),
    warehouse: singleRelation(row.warehouse),
    sku: sku
      ? {
          ...sku,
          product: singleRelation(sku.product)
        }
      : null
  };
}

function sortCurrentInventoryRows<T extends CurrentInventoryRow>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const skuCompare = (a.sku?.sku_code ?? "").localeCompare(
      b.sku?.sku_code ?? "",
      "zh-CN"
    );

    if (skuCompare !== 0) {
      return skuCompare;
    }

    return (a.warehouse?.warehouse_code ?? "").localeCompare(
      b.warehouse?.warehouse_code ?? "",
      "zh-CN"
    );
  });
}

function matchesSkuKeyword(row: CurrentInventoryRow, keyword: string) {
  const normalizedKeyword = keyword.trim().toLowerCase();

  if (!normalizedKeyword) {
    return true;
  }

  return [row.sku?.sku_code, row.sku?.sku_name]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(normalizedKeyword));
}

async function getCurrentInventoryRows(
  skuType: "material" | "finished_good",
  filters: CurrentInventoryFilters,
  action: string
): Promise<CurrentInventoryRow[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("inventory_items")
    .select(getCurrentInventorySelect())
    .order("updated_at", { ascending: false });

  if (filters.warehouseId) {
    query = query.eq("warehouse_id", filters.warehouseId);
  }

  const { data, error } = await withTimeout(query, action);

  if (error) {
    throw formatSupabaseError(action, error);
  }

  const keyword = filters.skuKeyword ?? "";

  return sortCurrentInventoryRows(
    ((data ?? []) as unknown as RawCurrentInventoryRow[])
      .map(normalizeCurrentInventory)
      .filter((row) => row.sku?.sku_type === skuType)
      .filter((row) => matchesSkuKeyword(row, keyword))
  );
}

export function getMaterialInventoryStatus(
  row: Pick<CurrentInventoryRow, "quantity_on_hand" | "safety_stock_quantity">
): InventoryStockStatus {
  const quantity = Number(row.quantity_on_hand);

  if (quantity <= 0) {
    return "out_of_stock";
  }

  if (
    row.safety_stock_quantity !== null &&
    quantity < Number(row.safety_stock_quantity)
  ) {
    return "low_stock";
  }

  return "normal";
}

export async function getMaterialInventory(
  filters: CurrentInventoryFilters = {}
): Promise<MaterialInventoryRow[]> {
  const rows = await getCurrentInventoryRows(
    "material",
    filters,
    "读取原材料库存"
  );
  const rowsWithStatus = rows.map((row) => ({
    ...row,
    stock_status: getMaterialInventoryStatus(row)
  }));

  if (filters.stockStatus && filters.stockStatus !== "all") {
    return rowsWithStatus.filter(
      (row) => row.stock_status === filters.stockStatus
    );
  }

  return rowsWithStatus;
}

export async function getProductInventory(
  filters: CurrentInventoryFilters = {}
): Promise<ProductInventoryRow[]> {
  return getCurrentInventoryRows("finished_good", filters, "读取成品库存");
}

async function getSkuIdsByKeyword(keyword: string): Promise<string[]> {
  const trimmedKeyword = keyword.trim();

  if (!trimmedKeyword) {
    return [];
  }

  const supabase = getSupabaseClient();
  const escapedKeyword = trimmedKeyword
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  const { data, error } = await withTimeout(
    supabase
      .from("skus")
      .select("id")
      .or(`sku_code.ilike.%${escapedKeyword}%,sku_name.ilike.%${escapedKeyword}%`),
    "按 SKU 搜索库存流水"
  );

  if (error) {
    throw formatSupabaseError("按 SKU 搜索库存流水", error);
  }

  return ((data ?? []) as Array<{ id: string }>).map((item) => item.id);
}

export async function getWarehousesForFilter(): Promise<
  InventoryTransactionWarehouse[]
> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("warehouses")
      .select("id, warehouse_code, name, warehouse_type, status")
      .order("warehouse_code", { ascending: true }),
    "读取仓库筛选项"
  );

  if (error) {
    throw formatSupabaseError("读取仓库筛选项", error);
  }

  return (data ?? []) as InventoryTransactionWarehouse[];
}

export async function getInventoryTransactions(
  filters: InventoryTransactionFilters = {}
): Promise<InventoryTransactionRow[]> {
  const supabase = getSupabaseClient();
  const skuKeyword = filters.skuKeyword?.trim() ?? "";
  const skuIds = skuKeyword ? await getSkuIdsByKeyword(skuKeyword) : [];

  if (skuKeyword && skuIds.length === 0) {
    return [];
  }

  let query = supabase
    .from("inventory_transactions")
    .select(
      `
        id,
        transaction_no,
        warehouse_id,
        sku_id,
        transaction_type,
        quantity,
        production_order_id,
        purchase_order_id,
        replenishment_request_id,
        operator_id,
        occurred_at,
        notes,
        created_at,
        warehouse:warehouses!inventory_transactions_warehouse_id_fkey (
          id,
          warehouse_code,
          name,
          warehouse_type,
          status
        ),
        sku:skus!inventory_transactions_sku_id_fkey (
          id,
          sku_code,
          sku_name,
          sku_type,
          unit,
          product:products!skus_product_id_fkey (
            id,
            product_code,
            name
          )
        ),
        purchase_order:purchase_orders!inventory_transactions_purchase_order_id_fkey (
          id,
          purchase_order_no
        ),
        production_order:production_orders!inventory_transactions_production_order_id_fkey (
          id,
          production_order_no
        ),
        replenishment_request:fba_replenishment_requests!inventory_transactions_replenishment_request_id_fkey (
          id,
          request_no
        ),
        operator:profiles!inventory_transactions_operator_id_fkey (
          id,
          full_name,
          email
        )
      `
    )
    .order("occurred_at", { ascending: false });

  if (filters.transactionType && filters.transactionType !== "all") {
    query = query.eq("transaction_type", filters.transactionType);
  }

  if (filters.warehouseId) {
    query = query.eq("warehouse_id", filters.warehouseId);
  }

  if (skuIds.length > 0) {
    query = query.in("sku_id", skuIds);
  }

  if (filters.startDate) {
    query = query.gte(
      "occurred_at",
      getDateBoundaryIso(filters.startDate, "start")
    );
  }

  if (filters.endDate) {
    query = query.lte("occurred_at", getDateBoundaryIso(filters.endDate, "end"));
  }

  const { data, error } = await withTimeout(query, "读取库存流水");

  if (error) {
    throw formatSupabaseError("读取库存流水", error);
  }

  return ((data ?? []) as unknown as RawInventoryTransactionRow[]).map(
    normalizeInventoryTransaction
  );
}

export async function upsertInventoryItem(input: {
  warehouseId: string;
  skuId: string;
  itemType: string;
  quantity: number;
  unit: string;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .select(
        "id, warehouse_id, sku_id, item_type, quantity_on_hand, reserved_quantity, safety_stock_quantity, unit"
      )
      .eq("warehouse_id", input.warehouseId)
      .eq("sku_id", input.skuId)
      .maybeSingle(),
    "读取当前库存"
  );

  if (error) {
    throw formatSupabaseError("读取当前库存", error);
  }

  const existing = data as InventoryItem | null;

  if (existing) {
    const nextQuantity = roundQuantity(
      Number(existing.quantity_on_hand) + input.quantity
    );
    const { error: updateError } = await withTimeout(
      supabase
        .from("inventory_items")
        .update({
          quantity_on_hand: nextQuantity,
          item_type: existing.item_type || input.itemType,
          unit: existing.unit || input.unit
        })
        .eq("id", existing.id),
      "更新当前库存"
    );

    if (updateError) {
      throw formatSupabaseError("更新当前库存", updateError);
    }

    return;
  }

  const { error: insertError } = await withTimeout(
    supabase.from("inventory_items").insert({
      warehouse_id: input.warehouseId,
      sku_id: input.skuId,
      item_type: input.itemType,
      quantity_on_hand: input.quantity,
      reserved_quantity: 0,
      safety_stock_quantity: 0,
      unit: input.unit
    }),
    "新增当前库存"
  );

  if (insertError) {
    throw formatSupabaseError("新增当前库存", insertError);
  }
}

export async function createInventoryTransaction(input: {
  warehouseId: string;
  skuId: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  purchaseOrderId?: string | null;
  productionOrderId?: string | null;
  replenishmentRequestId?: string | null;
  notes?: string | null;
}) {
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("inventory_transactions").insert({
      transaction_no: createInventoryTransactionNo(),
      warehouse_id: input.warehouseId,
      sku_id: input.skuId,
      transaction_type: input.transactionType,
      quantity: input.quantity,
      purchase_order_id: input.purchaseOrderId ?? null,
      production_order_id: input.productionOrderId ?? null,
      replenishment_request_id: input.replenishmentRequestId ?? null,
      operator_id: null,
      occurred_at: new Date().toISOString(),
      notes: input.notes ?? null
    }),
    "写入库存流水"
  );

  if (error) {
    throw formatSupabaseError("写入库存流水", error);
  }
}

async function getPurchaseOrderById(
  purchaseOrderId: string
): Promise<ReceivablePurchaseOrder> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("purchase_orders")
      .select(getPurchaseOrderSelect())
      .eq("id", purchaseOrderId)
      .single(),
    "读取采购单"
  );

  if (error) {
    throw formatSupabaseError("读取采购单", error);
  }

  return normalizePurchaseOrder(data as unknown as RawReceivablePurchaseOrder);
}

export async function getReceivablePurchaseOrders(): Promise<
  ReceivablePurchaseOrder[]
> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("purchase_orders")
      .select(getPurchaseOrderSelect())
      .in("status", ["ordered", "partially_received"])
      .order("created_at", { ascending: false }),
    "读取可入库采购单"
  );

  if (error) {
    throw formatSupabaseError("读取可入库采购单", error);
  }

  return ((data ?? []) as unknown as RawReceivablePurchaseOrder[]).map(
    normalizePurchaseOrder
  );
}

export async function receivePurchaseOrderItems(
  input: ReceivePurchaseOrderItemsInput
) {
  if (!input.warehouseId) {
    throw new Error("请选择入库仓库。");
  }

  const positiveItems = input.items.filter(
    (item) => Number(item.receiveQuantity) > 0
  );

  if (positiveItems.length === 0) {
    throw new Error("请至少填写一条大于 0 的入库数量。");
  }

  const order = await getPurchaseOrderById(input.purchaseOrderId);
  const itemById = new Map(order.items.map((item) => [item.id, item]));
  const materialRequirementIdsToReceive: string[] = [];

  for (const inputItem of positiveItems) {
    const orderItem = itemById.get(inputItem.purchaseOrderItemId);

    if (!orderItem) {
      throw new Error("采购明细不存在，请刷新页面后重试。");
    }

    const receiveQuantity = Number(inputItem.receiveQuantity);
    const remainingQuantity = roundQuantity(
      Number(orderItem.ordered_quantity) - Number(orderItem.received_quantity)
    );

    if (receiveQuantity <= 0) {
      throw new Error("入库数量必须大于 0。");
    }

    if (receiveQuantity > remainingQuantity) {
      throw new Error(
        `${orderItem.sku?.sku_code ?? "采购明细"} 本次入库数量不能超过待入库数量。`
      );
    }

    await createInventoryTransaction({
      warehouseId: input.warehouseId,
      skuId: orderItem.sku_id,
      transactionType: "material_in",
      quantity: receiveQuantity,
      purchaseOrderId: order.id,
      notes: `采购到货入库：${order.purchase_order_no}，单位：${orderItem.unit}`
    });

    await upsertInventoryItem({
      warehouseId: input.warehouseId,
      skuId: orderItem.sku_id,
      itemType: "material",
      quantity: receiveQuantity,
      unit: orderItem.unit
    });

    const nextReceivedQuantity = roundQuantity(
      Number(orderItem.received_quantity) + receiveQuantity
    );
    const supabase = getSupabaseClient();
    const { error: itemError } = await withTimeout(
      supabase
        .from("purchase_order_items")
        .update({ received_quantity: nextReceivedQuantity })
        .eq("id", orderItem.id),
      "更新采购明细到货数量"
    );

    if (itemError) {
      throw formatSupabaseError("更新采购明细到货数量", itemError);
    }

    if (
      orderItem.material_requirement_id &&
      nextReceivedQuantity >= Number(orderItem.ordered_quantity)
    ) {
      materialRequirementIdsToReceive.push(orderItem.material_requirement_id);
    }
  }

  if (materialRequirementIdsToReceive.length > 0) {
    const supabase = getSupabaseClient();
    const { error } = await withTimeout(
      supabase
        .from("material_requirements")
        .update({ status: "received" })
        .in("id", materialRequirementIdsToReceive),
      "更新物料需求到货状态"
    );

    if (error) {
      throw formatSupabaseError("更新物料需求到货状态", error);
    }
  }

  const updatedOrder = await getPurchaseOrderById(input.purchaseOrderId);
  const allReceived = updatedOrder.items.every(
    (item) => Number(item.received_quantity) >= Number(item.ordered_quantity)
  );
  const nextStatus: PurchaseOrderInboundStatus = allReceived
    ? "received"
    : "partially_received";
  const supabase = getSupabaseClient();
  const { error: orderError } = await withTimeout(
    supabase
      .from("purchase_orders")
      .update({
        status: nextStatus,
        warehouse_id: input.warehouseId,
        received_at: allReceived ? new Date().toISOString() : null
      })
      .eq("id", input.purchaseOrderId),
    "更新采购单入库状态"
  );

  if (orderError) {
    throw formatSupabaseError("更新采购单入库状态", orderError);
  }
}

export async function getReceivableProductionOrders(): Promise<
  ReceivableProductionOrder[]
> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("production_orders")
      .select(
        `
          id,
          production_order_no,
          replenishment_request_id,
          sku_id,
          planned_quantity,
          completed_quantity,
          status,
          planned_start_date,
          planned_end_date,
          notes,
          sku:skus!production_orders_sku_id_fkey (
            id,
            sku_code,
            sku_name,
            unit,
            product:products!skus_product_id_fkey (
              id,
              product_code,
              name
            )
          ),
          replenishment_request:fba_replenishment_requests!production_orders_replenishment_request_id_fkey (
            id,
            request_no,
            requested_quantity,
            status
          )
        `
      )
      .in("status", ["planned", "material_pending", "in_progress", "completed"])
      .order("created_at", { ascending: false }),
    "读取可入库生产任务"
  );

  if (error) {
    throw formatSupabaseError("读取可入库生产任务", error);
  }

  return ((data ?? []) as unknown as RawReceivableProductionOrder[]).map(
    normalizeProductionOrder
  );
}

export async function receiveProductionOrder(input: ReceiveProductionOrderInput) {
  if (!input.warehouseId) {
    throw new Error("请选择入库仓库。");
  }

  const receiveQuantity = Number(input.receiveQuantity);

  if (receiveQuantity <= 0) {
    throw new Error("本次入库数量必须大于 0。");
  }

  const order = (await getReceivableProductionOrders()).find(
    (item) => item.id === input.productionOrderId
  );

  if (!order) {
    throw new Error("生产任务不存在或当前不可入库，请刷新页面后重试。");
  }

  await createInventoryTransaction({
    warehouseId: input.warehouseId,
    skuId: order.sku_id,
    transactionType: "product_in",
    quantity: receiveQuantity,
    productionOrderId: order.id,
    replenishmentRequestId: order.replenishment_request_id,
    notes: `生产完成入库：${order.production_order_no}，单位：${order.sku?.unit ?? "pcs"}`
  });

  await upsertInventoryItem({
    warehouseId: input.warehouseId,
    skuId: order.sku_id,
    itemType: "finished_product",
    quantity: receiveQuantity,
    unit: order.sku?.unit ?? "pcs"
  });

  const nextCompletedQuantity = roundQuantity(
    Number(order.completed_quantity) + receiveQuantity
  );
  const isCompleted = nextCompletedQuantity >= Number(order.planned_quantity);
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("production_orders")
      .update({
        completed_quantity: nextCompletedQuantity,
        status: isCompleted ? "completed" : "in_progress",
        actual_completed_at: isCompleted ? new Date().toISOString() : null
      })
      .eq("id", order.id),
    "更新生产任务入库数量"
  );

  if (error) {
    throw formatSupabaseError("更新生产任务入库数量", error);
  }
}

export async function getFinishedGoodsInventory(
  skuIds?: string[],
  warehouseId?: string
): Promise<Map<string, number>> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("inventory_items")
    .select("sku_id, quantity_on_hand, reserved_quantity, item_type, warehouse_id")
    .eq("item_type", "finished_product");

  if (skuIds && skuIds.length > 0) {
    query = query.in("sku_id", skuIds);
  }

  if (warehouseId) {
    query = query.eq("warehouse_id", warehouseId);
  }

  const { data, error } = await withTimeout(query, "读取成品库存");

  if (error) {
    throw formatSupabaseError("读取成品库存", error);
  }

  const inventoryBySku = new Map<string, number>();

  for (const item of (data ?? []) as Array<
    Pick<InventoryItem, "sku_id" | "quantity_on_hand" | "reserved_quantity">
  >) {
    const current = inventoryBySku.get(item.sku_id) ?? 0;
    const availableQuantity = Math.max(
      0,
      Number(item.quantity_on_hand) - Number(item.reserved_quantity)
    );

    inventoryBySku.set(item.sku_id, roundQuantity(current + availableQuantity));
  }

  return inventoryBySku;
}

export async function getFbaOutboundQuantity(
  requestIds?: string[]
): Promise<Map<string, number>> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("inventory_transactions")
    .select("replenishment_request_id, sku_id, quantity")
    .eq("transaction_type", "product_out")
    .not("replenishment_request_id", "is", null);

  if (requestIds && requestIds.length > 0) {
    query = query.in("replenishment_request_id", requestIds);
  }

  const { data, error } = await withTimeout(query, "统计 FBA 已出库数量");

  if (error) {
    throw formatSupabaseError("统计 FBA 已出库数量", error);
  }

  const outboundByRequest = new Map<string, number>();

  for (const transaction of (data ?? []) as InventoryTransactionQuantity[]) {
    if (!transaction.replenishment_request_id) {
      continue;
    }

    const current = outboundByRequest.get(transaction.replenishment_request_id) ?? 0;
    outboundByRequest.set(
      transaction.replenishment_request_id,
      roundQuantity(current + Number(transaction.quantity))
    );
  }

  return outboundByRequest;
}

async function getFbaOutboundRequestById(
  replenishmentRequestId: string,
  warehouseId?: string
): Promise<FbaOutboundRequest> {
  const requests = await getFbaOutboundRequests({ warehouseId });
  const request = requests.find((item) => item.id === replenishmentRequestId);

  if (!request) {
    throw new Error("FBA 备货需求不存在或当前不可出库，请刷新页面后重试。");
  }

  return request;
}

export async function getFbaOutboundRequests(options: {
  warehouseId?: string;
} = {}): Promise<FbaOutboundRequest[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .select(
        `
          id,
          request_no,
          sku_id,
          target_warehouse_id,
          fba_warehouse_code,
          requested_quantity,
          target_ship_date,
          priority,
          status,
          notes,
          created_at,
          sku:skus!fba_replenishment_requests_sku_id_fkey (
            id,
            sku_code,
            sku_name,
            amazon_sku,
            fnsku,
            unit,
            product:products!skus_product_id_fkey (
              id,
              product_code,
              name
            )
          ),
          target_warehouse:warehouses!fba_replenishment_requests_target_warehouse_id_fkey (
            id,
            warehouse_code,
            name,
            warehouse_type
          ),
          production_orders:production_orders!production_orders_replenishment_request_id_fkey (
            id,
            production_order_no,
            planned_quantity,
            completed_quantity,
            status
          )
        `
      )
      .in("status", ["accepted", "in_production", "completed"])
      .order("created_at", { ascending: false }),
    "读取可 FBA 出库需求"
  );

  if (error) {
    throw formatSupabaseError("读取可 FBA 出库需求", error);
  }

  const rows = (data ?? []) as unknown as RawFbaOutboundRequest[];
  const skuIds = [...new Set(rows.map((row) => row.sku_id))];
  const requestIds = rows.map((row) => row.id);
  const [inventoryBySku, outboundByRequest] = await Promise.all([
    getFinishedGoodsInventory(skuIds, options.warehouseId),
    getFbaOutboundQuantity(requestIds)
  ]);

  return rows
    .map((row) =>
      normalizeFbaOutboundRequest(row, inventoryBySku, outboundByRequest)
    )
    .filter((request) => request.pending_outbound_quantity > 0);
}

export async function createFbaOutboundTransaction(input: {
  request: FbaOutboundRequest;
  warehouseId: string;
  quantity: number;
  logisticsNotes?: string;
  operationNotes?: string;
}) {
  const noteParts = [
    `FBA 出库：${input.request.request_no}`,
    `目标 FBA 仓库：${input.request.fba_warehouse_code ?? "-"}`,
    input.logisticsNotes ? `物流备注：${input.logisticsNotes}` : "",
    input.operationNotes ? `操作备注：${input.operationNotes}` : ""
  ].filter(Boolean);

  await createInventoryTransaction({
    warehouseId: input.warehouseId,
    skuId: input.request.sku_id,
    transactionType: "product_out",
    quantity: input.quantity,
    replenishmentRequestId: input.request.id,
    notes: noteParts.join("\n")
  });
}

export async function updateInventoryAfterFbaOutbound(input: {
  warehouseId: string;
  skuId: string;
  quantity: number;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .select(
        "id, warehouse_id, sku_id, item_type, quantity_on_hand, reserved_quantity, safety_stock_quantity, unit"
      )
      .eq("warehouse_id", input.warehouseId)
      .eq("sku_id", input.skuId)
      .maybeSingle(),
    "读取出库仓库存"
  );

  if (error) {
    throw formatSupabaseError("读取出库仓库存", error);
  }

  const existing = data as InventoryItem | null;

  if (!existing) {
    throw new Error("当前出库仓库没有该成品库存，不能出库。");
  }

  const availableQuantity = roundQuantity(
    Number(existing.quantity_on_hand) - Number(existing.reserved_quantity)
  );

  if (availableQuantity < input.quantity) {
    throw new Error("当前成品库存不足，不能提交 FBA 出库。");
  }

  const nextQuantity = roundQuantity(
    Number(existing.quantity_on_hand) - input.quantity
  );
  const { error: updateError } = await withTimeout(
    supabase
      .from("inventory_items")
      .update({ quantity_on_hand: nextQuantity })
      .eq("id", existing.id),
    "扣减成品库存"
  );

  if (updateError) {
    throw formatSupabaseError("扣减成品库存", updateError);
  }
}

export async function markFbaRequestShippedIfCompleted(input: {
  replenishmentRequestId: string;
  requestedQuantity: number;
}) {
  const outboundByRequest = await getFbaOutboundQuantity([
    input.replenishmentRequestId
  ]);
  const outboundQuantity = outboundByRequest.get(input.replenishmentRequestId) ?? 0;

  if (outboundQuantity < Number(input.requestedQuantity)) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .update({ status: "shipped" })
      .eq("id", input.replenishmentRequestId),
    "更新 FBA 备货需求为已发货"
  );

  if (error) {
    throw formatSupabaseError("更新 FBA 备货需求为已发货", error);
  }
}

export async function submitFbaOutbound(input: CreateFbaOutboundInput) {
  if (!input.warehouseId) {
    throw new Error("请选择出库仓库。");
  }

  const outboundQuantity = Number(input.outboundQuantity);

  if (outboundQuantity <= 0) {
    throw new Error("本次出库数量必须大于 0。");
  }

  const request = await getFbaOutboundRequestById(
    input.replenishmentRequestId,
    input.warehouseId
  );

  if (outboundQuantity > request.current_inventory_quantity) {
    throw new Error("本次出库数量不能大于当前成品库存。");
  }

  if (outboundQuantity > request.pending_outbound_quantity) {
    throw new Error("第一版暂不允许超发，本次出库数量不能大于待出库数量。");
  }

  await createFbaOutboundTransaction({
    request,
    warehouseId: input.warehouseId,
    quantity: outboundQuantity,
    logisticsNotes: input.logisticsNotes,
    operationNotes: input.operationNotes
  });

  await updateInventoryAfterFbaOutbound({
    warehouseId: input.warehouseId,
    skuId: request.sku_id,
    quantity: outboundQuantity
  });

  await markFbaRequestShippedIfCompleted({
    replenishmentRequestId: request.id,
    requestedQuantity: request.requested_quantity
  });
}
