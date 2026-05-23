import { getSupabaseClient } from "@/lib/supabase/client";
import { createInventoryTransaction } from "@/lib/api/inventory";

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
  requested_by_profile: ProductionProfile | null;
  accepted_by_profile: ProductionProfile | null;
};

export type CreateProductionOrderInput = {
  replenishmentRequestId: string;
  skuId: string;
  plannedQuantity: number;
  plannedStartDate?: string;
  plannedEndDate?: string;
  assignedTo?: string;
  notes?: string;
};

export type CreatedProductionOrder = {
  id: string;
  production_order_no: string;
  material_requirement_count: number;
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
    sku_code: string;
    sku_name: string;
    unit: string;
    product: {
      id: string;
      product_code: string;
      name: string;
    } | null;
  } | null;
  assigned_profile: ProductionProfile | null;
  material_requirements: Array<{
    id: string;
    material_sku_id: string;
    required_quantity: number;
    available_quantity: number;
    shortage_quantity: number;
    unit: string;
    status: string;
    material_sku: {
      id: string;
      sku_code: string;
      sku_name: string;
    } | null;
  }>;
  inbound_transactions: Array<{
    id: string;
    transaction_no: string;
    warehouse_id: string;
    sku_id: string;
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
    sku_id: string;
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
};

export type ProductionOrderStatusFilter = ProductionOrderStatus | "all";
export type ProductionMaterialStatusFilter = ProductionMaterialStatus | "all";

export type ProductionMaterialInventoryOption = {
  id: string;
  warehouse_id: string;
  sku_id: string;
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
  material_sku_id: string;
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
  component_sku_id: string;
  quantity_per: number;
  unit: string;
  loss_rate: number;
};

type InventoryItem = {
  sku_id: string;
  quantity_on_hand: number;
  reserved_quantity: number;
};

type MaterialIssueInventoryItem = {
  id: string;
  warehouse_id: string;
  sku_id: string;
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
  "sku" | "target_warehouse" | "requested_by_profile" | "accepted_by_profile"
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
          "material_sku"
        > & {
          material_sku: MaybeRelation<
            NonNullable<
              ProductionOrderTrackingRow["material_requirements"][number]["material_sku"]
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

function normalizePlanningRequest(
  request: RawPlanningFbaReplenishmentRequest
): PlanningFbaReplenishmentRequest {
  const sku = singleRelation(request.sku);
  const product = singleRelation(sku?.product ?? null);

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
    accepted_by_profile: singleRelation(request.accepted_by_profile)
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
  const materialRequirements = (row.material_requirements ?? []).map(
    (requirement) => ({
      ...requirement,
      material_sku: singleRelation(requirement.material_sku)
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
      sku_id: transaction.sku_id,
      quantity: Number(transaction.quantity),
      occurred_at: transaction.occurred_at,
      notes: transaction.notes,
      warehouse: singleRelation(transaction.warehouse)
    }));
  const requestedQuantity = Number(replenishmentRequest?.requested_quantity ?? 0);
  const plannedQuantity = Number(row.planned_quantity);
  const inboundQuantity = Number(row.completed_quantity);
  const materialStatus = computeProductionOrderMaterialStatus(materialRequirements);
  const materialsIssued = materialIssueTransactions.length > 0;

  return {
    ...row,
    replenishment_request: replenishmentRequest,
    sku: sku
      ? {
          ...sku,
          product: singleRelation(sku.product)
        }
      : null,
    assigned_profile: singleRelation(row.assigned_profile),
    material_requirements: materialRequirements,
    inbound_transactions: inboundTransactions,
    material_issue_transactions: materialIssueTransactions,
    requested_quantity: requestedQuantity,
    overproduction_quantity: roundQuantity(
      Math.max(0, plannedQuantity - requestedQuantity)
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
    material_issue_shortage_count: 0
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
      sku_code,
      sku_name,
      unit,
      product:products!skus_product_id_fkey (
        id,
        product_code,
        name
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
      material_sku_id,
      required_quantity,
      available_quantity,
      shortage_quantity,
      unit,
      status,
      material_sku:skus!material_requirements_material_sku_id_fkey (
        id,
        sku_code,
        sku_name
      )
    ),
    inbound_transactions:inventory_transactions!inventory_transactions_production_order_id_fkey (
      id,
      transaction_no,
      warehouse_id,
      sku_id,
      transaction_type,
      quantity,
      occurred_at,
      notes,
      warehouse:warehouses!inventory_transactions_warehouse_id_fkey (
        id,
        warehouse_code,
        name
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
  skuIds: string[]
): Promise<Map<string, ProductionMaterialInventoryOption[]>> {
  const inventoryBySku = new Map<string, ProductionMaterialInventoryOption[]>();

  if (skuIds.length === 0) {
    return inventoryBySku;
  }

  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .select(
        `
          id,
          warehouse_id,
          sku_id,
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
      .in("sku_id", skuIds)
      .order("created_at", { ascending: true }),
    "读取原材料当前库存"
  );

  if (error) {
    throw formatSupabaseError("读取原材料当前库存", error);
  }

  for (const row of (data ?? []) as unknown as RawProductionMaterialInventoryOption[]) {
    const option = normalizeMaterialInventoryOption(row);
    const current = inventoryBySku.get(option.sku_id) ?? [];

    inventoryBySku.set(option.sku_id, [...current, option]);
  }

  for (const [skuId, options] of inventoryBySku.entries()) {
    inventoryBySku.set(skuId, [...options].sort(sortMaterialInventoryOptions));
  }

  return inventoryBySku;
}

export async function getAvailableInventoryForMaterial(
  skuId: string
): Promise<ProductionMaterialInventoryOption[]> {
  const supabase = getSupabaseClient();
  const inventoryBySku = await getAvailableInventoryForMaterials(supabase, [
    skuId
  ]);

  return inventoryBySku.get(skuId) ?? [];
}

function buildIssueMaterialLine(
  requirement: ProductionOrderTrackingRow["material_requirements"][number],
  inventoryOptions: ProductionMaterialInventoryOption[]
): ProductionIssueMaterialLine {
  const requiredQuantity = roundQuantity(Number(requirement.required_quantity));
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
      material_sku_id: requirement.material_sku_id,
      sku_code: requirement.material_sku?.sku_code ?? "-",
      sku_name: requirement.material_sku?.sku_name ?? "-",
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
      material_sku_id: requirement.material_sku_id,
      sku_code: requirement.material_sku?.sku_code ?? "-",
      sku_name: requirement.material_sku?.sku_name ?? "-",
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
    material_sku_id: requirement.material_sku_id,
    sku_code: requirement.material_sku?.sku_code ?? "-",
    sku_name: requirement.material_sku?.sku_name ?? "-",
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
  inventoryBySku: Map<string, ProductionMaterialInventoryOption[]>
): ProductionOrderIssueMaterialsPreview {
  if (order.materials_issued) {
    return {
      production_order_id: order.id,
      production_order_no: order.production_order_no,
      replenishment_request_id: order.replenishment_request_id,
      sku_code: order.sku?.sku_code ?? "-",
      sku_name: order.sku?.sku_name ?? "-",
      planned_quantity: Number(order.planned_quantity),
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
      planned_quantity: Number(order.planned_quantity),
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
      planned_quantity: Number(order.planned_quantity),
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
      inventoryBySku.get(requirement.material_sku_id) ?? []
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
      planned_quantity: Number(order.planned_quantity),
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
    planned_quantity: Number(order.planned_quantity),
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
  const skuIds = [
    ...new Set(
      orders.flatMap((order) =>
        order.materials_issued
          ? []
          : order.material_requirements.map((requirement) => requirement.material_sku_id)
      )
    )
  ];
  const supabase = getSupabaseClient();
  const inventoryBySku = await getAvailableInventoryForMaterials(supabase, skuIds);

  return orders.map((order) => {
    const preview = buildIssuePreviewForOrder(order, inventoryBySku);

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
      .select("id, bom_header_id, component_sku_id, quantity_per, unit, loss_rate")
      .eq("bom_header_id", bomHeaderId)
      .order("created_at", { ascending: true }),
    "读取 BOM 明细"
  );

  if (error) {
    throw formatSupabaseError("读取 BOM 明细", error);
  }

  const items = (data ?? []) as BomItem[];

  if (items.length === 0) {
    throw new Error("当前成品 SKU 的启用 BOM 没有明细，不能自动生成物料需求。");
  }

  return items;
}

async function getAvailableInventoryBySku(
  supabase: ReturnType<typeof getSupabaseClient>,
  skuIds: string[]
): Promise<Map<string, number>> {
  const availability = new Map<string, number>();

  if (skuIds.length === 0) {
    return availability;
  }

  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .select("sku_id, quantity_on_hand, reserved_quantity")
      .in("sku_id", skuIds),
    "读取原材料库存"
  );

  if (error) {
    throw formatSupabaseError("读取原材料库存", error);
  }

  for (const item of (data ?? []) as InventoryItem[]) {
    const current = availability.get(item.sku_id) ?? 0;
    const itemAvailable =
      Number(item.quantity_on_hand) - Number(item.reserved_quantity);

    availability.set(item.sku_id, current + itemAvailable);
  }

  for (const [skuId, available] of availability.entries()) {
    availability.set(skuId, Math.max(0, roundQuantity(available)));
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

  const materialSkuIds = bomItems.map((item) => item.component_sku_id);
  const availableBySku = await getAvailableInventoryBySku(supabase, materialSkuIds);

  const rows = bomItems.map((item) => {
    const quantityPer = Number(item.quantity_per);
    const lossRate = Number(item.loss_rate);
    const requiredQuantity = roundQuantity(
      plannedQuantity * quantityPer * (1 + lossRate)
    );
    const availableQuantity = availableBySku.get(item.component_sku_id) ?? 0;
    const shortageQuantity = roundQuantity(
      Math.max(0, requiredQuantity - availableQuantity)
    );

    return {
      production_order_id: productionOrderId,
      replenishment_request_id: replenishmentRequestId,
      material_sku_id: item.component_sku_id,
      required_quantity: requiredQuantity,
      available_quantity: availableQuantity,
      shortage_quantity: shortageQuantity,
      reserved_quantity: 0,
      unit: item.unit,
      status: shortageQuantity > 0 ? "shortage" : "enough",
      notes: `按 BOM 计算：计划数量 ${plannedQuantity} × 单位用量 ${quantityPer} × (1 + 损耗率 ${lossRate})`
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

export async function getProductionPlanningRequests(): Promise<
  PlanningFbaReplenishmentRequest[]
> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
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
          )
        `
      )
      .in("status", ["submitted", "accepted"])
      .order("created_at", { ascending: false }),
    "读取待排产 FBA 备货需求"
  );

  if (error) {
    throw formatSupabaseError("读取待排产 FBA 备货需求", error);
  }

  const rows = (data ?? []) as unknown as RawPlanningFbaReplenishmentRequest[];

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
  const { data, error } = await withTimeout(
    supabase
      .from("production_orders")
      .select(getProductionOrderSelect())
      .order("created_at", { ascending: false }),
    "读取生产任务列表"
  );

  if (error) {
    throw formatSupabaseError("读取生产任务列表", error);
  }

  const rows = ((data ?? []) as unknown as RawProductionOrderTrackingRow[]).map(
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
      material_sku_id: "",
      required_quantity: 0,
      available_quantity: 0,
      shortage_quantity: 0,
      unit: "",
      status: requirement.status,
      material_sku: null
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
  const materialSkuIds = [
    ...new Set(
      order.material_requirements.map(
        (requirement) => requirement.material_sku_id
      )
    )
  ];
  const inventoryBySku = await getAvailableInventoryForMaterials(
    supabase,
    materialSkuIds
  );

  return buildIssuePreviewForOrder(order, inventoryBySku);
}

async function getMaterialInventoryItemForIssue(
  supabase: ReturnType<typeof getSupabaseClient>,
  inventoryItemId: string,
  materialSkuId: string
): Promise<MaterialIssueInventoryItem> {
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .select("id, warehouse_id, sku_id, quantity_on_hand, reserved_quantity, unit")
      .eq("id", inventoryItemId)
      .eq("sku_id", materialSkuId)
      .single(),
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
  quantity: number;
  productionOrderId: string;
  replenishmentRequestId?: string | null;
  notes?: string | null;
}) {
  await createInventoryTransaction({
    warehouseId: input.warehouseId,
    skuId: input.skuId,
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

    const inventoryItem = await getMaterialInventoryItemForIssue(
      supabase,
      material.selected_inventory_item_id,
      material.material_sku_id
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
        skuId: material.material_sku_id,
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
  const bomHeader = await getActiveBomHeader(supabase, input.skuId);
  const bomItems = await getBomItems(supabase, bomHeader.id);
  const { data, error } = await withTimeout(
    supabase
      .from("production_orders")
      .insert({
        production_order_no: createProductionOrderNo(),
        replenishment_request_id: input.replenishmentRequestId,
        sku_id: input.skuId,
        bom_header_id: bomHeader.id,
        planned_quantity: input.plannedQuantity,
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

  let materialRequirementCount = 0;
  try {
    materialRequirementCount = await generateMaterialRequirements(
      supabase,
      created.id,
      input.replenishmentRequestId,
      input.plannedQuantity,
      bomItems
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
