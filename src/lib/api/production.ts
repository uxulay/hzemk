import { getSupabaseClient } from "@/lib/supabase/client";

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
  | "ready"
  | "pending";

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
  requested_quantity: number;
  overproduction_quantity: number;
  inbound_quantity: number;
  pending_inbound_quantity: number;
  material_status: ProductionMaterialStatus;
};

export type ProductionOrderStatusFilter = ProductionOrderStatus | "all";
export type ProductionMaterialStatusFilter = ProductionMaterialStatus | "all";

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
  const requestedQuantity = Number(replenishmentRequest?.requested_quantity ?? 0);
  const plannedQuantity = Number(row.planned_quantity);
  const inboundQuantity = Number(row.completed_quantity);
  const materialStatus = computeProductionOrderMaterialStatus(materialRequirements);

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
    requested_quantity: requestedQuantity,
    overproduction_quantity: roundQuantity(
      Math.max(0, plannedQuantity - requestedQuantity)
    ),
    inbound_quantity: inboundQuantity,
    pending_inbound_quantity: roundQuantity(
      Math.max(0, plannedQuantity - inboundQuantity)
    ),
    material_status: materialStatus
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

  return ((data ?? []) as unknown as RawProductionOrderTrackingRow[]).map(
    normalizeProductionOrderTrackingRow
  );
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

  return normalizeProductionOrderTrackingRow(
    data as unknown as RawProductionOrderTrackingRow
  );
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
