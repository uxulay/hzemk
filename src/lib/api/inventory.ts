import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import type { BrandSummary } from "@/lib/brand-utils";
import { normalizeRpcPage, type ListPageResult } from "@/lib/api/page-types";
import type {
  BulkImportResult,
  BulkImportValidationRow,
  CsvDataRow
} from "@/lib/bulk-types";
import { getCsvRowValue, type CsvTemplateField } from "@/lib/utils/csv";

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
  brandId?: string;
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

export type InventoryTransactionSku = {
  id: string;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  unit: string;
  product: {
    id: string;
    brand_id: string | null;
    product_code: string;
    name: string;
    brand: BrandSummary | null;
  } | null;
};

export type InventoryTransactionRow = {
  id: string;
  transaction_no: string;
  warehouse_id: string;
  sku_id: string | null;
  product_sku_id: string | null;
  material_id: string | null;
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
  sku: InventoryTransactionSku | null;
  product_sku: InventoryTransactionSku | null;
  material: InventoryMaterial | null;
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
  brandId?: string;
};

export type CurrentInventorySummary = {
  skuKindCount: number;
  totalQuantity: number;
  lowStockCount: number;
  outOfStockCount: number;
  inStockSkuCount: number;
  outOfStockSkuCount: number;
};

export type CurrentInventoryPageResult = ListPageResult<
  CurrentInventoryRow,
  CurrentInventorySummary
>;

export type InventoryTransactionSummary = Record<InventoryTransactionType, number>;

export type InventoryTransactionPageResult = ListPageResult<
  InventoryTransactionRow,
  InventoryTransactionSummary
>;

export type InventoryAdjustmentSkuTypeFilter =
  | "all"
  | "material"
  | "finished_good";

export type InventoryAdjustmentFilters = {
  warehouseId?: string;
  skuKeyword?: string;
  skuType?: InventoryAdjustmentSkuTypeFilter;
};

export type InventoryAdjustmentMode = "increase" | "decrease" | "set_to";

export type InventoryAdjustmentReason =
  | "initial_stock"
  | "stocktake_gain"
  | "stocktake_loss"
  | "damage_loss"
  | "sample_use"
  | "data_correction"
  | "other";

export type InventoryAdjustmentRow = CurrentInventoryRow;

export type CurrentInventoryWarehouse = {
  id: string;
  warehouse_code: string;
  name: string;
  warehouse_type: string;
  status: string;
};

export type CurrentInventoryProduct = {
  id: string;
  brand_id: string | null;
  product_code: string;
  name: string;
  brand: BrandSummary | null;
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

export type InventoryMaterial = {
  id: string;
  material_code: string;
  material_name: string;
  category: string | null;
  unit: string;
  specs: string | null;
  default_supplier_id: string | null;
  status: string;
  supplier?: {
    id: string;
    supplier_code: string;
    name: string;
  } | null;
};

export type CurrentInventoryRow = {
  id: string;
  warehouse_id: string;
  sku_id: string | null;
  product_sku_id: string | null;
  material_id: string | null;
  item_type: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  safety_stock_quantity: number | null;
  unit: string;
  updated_at: string;
  warehouse: CurrentInventoryWarehouse | null;
  sku: CurrentInventorySku | null;
  product_sku: CurrentInventorySku | null;
  material: InventoryMaterial | null;
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
  sku_id: string | null;
  material_id: string | null;
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
  material: InventoryMaterial | null;
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
      brand_id: string | null;
      product_code: string;
      name: string;
      brand: BrandSummary | null;
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
      brand_id: string | null;
      product_code: string;
      name: string;
      brand: BrandSummary | null;
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

export type AdjustInventoryItemInput = {
  inventoryItemId: string;
  adjustmentMode: InventoryAdjustmentMode;
  adjustmentQuantity?: number;
  targetQuantity?: number;
  reason: InventoryAdjustmentReason;
  notes?: string;
};

export type AdjustInventoryByWarehouseSkuInput = {
  warehouseId: string;
  skuId: string;
  itemType?: "product_sku" | "material";
  adjustmentMode: InventoryAdjustmentMode;
  adjustmentQuantity?: number;
  targetQuantity?: number;
  reason: InventoryAdjustmentReason;
  notes?: string;
};

export type CreateAdjustmentTransactionInput = {
  inventoryItem: InventoryAdjustmentRow;
  adjustmentMode: InventoryAdjustmentMode;
  reason: InventoryAdjustmentReason;
  beforeQuantity: number;
  afterQuantity: number;
  signedDifference: number;
  notes?: string;
};

export type InventorySkuOption = {
  id: string;
  product_sku_id: string | null;
  material_id: string | null;
  product_id: string | null;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  unit: string;
  status: string;
  product: CurrentInventoryProduct;
  material: InventoryMaterial | null;
};

export type OtherInventoryMovementInput = {
  warehouseId: string;
  skuId: string;
  itemType?: "product_sku" | "material";
  quantity: number;
  reason: string;
  notes?: string;
};

export type OtherInventoryMovementImportInput = {
  warehouseId: string;
  warehouseCode: string;
  skuId: string | null;
  productSkuId?: string | null;
  materialId?: string | null;
  skuCode: string;
  skuName: string;
  skuType: string;
  unit: string;
  quantity: number;
  reason: string;
  remark?: string;
};

export type OtherInventoryMovementValidationRow =
  BulkImportValidationRow<OtherInventoryMovementImportInput>;

export type InventoryAdjustmentImportInput = {
  warehouseId: string;
  warehouseCode: string;
  skuId: string | null;
  productSkuId?: string | null;
  materialId?: string | null;
  skuCode: string;
  skuName: string;
  skuType: string;
  unit: string;
  adjustmentMode: InventoryAdjustmentMode;
  adjustmentQuantity?: number;
  targetQuantity?: number;
  reason: InventoryAdjustmentReason;
  remark?: string;
};

export type InventoryAdjustmentValidationRow =
  BulkImportValidationRow<InventoryAdjustmentImportInput>;

type InventoryBulkRpcResponse = {
  success_count?: number;
  failed_count?: number;
  errors?: BulkImportResult["errors"];
};

type MaybeRelation<T> = T | T[] | null;

type RawReceivablePurchaseOrderItem = Omit<
  ReceivablePurchaseOrderItem,
  "sku" | "material" | "material_requirement"
> & {
  sku: MaybeRelation<NonNullable<ReceivablePurchaseOrderItem["sku"]>>;
  material: MaybeRelation<InventoryMaterial>;
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
  | "product_sku"
  | "material"
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
  product_sku: MaybeRelation<
    Omit<NonNullable<InventoryTransactionRow["product_sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<NonNullable<InventoryTransactionRow["product_sku"]>["product"]>
      >;
    }
  >;
  material: MaybeRelation<InventoryMaterial>;
  purchase_order: MaybeRelation<InventoryTransactionRow["purchase_order"]>;
  production_order: MaybeRelation<InventoryTransactionRow["production_order"]>;
  replenishment_request: MaybeRelation<
    InventoryTransactionRow["replenishment_request"]
  >;
  operator: MaybeRelation<InventoryTransactionRow["operator"]>;
};

type RawCurrentInventoryRow = Omit<
  CurrentInventoryRow,
  "warehouse" | "sku" | "product_sku" | "material"
> & {
  warehouse: MaybeRelation<CurrentInventoryWarehouse>;
  sku: MaybeRelation<
    Omit<CurrentInventorySku, "product"> & {
      product: MaybeRelation<NonNullable<CurrentInventoryProduct>>;
    }
  >;
  product_sku: MaybeRelation<
    Omit<CurrentInventorySku, "product"> & {
      product: MaybeRelation<NonNullable<CurrentInventoryProduct>>;
    }
  >;
  material: MaybeRelation<InventoryMaterial>;
};

type RawInventorySkuOption = Omit<InventorySkuOption, "product" | "material"> & {
  product: MaybeRelation<NonNullable<CurrentInventoryProduct>>;
  material?: MaybeRelation<InventoryMaterial>;
};

type InventoryItem = {
  id: string;
  warehouse_id: string;
  sku_id: string | null;
  product_sku_id: string | null;
  material_id: string | null;
  item_type: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  safety_stock_quantity: number;
  unit: string;
};

type InventoryTransactionQuantity = {
  replenishment_request_id: string | null;
  sku_id: string | null;
  product_sku_id: string | null;
  material_id: string | null;
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

function normalizeProductBrand<T extends { brand?: MaybeRelation<BrandSummary> }>(
  product: T | null | undefined
): (Omit<T, "brand"> & { brand: BrandSummary | null }) | null {
  if (!product) {
    return null;
  }

  return {
    ...product,
    brand: singleRelation(product.brand ?? null)
  };
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

const inventoryAdjustmentModeLabels: Record<InventoryAdjustmentMode, string> = {
  increase: "增加库存",
  decrease: "减少库存",
  set_to: "直接修正库存"
};

const inventoryAdjustmentReasonLabels: Record<InventoryAdjustmentReason, string> = {
  initial_stock: "期初库存",
  stocktake_gain: "盘盈",
  stocktake_loss: "盘亏",
  damage_loss: "破损报废",
  sample_use: "样品领用",
  data_correction: "数据修正",
  other: "其他"
};

function getInventoryAdjustmentModeLabel(mode: InventoryAdjustmentMode) {
  return inventoryAdjustmentModeLabels[mode];
}

function getInventoryAdjustmentReasonLabel(reason: InventoryAdjustmentReason) {
  return inventoryAdjustmentReasonLabels[reason];
}

function getInventoryItemTypeBySkuType(skuType: string) {
  return skuType === "material" ? "material" : "finished_product";
}

function getInboundTransactionTypeBySkuType(
  skuType: string
): InventoryTransactionType {
  return skuType === "material" ? "material_in" : "product_in";
}

function getOutboundTransactionTypeBySkuType(
  skuType: string
): InventoryTransactionType {
  return skuType === "material" ? "material_out" : "product_out";
}

function isFinishedInventoryType(itemType: string) {
  return (
    itemType === "finished_product" ||
    itemType === "finished_good" ||
    itemType === "product_sku"
  );
}

function getInventoryIdentityFromOption(option: InventorySkuOption) {
  const materialId = option.material_id ?? (option.sku_type === "material" ? option.id : null);
  const productSkuId =
    option.product_sku_id ??
    (option.sku_type === "material" ? null : option.id);
  const skuId = option.sku_type === "material" ? null : option.id;

  return {
    skuId,
    productSkuId,
    materialId,
    itemType: option.sku_type === "material" ? "material" : "finished_product"
  };
}

function getInventoryIdentityFromItem(input: {
  sku_id?: string | null;
  product_sku_id?: string | null;
  material_id?: string | null;
  item_type: string;
}) {
  if (input.material_id || input.item_type === "material") {
    return {
      skuId: input.sku_id,
      productSkuId: null,
      materialId: input.material_id ?? null,
      itemType: "material"
    };
  }

  return {
    skuId: input.sku_id ?? input.product_sku_id ?? null,
    productSkuId: input.product_sku_id ?? input.sku_id ?? null,
    materialId: null,
    itemType: isFinishedInventoryType(input.item_type)
      ? input.item_type
      : "finished_product"
  };
}

function isInventorySupportedSkuType(skuType: string) {
  return (
    skuType === "material" ||
    skuType === "finished_good" ||
    skuType === "finished_product"
  );
}

function assertInventorySupportedSku(sku: Pick<InventorySkuOption, "sku_type">) {
  if (!isInventorySupportedSkuType(sku.sku_type)) {
    throw new Error("当前只支持辅料和成品 SKU 做其他出入库。");
  }
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
      material_id,
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
      material:materials!purchase_order_items_material_id_fkey (
        id,
        material_code,
        material_name,
        category,
        unit,
        specs,
        default_supplier_id,
        status,
        supplier:suppliers!materials_default_supplier_id_fkey (
          id,
          supplier_code,
          name
        )
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
    material: singleRelation(item.material),
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
  const product = normalizeProductBrand(singleRelation(sku?.product ?? null));

  return {
    ...order,
    sku: sku
      ? {
          ...sku,
          product
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
  const product = normalizeProductBrand(singleRelation(sku?.product ?? null));
  const outboundQuantity = outboundByRequest.get(request.id) ?? 0;
  const pendingOutboundQuantity = roundQuantity(
    Math.max(0, Number(request.requested_quantity) - outboundQuantity)
  );

  return {
    ...request,
    sku: sku
      ? {
          ...sku,
          product
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
  const product = normalizeProductBrand(singleRelation(sku?.product ?? null));
  const productSku = singleRelation(transaction.product_sku);
  const productSkuProduct = normalizeProductBrand(
    singleRelation(productSku?.product ?? null)
  );
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
          product
        }
      : null,
    product_sku: productSku
      ? {
          ...productSku,
          product: productSkuProduct
        }
      : null,
    material: singleRelation(transaction.material),
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
    product_sku_id,
    material_id,
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
        brand_id,
        product_code,
        name,
        brand:brands!products_brand_id_fkey (
          id,
          brand_code,
          name,
          english_name,
          logo_url,
          status
        )
      )
    ),
    product_sku:skus!inventory_items_product_sku_id_fkey (
      id,
      product_id,
      sku_code,
      sku_name,
      sku_type,
      unit,
      product:products!skus_product_id_fkey (
        id,
        brand_id,
        product_code,
        name,
        brand:brands!products_brand_id_fkey (
          id,
          brand_code,
          name,
          english_name,
          logo_url,
          status
        )
      )
    ),
    material:materials!inventory_items_material_id_fkey (
      id,
      material_code,
      material_name,
      category,
      unit,
      specs,
      default_supplier_id,
      status,
      supplier:suppliers!materials_default_supplier_id_fkey (
        id,
        supplier_code,
        name
      )
    )
  `;
}

function getInventoryTransactionSelect() {
  return `
    id,
    transaction_no,
    warehouse_id,
    sku_id,
    product_sku_id,
    material_id,
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
        brand_id,
        product_code,
        name,
        brand:brands!products_brand_id_fkey (
          id,
          brand_code,
          name,
          english_name,
          logo_url,
          status
        )
      )
    ),
    product_sku:skus!inventory_transactions_product_sku_id_fkey (
      id,
      sku_code,
      sku_name,
      sku_type,
      unit,
      product:products!skus_product_id_fkey (
        id,
        brand_id,
        product_code,
        name,
        brand:brands!products_brand_id_fkey (
          id,
          brand_code,
          name,
          english_name,
          logo_url,
          status
        )
      )
    ),
    material:materials!inventory_transactions_material_id_fkey (
      id,
      material_code,
      material_name,
      category,
      unit,
      specs,
      default_supplier_id,
      status
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
  `;
}

function normalizeCurrentInventory(row: RawCurrentInventoryRow): CurrentInventoryRow {
  const sku = singleRelation(row.sku);
  const product = normalizeProductBrand(singleRelation(sku?.product ?? null));
  const productSku = singleRelation(row.product_sku);
  const productSkuProduct = normalizeProductBrand(
    singleRelation(productSku?.product ?? null)
  );
  const material = singleRelation(row.material);

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
          product
        }
      : null,
    product_sku: productSku
      ? {
          ...productSku,
          product: productSkuProduct
        }
      : null,
    material
  };
}

function normalizeInventorySkuOption(row: RawInventorySkuOption): InventorySkuOption {
  return {
    ...row,
    product: normalizeProductBrand(singleRelation(row.product ?? null)),
    material: singleRelation(row.material ?? null)
  };
}

function createSyntheticInventoryRow(input: {
  warehouse: CurrentInventoryWarehouse;
  sku: InventorySkuOption;
}): InventoryAdjustmentRow {
  const identity = getInventoryIdentityFromOption(input.sku);

  return {
    id: "",
    warehouse_id: input.warehouse.id,
    sku_id: identity.skuId,
    product_sku_id: identity.productSkuId,
    material_id: identity.materialId,
    item_type: identity.itemType,
    quantity_on_hand: 0,
    reserved_quantity: 0,
    safety_stock_quantity: 0,
    unit: input.sku.unit,
    updated_at: new Date().toISOString(),
    warehouse: input.warehouse,
    sku: {
      id: input.sku.id,
      product_id: input.sku.product_id,
      sku_code: input.sku.sku_code,
      sku_name: input.sku.sku_name,
      sku_type: input.sku.sku_type,
      unit: input.sku.unit,
      product: input.sku.product
    },
    product_sku:
      identity.productSkuId && input.sku.sku_type !== "material"
        ? {
            id: identity.productSkuId,
            product_id: input.sku.product_id,
            sku_code: input.sku.sku_code,
            sku_name: input.sku.sku_name,
            sku_type: input.sku.sku_type,
            unit: input.sku.unit,
            product: input.sku.product
          }
        : null,
    material: input.sku.material
  };
}

function sortCurrentInventoryRows<T extends CurrentInventoryRow>(rows: T[]) {
  return [...rows].sort((a, b) => {
    const aCode =
      a.material?.material_code ?? a.product_sku?.sku_code ?? a.sku?.sku_code ?? "";
    const bCode =
      b.material?.material_code ?? b.product_sku?.sku_code ?? b.sku?.sku_code ?? "";
    const skuCompare = aCode.localeCompare(
      bCode,
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

  return [
    row.material?.material_code,
    row.material?.material_name,
    row.product_sku?.sku_code,
    row.product_sku?.sku_name,
    row.sku?.sku_code,
    row.sku?.sku_name
  ]
    .filter(Boolean)
    .some((value) => value?.toLowerCase().includes(normalizedKeyword));
}

function matchesBrand(row: CurrentInventoryRow, brandId?: string) {
  if (!brandId || brandId === "all") {
    return true;
  }

  const currentBrandId =
    row.product_sku?.product?.brand?.id ?? row.sku?.product?.brand?.id ?? null;

  return brandId === "none" ? !currentBrandId : currentBrandId === brandId;
}

function matchesAdjustmentSkuType(
  row: CurrentInventoryRow,
  skuType: InventoryAdjustmentSkuTypeFilter = "all"
) {
  if (skuType === "all") {
    return true;
  }

  if (skuType === "finished_good") {
    return (
      Boolean(row.product_sku_id) ||
      row.sku?.sku_type === "finished_good" ||
      row.sku?.sku_type === "finished_product"
    );
  }

  return Boolean(row.material_id) || row.sku?.sku_type === skuType;
}

async function getCurrentInventoryRows(
  skuType: "material" | "finished_good",
  filters: CurrentInventoryFilters,
  action: string
): Promise<CurrentInventoryRow[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawCurrentInventoryRow>(
    () => {
      let query = supabase
        .from("inventory_items")
        .select(getCurrentInventorySelect())
        .order("updated_at", { ascending: false });

      if (filters.warehouseId) {
        query = query.eq("warehouse_id", filters.warehouseId);
      }

      return query;
    },
    action
  );

  const keyword = filters.skuKeyword ?? "";

  return sortCurrentInventoryRows(
    data
      .map(normalizeCurrentInventory)
      .filter((row) =>
        skuType === "material"
          ? Boolean(row.material_id) || row.sku?.sku_type === "material"
          : Boolean(row.product_sku_id) ||
            row.sku?.sku_type === "finished_good" ||
            row.sku?.sku_type === "finished_product"
      )
      .filter((row) => matchesBrand(row, filters.brandId))
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

const emptyCurrentInventorySummary: CurrentInventorySummary = {
  skuKindCount: 0,
  totalQuantity: 0,
  lowStockCount: 0,
  outOfStockCount: 0,
  inStockSkuCount: 0,
  outOfStockSkuCount: 0
};

export async function getCurrentInventoryPage(input: {
  mode: "materials" | "products";
  page?: number;
  pageSize?: number;
  filters?: CurrentInventoryFilters;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}): Promise<CurrentInventoryPageResult> {
  const supabase = getSupabaseClient();
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
  const filters = input.filters ?? {};
  const { data, error } = await withTimeout(
    supabase.rpc("get_current_inventory_page", {
      p_page: page,
      p_page_size: pageSize,
      p_keyword: filters.skuKeyword?.trim() || null,
      p_filters: {
        mode: input.mode,
        warehouseId: filters.warehouseId || "all",
        brandId: filters.brandId || "all",
        stockStatus: filters.stockStatus || "all"
      },
      p_sort_by: input.sortBy ?? "updated_at",
      p_sort_direction: input.sortDirection ?? "desc"
    }),
    input.mode === "materials" ? "分页读取辅料库存" : "分页读取成品库存"
  );

  if (error) {
    throw new Error(
      `${input.mode === "materials" ? "分页读取辅料库存" : "分页读取成品库存"}失败：${error.message}。请确认已经在 Supabase SQL Editor 执行 supabase/performance-rpc-and-indexes.sql。`
    );
  }

  return normalizeRpcPage<CurrentInventoryRow, CurrentInventorySummary>(data, {
    page,
    pageSize,
    summary: emptyCurrentInventorySummary
  });
}

export async function getInventoryForAdjustment(
  filters: InventoryAdjustmentFilters = {}
): Promise<InventoryAdjustmentRow[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawCurrentInventoryRow>(
    () => {
      let query = supabase
        .from("inventory_items")
        .select(getCurrentInventorySelect())
        .order("updated_at", { ascending: false });

      if (filters.warehouseId) {
        query = query.eq("warehouse_id", filters.warehouseId);
      }

      return query;
    },
    "读取可调整库存"
  );

  return sortCurrentInventoryRows(
    data
      .map(normalizeCurrentInventory)
      .filter((row) => matchesAdjustmentSkuType(row, filters.skuType ?? "all"))
      .filter((row) => matchesSkuKeyword(row, filters.skuKeyword ?? ""))
  );
}

async function getInventoryObjectIdsByKeyword(keyword: string): Promise<{
  skuIds: string[];
  materialIds: string[];
}> {
  const trimmedKeyword = keyword.trim();

  if (!trimmedKeyword) {
    return { skuIds: [], materialIds: [] };
  }

  const supabase = getSupabaseClient();
  const escapedKeyword = trimmedKeyword
    .replaceAll("%", "\\%")
    .replaceAll("_", "\\_");
  const [skus, materials] = await Promise.all([
    fetchAllSupabaseRows<{ id: string }>(
      () =>
      supabase
      .from("skus")
      .select("id")
      .or(`sku_code.ilike.%${escapedKeyword}%,sku_name.ilike.%${escapedKeyword}%`),
    "按 SKU 搜索库存流水"
    ),
    fetchAllSupabaseRows<{ id: string }>(
      () =>
        supabase
          .from("materials")
          .select("id")
          .or(
            `material_code.ilike.%${escapedKeyword}%,material_name.ilike.%${escapedKeyword}%,specs.ilike.%${escapedKeyword}%`
          ),
      "按辅料搜索库存流水"
    )
  ]);

  return {
    skuIds: skus.map((item) => item.id),
    materialIds: materials.map((item) => item.id)
  };
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

export async function getSkuOptionsForInventory(
  keyword = "",
  limit = 20
): Promise<InventorySkuOption[]> {
  const supabase = getSupabaseClient();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const normalizedKeyword = keyword.trim();
  let skuQuery = supabase
    .from("skus")
    .select(
      `
        id,
        product_id,
        sku_code,
        sku_name,
        sku_type,
        unit,
        status,
        product:products!skus_product_id_fkey (
          id,
          brand_id,
          product_code,
          name,
          brand:brands!products_brand_id_fkey (
            id,
            brand_code,
            name,
            english_name,
            logo_url,
            status
          )
        )
      `
    )
    .in("sku_type", ["finished_good", "finished_product"])
    .order("sku_code", { ascending: true })
    .limit(safeLimit);
  let materialQuery = supabase
    .from("materials")
    .select(
      `
        id,
        material_code,
        material_name,
        category,
        unit,
        specs,
        default_supplier_id,
        status,
        supplier:suppliers!materials_default_supplier_id_fkey (
          id,
          supplier_code,
          name
        )
      `
    )
    .order("material_code", { ascending: true })
    .limit(safeLimit);

  if (normalizedKeyword) {
    skuQuery = skuQuery.or(
      [
        `sku_code.ilike.%${normalizedKeyword}%`,
        `sku_name.ilike.%${normalizedKeyword}%`
      ].join(",")
    );
    materialQuery = materialQuery.or(
      [
        `material_code.ilike.%${normalizedKeyword}%`,
        `material_name.ilike.%${normalizedKeyword}%`,
        `specs.ilike.%${normalizedKeyword}%`
      ].join(",")
    );
  } else {
    skuQuery = skuQuery.eq("status", "active");
    materialQuery = materialQuery.eq("status", "active");
  }

  const [skuData, materialData] = await Promise.all([
    withTimeout(skuQuery, "搜索库存可选 SKU"),
    withTimeout(materialQuery, "搜索库存可选辅料")
  ]);

  if (skuData.error) {
    throw formatSupabaseError("搜索库存可选 SKU", skuData.error);
  }

  if (materialData.error) {
    throw formatSupabaseError("搜索库存可选辅料", materialData.error);
  }

  const productOptions = ((skuData.data ?? []) as unknown as RawInventorySkuOption[])
    .map((sku) =>
      normalizeInventorySkuOption({
        ...sku,
        product_sku_id: sku.id,
        material_id: null,
      })
    );
  const materialOptions: InventorySkuOption[] = ((materialData.data ?? []) as unknown as InventoryMaterial[]).map(
    (material) => ({
      id: material.id,
      product_sku_id: null,
      material_id: material.id,
      product_id: null,
      sku_code: material.material_code,
      sku_name: material.material_name,
      sku_type: "material",
      unit: material.unit,
      status: material.status,
      product: null,
      material
    })
  );

  return [...materialOptions, ...productOptions].sort((a, b) =>
    a.sku_code.localeCompare(b.sku_code, "zh-CN")
  );
}

async function getSkuOptionsForInventoryByCodes(
  skuCodes: string[]
): Promise<InventorySkuOption[]> {
  const uniqueCodes = Array.from(new Set(skuCodes.map((code) => code.trim()).filter(Boolean)));

  if (uniqueCodes.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const [skuResult, materialResult] = await Promise.all([
    withTimeout(
      supabase
        .from("skus")
        .select(
          `
            id,
            product_id,
            sku_code,
            sku_name,
            sku_type,
            unit,
            status,
            product:products!skus_product_id_fkey (
              id,
              brand_id,
              product_code,
              name,
              brand:brands!products_brand_id_fkey (
                id,
                brand_code,
                name,
                english_name,
                logo_url,
                status
              )
            )
          `
        )
        .in("sku_code", uniqueCodes),
      "按编码读取库存可选 SKU"
    ),
    withTimeout(
      supabase
        .from("materials")
        .select(
          `
            id,
            material_code,
            material_name,
            category,
            unit,
            specs,
            default_supplier_id,
            status,
            supplier:suppliers!materials_default_supplier_id_fkey (
              id,
              supplier_code,
              name
            )
          `
        )
        .in("material_code", uniqueCodes),
      "按编码读取库存可选辅料"
    )
  ]);

  if (skuResult.error) {
    throw formatSupabaseError("按编码读取库存可选 SKU", skuResult.error);
  }

  if (materialResult.error) {
    throw formatSupabaseError("按编码读取库存可选辅料", materialResult.error);
  }

  const productOptions = ((skuResult.data ?? []) as unknown as RawInventorySkuOption[])
    .map((sku) =>
      normalizeInventorySkuOption({
        ...sku,
        product_sku_id: sku.id,
        material_id: null
      })
    );
  const materialOptions: InventorySkuOption[] = ((materialResult.data ?? []) as unknown as InventoryMaterial[]).map(
    (material) => ({
      id: material.id,
      product_sku_id: null,
      material_id: material.id,
      product_id: null,
      sku_code: material.material_code,
      sku_name: material.material_name,
      sku_type: "material",
      unit: material.unit,
      status: material.status,
      product: null,
      material
    })
  );

  return [...materialOptions, ...productOptions].sort((a, b) =>
    a.sku_code.localeCompare(b.sku_code, "zh-CN")
  );
}

async function getSkuOptionForInventoryById(
  id: string
): Promise<InventorySkuOption | null> {
  if (!id) {
    return null;
  }

  const supabase = getSupabaseClient();
  const [skuResult, materialResult] = await Promise.all([
    withTimeout(
      supabase
        .from("skus")
        .select(
          `
            id,
            product_id,
            sku_code,
            sku_name,
            sku_type,
            unit,
            status,
            product:products!skus_product_id_fkey (
              id,
              brand_id,
              product_code,
              name,
              brand:brands!products_brand_id_fkey (
                id,
                brand_code,
                name,
                english_name,
                logo_url,
                status
              )
            )
          `
        )
        .eq("id", id)
        .maybeSingle(),
      "按 ID 读取库存可选 SKU"
    ),
    withTimeout(
      supabase
        .from("materials")
        .select(
          `
            id,
            material_code,
            material_name,
            category,
            unit,
            specs,
            default_supplier_id,
            status,
            supplier:suppliers!materials_default_supplier_id_fkey (
              id,
              supplier_code,
              name
            )
          `
        )
        .eq("id", id)
        .maybeSingle(),
      "按 ID 读取库存可选辅料"
    )
  ]);

  if (skuResult.error) {
    throw formatSupabaseError("按 ID 读取库存可选 SKU", skuResult.error);
  }

  if (materialResult.error) {
    throw formatSupabaseError("按 ID 读取库存可选辅料", materialResult.error);
  }

  if (skuResult.data) {
    return normalizeInventorySkuOption({
      ...(skuResult.data as unknown as RawInventorySkuOption),
      product_sku_id: id,
      material_id: null
    });
  }

  if (materialResult.data) {
    const material = materialResult.data as unknown as InventoryMaterial;

    return {
      id: material.id,
      product_sku_id: null,
      material_id: material.id,
      product_id: null,
      sku_code: material.material_code,
      sku_name: material.material_name,
      sku_type: "material",
      unit: material.unit,
      status: material.status,
      product: null,
      material
    };
  }

  return null;
}

export async function getInventoryItemByWarehouseAndSku(
  warehouseId: string,
  skuId: string
): Promise<InventoryAdjustmentRow | null> {
  if (!warehouseId || !skuId) {
    return null;
  }

  const supabase = getSupabaseClient();
  const option = await getSkuOptionForInventoryById(skuId);
  const identity = option ? getInventoryIdentityFromOption(option) : null;
  const { data, error } = await withTimeout(
    (() => {
      let query = supabase
      .from("inventory_items")
      .select(getCurrentInventorySelect())
        .eq("warehouse_id", warehouseId);

      if (identity?.materialId) {
        query = query.eq("material_id", identity.materialId);
      } else if (identity?.productSkuId) {
        query = query.eq("product_sku_id", identity.productSkuId);
      } else {
        query = query.eq("sku_id", skuId);
      }

      return query.maybeSingle();
    })(),
    "读取仓库 SKU 库存"
  );

  if (error) {
    throw formatSupabaseError("读取仓库 SKU 库存", error);
  }

  if (!data) {
    return null;
  }

  return normalizeCurrentInventory(data as unknown as RawCurrentInventoryRow);
}

export async function getInventoryTransactions(
  filters: InventoryTransactionFilters = {}
): Promise<InventoryTransactionRow[]> {
  const supabase = getSupabaseClient();
  const skuKeyword = filters.skuKeyword?.trim() ?? "";
  const objectIds = skuKeyword
    ? await getInventoryObjectIdsByKeyword(skuKeyword)
    : { skuIds: [], materialIds: [] };

  if (
    skuKeyword &&
    objectIds.skuIds.length === 0 &&
    objectIds.materialIds.length === 0
  ) {
    return [];
  }

  const data = await fetchAllSupabaseRows<RawInventoryTransactionRow>(
    () => {
      let query = supabase
        .from("inventory_transactions")
        .select(getInventoryTransactionSelect())
        .order("occurred_at", { ascending: false });

      if (filters.transactionType && filters.transactionType !== "all") {
        query = query.eq("transaction_type", filters.transactionType);
      }

      if (filters.warehouseId) {
        query = query.eq("warehouse_id", filters.warehouseId);
      }

      if (objectIds.skuIds.length > 0 || objectIds.materialIds.length > 0) {
        const conditions: string[] = [];

        if (objectIds.skuIds.length > 0) {
          const ids = objectIds.skuIds.join(",");
          conditions.push(`sku_id.in.(${ids})`, `product_sku_id.in.(${ids})`);
        }

        if (objectIds.materialIds.length > 0) {
          conditions.push(`material_id.in.(${objectIds.materialIds.join(",")})`);
        }

        query = query.or(conditions.join(","));
      }

      if (filters.startDate) {
        query = query.gte(
          "occurred_at",
          getDateBoundaryIso(filters.startDate, "start")
        );
      }

      if (filters.endDate) {
        query = query.lte(
          "occurred_at",
          getDateBoundaryIso(filters.endDate, "end")
        );
      }

      return query;
    },
    "读取库存流水"
  );

  return data
    .map(normalizeInventoryTransaction)
    .filter((transaction) => {
      const brandId = filters.brandId ?? "all";

      if (brandId === "all") {
        return true;
      }

      const currentBrandId =
        transaction.product_sku?.product?.brand?.id ??
        transaction.sku?.product?.brand?.id ??
        null;

      return brandId === "none" ? !currentBrandId : currentBrandId === brandId;
    });
}

const emptyInventoryTransactionSummary: InventoryTransactionSummary = {
  material_in: 0,
  material_out: 0,
  product_in: 0,
  product_out: 0,
  adjustment: 0
};

export async function getInventoryTransactionsPage(input: {
  page?: number;
  pageSize?: number;
  filters?: InventoryTransactionFilters;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
}): Promise<InventoryTransactionPageResult> {
  const supabase = getSupabaseClient();
  const page = Math.max(input.page ?? 1, 1);
  const pageSize = Math.min(Math.max(input.pageSize ?? 20, 1), 100);
  const filters = input.filters ?? {};
  const { data, error } = await withTimeout(
    supabase.rpc("get_inventory_transactions_page", {
      p_page: page,
      p_page_size: pageSize,
      p_keyword: filters.skuKeyword?.trim() || null,
      p_filters: {
        transactionType: filters.transactionType ?? "all",
        warehouseId: filters.warehouseId || "all",
        brandId: filters.brandId || "all",
        startDate: filters.startDate || "",
        endDate: filters.endDate || ""
      },
      p_sort_by: input.sortBy ?? "occurred_at",
      p_sort_direction: input.sortDirection ?? "desc"
    }),
    "分页读取库存流水"
  );

  if (error) {
    throw new Error(
      `分页读取库存流水失败：${error.message}。请确认已经在 Supabase SQL Editor 执行 supabase/performance-rpc-and-indexes.sql。`
    );
  }

  return normalizeRpcPage<InventoryTransactionRow, InventoryTransactionSummary>(
    data,
    {
      page,
      pageSize,
      summary: emptyInventoryTransactionSummary
    }
  );
}

export async function getRecentAdjustmentTransactions(
  limit = 20
): Promise<InventoryTransactionRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_transactions")
      .select(getInventoryTransactionSelect())
      .eq("transaction_type", "adjustment")
      .order("occurred_at", { ascending: false })
      .limit(limit),
    "读取最近库存调整流水"
  );

  if (error) {
    throw formatSupabaseError("读取最近库存调整流水", error);
  }

  return ((data ?? []) as unknown as RawInventoryTransactionRow[]).map(
    normalizeInventoryTransaction
  );
}

export async function upsertInventoryItem(input: {
  warehouseId: string;
  skuId?: string | null;
  productSkuId?: string | null;
  materialId?: string | null;
  itemType: string;
  quantity: number;
  unit: string;
}) {
  const supabase = getSupabaseClient();
  const identity = getInventoryIdentityFromItem({
    sku_id: input.skuId,
    product_sku_id: input.productSkuId ?? null,
    material_id: input.materialId ?? null,
    item_type: input.itemType
  });
  const { data, error } = await withTimeout(
    (() => {
      let query = supabase
      .from("inventory_items")
      .select(
        "id, warehouse_id, sku_id, product_sku_id, material_id, item_type, quantity_on_hand, reserved_quantity, safety_stock_quantity, unit"
      )
        .eq("warehouse_id", input.warehouseId);

      if (identity.materialId) {
        query = query.eq("material_id", identity.materialId);
      } else if (identity.productSkuId) {
        query = query.eq("product_sku_id", identity.productSkuId);
      } else {
        query = query.eq("sku_id", identity.skuId);
      }

      return query.maybeSingle();
    })(),
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
          product_sku_id: existing.product_sku_id ?? identity.productSkuId,
          material_id: existing.material_id ?? identity.materialId,
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
      sku_id: identity.skuId,
      product_sku_id: identity.productSkuId,
      material_id: identity.materialId,
      item_type: identity.itemType,
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
  skuId?: string | null;
  productSkuId?: string | null;
  materialId?: string | null;
  itemType?: string;
  transactionType: InventoryTransactionType;
  quantity: number;
  purchaseOrderId?: string | null;
  productionOrderId?: string | null;
  replenishmentRequestId?: string | null;
  notes?: string | null;
}) {
  const supabase = getSupabaseClient();
  const identity = getInventoryIdentityFromItem({
    sku_id: input.skuId,
    product_sku_id: input.productSkuId ?? null,
    material_id: input.materialId ?? null,
    item_type:
      input.itemType ??
      (input.transactionType.startsWith("material") ? "material" : "finished_product")
  });
  const { error } = await withTimeout(
    supabase.from("inventory_transactions").insert({
      transaction_no: createInventoryTransactionNo(),
      warehouse_id: input.warehouseId,
      sku_id: identity.skuId,
      product_sku_id: identity.productSkuId,
      material_id: identity.materialId,
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

async function getRawInventoryItemByWarehouseAndSku(input: {
  warehouseId: string;
  skuId?: string | null;
  productSkuId?: string | null;
  materialId?: string | null;
  action?: string;
}): Promise<InventoryItem | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    (() => {
      let query = supabase
      .from("inventory_items")
      .select(
        "id, warehouse_id, sku_id, product_sku_id, material_id, item_type, quantity_on_hand, reserved_quantity, safety_stock_quantity, unit"
      )
        .eq("warehouse_id", input.warehouseId);

      if (input.materialId) {
        query = query.eq("material_id", input.materialId);
      } else if (input.productSkuId) {
        query = query.eq("product_sku_id", input.productSkuId);
      } else {
        query = query.eq("sku_id", input.skuId);
      }

      return query.maybeSingle();
    })(),
    input.action ?? "读取当前库存"
  );

  if (error) {
    throw formatSupabaseError(input.action ?? "读取当前库存", error);
  }

  return data as InventoryItem | null;
}

async function insertInventoryItemWithQuantity(input: {
  warehouseId: string;
  skuId?: string | null;
  productSkuId?: string | null;
  materialId?: string | null;
  itemType: string;
  quantity: number;
  unit: string;
  action?: string;
}): Promise<InventoryItem> {
  const supabase = getSupabaseClient();
  const identity = getInventoryIdentityFromItem({
    sku_id: input.skuId,
    product_sku_id: input.productSkuId ?? null,
    material_id: input.materialId ?? null,
    item_type: input.itemType
  });
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .insert({
        warehouse_id: input.warehouseId,
        sku_id: identity.skuId,
        product_sku_id: identity.productSkuId,
        material_id: identity.materialId,
        item_type: identity.itemType,
        quantity_on_hand: input.quantity,
        reserved_quantity: 0,
        safety_stock_quantity: 0,
        unit: input.unit
      })
      .select(
        "id, warehouse_id, sku_id, product_sku_id, material_id, item_type, quantity_on_hand, reserved_quantity, safety_stock_quantity, unit"
      )
      .single(),
    input.action ?? "新增当前库存"
  );

  if (error) {
    throw formatSupabaseError(input.action ?? "新增当前库存", error);
  }

  return data as InventoryItem;
}

async function updateInventoryItemQuantityById(input: {
  inventoryItemId: string;
  expectedQuantity: number;
  nextQuantity: number;
  action: string;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .update({ quantity_on_hand: input.nextQuantity })
      .eq("id", input.inventoryItemId)
      .eq("quantity_on_hand", input.expectedQuantity)
      .select("id")
      .maybeSingle(),
    input.action
  );

  if (error) {
    throw formatSupabaseError(input.action, error);
  }

  if (!data) {
    throw new Error("这条库存刚刚发生了变化，请刷新列表后重新操作。");
  }
}

async function getInventorySkuOptionById(skuId: string) {
  const sku = await getSkuOptionForInventoryById(skuId);

  if (!sku) {
    throw new Error("SKU 不存在，请刷新页面后重试。");
  }

  assertInventorySupportedSku(sku);

  return sku;
}

function validateOtherMovementInput(input: OtherInventoryMovementInput) {
  if (!input.warehouseId) {
    throw new Error("请选择仓库。");
  }

  if (!input.skuId) {
    throw new Error("请选择 SKU。");
  }

  const quantity = Number(input.quantity);

  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("数量必须大于 0。");
  }

  if (!input.reason.trim()) {
    throw new Error("请填写原因。");
  }

  return roundQuantity(quantity);
}

function buildOtherInboundNotes(input: {
  reason: string;
  notes?: string;
  unit: string;
}) {
  const source =
    input.reason.includes("初始") || input.notes?.includes("初始")
      ? "初始库存导入"
      : "其他入库";

  return [
    source,
    `入库原因：${input.reason.trim()}`,
    `单位：${input.unit}`,
    `操作备注：${input.notes?.trim() || "-"}`
  ].join("\n");
}

function buildOtherOutboundNotes(input: {
  reason: string;
  notes?: string;
  unit: string;
}) {
  return [
    "其他出库",
    `出库原因：${input.reason.trim()}`,
    `单位：${input.unit}`,
    `操作备注：${input.notes?.trim() || "-"}`
  ].join("\n");
}

export async function createOtherInbound(input: OtherInventoryMovementInput) {
  const quantity = validateOtherMovementInput(input);
  const sku = await getInventorySkuOptionById(input.skuId);
  const identity = getInventoryIdentityFromOption(sku);
  const transactionType = getInboundTransactionTypeBySkuType(sku.sku_type);
  const existing = await getRawInventoryItemByWarehouseAndSku({
    warehouseId: input.warehouseId,
    skuId: identity.skuId,
    productSkuId: identity.productSkuId,
    materialId: identity.materialId
  });
  const beforeQuantity = roundQuantity(Number(existing?.quantity_on_hand ?? 0));
  const afterQuantity = roundQuantity(beforeQuantity + quantity);
  let changedItem = existing;

  if (existing) {
    await updateInventoryItemQuantityById({
      inventoryItemId: existing.id,
      expectedQuantity: beforeQuantity,
      nextQuantity: afterQuantity,
      action: "增加当前库存"
    });
  } else {
    changedItem = await insertInventoryItemWithQuantity({
      warehouseId: input.warehouseId,
      skuId: identity.skuId,
      productSkuId: identity.productSkuId,
      materialId: identity.materialId,
      itemType: identity.itemType,
      quantity: afterQuantity,
      unit: sku.unit
    });
  }

  try {
    await createInventoryTransaction({
      warehouseId: input.warehouseId,
      skuId: identity.skuId,
      productSkuId: identity.productSkuId,
      materialId: identity.materialId,
      itemType: identity.itemType,
      transactionType,
      quantity,
      notes: buildOtherInboundNotes({
        reason: input.reason,
        notes: input.notes,
        unit: sku.unit
      })
    });
  } catch (error) {
    if (changedItem) {
      try {
        await updateInventoryItemQuantityById({
          inventoryItemId: changedItem.id,
          expectedQuantity: afterQuantity,
          nextQuantity: beforeQuantity,
          action: "回滚当前库存"
        });
      } catch (rollbackError) {
        throw new Error(
          `库存已经增加，但库存流水写入失败，自动回滚也失败。原始错误：${getUnknownErrorMessage(
            error
          )}；回滚错误：${getUnknownErrorMessage(rollbackError)}。请立刻检查库存和流水。`
        );
      }
    }

    throw error;
  }

  return {
    beforeQuantity,
    afterQuantity,
    quantity
  };
}

export async function createOtherOutbound(input: OtherInventoryMovementInput) {
  const quantity = validateOtherMovementInput(input);
  const sku = await getInventorySkuOptionById(input.skuId);
  const identity = getInventoryIdentityFromOption(sku);
  const existing = await getRawInventoryItemByWarehouseAndSku({
    warehouseId: input.warehouseId,
    skuId: identity.skuId,
    productSkuId: identity.productSkuId,
    materialId: identity.materialId,
    action: "读取出库仓库存"
  });

  if (!existing) {
    throw new Error("当前仓库没有这个 SKU 的库存记录，不能出库。");
  }

  const beforeQuantity = roundQuantity(Number(existing.quantity_on_hand));
  const reservedQuantity = roundQuantity(Number(existing.reserved_quantity));
  const availableQuantity = roundQuantity(beforeQuantity - reservedQuantity);

  if (quantity > availableQuantity) {
    throw new Error(
      `当前可用库存只有 ${availableQuantity} ${sku.unit}，不能出库 ${quantity} ${sku.unit}。`
    );
  }

  const afterQuantity = roundQuantity(beforeQuantity - quantity);

  await updateInventoryItemQuantityById({
    inventoryItemId: existing.id,
    expectedQuantity: beforeQuantity,
    nextQuantity: afterQuantity,
    action: "扣减当前库存"
  });

  try {
    await createInventoryTransaction({
      warehouseId: input.warehouseId,
      skuId: identity.skuId,
      productSkuId: identity.productSkuId,
      materialId: identity.materialId,
      itemType: identity.itemType,
      transactionType: getOutboundTransactionTypeBySkuType(sku.sku_type),
      quantity,
      notes: buildOtherOutboundNotes({
        reason: input.reason,
        notes: input.notes,
        unit: sku.unit
      })
    });
  } catch (error) {
    try {
      await updateInventoryItemQuantityById({
        inventoryItemId: existing.id,
        expectedQuantity: afterQuantity,
        nextQuantity: beforeQuantity,
        action: "回滚当前库存"
      });
    } catch (rollbackError) {
      throw new Error(
        `库存已经扣减，但库存流水写入失败，自动回滚也失败。原始错误：${getUnknownErrorMessage(
          error
        )}；回滚错误：${getUnknownErrorMessage(rollbackError)}。请立刻检查库存和流水。`
      );
    }

    throw error;
  }

  return {
    beforeQuantity,
    afterQuantity,
    quantity
  };
}

export async function adjustInventoryByWarehouseSku(
  input: AdjustInventoryByWarehouseSkuInput
) {
  if (!input.warehouseId) {
    throw new Error("请选择仓库。");
  }

  if (!input.skuId) {
    throw new Error("请选择 SKU。");
  }

  if (!input.reason) {
    throw new Error("请选择调整原因。");
  }

  const [sku, warehouses, existingRow] = await Promise.all([
    getInventorySkuOptionById(input.skuId),
    getWarehousesForFilter(),
    getInventoryItemByWarehouseAndSku(input.warehouseId, input.skuId)
  ]);
  const identity = getInventoryIdentityFromOption(sku);
  const existingRaw = await getRawInventoryItemByWarehouseAndSku({
    warehouseId: input.warehouseId,
    skuId: identity.skuId,
    productSkuId: identity.productSkuId,
    materialId: identity.materialId
  });
  const warehouse = warehouses.find((item) => item.id === input.warehouseId);

  if (!warehouse) {
    throw new Error("仓库不存在，请刷新页面后重试。");
  }

  const currentQuantity = roundQuantity(Number(existingRaw?.quantity_on_hand ?? 0));
  const { nextQuantity, signedDifference } = getAdjustmentTarget({
    currentQuantity,
    adjustmentMode: input.adjustmentMode,
    adjustmentQuantity: input.adjustmentQuantity,
    targetQuantity: input.targetQuantity
  });
  const inventoryItem =
    existingRow ??
    createSyntheticInventoryRow({
      warehouse,
      sku
    });

  let changedItem = existingRaw;

  if (existingRaw) {
    await updateInventoryItemQuantityById({
      inventoryItemId: existingRaw.id,
      expectedQuantity: currentQuantity,
      nextQuantity,
      action: "更新当前库存"
    });
  } else {
    changedItem = await insertInventoryItemWithQuantity({
      warehouseId: input.warehouseId,
      skuId: identity.skuId,
      productSkuId: identity.productSkuId,
      materialId: identity.materialId,
      itemType: identity.itemType,
      quantity: nextQuantity,
      unit: sku.unit
    });
  }

  try {
    await createAdjustmentTransaction({
      inventoryItem,
      adjustmentMode: input.adjustmentMode,
      reason: input.reason,
      beforeQuantity: currentQuantity,
      afterQuantity: nextQuantity,
      signedDifference,
      notes: input.notes
    });
  } catch (error) {
    if (changedItem) {
      try {
        await updateInventoryItemQuantityById({
          inventoryItemId: changedItem.id,
          expectedQuantity: nextQuantity,
          nextQuantity: currentQuantity,
          action: "回滚当前库存"
        });
      } catch (rollbackError) {
        throw new Error(
          `库存已经更新，但库存流水写入失败，自动回滚也失败。原始错误：${getUnknownErrorMessage(
            error
          )}；回滚错误：${getUnknownErrorMessage(rollbackError)}。请立刻检查库存和流水。`
        );
      }
    }

    throw error;
  }

  return {
    inventoryItem,
    beforeQuantity: currentQuantity,
    afterQuantity: nextQuantity,
    signedDifference
  };
}

export const otherInboundImportFields: CsvTemplateField[] = [
  {
    key: "仓库编码",
    label: "仓库编码",
    required: true,
    example: "WH-FIN-001",
    aliases: ["warehouse_code"]
  },
  {
    key: "SKU 编码",
    label: "SKU 编码",
    required: true,
    example: "SKU-001",
    aliases: ["sku_code"]
  },
  {
    key: "入库数量",
    label: "入库数量",
    required: true,
    example: "100",
    aliases: ["quantity"]
  },
  {
    key: "入库原因",
    label: "入库原因",
    required: true,
    example: "初始库存导入",
    aliases: ["reason"]
  },
  {
    key: "备注",
    label: "备注",
    example: "期初盘点录入",
    aliases: ["remark"]
  }
];

export const otherOutboundImportFields: CsvTemplateField[] = [
  {
    key: "仓库编码",
    label: "仓库编码",
    required: true,
    example: "WH-FIN-001",
    aliases: ["warehouse_code"]
  },
  {
    key: "SKU 编码",
    label: "SKU 编码",
    required: true,
    example: "SKU-001",
    aliases: ["sku_code"]
  },
  {
    key: "出库数量",
    label: "出库数量",
    required: true,
    example: "10",
    aliases: ["quantity"]
  },
  {
    key: "出库原因",
    label: "出库原因",
    required: true,
    example: "样品出库",
    aliases: ["reason"]
  },
  {
    key: "备注",
    label: "备注",
    example: "业务样品",
    aliases: ["remark"]
  }
];

export const inventoryAdjustmentImportFields: CsvTemplateField[] = [
  {
    key: "仓库编码",
    label: "仓库编码",
    required: true,
    example: "WH-FIN-001",
    aliases: ["warehouse_code"]
  },
  {
    key: "SKU 编码",
    label: "SKU 编码",
    required: true,
    example: "SKU-001",
    aliases: ["sku_code"]
  },
  {
    key: "调整方式",
    label: "调整方式",
    required: true,
    example: "直接修正库存",
    aliases: ["adjustment_mode"]
  },
  {
    key: "调整数量",
    label: "调整数量",
    example: "10",
    aliases: ["adjustment_quantity"]
  },
  {
    key: "调整后库存",
    label: "调整后库存",
    example: "100",
    aliases: ["target_quantity"]
  },
  {
    key: "调整原因",
    label: "调整原因",
    required: true,
    example: "期初库存",
    aliases: ["reason"]
  },
  {
    key: "备注",
    label: "备注",
    example: "系统上线期初录入",
    aliases: ["remark"]
  }
];

function getOtherMovementImportField(fields: CsvTemplateField[], key: string) {
  const field = fields.find((item) => item.key === key);

  if (!field) {
    throw new Error(`导入字段不存在：${key}`);
  }

  return field;
}

async function validateOtherMovementImportRows(input: {
  rows: CsvDataRow[];
  fields: CsvTemplateField[];
  movementType: "inbound" | "outbound";
}): Promise<OtherInventoryMovementValidationRow[]> {
  const warehouseCodeField = getOtherMovementImportField(input.fields, "仓库编码");
  const skuCodeField = getOtherMovementImportField(input.fields, "SKU 编码");
  const quantityField = getOtherMovementImportField(
    input.fields,
    input.movementType === "inbound" ? "入库数量" : "出库数量"
  );
  const reasonField = getOtherMovementImportField(
    input.fields,
    input.movementType === "inbound" ? "入库原因" : "出库原因"
  );
  const remarkField = getOtherMovementImportField(input.fields, "备注");
  const warehouseCodes = Array.from(
    new Set(
      input.rows
        .map((row) => getCsvRowValue(row, warehouseCodeField))
        .filter(Boolean)
    )
  );
  const skuCodes = Array.from(
    new Set(input.rows.map((row) => getCsvRowValue(row, skuCodeField)).filter(Boolean))
  );
  const supabase = getSupabaseClient();
  const [warehouseResult, skus] = await Promise.all([
    withTimeout(
      warehouseCodes.length > 0
        ? supabase
            .from("warehouses")
            .select("id, warehouse_code, name, warehouse_type, status")
            .in("warehouse_code", warehouseCodes)
        : Promise.resolve({ data: [], error: null } as any),
      "按编码读取导入仓库"
    ),
    getSkuOptionsForInventoryByCodes(skuCodes)
  ]);

  if (warehouseResult.error) {
    throw formatSupabaseError("按编码读取导入仓库", warehouseResult.error);
  }

  const warehouses = (warehouseResult.data ?? []) as InventoryTransactionWarehouse[];
  const warehouseByCode = new Map(
    warehouses.map((warehouse) => [warehouse.warehouse_code.trim(), warehouse])
  );
  const skuByCode = new Map(skus.map((sku) => [sku.sku_code.trim(), sku]));
  const validationRows = input.rows.map<OtherInventoryMovementValidationRow>(
    (row, index) => {
      const rowNumber = index + 2;
      const errors: string[] = [];
      const warehouseCode = getCsvRowValue(row, warehouseCodeField);
      const skuCode = getCsvRowValue(row, skuCodeField);
      const quantityText = getCsvRowValue(row, quantityField);
      const reason = getCsvRowValue(row, reasonField);
      const remark = getCsvRowValue(row, remarkField);
      const warehouse = warehouseCode ? warehouseByCode.get(warehouseCode) : null;
      const sku = skuCode ? skuByCode.get(skuCode) : null;
      const identity = sku ? getInventoryIdentityFromOption(sku) : null;
      const quantity = Number(quantityText);

      if (!warehouseCode) {
        errors.push("仓库编码必填。");
      } else if (!warehouse) {
        errors.push(`仓库编码 ${warehouseCode} 不存在。`);
      }

      if (!skuCode) {
        errors.push("SKU 编码必填。");
      } else if (!sku) {
        errors.push(`SKU 编码 ${skuCode} 不存在。`);
      } else if (!isInventorySupportedSkuType(sku.sku_type)) {
        errors.push("当前只支持辅料和成品 SKU。");
      }

      if (!quantityText) {
        errors.push("数量必填。");
      } else if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push("数量必须大于 0。");
      }

      if (!reason) {
        errors.push("原因必填。");
      }

      return {
        rowNumber,
        rawRow: row,
        data:
          warehouse && sku && Number.isFinite(quantity) && quantity > 0 && reason
            ? {
                warehouseId: warehouse.id,
                warehouseCode,
                skuId: identity?.skuId ?? sku.id,
                productSkuId: identity?.productSkuId ?? null,
                materialId: identity?.materialId ?? null,
                skuCode,
                skuName: sku.sku_name,
                skuType: sku.sku_type,
                unit: sku.unit,
                quantity: roundQuantity(quantity),
                reason,
                remark
              }
            : undefined,
        errors,
        groupKey:
          warehouse && identity
            ? `${warehouse.id}:${identity.materialId ?? identity.productSkuId ?? identity.skuId}`
            : undefined
      };
    }
  );

  if (input.movementType === "outbound") {
    await appendOtherOutboundStockValidation(validationRows);
  }

  return validationRows;
}

async function appendOtherOutboundStockValidation(
  rows: OtherInventoryMovementValidationRow[]
) {
  const rowsWithData = rows.filter((row) => row.data && row.errors.length === 0);
  const groupQuantity = new Map<string, number>();

  for (const row of rowsWithData) {
    if (!row.data || !row.groupKey) {
      continue;
    }

    groupQuantity.set(
      row.groupKey,
      roundQuantity((groupQuantity.get(row.groupKey) ?? 0) + row.data.quantity)
    );
  }

  if (groupQuantity.size === 0) {
    return;
  }

  const supabase = getSupabaseClient();
  const warehouseIds = Array.from(new Set(rowsWithData.map((row) => row.data?.warehouseId).filter(Boolean))) as string[];
  const skuIds = Array.from(new Set(rowsWithData.map((row) => row.data?.skuId).filter(Boolean))) as string[];
  const productSkuIds = Array.from(new Set(rowsWithData.map((row) => row.data?.productSkuId).filter(Boolean))) as string[];
  const materialIds = Array.from(new Set(rowsWithData.map((row) => row.data?.materialId).filter(Boolean))) as string[];
  const objectConditions: string[] = [];

  if (skuIds.length > 0) {
    objectConditions.push(`sku_id.in.(${skuIds.join(",")})`);
  }

  if (productSkuIds.length > 0) {
    objectConditions.push(`product_sku_id.in.(${productSkuIds.join(",")})`);
  }

  if (materialIds.length > 0) {
    objectConditions.push(`material_id.in.(${materialIds.join(",")})`);
  }

  const { data: inventoryRowsData, error: inventoryError } = await withTimeout(
    objectConditions.length > 0
      ? supabase
          .from("inventory_items")
          .select("warehouse_id, sku_id, product_sku_id, material_id, quantity_on_hand, reserved_quantity")
          .in("warehouse_id", warehouseIds)
          .or(objectConditions.join(","))
      : Promise.resolve({ data: [], error: null } as any),
    "校验其他出库库存"
  );

  if (inventoryError) {
    throw formatSupabaseError("校验其他出库库存", inventoryError);
  }

  const inventoryRows = (inventoryRowsData ?? []) as Pick<
    InventoryItem,
    "warehouse_id" | "sku_id" | "quantity_on_hand" | "reserved_quantity"
    | "product_sku_id" | "material_id"
  >[];
  const availableByGroup = new Map<string, number>();

  for (const item of inventoryRows) {
    const key = `${item.warehouse_id}:${item.material_id ?? item.product_sku_id ?? item.sku_id}`;
    availableByGroup.set(
      key,
      roundQuantity(
        Number(item.quantity_on_hand) - Number(item.reserved_quantity)
      )
    );
  }

  for (const row of rowsWithData) {
    if (!row.data || !row.groupKey) {
      continue;
    }

    const requestedQuantity = groupQuantity.get(row.groupKey) ?? 0;
    const availableQuantity = availableByGroup.get(row.groupKey) ?? 0;

    if (requestedQuantity > availableQuantity) {
      row.errors.push(
        `同仓库同 SKU 合计出库 ${requestedQuantity}，超过可用库存 ${availableQuantity}。`
      );
    }
  }
}

export async function validateOtherInboundImportRows(rows: CsvDataRow[]) {
  return validateOtherMovementImportRows({
    rows,
    fields: otherInboundImportFields,
    movementType: "inbound"
  });
}

export async function validateOtherOutboundImportRows(rows: CsvDataRow[]) {
  return validateOtherMovementImportRows({
    rows,
    fields: otherOutboundImportFields,
    movementType: "outbound"
  });
}

function getInventoryAdjustmentImportField(key: string) {
  const field = inventoryAdjustmentImportFields.find((item) => item.key === key);

  if (!field) {
    throw new Error(`库存调整导入字段不存在：${key}`);
  }

  return field;
}

function parseInventoryAdjustmentMode(
  value: string
): InventoryAdjustmentMode | null {
  const normalized = value.trim().toLowerCase();
  const modeMap: Record<string, InventoryAdjustmentMode> = {
    increase: "increase",
    "增加": "increase",
    "增加库存": "increase",
    decrease: "decrease",
    "减少": "decrease",
    "减少库存": "decrease",
    set_to: "set_to",
    setto: "set_to",
    "修正": "set_to",
    "直接修正": "set_to",
    "直接修正库存": "set_to",
    "期初": "set_to",
    "期初库存": "set_to",
    "盘点": "set_to"
  };

  return modeMap[normalized] ?? null;
}

function parseInventoryAdjustmentReason(
  value: string
): InventoryAdjustmentReason | null {
  const normalized = value.trim().toLowerCase();
  const reasonMap: Record<string, InventoryAdjustmentReason> = {
    initial_stock: "initial_stock",
    "期初": "initial_stock",
    "期初库存": "initial_stock",
    stocktake_gain: "stocktake_gain",
    "盘盈": "stocktake_gain",
    stocktake_loss: "stocktake_loss",
    "盘亏": "stocktake_loss",
    damage_loss: "damage_loss",
    "破损": "damage_loss",
    "破损报废": "damage_loss",
    sample_use: "sample_use",
    "样品": "sample_use",
    "样品领用": "sample_use",
    data_correction: "data_correction",
    "数据修正": "data_correction",
    other: "other",
    "其他": "other"
  };

  return reasonMap[normalized] ?? null;
}

export async function validateInventoryAdjustmentImportRows(
  rows: CsvDataRow[]
): Promise<InventoryAdjustmentValidationRow[]> {
  const warehouseCodeField = getInventoryAdjustmentImportField("仓库编码");
  const skuCodeField = getInventoryAdjustmentImportField("SKU 编码");
  const warehouseCodes = Array.from(
    new Set(rows.map((row) => getCsvRowValue(row, warehouseCodeField)).filter(Boolean))
  );
  const skuCodes = Array.from(
    new Set(rows.map((row) => getCsvRowValue(row, skuCodeField)).filter(Boolean))
  );
  const supabase = getSupabaseClient();
  const [warehouseResult, skus] = await Promise.all([
    withTimeout(
      warehouseCodes.length > 0
        ? supabase
            .from("warehouses")
            .select("id, warehouse_code, name, warehouse_type, status")
            .in("warehouse_code", warehouseCodes)
        : Promise.resolve({ data: [], error: null } as any),
      "按编码读取库存调整仓库"
    ),
    getSkuOptionsForInventoryByCodes(skuCodes)
  ]);

  if (warehouseResult.error) {
    throw formatSupabaseError("按编码读取库存调整仓库", warehouseResult.error);
  }

  const warehouses = (warehouseResult.data ?? []) as InventoryTransactionWarehouse[];
  const warehouseByCode = new Map(
    warehouses.map((warehouse) => [warehouse.warehouse_code.trim(), warehouse])
  );
  const skuByCode = new Map(skus.map((sku) => [sku.sku_code.trim(), sku]));
  const modeField = getInventoryAdjustmentImportField("调整方式");
  const adjustmentQuantityField = getInventoryAdjustmentImportField("调整数量");
  const targetQuantityField = getInventoryAdjustmentImportField("调整后库存");
  const reasonField = getInventoryAdjustmentImportField("调整原因");
  const remarkField = getInventoryAdjustmentImportField("备注");
  const groupCount = new Map<string, number>();
  const validationRows = rows.map<InventoryAdjustmentValidationRow>(
    (row, index) => {
      const rowNumber = index + 2;
      const errors: string[] = [];
      const warehouseCode = getCsvRowValue(row, warehouseCodeField);
      const skuCode = getCsvRowValue(row, skuCodeField);
      const modeText = getCsvRowValue(row, modeField);
      const adjustmentQuantityText = getCsvRowValue(row, adjustmentQuantityField);
      const targetQuantityText = getCsvRowValue(row, targetQuantityField);
      const reasonText = getCsvRowValue(row, reasonField);
      const remark = getCsvRowValue(row, remarkField);
      const warehouse = warehouseCode ? warehouseByCode.get(warehouseCode) : null;
      const sku = skuCode ? skuByCode.get(skuCode) : null;
      const identity = sku ? getInventoryIdentityFromOption(sku) : null;
      const adjustmentMode = modeText
        ? parseInventoryAdjustmentMode(modeText)
        : null;
      const reason = reasonText
        ? parseInventoryAdjustmentReason(reasonText)
        : null;
      const adjustmentQuantity = adjustmentQuantityText
        ? Number(adjustmentQuantityText)
        : undefined;
      const targetQuantity = targetQuantityText
        ? Number(targetQuantityText)
        : undefined;
      const groupKey =
        warehouse && identity
          ? `${warehouse.id}:${identity.materialId ?? identity.productSkuId ?? identity.skuId}`
          : undefined;

      if (groupKey) {
        groupCount.set(groupKey, (groupCount.get(groupKey) ?? 0) + 1);
      }

      if (!warehouseCode) {
        errors.push("仓库编码必填。");
      } else if (!warehouse) {
        errors.push(`仓库编码 ${warehouseCode} 不存在。`);
      }

      if (!skuCode) {
        errors.push("SKU 编码必填。");
      } else if (!sku) {
        errors.push(`SKU 编码 ${skuCode} 不存在。`);
      } else if (!isInventorySupportedSkuType(sku.sku_type)) {
        errors.push("当前只支持辅料和成品 SKU。");
      }

      if (!modeText) {
        errors.push("调整方式必填。");
      } else if (!adjustmentMode) {
        errors.push("调整方式只支持：直接修正库存、增加库存、减少库存。");
      }

      if (adjustmentMode === "set_to") {
        if (!targetQuantityText) {
          errors.push("直接修正库存时，调整后库存必填。");
        } else if (!Number.isFinite(targetQuantity) || Number(targetQuantity) < 0) {
          errors.push("调整后库存必须大于或等于 0。");
        }
      }

      if (adjustmentMode === "increase" || adjustmentMode === "decrease") {
        if (!adjustmentQuantityText) {
          errors.push("增加或减少库存时，调整数量必填。");
        } else if (
          !Number.isFinite(adjustmentQuantity) ||
          Number(adjustmentQuantity) <= 0
        ) {
          errors.push("调整数量必须大于 0。");
        }
      }

      if (!reasonText) {
        errors.push("调整原因必填。");
      } else if (!reason) {
        errors.push("调整原因只支持：期初库存、盘盈、盘亏、破损报废、样品领用、数据修正、其他。");
      }

      return {
        rowNumber,
        rawRow: row,
        data:
          warehouse && sku && adjustmentMode && reason && errors.length === 0
            ? {
                warehouseId: warehouse.id,
                warehouseCode,
                skuId: identity?.skuId ?? sku.id,
                productSkuId: identity?.productSkuId ?? null,
                materialId: identity?.materialId ?? null,
                skuCode,
                skuName: sku.sku_name,
                skuType: sku.sku_type,
                unit: sku.unit,
                adjustmentMode,
                adjustmentQuantity:
                  adjustmentMode === "set_to"
                    ? undefined
                    : roundQuantity(Number(adjustmentQuantity)),
                targetQuantity:
                  adjustmentMode === "set_to"
                    ? roundQuantity(Number(targetQuantity))
                    : undefined,
                reason,
                remark
              }
            : undefined,
        errors,
        groupKey
      };
    }
  );

  for (const row of validationRows) {
    if (row.groupKey && (groupCount.get(row.groupKey) ?? 0) > 1) {
      row.errors.push("同一仓库同一 SKU 在文件里重复，请合并成一行。");
      row.data = undefined;
    }
  }

  return validationRows;
}

export async function bulkCreateOtherInbound(
  rows: OtherInventoryMovementImportInput[]
): Promise<BulkImportResult> {
  if (rows.length === 0) {
    return { successCount: 0, failedCount: 0, errors: [] };
  }

  const supabase = getSupabaseClient();
  const payload = rows.map((row) => ({
    warehouse_id: row.warehouseId,
    sku_id: row.skuId,
    product_sku_id: row.productSkuId ?? null,
    material_id: row.materialId ?? null,
    quantity: row.quantity,
    reason: row.reason,
    remark: row.remark ?? "",
    unit: row.unit,
    sku_type: row.skuType,
    warehouse_code: row.warehouseCode,
    sku_code: row.skuCode
  }));
  const { data, error } = await withTimeout(
    supabase.rpc("bulk_create_other_inbound", { payload }),
    "批量其他入库"
  );

  if (error) {
    return buildBulkRpcFailureResult({ rows, error });
  }

  return normalizeBulkRpcResult(data as InventoryBulkRpcResponse | null, rows.length);
}

export async function bulkCreateOtherOutbound(
  rows: OtherInventoryMovementImportInput[]
): Promise<BulkImportResult> {
  if (rows.length === 0) {
    return { successCount: 0, failedCount: 0, errors: [] };
  }

  const supabase = getSupabaseClient();
  const payload = rows.map((row) => ({
    warehouse_id: row.warehouseId,
    sku_id: row.skuId,
    product_sku_id: row.productSkuId ?? null,
    material_id: row.materialId ?? null,
    quantity: row.quantity,
    reason: row.reason,
    remark: row.remark ?? "",
    unit: row.unit,
    sku_type: row.skuType,
    warehouse_code: row.warehouseCode,
    sku_code: row.skuCode
  }));
  const { data, error } = await withTimeout(
    supabase.rpc("bulk_create_other_outbound", { payload }),
    "批量其他出库"
  );

  if (error) {
    return buildBulkRpcFailureResult({ rows, error });
  }

  return normalizeBulkRpcResult(data as InventoryBulkRpcResponse | null, rows.length);
}

export async function bulkAdjustInventory(
  rows: InventoryAdjustmentImportInput[]
): Promise<BulkImportResult> {
  if (rows.length === 0) {
    return { successCount: 0, failedCount: 0, errors: [] };
  }

  const supabase = getSupabaseClient();
  const payload = rows.map((row) => ({
    warehouse_id: row.warehouseId,
    sku_id: row.skuId,
    product_sku_id: row.productSkuId ?? null,
    material_id: row.materialId ?? null,
    adjustment_mode: row.adjustmentMode,
    adjustment_quantity: row.adjustmentQuantity ?? null,
    target_quantity: row.targetQuantity ?? null,
    reason: row.reason,
    remark: row.remark ?? "",
    unit: row.unit,
    sku_type: row.skuType,
    warehouse_code: row.warehouseCode,
    sku_code: row.skuCode
  }));
  const { data, error } = await withTimeout(
    supabase.rpc("bulk_adjust_inventory", { payload }),
    "批量库存调整"
  );

  if (error) {
    return buildBulkRpcFailureResult({ rows, error });
  }

  return normalizeBulkRpcResult(data as InventoryBulkRpcResponse | null, rows.length);
}

async function getInventoryItemForAdjustment(
  inventoryItemId: string
): Promise<InventoryAdjustmentRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .select(getCurrentInventorySelect())
      .eq("id", inventoryItemId)
      .single(),
    "读取要调整的库存"
  );

  if (error) {
    throw formatSupabaseError("读取要调整的库存", error);
  }

  return normalizeCurrentInventory(data as unknown as RawCurrentInventoryRow);
}

async function updateInventoryItemQuantity(input: {
  inventoryItemId: string;
  expectedQuantity: number;
  nextQuantity: number;
  action: string;
}) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .update({ quantity_on_hand: input.nextQuantity })
      .eq("id", input.inventoryItemId)
      .eq("quantity_on_hand", input.expectedQuantity)
      .select("id")
      .maybeSingle(),
    input.action
  );

  if (error) {
    throw formatSupabaseError(input.action, error);
  }

  if (!data) {
    throw new Error("这条库存刚刚发生了变化，请刷新列表后重新调整。");
  }
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "未知错误";
}

function buildBulkRpcFailureResult(input: {
  rows: Array<{ warehouseCode: string; skuCode: string }>;
  error: unknown;
}): BulkImportResult {
  const message = getUnknownErrorMessage(input.error);

  return {
    successCount: 0,
    failedCount: input.rows.length,
    errors: input.rows.map((row, index) => ({
      rowNumber: index + 2,
      label: `${row.warehouseCode} / ${row.skuCode}`,
      message
    }))
  };
}

function normalizeBulkRpcResult(
  data: InventoryBulkRpcResponse | null,
  fallbackSuccessCount: number
): BulkImportResult {
  return {
    successCount: Number(data?.success_count ?? fallbackSuccessCount),
    failedCount: Number(data?.failed_count ?? 0),
    errors: Array.isArray(data?.errors) ? data.errors : []
  };
}

function getAdjustmentTarget(input: {
  currentQuantity: number;
  adjustmentMode: InventoryAdjustmentMode;
  adjustmentQuantity?: number;
  targetQuantity?: number;
}) {
  if (input.adjustmentMode === "set_to") {
    const targetQuantity = Number(input.targetQuantity);

    if (!Number.isFinite(targetQuantity) || targetQuantity < 0) {
      throw new Error("调整后库存不能小于 0。");
    }

    const nextQuantity = roundQuantity(targetQuantity);
    const signedDifference = roundQuantity(nextQuantity - input.currentQuantity);

    if (signedDifference === 0) {
      throw new Error("库存数量没有变化。");
    }

    return {
      nextQuantity,
      signedDifference
    };
  }

  const adjustmentQuantity = Number(input.adjustmentQuantity);

  if (!Number.isFinite(adjustmentQuantity) || adjustmentQuantity <= 0) {
    throw new Error("调整数量必须大于 0。");
  }

  if (
    input.adjustmentMode === "decrease" &&
    adjustmentQuantity > input.currentQuantity
  ) {
    throw new Error("减少库存数量不能大于当前库存。");
  }

  const signedDifference =
    input.adjustmentMode === "increase"
      ? roundQuantity(adjustmentQuantity)
      : roundQuantity(-adjustmentQuantity);
  const nextQuantity = roundQuantity(input.currentQuantity + signedDifference);

  if (nextQuantity < 0) {
    throw new Error("调整后库存不能小于 0。");
  }

  return {
    nextQuantity,
    signedDifference
  };
}

export async function createAdjustmentTransaction(
  input: CreateAdjustmentTransactionInput
) {
  const unit = input.inventoryItem.sku?.unit ?? input.inventoryItem.unit;
  const reasonLabel = getInventoryAdjustmentReasonLabel(input.reason);
  const modeLabel = getInventoryAdjustmentModeLabel(input.adjustmentMode);
  const signedDifferenceText =
    input.signedDifference > 0
      ? `+${input.signedDifference}`
      : String(input.signedDifference);
  const noteParts = [
    `调整原因：${reasonLabel}（${input.reason}）`,
    `调整方式：${modeLabel}（${input.adjustmentMode}）`,
    `调整前库存：${input.beforeQuantity} ${unit}`,
    `调整后库存：${input.afterQuantity} ${unit}`,
    `调整差异：${signedDifferenceText} ${unit}`,
    `操作备注：${input.notes?.trim() || "-"}`
  ];

  await createInventoryTransaction({
    warehouseId: input.inventoryItem.warehouse_id,
    skuId: input.inventoryItem.sku_id,
    productSkuId: input.inventoryItem.product_sku_id,
    materialId: input.inventoryItem.material_id,
    itemType: input.inventoryItem.item_type,
    transactionType: "adjustment",
    quantity: roundQuantity(Math.abs(input.signedDifference)),
    notes: noteParts.join("\n")
  });
}

export async function adjustInventoryItem(input: AdjustInventoryItemInput) {
  if (!input.inventoryItemId) {
    throw new Error("请选择要调整的库存。");
  }

  if (!input.reason) {
    throw new Error("请选择调整原因。");
  }

  const inventoryItem = await getInventoryItemForAdjustment(input.inventoryItemId);
  const currentQuantity = roundQuantity(Number(inventoryItem.quantity_on_hand));
  const { nextQuantity, signedDifference } = getAdjustmentTarget({
    currentQuantity,
    adjustmentMode: input.adjustmentMode,
    adjustmentQuantity: input.adjustmentQuantity,
    targetQuantity: input.targetQuantity
  });

  await updateInventoryItemQuantity({
    inventoryItemId: inventoryItem.id,
    expectedQuantity: currentQuantity,
    nextQuantity,
    action: "更新当前库存"
  });

  try {
    await createAdjustmentTransaction({
      inventoryItem,
      adjustmentMode: input.adjustmentMode,
      reason: input.reason,
      beforeQuantity: currentQuantity,
      afterQuantity: nextQuantity,
      signedDifference,
      notes: input.notes
    });
  } catch (error) {
    try {
      await updateInventoryItemQuantity({
        inventoryItemId: inventoryItem.id,
        expectedQuantity: nextQuantity,
        nextQuantity: currentQuantity,
        action: "回滚当前库存"
      });
    } catch (rollbackError) {
      throw new Error(
        `库存已经更新，但库存流水写入失败，自动回滚也失败。原始错误：${getUnknownErrorMessage(
          error
        )}；回滚错误：${getUnknownErrorMessage(rollbackError)}。请立刻检查库存和流水。`
      );
    }

    throw error;
  }

  return {
    inventoryItem,
    beforeQuantity: currentQuantity,
    afterQuantity: nextQuantity,
    signedDifference
  };
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
  const data = await fetchAllSupabaseRows<RawReceivablePurchaseOrder>(
    () =>
      supabase
      .from("purchase_orders")
      .select(getPurchaseOrderSelect())
      .in("status", ["ordered", "partially_received"])
      .order("created_at", { ascending: false }),
    "读取可入库采购单"
  );

  return data.map(normalizePurchaseOrder);
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
        `${orderItem.material?.material_code ?? orderItem.sku?.sku_code ?? "采购明细"} 本次入库数量不能超过待入库数量。`
      );
    }

    await createInventoryTransaction({
      warehouseId: input.warehouseId,
      skuId: orderItem.sku_id,
      materialId: orderItem.material_id,
      itemType: "material",
      transactionType: "material_in",
      quantity: receiveQuantity,
      purchaseOrderId: order.id,
      notes: `采购到货入库：${order.purchase_order_no}，单位：${orderItem.unit}`
    });

    await upsertInventoryItem({
      warehouseId: input.warehouseId,
      skuId: orderItem.sku_id,
      materialId: orderItem.material_id,
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
  const data = await fetchAllSupabaseRows<RawReceivableProductionOrder>(
    () =>
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
              brand_id,
              product_code,
              name,
              brand:brands!products_brand_id_fkey (
                id,
                brand_code,
                name,
                english_name,
                logo_url,
                status
              )
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

  return data.map(normalizeProductionOrder);
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
    productSkuId: order.sku_id,
    itemType: "finished_product",
    transactionType: "product_in",
    quantity: receiveQuantity,
    productionOrderId: order.id,
    replenishmentRequestId: order.replenishment_request_id,
    notes: `生产完成入库：${order.production_order_no}，单位：${order.sku?.unit ?? "pcs"}`
  });

  await upsertInventoryItem({
    warehouseId: input.warehouseId,
    skuId: order.sku_id,
    productSkuId: order.sku_id,
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
  const data = await fetchAllSupabaseRows<
    Pick<InventoryItem, "sku_id" | "product_sku_id" | "quantity_on_hand" | "reserved_quantity">
  >(
    () => {
      let query = supabase
        .from("inventory_items")
        .select("sku_id, product_sku_id, quantity_on_hand, reserved_quantity, item_type, warehouse_id")
        .in("item_type", ["finished_product", "finished_good", "product_sku"]);

      if (skuIds && skuIds.length > 0) {
        query = query.or(
          `product_sku_id.in.(${skuIds.join(",")}),sku_id.in.(${skuIds.join(",")})`
        );
      }

      if (warehouseId) {
        query = query.eq("warehouse_id", warehouseId);
      }

      return query;
    },
    "读取成品库存"
  );

  const inventoryBySku = new Map<string, number>();

  for (const item of data) {
    const skuId = item.product_sku_id ?? item.sku_id;
    if (!skuId) {
      continue;
    }
    const current = inventoryBySku.get(skuId) ?? 0;
    const availableQuantity = Math.max(
      0,
      Number(item.quantity_on_hand) - Number(item.reserved_quantity)
    );

    inventoryBySku.set(skuId, roundQuantity(current + availableQuantity));
  }

  return inventoryBySku;
}

export async function getFbaOutboundQuantity(
  requestIds?: string[]
): Promise<Map<string, number>> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<InventoryTransactionQuantity>(
    () => {
      let query = supabase
        .from("inventory_transactions")
        .select("replenishment_request_id, sku_id, product_sku_id, material_id, quantity")
        .eq("transaction_type", "product_out")
        .not("replenishment_request_id", "is", null);

      if (requestIds && requestIds.length > 0) {
        query = query.in("replenishment_request_id", requestIds);
      }

      return query;
    },
    "统计 FBA 已出库数量"
  );

  const outboundByRequest = new Map<string, number>();

  for (const transaction of data) {
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
  const rows = await fetchAllSupabaseRows<RawFbaOutboundRequest>(
    () =>
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
              brand_id,
              product_code,
              name,
              brand:brands!products_brand_id_fkey (
                id,
                brand_code,
                name,
                english_name,
                logo_url,
                status
              )
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
    productSkuId: input.request.sku_id,
    itemType: "finished_product",
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
        "id, warehouse_id, sku_id, product_sku_id, material_id, item_type, quantity_on_hand, reserved_quantity, safety_stock_quantity, unit"
      )
      .eq("warehouse_id", input.warehouseId)
      .or(`product_sku_id.eq.${input.skuId},sku_id.eq.${input.skuId}`)
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
