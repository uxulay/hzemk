import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import { createInventoryTransaction } from "@/lib/api/inventory";
import type { BrandSummary } from "@/lib/brand-utils";

export type PlanningRequestStatus =
  | "submitted"
  | "accepted"
  | "rejected"
  | "in_production";

export type PlanningRequestPriority = "low" | "normal" | "high" | "urgent";

export type ProductionOrderStatus =
  | "planned"
  | "material_pending"
  | "in_progress"
  | "completed"
  | "cancelled";

export type ProductionProfile = {
  id: string;
  full_name: string;
  email: string;
  status: string;
};

export type PlanningFbaReplenishmentRequest = {
  id: string;
  request_no: string;
  requested_by: string | null;
  sku_id: string;
  target_warehouse_id: string | null;
  fba_warehouse_code: string | null;
  requested_quantity: number;
  target_ship_date: string | null;
  priority: PlanningRequestPriority;
  status: PlanningRequestStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  rejected_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sku: {
    id: string;
    product_id: string | null;
    sku_code: string;
    sku_name: string;
    amazon_sku: string | null;
    fnsku: string | null;
    specs: string | null;
    unit: string;
    product: {
      id: string;
      brand_id: string | null;
      product_code: string;
      name: string;
      product_image_url: string | null;
      brand: BrandSummary | null;
    } | null;
  } | null;
  target_warehouse: {
    id: string;
    warehouse_code: string;
    name: string;
    warehouse_type: string;
  } | null;
  requested_by_profile: ProductionProfile | null;
  accepted_by_profile: ProductionProfile | null;
  items: PlanningFbaReplenishmentRequestItem[];
  product_count: number;
  sku_count: number;
  total_requested_quantity: number;
};

export type CreateProductionOrderInput = {
  replenishmentRequestId: string;
  skuId?: string;
  plannedQuantity?: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  assignedTo?: string;
  notes?: string;
  items?: Array<{
    replenishmentRequestItemId: string | null;
    skuId: string;
    requestedQuantity: number;
    plannedQuantity: number;
    remark?: string | null;
  }>;
};

export type CreatedProductionOrder = {
  id: string;
  production_order_no: string;
  material_requirement_count: number;
};

export type PlanningFbaReplenishmentRequestItem = {
  id: string;
  request_id: string;
  product_id: string | null;
  sku_id: string;
  requested_quantity: number;
  remark: string | null;
  sku: {
    id: string;
    product_id: string | null;
    sku_code: string;
    sku_name: string;
    specs: string | null;
    unit: string;
    product: {
      id: string;
      brand_id: string | null;
      product_code: string;
      name: string;
      product_image_url: string | null;
      brand: BrandSummary | null;
    } | null;
  } | null;
  product: {
    id: string;
    brand_id: string | null;
    product_code: string;
    name: string;
    product_image_url: string | null;
    brand: BrandSummary | null;
  } | null;
};

export type ProductionOrderItem = {
  id: string;
  production_order_id: string;
  replenishment_request_item_id: string | null;
  sku_id: string;
  requested_quantity: number | null;
  planned_quantity: number;
  completed_quantity: number;
  remark: string | null;
  sku: {
    id: string;
    product_id: string | null;
    sku_code: string;
    sku_name: string;
    specs: string | null;
    unit: string;
    product: {
      id: string;
      brand_id: string | null;
      product_code: string;
      name: string;
      product_image_url: string | null;
      brand: BrandSummary | null;
    } | null;
  } | null;
};

export type ProductionMaterialStatus =
  | "not_generated"
  | "shortage"
  | "purchased"
  | "received"
  | "issued"
  | "ready"
  | "pending";

export type ProductionMaterialIssueStatus =
  | "not_generated"
  | "issued"
  | "ready"
  | "shortage"
  | "warehouse_adjust_needed"
  | "blocked";

export type ProductionOrderTrackingRow = {
  id: string;
  production_order_no: string;
  replenishment_request_id: string | null;
  sku_id: string;
  bom_header_id: string | null;
  planned_quantity: number;
  completed_quantity: number;
  planned_start_date: string | null;
  planned_end_date: string | null;
  actual_start_at: string | null;
  actual_completed_at: string | null;
  status: ProductionOrderStatus;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  replenishment_request: {
    id: string;
    request_no: string;
    requested_quantity: number;
    status: string;
    target_ship_date: string | null;
    fba_warehouse_code: string | null;
  } | null;
  sku: {
    id: string;
    product_id: string | null;
    sku_code: string;
    sku_name: string;
    specs: string | null;
    unit: string;
    product: {
      id: string;
      brand_id: string | null;
      product_code: string;
      name: string;
      product_image_url: string | null;
      brand: BrandSummary | null;
    } | null;
  } | null;
  assigned_profile: ProductionProfile | null;
  material_requirements: Array<{
    id: string;
    material_id: string | null;
    required_quantity: number;
    available_quantity: number;
    shortage_quantity: number;
    unit: string;
    status: string;
    material: {
      id: string;
      material_code: string;
      material_name: string;
      specs: string | null;
      unit: string;
    } | null;
  }>;
  inbound_transactions: Array<{
    id: string;
    transaction_no: string;
    warehouse_id: string;
    transaction_type: string;
    quantity: number;
    occurred_at: string;
    notes: string | null;
    warehouse: {
      id: string;
      warehouse_code: string;
      name: string;
    } | null;
  }>;
  material_issue_transactions: Array<{
    id: string;
    transaction_no: string;
    warehouse_id: string;
    quantity: number;
    occurred_at: string;
    notes: string | null;
    warehouse: {
      id: string;
      warehouse_code: string;
      name: string;
    } | null;
  }>;
  requested_quantity: number;
  overproduction_quantity: number;
  inbound_quantity: number;
  pending_inbound_quantity: number;
  material_status: ProductionMaterialStatus;
  materials_issued: boolean;
  material_issue_status: ProductionMaterialIssueStatus;
  material_issue_can_issue: boolean;
  material_issue_block_reason: string | null;
  material_issue_shortage_count: number;
  items: ProductionOrderItem[];
  product_count: number;
  sku_count: number;
  total_planned_quantity: number;
  total_completed_quantity: number;
};

export type ProductionOrderStatusFilter = ProductionOrderStatus | "all";
export type ProductionMaterialStatusFilter = ProductionMaterialStatus | "all";

export type ProductionMaterialInventoryOption = {
  id: string;
  warehouse_id: string;
  material_id: string | null;
  item_type: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  available_quantity: number;
  unit: string;
  warehouse: {
    id: string;
    warehouse_code: string;
    name: string;
    warehouse_type: string;
    status: string;
  } | null;
};

export type ProductionIssueMaterialLineStatus =
  | "enough"
  | "shortage"
  | "warehouse_adjust_needed";

export type ProductionIssueMaterialLine = {
  material_requirement_id: string;
  material_id: string | null;
  sku_code: string;
  sku_name: string;
  unit: string;
  required_quantity: number;
  total_available_quantity: number;
  shortage_quantity: number;
  selected_inventory_item_id: string | null;
  selected_warehouse_id: string | null;
  selected_warehouse_code: string | null;
  selected_warehouse_name: string | null;
  selected_quantity_on_hand: number | null;
  selected_reserved_quantity: number | null;
  current_quantity: number;
  after_issue_quantity: number | null;
  status: ProductionIssueMaterialLineStatus;
  status_label: string;
  reason: string | null;
};

export type ProductionOrderIssueMaterialsPreview = {
  production_order_id: string;
  production_order_no: string;
  replenishment_request_id: string | null;
  sku_code: string;
  sku_name: string;
  planned_quantity: number;
  status: ProductionMaterialIssueStatus;
  materials_issued: boolean;
  can_issue: boolean;
  blocking_reason: string | null;
  shortage_count: number;
  materials: ProductionIssueMaterialLine[];
};

type MaybeRelation<T> = T | T[] | null;

type BomHeader = {
  id: string;
  product_sku_id: string;
  bom_code: string;
  version: string;
  status: string;
  effective_from: string | null;
};

type BomItem = {
  id: string;
  bom_header_id: string;
  material_id: string | null;
  material: {
    id: string;
    material_code: string;
    material_name: string;
    unit: string;
  } | null;
  quantity_per: number;
  unit: string;
  loss_rate: number;
};

type ResolvedBomRequirementLine = {
  key: string;
  material_id: string;
  quantity_per: number;
  unit: string;
  loss_rate: number;
  material_label: string;
};

type InventoryItem = {
  material_id: string | null;
  quantity_on_hand: number;
  reserved_quantity: number;
};

type MaterialIssueInventoryItem = {
  id: string;
  warehouse_id: string;
  sku_id: string;
  material_id: string | null;
  quantity_on_hand: number;
  reserved_quantity: number;
  unit: string;
};

type RawProductionMaterialInventoryOption = Omit<
  ProductionMaterialInventoryOption,
  "warehouse" | "available_quantity"
> & {
  warehouse: MaybeRelation<
    NonNullable<ProductionMaterialInventoryOption["warehouse"]>
  >;
};

type InsertedProductionOrder = {
  id: string;
  production_order_no: string;
};

type RawPlanningFbaReplenishmentRequest = Omit<
  PlanningFbaReplenishmentRequest,
  | "sku"
  | "target_warehouse"
  | "requested_by_profile"
  | "accepted_by_profile"
  | "items"
  | "product_count"
  | "sku_count"
  | "total_requested_quantity"
> & {
  sku: MaybeRelation<
    Omit<NonNullable<PlanningFbaReplenishmentRequest["sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<NonNullable<PlanningFbaReplenishmentRequest["sku"]>["product"]>
      >;
    }
  >;
  target_warehouse: MaybeRelation<
    NonNullable<PlanningFbaReplenishmentRequest["target_warehouse"]>
  >;
  requested_by_profile: MaybeRelation<ProductionProfile>;
  accepted_by_profile: MaybeRelation<ProductionProfile>;
  items: RawPlanningFbaReplenishmentRequestItem[] | null;
};

type RawPlanningFbaReplenishmentRequestItem = Omit<
  PlanningFbaReplenishmentRequestItem,
  "sku" | "product"
> & {
  sku: MaybeRelation<
    Omit<NonNullable<PlanningFbaReplenishmentRequestItem["sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<
          NonNullable<PlanningFbaReplenishmentRequestItem["sku"]>["product"]
        >
      >;
    }
  >;
  product: MaybeRelation<NonNullable<PlanningFbaReplenishmentRequestItem["product"]>>;
};

type RawProductionOrderTrackingRow = Omit<
  ProductionOrderTrackingRow,
  | "replenishment_request"
  | "sku"
  | "assigned_profile"
  | "material_requirements"
  | "inbound_transactions"
  | "requested_quantity"
  | "overproduction_quantity"
  | "inbound_quantity"
  | "pending_inbound_quantity"
  | "material_status"
  | "material_issue_transactions"
  | "materials_issued"
  | "material_issue_status"
  | "material_issue_can_issue"
  | "material_issue_block_reason"
  | "material_issue_shortage_count"
  | "items"
  | "product_count"
  | "sku_count"
  | "total_planned_quantity"
  | "total_completed_quantity"
> & {
  replenishment_request: MaybeRelation<
    NonNullable<ProductionOrderTrackingRow["replenishment_request"]>
  >;
  sku: MaybeRelation<
    Omit<NonNullable<ProductionOrderTrackingRow["sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<NonNullable<ProductionOrderTrackingRow["sku"]>["product"]>
      >;
    }
  >;
  assigned_profile: MaybeRelation<ProductionProfile>;
  material_requirements:
    | Array<
        Omit<
          ProductionOrderTrackingRow["material_requirements"][number],
          "material"
        > & {
          material: MaybeRelation<
            NonNullable<
              ProductionOrderTrackingRow["material_requirements"][number]["material"]
            >
          >;
        }
      >
    | null;
  inbound_transactions:
    | Array<
        Omit<
          ProductionOrderTrackingRow["inbound_transactions"][number],
          "warehouse"
        > & {
          warehouse: MaybeRelation<
            NonNullable<
              ProductionOrderTrackingRow["inbound_transactions"][number]["warehouse"]
            >
          >;
        }
      >
    | null;
  items: RawProductionOrderItem[] | null;
};

type RawProductionOrderItem = Omit<ProductionOrderItem, "sku"> & {
  sku: MaybeRelation<
    Omit<NonNullable<ProductionOrderItem["sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<NonNullable<ProductionOrderItem["sku"]>["product"]>
      >;
    }
  >;
};

function formatSupabaseError(action: string, error: { message: string }) {
  return new Error(`${action}失败：${error.message}`);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "未知错误";
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

function normalizePlanningRequest(
  request: RawPlanningFbaReplenishmentRequest
): PlanningFbaReplenishmentRequest {
  const sku = singleRelation(request.sku);
  const product = normalizeProductBrand(singleRelation(sku?.product ?? null));
  const items = (request.items ?? []).map(normalizePlanningRequestItem);
  const compatibleItems =
    items.length > 0 || !sku
      ? items
      : [
          {
            id: `${request.id}-legacy-item`,
            request_id: request.id,
            product_id: sku.product_id,
            sku_id: request.sku_id,
            requested_quantity: Number(request.requested_quantity),
            remark: null,
            sku: {
              ...sku,
              specs: sku.specs ?? null,
              unit: sku.unit ?? "pcs",
              product
            },
            product
          }
        ];
  const productIds = new Set(
    compatibleItems.map((item) => item.product_id).filter(Boolean)
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
    requested_by_profile: singleRelation(request.requested_by_profile),
    accepted_by_profile: singleRelation(request.accepted_by_profile),
    items: compatibleItems,
    product_count: productIds.size,
    sku_count: compatibleItems.length,
    total_requested_quantity: compatibleItems.reduce(
      (sum, item) => sum + Number(item.requested_quantity),
      0
    )
  };
}

function normalizePlanningRequestItem(
  item: RawPlanningFbaReplenishmentRequestItem
): PlanningFbaReplenishmentRequestItem {
  const sku = singleRelation(item.sku);
  const skuProduct = normalizeProductBrand(singleRelation(sku?.product ?? null));
  const directProduct = normalizeProductBrand(singleRelation(item.product));

  return {
    ...item,
    requested_quantity: Number(item.requested_quantity),
    sku: sku
      ? {
          ...sku,
          product: skuProduct
        }
      : null,
    product: directProduct ?? skuProduct
  };
}

function normalizeProductionOrderItem(
  item: RawProductionOrderItem
): ProductionOrderItem {
  const sku = singleRelation(item.sku);
  const product = normalizeProductBrand(singleRelation(sku?.product ?? null));

  return {
    ...item,
    requested_quantity:
      item.requested_quantity === null ? null : Number(item.requested_quantity),
    planned_quantity: Number(item.planned_quantity),
    completed_quantity: Number(item.completed_quantity),
    sku: sku
      ? {
          ...sku,
          product
        }
      : null
  };
}

function computeProductionOrderMaterialStatus(
  requirements: ProductionOrderTrackingRow["material_requirements"]
): ProductionMaterialStatus {
  if (requirements.length === 0) {
    return "not_generated";
  }

  const statuses = requirements.map((requirement) => requirement.status);

  if (statuses.includes("shortage")) {
    return "shortage";
  }

  if (statuses.includes("purchased")) {
    return "purchased";
  }

  if (statuses.includes("received")) {
    return "received";
  }

  if (statuses.every((status) => status === "issued")) {
    return "issued";
  }

  if (statuses.every((status) => ["enough", "ready", "reserved"].includes(status))) {
    return "ready";
  }

  return "pending";
}

function normalizeProductionOrderTrackingRow(
  row: RawProductionOrderTrackingRow
): ProductionOrderTrackingRow {
  const replenishmentRequest = singleRelation(row.replenishment_request);
  const sku = singleRelation(row.sku);
  const product = normalizeProductBrand(singleRelation(sku?.product ?? null));
  const materialRequirements = (row.material_requirements ?? []).map(
    (requirement) => ({
      ...requirement,
      material: singleRelation(requirement.material)
    })
  );
  const inboundTransactions = (row.inbound_transactions ?? [])
    .filter((transaction) => transaction.transaction_type === "product_in")
    .map((transaction) => ({
      ...transaction,
      warehouse: singleRelation(transaction.warehouse)
    }));
  const materialIssueTransactions = (row.inbound_transactions ?? [])
    .filter((transaction) => transaction.transaction_type === "material_out")
    .map((transaction) => ({
      id: transaction.id,
      transaction_no: transaction.transaction_no,
      warehouse_id: transaction.warehouse_id,
      quantity: Number(transaction.quantity),
      occurred_at: transaction.occurred_at,
      notes: transaction.notes,
      warehouse: singleRelation(transaction.warehouse)
    }));
  const requestedQuantity = Number(replenishmentRequest?.requested_quantity ?? 0);
  const items = (row.items ?? []).map(normalizeProductionOrderItem);
  const compatibleItems =
    items.length > 0 || !sku
      ? items
      : [
          {
            id: `${row.id}-legacy-item`,
            production_order_id: row.id,
            replenishment_request_item_id: null,
            sku_id: row.sku_id,
            requested_quantity: requestedQuantity,
            planned_quantity: Number(row.planned_quantity),
            completed_quantity: Number(row.completed_quantity),
            remark: null,
            sku: {
              ...sku,
              product
            }
          }
        ];
  const plannedQuantity = compatibleItems.reduce(
    (sum, item) => sum + Number(item.planned_quantity),
    0
  );
  const inboundQuantity = compatibleItems.reduce(
    (sum, item) => sum + Number(item.completed_quantity),
    0
  );
  const requestedQuantityFromItems = compatibleItems.reduce(
    (sum, item) => sum + Number(item.requested_quantity ?? 0),
    0
  );
  const productIds = new Set(
    compatibleItems.map((item) => item.sku?.product?.id).filter(Boolean)
  );
  const materialStatus = computeProductionOrderMaterialStatus(materialRequirements);
  const materialsIssued = materialIssueTransactions.length > 0;

  return {
    ...row,
    replenishment_request: replenishmentRequest,
    sku: sku
      ? {
          ...sku,
          product
        }
      : null,
    assigned_profile: singleRelation(row.assigned_profile),
    material_requirements: materialRequirements,
    inbound_transactions: inboundTransactions,
    material_issue_transactions: materialIssueTransactions,
    requested_quantity: requestedQuantityFromItems || requestedQuantity,
    overproduction_quantity: roundQuantity(
      Math.max(0, plannedQuantity - (requestedQuantityFromItems || requestedQuantity))
    ),
    inbound_quantity: inboundQuantity,
    pending_inbound_quantity: roundQuantity(
      Math.max(0, plannedQuantity - inboundQuantity)
    ),
    material_status: materialStatus,
    materials_issued: materialsIssued,
    material_issue_status: materialsIssued ? "issued" : "blocked",
    material_issue_can_issue: false,
    material_issue_block_reason: materialsIssued
      ? "该生产任务已确认领料，不能重复扣减库存。"
      : null,
    material_issue_shortage_count: 0,
    items: compatibleItems,
    product_count: productIds.size,
    sku_count: compatibleItems.length,
    total_planned_quantity: roundQuantity(plannedQuantity),
    total_completed_quantity: roundQuantity(inboundQuantity)
  };
}

function getProductionOrderSelect() {
  return `
    id,
    production_order_no,
    replenishment_request_id,
    sku_id,
    bom_header_id,
    planned_quantity,
    completed_quantity,
    planned_start_date,
    planned_end_date,
    actual_start_at,
    actual_completed_at,
    status,
    assigned_to,
    notes,
    created_at,
    updated_at,
    replenishment_request:fba_replenishment_requests!production_orders_replenishment_request_id_fkey (
      id,
      request_no,
      requested_quantity,
      status,
      target_ship_date,
      fba_warehouse_code
    ),
    sku:skus!production_orders_sku_id_fkey (
      id,
      product_id,
      sku_code,
      sku_name,
      specs,
      unit,
      product:products!skus_product_id_fkey (
        id,
        brand_id,
        product_code,
        name,
        product_image_url,
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
    assigned_profile:profiles!production_orders_assigned_to_fkey (
      id,
      full_name,
      email,
      status
    ),
    material_requirements:material_requirements!material_requirements_production_order_id_fkey (
      id,
      material_id,
      required_quantity,
      available_quantity,
      shortage_quantity,
      unit,
      status,
      material:materials!material_requirements_material_id_fkey (
        id,
        material_code,
        material_name,
        specs,
        unit
      )
    ),
    inbound_transactions:inventory_transactions!inventory_transactions_production_order_id_fkey (
      id,
      transaction_no,
      warehouse_id,
      product_sku_id,
      material_id,
      transaction_type,
      quantity,
      occurred_at,
      notes,
      warehouse:warehouses!inventory_transactions_warehouse_id_fkey (
        id,
        warehouse_code,
        name
      )
    ),
    items:production_order_items!production_order_items_production_order_id_fkey (
      id,
      production_order_id,
      replenishment_request_item_id,
      sku_id,
      requested_quantity,
      planned_quantity,
      completed_quantity,
      remark,
      sku:skus!production_order_items_sku_id_fkey (
        id,
        product_id,
        sku_code,
        sku_name,
        specs,
        unit,
        product:products!skus_product_id_fkey (
          id,
          brand_id,
          product_code,
          name,
          product_image_url,
          brand:brands!products_brand_id_fkey (
            id,
            brand_code,
            name,
            english_name,
            logo_url,
            status
          )
        )
      )
    )
  `;
}

function createProductionOrderNo() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();

  return `PO-${datePart}-${randomPart}`;
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function normalizeMaterialInventoryOption(
  row: RawProductionMaterialInventoryOption
): ProductionMaterialInventoryOption {
  const quantityOnHand = Number(row.quantity_on_hand);
  const reservedQuantity = Number(row.reserved_quantity);

  return {
    ...row,
    quantity_on_hand: quantityOnHand,
    reserved_quantity: reservedQuantity,
    available_quantity: roundQuantity(
      Math.max(0, quantityOnHand - reservedQuantity)
    ),
    warehouse: singleRelation(row.warehouse)
  };
}

function sortMaterialInventoryOptions(
  first: ProductionMaterialInventoryOption,
  second: ProductionMaterialInventoryOption
) {
  const firstActive = first.warehouse?.status === "active" ? 0 : 1;
  const secondActive = second.warehouse?.status === "active" ? 0 : 1;

  if (firstActive !== secondActive) {
    return firstActive - secondActive;
  }

  const firstMaterialWarehouse =
    first.warehouse?.warehouse_type === "material" ? 0 : 1;
  const secondMaterialWarehouse =
    second.warehouse?.warehouse_type === "material" ? 0 : 1;

  if (firstMaterialWarehouse !== secondMaterialWarehouse) {
    return firstMaterialWarehouse - secondMaterialWarehouse;
  }

  return (first.warehouse?.warehouse_code ?? "").localeCompare(
    second.warehouse?.warehouse_code ?? "",
    "zh-CN"
  );
}

async function getAvailableInventoryForMaterials(
  supabase: ReturnType<typeof getSupabaseClient>,
  materialIds: string[]
): Promise<Map<string, ProductionMaterialInventoryOption[]>> {
  const inventoryByMaterial = new Map<string, ProductionMaterialInventoryOption[]>();

  if (materialIds.length === 0) {
    return inventoryByMaterial;
  }

  const data = await fetchAllSupabaseRows<RawProductionMaterialInventoryOption>(
    () =>
      supabase
      .from("inventory_items")
      .select(
        `
          id,
          warehouse_id,
          material_id,
          item_type,
          quantity_on_hand,
          reserved_quantity,
          unit,
          warehouse:warehouses!inventory_items_warehouse_id_fkey (
            id,
            warehouse_code,
            name,
            warehouse_type,
            status
          )
        `
      )
      .in("material_id", materialIds)
      .order("created_at", { ascending: true }),
    "读取原材料当前库存"
  );

  for (const row of data) {
    const option = normalizeMaterialInventoryOption(row);
    if (option.material_id) {
      const current = inventoryByMaterial.get(option.material_id) ?? [];
      inventoryByMaterial.set(option.material_id, [...current, option]);
    }
  }

  for (const [materialId, options] of inventoryByMaterial.entries()) {
    inventoryByMaterial.set(
      materialId,
      [...options].sort(sortMaterialInventoryOptions)
    );
  }

  return inventoryByMaterial;
}

function getRequirementMaterialCode(
  requirement: ProductionOrderTrackingRow["material_requirements"][number]
) {
  return (
    requirement.material?.material_code ?? "-"
  );
}

function getRequirementMaterialName(
  requirement: ProductionOrderTrackingRow["material_requirements"][number]
) {
  return (
    requirement.material?.material_name ?? "-"
  );
}

function buildIssueMaterialLine(
  requirement: ProductionOrderTrackingRow["material_requirements"][number],
  inventoryOptions: ProductionMaterialInventoryOption[]
): ProductionIssueMaterialLine {
  const requiredQuantity = roundQuantity(Number(requirement.required_quantity));
  const materialCode = getRequirementMaterialCode(requirement);
  const materialName = getRequirementMaterialName(requirement);

  if (!requirement.material_id) {
    return {
      material_requirement_id: requirement.id,
      material_id: requirement.material_id,
      sku_code: materialCode,
      sku_name: materialName,
      unit: requirement.unit,
      required_quantity: requiredQuantity,
      total_available_quantity: 0,
      shortage_quantity: requiredQuantity,
      selected_inventory_item_id: null,
      selected_warehouse_id: null,
      selected_warehouse_code: null,
      selected_warehouse_name: null,
      selected_quantity_on_hand: null,
      selected_reserved_quantity: null,
      current_quantity: 0,
      after_issue_quantity: null,
      status: "shortage",
      status_label: "待补齐辅料",
      reason: "该物料需求没有关联辅料，不能确认领料。"
    };
  }

  const sortedOptions = [...inventoryOptions].sort(sortMaterialInventoryOptions);
  const selectedOption =
    sortedOptions.find(
      (option) => option.available_quantity >= requiredQuantity
    ) ?? null;
  const totalAvailableQuantity = roundQuantity(
    sortedOptions.reduce(
      (sum, option) => sum + Number(option.available_quantity),
      0
    )
  );
  const bestOption =
    selectedOption ??
    [...sortedOptions].sort(
      (first, second) => second.available_quantity - first.available_quantity
    )[0] ??
    null;

  if (selectedOption) {
    return {
      material_requirement_id: requirement.id,
      material_id: requirement.material_id,
      sku_code: materialCode,
      sku_name: materialName,
      unit: requirement.unit,
      required_quantity: requiredQuantity,
      total_available_quantity: totalAvailableQuantity,
      shortage_quantity: 0,
      selected_inventory_item_id: selectedOption.id,
      selected_warehouse_id: selectedOption.warehouse_id,
      selected_warehouse_code: selectedOption.warehouse?.warehouse_code ?? null,
      selected_warehouse_name: selectedOption.warehouse?.name ?? null,
      selected_quantity_on_hand: selectedOption.quantity_on_hand,
      selected_reserved_quantity: selectedOption.reserved_quantity,
      current_quantity: selectedOption.quantity_on_hand,
      after_issue_quantity: roundQuantity(
        selectedOption.quantity_on_hand - requiredQuantity
      ),
      status: "enough",
      status_label: "足够",
      reason: null
    };
  }

  if (totalAvailableQuantity >= requiredQuantity) {
    return {
      material_requirement_id: requirement.id,
      material_id: requirement.material_id,
      sku_code: materialCode,
      sku_name: materialName,
      unit: requirement.unit,
      required_quantity: requiredQuantity,
      total_available_quantity: totalAvailableQuantity,
      shortage_quantity: 0,
      selected_inventory_item_id: null,
      selected_warehouse_id: bestOption?.warehouse_id ?? null,
      selected_warehouse_code: bestOption?.warehouse?.warehouse_code ?? null,
      selected_warehouse_name: bestOption?.warehouse?.name ?? null,
      selected_quantity_on_hand: bestOption?.quantity_on_hand ?? null,
      selected_reserved_quantity: bestOption?.reserved_quantity ?? null,
      current_quantity: totalAvailableQuantity,
      after_issue_quantity: null,
      status: "warehouse_adjust_needed",
      status_label: "单仓不足",
      reason: "该原材料所有仓库合计够用，但没有一个仓库单独够扣，请先手动调整仓库库存。"
    };
  }

  return {
    material_requirement_id: requirement.id,
    material_id: requirement.material_id,
    sku_code: materialCode,
    sku_name: materialName,
    unit: requirement.unit,
    required_quantity: requiredQuantity,
    total_available_quantity: totalAvailableQuantity,
    shortage_quantity: roundQuantity(requiredQuantity - totalAvailableQuantity),
    selected_inventory_item_id: null,
    selected_warehouse_id: bestOption?.warehouse_id ?? null,
    selected_warehouse_code: bestOption?.warehouse?.warehouse_code ?? null,
    selected_warehouse_name: bestOption?.warehouse?.name ?? null,
    selected_quantity_on_hand: bestOption?.quantity_on_hand ?? null,
    selected_reserved_quantity: bestOption?.reserved_quantity ?? null,
    current_quantity: totalAvailableQuantity,
    after_issue_quantity: null,
    status: "shortage",
    status_label: "不足",
    reason: "当前可用库存不足，不能确认领料。"
  };
}

function buildIssuePreviewForOrder(
  order: ProductionOrderTrackingRow,
  inventoryByMaterial: Map<string, ProductionMaterialInventoryOption[]>
): ProductionOrderIssueMaterialsPreview {
  if (order.materials_issued) {
    return {
      production_order_id: order.id,
      production_order_no: order.production_order_no,
      replenishment_request_id: order.replenishment_request_id,
      sku_code: order.sku?.sku_code ?? "-",
      sku_name: order.sku?.sku_name ?? "-",
      planned_quantity: Number(order.total_planned_quantity),
      status: "issued",
      materials_issued: true,
      can_issue: false,
      blocking_reason: "该生产任务已确认领料，不能重复扣减库存。",
      shortage_count: 0,
      materials: []
    };
  }

  if (order.status === "cancelled") {
    return {
      production_order_id: order.id,
      production_order_no: order.production_order_no,
      replenishment_request_id: order.replenishment_request_id,
      sku_code: order.sku?.sku_code ?? "-",
      sku_name: order.sku?.sku_name ?? "-",
      planned_quantity: Number(order.total_planned_quantity),
      status: "blocked",
      materials_issued: false,
      can_issue: false,
      blocking_reason: "该生产任务已取消，不能确认领料。",
      shortage_count: 0,
      materials: []
    };
  }

  if (order.material_requirements.length === 0) {
    return {
      production_order_id: order.id,
      production_order_no: order.production_order_no,
      replenishment_request_id: order.replenishment_request_id,
      sku_code: order.sku?.sku_code ?? "-",
      sku_name: order.sku?.sku_name ?? "-",
      planned_quantity: Number(order.total_planned_quantity),
      status: "not_generated",
      materials_issued: false,
      can_issue: false,
      blocking_reason: "该生产任务还没有生成物料需求。",
      shortage_count: 0,
      materials: []
    };
  }

  const materials = order.material_requirements.map((requirement) =>
    buildIssueMaterialLine(
      requirement,
      inventoryByMaterial.get(requirement.material_id ?? "") ?? []
    )
  );
  const shortageCount = materials.filter(
    (material) => material.status !== "enough"
  ).length;
  const hasShortage = materials.some((material) => material.status === "shortage");
  const hasWarehouseAdjustNeeded = materials.some(
    (material) => material.status === "warehouse_adjust_needed"
  );

  if (hasShortage) {
    return {
      production_order_id: order.id,
      production_order_no: order.production_order_no,
      replenishment_request_id: order.replenishment_request_id,
      sku_code: order.sku?.sku_code ?? "-",
      sku_name: order.sku?.sku_name ?? "-",
      planned_quantity: Number(order.total_planned_quantity),
      status: "shortage",
      materials_issued: false,
      can_issue: false,
      blocking_reason: "原材料库存不足，请先采购入库或调整库存后再领料。",
      shortage_count: shortageCount,
      materials
    };
  }

  if (hasWarehouseAdjustNeeded) {
    return {
      production_order_id: order.id,
      production_order_no: order.production_order_no,
      replenishment_request_id: order.replenishment_request_id,
      sku_code: order.sku?.sku_code ?? "-",
      sku_name: order.sku?.sku_name ?? "-",
      planned_quantity: Number(order.planned_quantity),
      status: "warehouse_adjust_needed",
      materials_issued: false,
      can_issue: false,
      blocking_reason: "有原材料合计库存够，但单个仓库不够扣。第一版不跨仓扣料，请先手动调整仓库库存。",
      shortage_count: shortageCount,
      materials
    };
  }

  return {
    production_order_id: order.id,
    production_order_no: order.production_order_no,
    replenishment_request_id: order.replenishment_request_id,
    sku_code: order.sku?.sku_code ?? "-",
    sku_name: order.sku?.sku_name ?? "-",
    planned_quantity: Number(order.total_planned_quantity),
    status: "ready",
    materials_issued: false,
    can_issue: true,
    blocking_reason: null,
    shortage_count: 0,
    materials
  };
}

async function hydrateProductionOrderIssueStatuses(
  orders: ProductionOrderTrackingRow[]
): Promise<ProductionOrderTrackingRow[]> {
  const materialIds = [
    ...new Set(
      orders.flatMap((order) =>
        order.materials_issued
          ? []
          : order.material_requirements.map((requirement) => requirement.material_id)
      )
      .filter((materialId): materialId is string => Boolean(materialId))
    )
  ];
  const supabase = getSupabaseClient();
  const inventoryByMaterial = await getAvailableInventoryForMaterials(
    supabase,
    materialIds
  );

  return orders.map((order) => {
    const preview = buildIssuePreviewForOrder(order, inventoryByMaterial);

    return {
      ...order,
      material_issue_status: preview.status,
      material_issue_can_issue: preview.can_issue,
      material_issue_block_reason: preview.blocking_reason,
      material_issue_shortage_count: preview.shortage_count
    };
  });
}

async function getActiveBomHeader(
  supabase: ReturnType<typeof getSupabaseClient>,
  skuId: string
): Promise<BomHeader> {
  const { data, error } = await withTimeout(
    supabase
      .from("bom_headers")
      .select("id, product_sku_id, bom_code, version, status, effective_from")
      .eq("product_sku_id", skuId)
      .eq("status", "active")
      .order("effective_from", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    "读取成品 SKU 的启用 BOM"
  );

  if (error) {
    throw formatSupabaseError("读取成品 SKU 的启用 BOM", error);
  }

  if (!data) {
    throw new Error("当前成品 SKU 没有启用中的 BOM，不能自动生成物料需求。");
  }

  return data as BomHeader;
}

async function getBomItems(
  supabase: ReturnType<typeof getSupabaseClient>,
  bomHeaderId: string
): Promise<BomItem[]> {
  const { data, error } = await withTimeout(
    supabase
      .from("bom_items")
      .select(
        `
          id,
          bom_header_id,
          material_id,
          quantity_per,
          unit,
          loss_rate,
          material:materials!bom_items_material_id_fkey (
            id,
            material_code,
            material_name,
            unit
          )
        `
      )
      .eq("bom_header_id", bomHeaderId)
      .order("created_at", { ascending: true }),
    "读取 BOM 明细"
  );

  if (error) {
    throw formatSupabaseError("读取 BOM 明细", error);
  }

  const items = ((data ?? []) as unknown as Array<
    Omit<BomItem, "material"> & {
      material: MaybeRelation<NonNullable<BomItem["material"]>>;
    }
  >).map((item) => ({
    ...item,
    material: singleRelation(item.material)
  }));

  if (items.length === 0) {
    throw new Error("当前成品 SKU 的启用 BOM 没有明细，不能自动生成物料需求。");
  }

  return items;
}

async function resolveBomRequirementLines(
  _supabase: ReturnType<typeof getSupabaseClient>,
  bomItems: BomItem[]
): Promise<ResolvedBomRequirementLine[]> {
  return bomItems.map((item) => {
    if (item.material_id && item.material) {
      return {
        key: `material:${item.material_id}`,
        material_id: item.material_id,
        quantity_per: item.quantity_per,
        unit: item.material.unit || item.unit,
        loss_rate: item.loss_rate,
        material_label: `${item.material.material_code} / ${item.material.material_name}`
      };
    }

    throw new Error(`BOM 明细 ${item.id} 没有关联辅料，不能自动生成物料需求。`);
  });
}

async function getAvailableInventoryByMaterial(
  supabase: ReturnType<typeof getSupabaseClient>,
  materialIds: string[]
): Promise<Map<string, number>> {
  const availability = new Map<string, number>();

  if (materialIds.length === 0) {
    return availability;
  }

  const data = await fetchAllSupabaseRows<InventoryItem>(
    () =>
      supabase
        .from("inventory_items")
        .select("material_id, quantity_on_hand, reserved_quantity")
        .in("material_id", materialIds),
    "读取辅料库存"
  );

  for (const item of data) {
    if (!item.material_id) {
      continue;
    }

    const current = availability.get(item.material_id) ?? 0;
    const itemAvailable =
      Number(item.quantity_on_hand) - Number(item.reserved_quantity);

    availability.set(item.material_id, current + itemAvailable);
  }

  for (const [materialId, available] of availability.entries()) {
    availability.set(materialId, Math.max(0, roundQuantity(available)));
  }

  return availability;
}

async function ensureMaterialRequirementsDoNotExist(
  supabase: ReturnType<typeof getSupabaseClient>,
  productionOrderId: string
) {
  const { data, error } = await withTimeout(
    supabase
      .from("material_requirements")
      .select("id")
      .eq("production_order_id", productionOrderId)
      .limit(1),
    "检查生产任务是否已有物料需求"
  );

  if (error) {
    throw formatSupabaseError("检查生产任务是否已有物料需求", error);
  }

  if ((data ?? []).length > 0) {
    throw new Error("当前生产任务已经生成过物料需求，为避免重复生成，本次已停止。");
  }
}

async function generateMaterialRequirements(
  supabase: ReturnType<typeof getSupabaseClient>,
  productionOrderId: string,
  replenishmentRequestId: string,
  plannedQuantity: number,
  bomItems: BomItem[]
) {
  await ensureMaterialRequirementsDoNotExist(supabase, productionOrderId);

  const requirementLines = await resolveBomRequirementLines(supabase, bomItems);
  const materialIds = requirementLines
    .map((item) => item.material_id)
    .filter((materialId): materialId is string => Boolean(materialId));
  const availableByMaterial = await getAvailableInventoryByMaterial(
    supabase,
    materialIds
  );

  const rows = requirementLines.map((item) => {
    const quantityPer = Number(item.quantity_per);
    const lossRate = Number(item.loss_rate);
    const requiredQuantity = roundQuantity(
      plannedQuantity * quantityPer * (1 + lossRate)
    );
    const availableQuantity = availableByMaterial.get(item.material_id) ?? 0;
    const shortageQuantity = roundQuantity(
      Math.max(0, requiredQuantity - availableQuantity)
    );

    return {
      production_order_id: productionOrderId,
      replenishment_request_id: replenishmentRequestId,
      material_id: item.material_id,
      required_quantity: requiredQuantity,
      available_quantity: availableQuantity,
      shortage_quantity: shortageQuantity,
      reserved_quantity: 0,
      unit: item.unit,
      status: shortageQuantity > 0 ? "shortage" : "enough",
      notes: `按 BOM 计算：${item.material_label}；计划数量 ${plannedQuantity} × 单位用量 ${quantityPer} × (1 + 损耗率 ${lossRate})`
    };
  });

  const { error } = await withTimeout(
    supabase.from("material_requirements").insert(rows),
    "写入物料需求"
  );

  if (error) {
    throw formatSupabaseError("写入物料需求", error);
  }

  return rows.length;
}

async function generateMaterialRequirementsForOrderItems(
  supabase: ReturnType<typeof getSupabaseClient>,
  productionOrderId: string,
  replenishmentRequestId: string,
  items: Array<{
    skuId: string;
    plannedQuantity: number;
  }>
) {
  await ensureMaterialRequirementsDoNotExist(supabase, productionOrderId);

  const requirementByMaterial = new Map<
    string,
    {
      material_id: string;
      required_quantity: number;
      unit: string;
      notes: string[];
    }
  >();

  for (const item of items) {
    const bomHeader = await getActiveBomHeader(supabase, item.skuId);
    const bomItems = await getBomItems(supabase, bomHeader.id);
    const requirementLines = await resolveBomRequirementLines(supabase, bomItems);

    for (const bomItem of requirementLines) {
      const quantityPer = Number(bomItem.quantity_per);
      const lossRate = Number(bomItem.loss_rate);
      const requiredQuantity = roundQuantity(
        item.plannedQuantity * quantityPer * (1 + lossRate)
      );
      const current = requirementByMaterial.get(bomItem.key);
      const note = `SKU ${item.skuId} / ${bomItem.material_label}：计划数量 ${item.plannedQuantity} × 单位用量 ${quantityPer} × (1 + 损耗率 ${lossRate})`;

      if (current) {
        current.required_quantity = roundQuantity(
          current.required_quantity + requiredQuantity
        );
        current.notes.push(note);
      } else {
        requirementByMaterial.set(bomItem.key, {
          material_id: bomItem.material_id,
          required_quantity: requiredQuantity,
          unit: bomItem.unit,
          notes: [note]
        });
      }
    }
  }

  const materialIds = [...requirementByMaterial.values()]
    .map((requirement) => requirement.material_id)
    .filter((materialId): materialId is string => Boolean(materialId));
  const availableByMaterial = await getAvailableInventoryByMaterial(
    supabase,
    materialIds
  );
  const rows = [...requirementByMaterial.values()].map((requirement) => {
    const availableQuantity = availableByMaterial.get(requirement.material_id) ?? 0;
    const shortageQuantity = roundQuantity(
      Math.max(0, requirement.required_quantity - availableQuantity)
    );

    return {
      production_order_id: productionOrderId,
      replenishment_request_id: replenishmentRequestId,
      material_id: requirement.material_id,
      required_quantity: requirement.required_quantity,
      available_quantity: availableQuantity,
      shortage_quantity: shortageQuantity,
      reserved_quantity: 0,
      unit: requirement.unit,
      status: shortageQuantity > 0 ? "shortage" : "enough",
      notes: `按整张生产任务明细汇总计算。\n${requirement.notes.join("\n")}`
    };
  });

  if (rows.length === 0) {
    throw new Error("没有可写入的物料需求。");
  }

  const { error } = await withTimeout(
    supabase.from("material_requirements").insert(rows),
    "写入整张生产任务物料需求"
  );

  if (error) {
    throw formatSupabaseError("写入整张生产任务物料需求", error);
  }

  return rows.length;
}

export async function getProductionPlanningRequests(): Promise<
  PlanningFbaReplenishmentRequest[]
> {
  const supabase = getSupabaseClient();
  const rows = await fetchAllSupabaseRows<RawPlanningFbaReplenishmentRequest>(
    () =>
      supabase
        .from("fba_replenishment_requests")
        .select(
          `
          id,
          request_no,
          requested_by,
          sku_id,
          target_warehouse_id,
          fba_warehouse_code,
          requested_quantity,
          target_ship_date,
          priority,
          status,
          accepted_by,
          accepted_at,
          rejected_reason,
          notes,
          created_at,
          updated_at,
          sku:skus!fba_replenishment_requests_sku_id_fkey (
            id,
            product_id,
            sku_code,
            sku_name,
            amazon_sku,
            fnsku,
            specs,
            unit,
            product:products!skus_product_id_fkey (
              id,
              brand_id,
              product_code,
              name,
              product_image_url,
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
          requested_by_profile:profiles!fba_replenishment_requests_requested_by_fkey (
            id,
            full_name,
            email,
            status
          ),
          accepted_by_profile:profiles!fba_replenishment_requests_accepted_by_fkey (
            id,
            full_name,
            email,
            status
          ),
          items:fba_replenishment_request_items!fba_replenishment_request_items_request_id_fkey (
            id,
            request_id,
            product_id,
            sku_id,
            requested_quantity,
            remark,
            sku:skus!fba_replenishment_request_items_sku_id_fkey (
              id,
              product_id,
              sku_code,
              sku_name,
              specs,
              unit,
              product:products!skus_product_id_fkey (
                id,
                brand_id,
                product_code,
                name,
                product_image_url,
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
            product:products!fba_replenishment_request_items_product_id_fkey (
              id,
              brand_id,
              product_code,
              name,
              product_image_url,
              brand:brands!products_brand_id_fkey (
                id,
                brand_code,
                name,
                english_name,
                logo_url,
                status
              )
            )
          )
        `
        )
        .in("status", ["submitted", "accepted"])
        .order("created_at", { ascending: false }),
    "读取待排产 FBA 备货需求"
  );

  return rows.map(normalizePlanningRequest);
}

export async function getProductionAssignees(): Promise<ProductionProfile[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("profiles")
      .select("id, full_name, email, status")
      .order("full_name", { ascending: true }),
    "读取生产负责人列表"
  );

  if (error) {
    throw formatSupabaseError("读取生产负责人列表", error);
  }

  return (data ?? []) as ProductionProfile[];
}

export async function getProductionOrders(): Promise<ProductionOrderTrackingRow[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawProductionOrderTrackingRow>(
    () =>
      supabase
      .from("production_orders")
      .select(getProductionOrderSelect())
      .order("created_at", { ascending: false }),
    "读取生产任务列表"
  );

  const rows = data.map(
    normalizeProductionOrderTrackingRow
  );

  return hydrateProductionOrderIssueStatuses(rows);
}

export async function getProductionOrderDetail(
  productionOrderId: string
): Promise<ProductionOrderTrackingRow> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("production_orders")
      .select(getProductionOrderSelect())
      .eq("id", productionOrderId)
      .single(),
    "读取生产任务详情"
  );

  if (error) {
    throw formatSupabaseError("读取生产任务详情", error);
  }

  const row = normalizeProductionOrderTrackingRow(
    data as unknown as RawProductionOrderTrackingRow
  );
  const [hydratedRow] = await hydrateProductionOrderIssueStatuses([row]);

  return hydratedRow;
}

export async function getProductionOrderInboundQuantity(
  productionOrderId: string
): Promise<number> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_transactions")
      .select("quantity")
      .eq("production_order_id", productionOrderId)
      .eq("transaction_type", "product_in"),
    "统计生产任务入库数量"
  );

  if (error) {
    throw formatSupabaseError("统计生产任务入库数量", error);
  }

  return roundQuantity(
    (data ?? []).reduce((sum, transaction) => {
      return sum + Number(transaction.quantity);
    }, 0)
  );
}

export async function getProductionOrderMaterialStatus(
  productionOrderId: string
): Promise<ProductionMaterialStatus> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("material_requirements")
      .select("id, status")
      .eq("production_order_id", productionOrderId),
    "读取生产任务物料状态"
  );

  if (error) {
    throw formatSupabaseError("读取生产任务物料状态", error);
  }

  return computeProductionOrderMaterialStatus(
    (data ?? []).map((requirement) => ({
      id: requirement.id,
      material_id: null,
      required_quantity: 0,
      available_quantity: 0,
      shortage_quantity: 0,
      unit: "",
      status: requirement.status,
      material: null
    }))
  );
}

export async function hasProductionOrderIssuedMaterials(
  productionOrderId: string
): Promise<boolean> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_transactions")
      .select("id")
      .eq("production_order_id", productionOrderId)
      .eq("transaction_type", "material_out")
      .limit(1),
    "检查生产任务是否已领料"
  );

  if (error) {
    throw formatSupabaseError("检查生产任务是否已领料", error);
  }

  return (data ?? []).length > 0;
}

export async function getProductionOrderIssueMaterialsPreview(
  productionOrderId: string
): Promise<ProductionOrderIssueMaterialsPreview> {
  const supabase = getSupabaseClient();
  const order = await getProductionOrderDetail(productionOrderId);
  const materialIds = [
    ...new Set(
      order.material_requirements
        .map((requirement) => requirement.material_id)
        .filter((materialId): materialId is string => Boolean(materialId))
    )
  ];
  const inventoryBySku = await getAvailableInventoryForMaterials(
    supabase,
    materialIds
  );

  return buildIssuePreviewForOrder(order, inventoryBySku);
}

async function getMaterialInventoryItemForIssue(
  supabase: ReturnType<typeof getSupabaseClient>,
  inventoryItemId: string,
  materialId: string | null
): Promise<MaterialIssueInventoryItem> {
  const { data, error } = await withTimeout(
    (() => {
      let query = supabase
      .from("inventory_items")
        .select("id, warehouse_id, sku_id, material_id, quantity_on_hand, reserved_quantity, unit")
        .eq("id", inventoryItemId);

      if (materialId) {
        query = query.eq("material_id", materialId);
      }

      return query.single();
    })(),
    "重新读取原材料库存"
  );

  if (error) {
    throw formatSupabaseError("重新读取原材料库存", error);
  }

  return data as MaterialIssueInventoryItem;
}

async function deductMaterialInventory(input: {
  inventoryItem: MaterialIssueInventoryItem;
  quantity: number;
  materialLabel: string;
}) {
  const supabase = getSupabaseClient();
  const availableQuantity = roundQuantity(
    Number(input.inventoryItem.quantity_on_hand) -
      Number(input.inventoryItem.reserved_quantity)
  );

  if (availableQuantity < input.quantity) {
    throw new Error(
      `${input.materialLabel} 库存不足：需要 ${input.quantity}，当前可用 ${availableQuantity}，缺 ${roundQuantity(
        input.quantity - availableQuantity
      )}。`
    );
  }

  const nextQuantity = roundQuantity(
    Number(input.inventoryItem.quantity_on_hand) - input.quantity
  );
  const { error } = await withTimeout(
    supabase
      .from("inventory_items")
      .update({ quantity_on_hand: nextQuantity })
      .eq("id", input.inventoryItem.id),
    "扣减原材料库存"
  );

  if (error) {
    throw formatSupabaseError("扣减原材料库存", error);
  }
}

export async function createMaterialOutTransaction(input: {
  warehouseId: string;
  skuId: string;
  materialId?: string | null;
  quantity: number;
  productionOrderId: string;
  replenishmentRequestId?: string | null;
  notes?: string | null;
}) {
  await createInventoryTransaction({
    warehouseId: input.warehouseId,
    skuId: input.skuId,
    materialId: input.materialId ?? null,
    itemType: "material",
    transactionType: "material_out",
    quantity: input.quantity,
    productionOrderId: input.productionOrderId,
    replenishmentRequestId: input.replenishmentRequestId ?? null,
    notes: input.notes ?? "生产任务自动领料"
  });
}

async function markMaterialRequirementsIssued(productionOrderId: string) {
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("material_requirements")
      .update({ status: "issued" })
      .eq("production_order_id", productionOrderId),
    "更新物料需求为已领料"
  );

  if (error) {
    throw formatSupabaseError("更新物料需求为已领料", error);
  }
}

export async function issueMaterialsForProductionOrder(
  productionOrderId: string
): Promise<ProductionOrderIssueMaterialsPreview> {
  const preview = await getProductionOrderIssueMaterialsPreview(productionOrderId);

  if (preview.materials_issued) {
    throw new Error("该生产任务已确认领料，不能重复扣减库存。");
  }

  if (!preview.can_issue) {
    throw new Error(preview.blocking_reason ?? "当前生产任务不能确认领料。");
  }

  const alreadyIssued = await hasProductionOrderIssuedMaterials(productionOrderId);

  if (alreadyIssued) {
    throw new Error("该生产任务已确认领料，不能重复扣减库存。");
  }

  const supabase = getSupabaseClient();

  for (const material of preview.materials) {
    if (!material.selected_inventory_item_id || !material.selected_warehouse_id) {
      throw new Error(
        `${material.sku_code} 没有可扣减的单仓库存，不能确认领料。`
      );
    }

    if (!material.material_id) {
      throw new Error(`${material.sku_code} 没有关联可扣库存的辅料，不能确认领料。`);
    }

    const inventoryItem = await getMaterialInventoryItemForIssue(
      supabase,
      material.selected_inventory_item_id,
      material.material_id
    );
    const materialLabel = `${material.sku_code} / ${material.sku_name}`;

    await deductMaterialInventory({
      inventoryItem,
      quantity: material.required_quantity,
      materialLabel
    });

    try {
      await createMaterialOutTransaction({
        warehouseId: inventoryItem.warehouse_id,
        skuId: inventoryItem.sku_id,
        materialId: material.material_id,
        quantity: material.required_quantity,
        productionOrderId: productionOrderId,
        replenishmentRequestId: preview.replenishment_request_id,
        notes: [
          "生产任务自动领料",
          `生产任务：${preview.production_order_no}`,
          `原材料：${materialLabel}`,
          `应领数量：${material.required_quantity}${material.unit}`
        ].join("\n")
      });
    } catch (error) {
      await withTimeout(
        supabase
          .from("inventory_items")
          .update({ quantity_on_hand: inventoryItem.quantity_on_hand })
          .eq("id", inventoryItem.id),
        "恢复原材料库存"
      );

      throw new Error(
        `写入 ${materialLabel} 的领料流水失败，库存已尝试恢复：${getErrorMessage(
          error
        )}`
      );
    }
  }

  await markMaterialRequirementsIssued(productionOrderId);
  await updateProductionOrderStatus(productionOrderId, "in_progress");

  return getProductionOrderIssueMaterialsPreview(productionOrderId);
}

export async function updateProductionOrderStatus(
  productionOrderId: string,
  status: ProductionOrderStatus
) {
  const supabase = getSupabaseClient();
  const updates: Partial<{
    status: ProductionOrderStatus;
    actual_start_at: string;
    actual_completed_at: string;
  }> = { status };

  if (status === "in_progress") {
    updates.actual_start_at = new Date().toISOString();
  }

  if (status === "completed") {
    updates.actual_completed_at = new Date().toISOString();
  }

  const { error } = await withTimeout(
    supabase.from("production_orders").update(updates).eq("id", productionOrderId),
    "更新生产任务状态"
  );

  if (error) {
    throw formatSupabaseError("更新生产任务状态", error);
  }
}

export async function acceptFbaReplenishmentRequest(
  requestId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .update({
        status: "accepted",
        accepted_at: new Date().toISOString(),
        rejected_reason: null
      })
      .eq("id", requestId),
    "接单 FBA 备货需求"
  );

  if (error) {
    throw formatSupabaseError("接单 FBA 备货需求", error);
  }
}

export async function rejectFbaReplenishmentRequest(
  requestId: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .update({
        status: "rejected",
        accepted_by: null,
        accepted_at: null
      })
      .eq("id", requestId),
    "拒绝 FBA 备货需求"
  );

  if (error) {
    throw formatSupabaseError("拒绝 FBA 备货需求", error);
  }
}

export async function createProductionOrder(
  input: CreateProductionOrderInput
): Promise<CreatedProductionOrder> {
  const supabase = getSupabaseClient();
  const normalizedItems =
    input.items && input.items.length > 0
      ? input.items.map((item) => ({
          replenishmentRequestItemId: item.replenishmentRequestItemId,
          skuId: item.skuId,
          requestedQuantity: Number(item.requestedQuantity),
          plannedQuantity: Number(item.plannedQuantity),
          remark: item.remark?.trim() || null
        }))
      : [
          {
            replenishmentRequestItemId: null,
            skuId: input.skuId ?? "",
            requestedQuantity: Number(input.plannedQuantity ?? 0),
            plannedQuantity: Number(input.plannedQuantity ?? 0),
            remark: null
          }
        ];

  if (normalizedItems.length === 0) {
    throw new Error("至少需要一条生产明细。");
  }

  const invalidItem = normalizedItems.find(
    (item) =>
      !item.skuId ||
      !Number.isInteger(item.plannedQuantity) ||
      item.plannedQuantity <= 0
  );

  if (invalidItem) {
    throw new Error("每个 SKU 的计划生产数量都必须是正整数。");
  }

  const existingResult = await withTimeout(
    supabase
      .from("production_orders")
      .select("id, production_order_no")
      .eq("replenishment_request_id", input.replenishmentRequestId)
      .limit(1),
    "检查是否已创建生产任务"
  );

  if (existingResult.error) {
    throw formatSupabaseError("检查是否已创建生产任务", existingResult.error);
  }

  if ((existingResult.data ?? []).length > 0) {
    throw new Error("这张 FBA 备货单已经创建过生产任务，第一版先禁止重复创建。");
  }

  const firstItem = normalizedItems[0];
  const firstBomHeader = await getActiveBomHeader(supabase, firstItem.skuId);
  const totalPlannedQuantity = normalizedItems.reduce(
    (sum, item) => sum + item.plannedQuantity,
    0
  );
  const { data, error } = await withTimeout(
    supabase
      .from("production_orders")
      .insert({
        production_order_no: createProductionOrderNo(),
        replenishment_request_id: input.replenishmentRequestId,
        sku_id: firstItem.skuId,
        bom_header_id: firstBomHeader.id,
        planned_quantity: totalPlannedQuantity,
        completed_quantity: 0,
        planned_start_date: input.plannedStartDate || null,
        planned_end_date: input.plannedEndDate || null,
        actual_start_at: null,
        actual_completed_at: null,
        status: "planned",
        assigned_to: input.assignedTo || null,
        notes: input.notes?.trim() || null
      })
      .select("id, production_order_no")
      .single(),
    "创建生产任务"
  );

  if (error) {
    throw formatSupabaseError("创建生产任务", error);
  }

  const created = data as InsertedProductionOrder;
  const { error: itemError } = await withTimeout(
    supabase.from("production_order_items").insert(
      normalizedItems.map((item) => ({
        production_order_id: created.id,
        replenishment_request_item_id: item.replenishmentRequestItemId,
        sku_id: item.skuId,
        requested_quantity: item.requestedQuantity,
        planned_quantity: item.plannedQuantity,
        completed_quantity: 0,
        remark: item.remark
      }))
    ),
    "创建生产任务明细"
  );

  if (itemError) {
    await supabase
      .from("production_orders")
      .update({
        status: "cancelled",
        notes: `${input.notes?.trim() || ""}\n系统提示：生产任务明细创建失败，这张生产任务不要继续流转。`.trim()
      })
      .eq("id", created.id);
    throw new Error(
      `生产任务主表已创建，但明细创建失败，系统已把主表标记为取消：${itemError.message}`
    );
  }

  let materialRequirementCount = 0;
  try {
    materialRequirementCount = await generateMaterialRequirementsForOrderItems(
      supabase,
      created.id,
      input.replenishmentRequestId,
      normalizedItems.map((item) => ({
        skuId: item.skuId,
        plannedQuantity: item.plannedQuantity
      }))
    );
  } catch (error) {
    throw new Error(
      `生产任务已创建（${created.production_order_no}），但物料需求生成失败：${getErrorMessage(error)}`
    );
  }

  const { error: statusError } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .update({ status: "in_production" })
      .eq("id", input.replenishmentRequestId),
    "更新 FBA 备货需求为生产中"
  );

  if (statusError) {
    throw new Error(
      `生产任务已创建（${created.production_order_no}），物料需求已生成，但更新 FBA 备货需求状态失败：${statusError.message}`
    );
  }

  return {
    ...created,
    material_requirement_count: materialRequirementCount
  };
}
