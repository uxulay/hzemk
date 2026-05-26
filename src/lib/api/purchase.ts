import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";

export type PurchaseOrderStatus =
  | "draft"
  | "ordered"
  | "partially_received"
  | "received"
  | "cancelled";

export type PurchaseSupplierSummary = {
  id: string;
  supplier_code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  status: string;
};

export type ShortageMaterialRequirement = {
  id: string;
  production_order_id: string;
  material_id: string | null;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  unit: string;
  status: "shortage";
  production_order: {
    id: string;
    production_order_no: string;
    sku_id: string;
    finished_sku: {
      id: string;
      sku_code: string;
      sku_name: string;
    } | null;
  } | null;
  material: {
    id: string;
    material_code: string;
    material_name: string;
    unit: string;
    specs: string | null;
    default_supplier_id: string | null;
    default_supplier: PurchaseSupplierSummary | null;
  } | null;
};

export type PurchaseOrderItem = {
  id: string;
  purchase_order_id: string;
  sku_id: string | null;
  material_id: string | null;
  material_requirement_id: string | null;
  ordered_quantity: number;
  received_quantity: number;
  unit: string;
  unit_price: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sku: {
    id: string;
    sku_code: string;
    sku_name: string;
    unit: string;
    specs: string | null;
  } | null;
  material: {
    id: string;
    material_code: string;
    material_name: string;
    unit: string;
    specs: string | null;
  } | null;
  material_requirement: {
    id: string;
    shortage_quantity: number;
    status: string;
    production_order: {
      id: string;
      production_order_no: string;
    } | null;
  } | null;
};

export type PurchaseMaterialOption = {
  id: string;
  material_code: string;
  material_name: string;
  unit: string;
  specs: string | null;
  default_supplier_id: string | null;
  default_supplier: PurchaseSupplierSummary | null;
};

export type PurchaseProfileOption = {
  id: string;
  full_name: string;
  email: string;
};

export type PurchaseOrderSource = "shortage" | "manual" | "bulk_import";

export type PurchaseOrder = {
  id: string;
  purchase_order_no: string;
  supplier_id: string | null;
  warehouse_id: string | null;
  created_by: string | null;
  status: PurchaseOrderStatus;
  ordered_at: string | null;
  expected_arrival_date: string | null;
  received_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  supplier: {
    id: string;
    supplier_code: string;
    name: string;
    contact_name: string | null;
    phone: string | null;
    email: string | null;
    address: string | null;
  } | null;
  created_by_profile: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  items: PurchaseOrderItem[];
  total_amount: number;
  item_count: number;
  source: PurchaseOrderSource;
};

export type CreatePurchaseOrderInput = {
  supplierId: string;
  createdBy?: string | null;
  orderDate?: string;
  expectedArrivalDate?: string;
  notes?: string;
  items: Array<{
    materialId?: string | null;
    skuId?: string | null;
    materialRequirementId: string;
    orderedQuantity: number;
    unit: string;
    unitPrice?: number | null;
    notes?: string;
  }>;
};

export type ManualPurchaseOrderItemInput = {
  materialId: string;
  skuId?: string | null;
  orderedQuantity: number;
  unit: string;
  unitPrice?: number | null;
  notes?: string;
};

export type CreateManualPurchaseOrderInput = {
  purchaseOrderNo?: string;
  supplierId: string;
  createdBy?: string | null;
  orderDate?: string;
  expectedArrivalDate?: string;
  notes?: string;
  source?: "manual" | "bulk_import";
  items: ManualPurchaseOrderItemInput[];
};

export type UpdatePurchaseOrderInput = {
  purchaseOrderId: string;
  supplierId: string;
  createdBy?: string | null;
  orderDate?: string;
  expectedArrivalDate?: string;
  notes?: string;
  items: Array<{
    id: string;
    orderedQuantity: number;
    unitPrice?: number | null;
    notes?: string;
  }>;
};

type MaybeRelation<T> = T | T[] | null;

type RawShortageMaterialRequirement = Omit<
  ShortageMaterialRequirement,
  "production_order" | "material"
> & {
  production_order: MaybeRelation<
    Omit<NonNullable<ShortageMaterialRequirement["production_order"]>, "finished_sku"> & {
      finished_sku: MaybeRelation<
        NonNullable<
          NonNullable<ShortageMaterialRequirement["production_order"]>["finished_sku"]
        >
      >;
    }
  >;
  material: MaybeRelation<
    Omit<NonNullable<ShortageMaterialRequirement["material"]>, "default_supplier"> & {
      default_supplier: MaybeRelation<PurchaseSupplierSummary>;
    }
  >;
};

type RawPurchaseMaterialOption = Omit<
  PurchaseMaterialOption,
  "default_supplier"
> & {
  default_supplier: MaybeRelation<PurchaseSupplierSummary>;
};

type RawPurchaseOrderItem = Omit<
  PurchaseOrderItem,
  "sku" | "material" | "material_requirement"
> & {
  sku: MaybeRelation<NonNullable<PurchaseOrderItem["sku"]>>;
  material: MaybeRelation<NonNullable<PurchaseOrderItem["material"]>>;
  material_requirement: MaybeRelation<
    Omit<
      NonNullable<PurchaseOrderItem["material_requirement"]>,
      "production_order"
    > & {
      production_order: MaybeRelation<
        NonNullable<
          NonNullable<PurchaseOrderItem["material_requirement"]>["production_order"]
        >
      >;
    }
  >;
};

type RawPurchaseOrder = Omit<
  PurchaseOrder,
  "supplier" | "created_by_profile" | "items" | "total_amount" | "item_count" | "source"
> & {
  supplier: MaybeRelation<NonNullable<PurchaseOrder["supplier"]>>;
  created_by_profile: MaybeRelation<
    NonNullable<PurchaseOrder["created_by_profile"]>
  >;
  items: RawPurchaseOrderItem[] | null;
};

type InsertedPurchaseOrder = {
  id: string;
  purchase_order_no: string;
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

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function createPurchaseOrderNo() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("");
  const randomPart = String(Math.floor(Math.random() * 10000)).padStart(4, "0");

  return `PUR-${datePart}-${randomPart}`;
}

function getSourceFromOrder(notes: string | null, items: PurchaseOrderItem[]) {
  if (items.some((item) => Boolean(item.material_requirement_id))) {
    return "shortage" satisfies PurchaseOrderSource;
  }

  if ((notes ?? "").includes("[批量导入]")) {
    return "bulk_import" satisfies PurchaseOrderSource;
  }

  return "manual" satisfies PurchaseOrderSource;
}

function getOrderDateTime(value: string | undefined) {
  if (!value) {
    return null;
  }

  return `${value}T00:00:00`;
}

function normalizeShortageRequirement(
  row: RawShortageMaterialRequirement
): ShortageMaterialRequirement {
  const productionOrder = singleRelation(row.production_order);
  const material = singleRelation(row.material);

  return {
    ...row,
    production_order: productionOrder
      ? {
          ...productionOrder,
          finished_sku: singleRelation(productionOrder.finished_sku)
        }
      : null,
    material: material
      ? {
          ...material,
          default_supplier: singleRelation(material.default_supplier)
        }
      : null
  };
}

function normalizePurchaseMaterialOption(row: RawPurchaseMaterialOption): PurchaseMaterialOption {
  return {
    ...row,
    default_supplier: singleRelation(row.default_supplier)
  };
}

function normalizePurchaseOrderItem(row: RawPurchaseOrderItem): PurchaseOrderItem {
  const materialRequirement = singleRelation(row.material_requirement);

  return {
    ...row,
    sku: singleRelation(row.sku),
    material: singleRelation(row.material),
    material_requirement: materialRequirement
      ? {
          ...materialRequirement,
          production_order: singleRelation(materialRequirement.production_order)
        }
      : null
  };
}

function normalizePurchaseOrder(row: RawPurchaseOrder): PurchaseOrder {
  const items = (row.items ?? []).map(normalizePurchaseOrderItem);
  const totalAmount = items.reduce((sum, item) => {
    return sum + Number(item.ordered_quantity) * Number(item.unit_price ?? 0);
  }, 0);

  return {
    ...row,
    supplier: singleRelation(row.supplier),
    created_by_profile: singleRelation(row.created_by_profile),
    items,
    total_amount: roundMoney(totalAmount),
    item_count: items.length,
    source: getSourceFromOrder(row.notes, items)
  };
}

function getPurchaseOrderSelect() {
  return `
    id,
    purchase_order_no,
    supplier_id,
    warehouse_id,
    created_by,
    status,
    ordered_at,
    expected_arrival_date,
    received_at,
    notes,
    created_at,
    updated_at,
    supplier:suppliers!purchase_orders_supplier_id_fkey (
      id,
      supplier_code,
      name,
      contact_name,
      phone,
      email,
      address
    ),
    created_by_profile:profiles!purchase_orders_created_by_fkey (
      id,
      full_name,
      email
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
      notes,
      created_at,
      updated_at,
      sku:skus!purchase_order_items_sku_id_fkey (
        id,
        sku_code,
        sku_name,
        unit,
        specs
      ),
      material:materials!purchase_order_items_material_id_fkey (
        id,
        material_code,
        material_name,
        unit,
        specs
      ),
      material_requirement:material_requirements!purchase_order_items_material_requirement_id_fkey (
        id,
        shortage_quantity,
        status,
        production_order:production_orders!material_requirements_production_order_id_fkey (
          id,
          production_order_no
        )
      )
    )
  `;
}

export async function getShortageMaterialRequirements(): Promise<
  ShortageMaterialRequirement[]
> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("material_requirements")
      .select(
        `
          id,
          production_order_id,
          material_id,
          required_quantity,
          available_quantity,
          shortage_quantity,
          unit,
          status,
          production_order:production_orders!material_requirements_production_order_id_fkey (
            id,
            production_order_no,
            sku_id,
            finished_sku:skus!production_orders_sku_id_fkey (
              id,
              sku_code,
              sku_name
            )
          ),
          material:materials!material_requirements_material_id_fkey (
            id,
            material_code,
            material_name,
            unit,
            specs,
            default_supplier_id,
            default_supplier:suppliers!materials_default_supplier_id_fkey (
              id,
              supplier_code,
              name,
              contact_name,
              phone,
              status
            )
          )
        `
      )
      .eq("status", "shortage")
      .gt("shortage_quantity", 0)
      .order("created_at", { ascending: false }),
    "读取缺料物料列表"
  );

  if (error) {
    throw formatSupabaseError("读取缺料物料列表", error);
  }

  return ((data ?? []) as unknown as RawShortageMaterialRequirement[]).map(
    normalizeShortageRequirement
  );
}

export async function getPurchaseOrders(): Promise<PurchaseOrder[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawPurchaseOrder>(
    () =>
      supabase
      .from("purchase_orders")
      .select(getPurchaseOrderSelect())
      .order("created_at", { ascending: false }),
    "读取采购单列表"
  );

  return data.map(normalizePurchaseOrder);
}

export async function getPurchaseOrderDetail(
  purchaseOrderId: string
): Promise<PurchaseOrder> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("purchase_orders")
      .select(getPurchaseOrderSelect())
      .eq("id", purchaseOrderId)
      .single(),
    "读取采购单详情"
  );

  if (error) {
    throw formatSupabaseError("读取采购单详情", error);
  }

  return normalizePurchaseOrder(data as unknown as RawPurchaseOrder);
}

export async function getPurchaseMaterialOptions(): Promise<
  PurchaseMaterialOption[]
> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawPurchaseMaterialOption>(
    () =>
      supabase
      .from("materials")
      .select(
        `
          id,
          material_code,
          material_name,
          unit,
          specs,
          default_supplier_id,
          default_supplier:suppliers!materials_default_supplier_id_fkey (
            id,
            supplier_code,
            name,
            contact_name,
            phone,
            status
          )
        `
      )
      .eq("status", "active")
      .order("material_code", { ascending: true }),
    "读取辅料列表"
  );

  return data.map((material) => normalizePurchaseMaterialOption(material));
}

export async function getPurchaseProfileOptions(): Promise<PurchaseProfileOption[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("profiles")
      .select("id, full_name, email")
      .eq("status", "active")
      .order("full_name", { ascending: true }),
    "读取采购负责人列表"
  );

  if (error) {
    throw formatSupabaseError("读取采购负责人列表", error);
  }

  return (data ?? []) as PurchaseProfileOption[];
}

export async function getExistingPurchaseOrderNos(
  purchaseOrderNos: string[]
): Promise<string[]> {
  const uniqueNos = Array.from(
    new Set(purchaseOrderNos.map((value) => value.trim()).filter(Boolean))
  );

  if (uniqueNos.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("purchase_orders")
      .select("purchase_order_no")
      .in("purchase_order_no", uniqueNos),
    "检查采购单号是否已存在"
  );

  if (error) {
    throw formatSupabaseError("检查采购单号是否已存在", error);
  }

  return (data ?? []).map((row) => row.purchase_order_no as string);
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput
): Promise<InsertedPurchaseOrder> {
  if (!input.supplierId) {
    throw new Error("请选择供应商。");
  }

  if (input.items.length === 0) {
    throw new Error("请至少选择一条缺料物料。");
  }

  for (const item of input.items) {
    if ((!item.materialId && !item.skuId) || !item.materialRequirementId) {
      throw new Error("采购明细缺少辅料或物料需求 ID。");
    }

    if (Number(item.orderedQuantity) <= 0) {
      throw new Error("采购数量必须大于 0。");
    }

    if (item.unitPrice !== null && item.unitPrice !== undefined && item.unitPrice < 0) {
      throw new Error("单价不能小于 0。");
    }
  }

  const supabase = getSupabaseClient();
  const purchaseOrderNo = createPurchaseOrderNo();

  const { data: order, error: orderError } = await withTimeout(
    supabase
      .from("purchase_orders")
      .insert({
        purchase_order_no: purchaseOrderNo,
        supplier_id: input.supplierId,
        created_by: input.createdBy || null,
        status: "draft",
        ordered_at: getOrderDateTime(input.orderDate),
        expected_arrival_date: input.expectedArrivalDate || null,
        notes: input.notes || null
      })
      .select("id, purchase_order_no")
      .single(),
    "创建采购单"
  );

  if (orderError) {
    throw formatSupabaseError("创建采购单", orderError);
  }

  const insertedOrder = order as InsertedPurchaseOrder;
  const itemRows = input.items.map((item) => ({
    purchase_order_id: insertedOrder.id,
    sku_id: item.materialId ? null : item.skuId || null,
    material_id: item.materialId || null,
    material_requirement_id: item.materialRequirementId,
    ordered_quantity: item.orderedQuantity,
    received_quantity: 0,
    unit: item.unit,
    unit_price: item.unitPrice ?? null,
    notes: item.notes || null
  }));

  const { error: itemsError } = await withTimeout(
    supabase.from("purchase_order_items").insert(itemRows),
    "写入采购单明细"
  );

  if (itemsError) {
    throw formatSupabaseError("写入采购单明细", itemsError);
  }

  const materialRequirementIds = input.items.map(
    (item) => item.materialRequirementId
  );
  const { error: requirementsError } = await withTimeout(
    supabase
      .from("material_requirements")
      .update({ status: "purchased" })
      .in("id", materialRequirementIds),
    "更新物料需求状态"
  );

  if (requirementsError) {
    throw formatSupabaseError("更新物料需求状态", requirementsError);
  }

  return insertedOrder;
}

function validateManualPurchaseItems(items: ManualPurchaseOrderItemInput[]) {
  if (items.length === 0) {
    throw new Error("请至少添加一条采购明细。");
  }

  for (const item of items) {
    if (!item.materialId) {
      throw new Error("采购明细缺少辅料。");
    }

    if (Number(item.orderedQuantity) <= 0) {
      throw new Error("采购数量必须大于 0。");
    }

    if (item.unitPrice !== null && item.unitPrice !== undefined && item.unitPrice < 0) {
      throw new Error("单价不能小于 0。");
    }
  }
}

export async function createManualPurchaseOrder(
  input: CreateManualPurchaseOrderInput
): Promise<InsertedPurchaseOrder> {
  if (!input.supplierId) {
    throw new Error("请选择供应商。");
  }

  validateManualPurchaseItems(input.items);

  const supabase = getSupabaseClient();
  const purchaseOrderNo = input.purchaseOrderNo?.trim() || createPurchaseOrderNo();
  const sourcePrefix = input.source === "bulk_import" ? "[批量导入]" : "[手动创建]";
  const notes = [sourcePrefix, input.notes?.trim()].filter(Boolean).join(" ");

  const { data: order, error: orderError } = await withTimeout(
    supabase
      .from("purchase_orders")
      .insert({
        purchase_order_no: purchaseOrderNo,
        supplier_id: input.supplierId,
        created_by: input.createdBy || null,
        status: "draft",
        ordered_at: getOrderDateTime(input.orderDate),
        expected_arrival_date: input.expectedArrivalDate || null,
        notes: notes || null
      })
      .select("id, purchase_order_no")
      .single(),
    "创建采购单"
  );

  if (orderError) {
    throw formatSupabaseError("创建采购单", orderError);
  }

  const insertedOrder = order as InsertedPurchaseOrder;
  const itemRows = input.items.map((item) => ({
    purchase_order_id: insertedOrder.id,
    sku_id: null,
    material_id: item.materialId,
    material_requirement_id: null,
    ordered_quantity: item.orderedQuantity,
    received_quantity: 0,
    unit: item.unit,
    unit_price: item.unitPrice ?? 0,
    notes: item.notes || null
  }));

  const { error: itemsError } = await withTimeout(
    supabase.from("purchase_order_items").insert(itemRows),
    "写入采购单明细"
  );

  if (itemsError) {
    throw formatSupabaseError("写入采购单明细", itemsError);
  }

  return insertedOrder;
}

export async function updatePurchaseOrder(
  input: UpdatePurchaseOrderInput
): Promise<void> {
  if (!input.purchaseOrderId) {
    throw new Error("缺少采购单 ID。");
  }

  if (!input.supplierId) {
    throw new Error("请选择供应商。");
  }

  if (input.items.length === 0) {
    throw new Error("请至少保留一条采购明细。");
  }

  for (const item of input.items) {
    if (!item.id) {
      throw new Error("采购明细缺少 ID。");
    }

    if (Number(item.orderedQuantity) <= 0) {
      throw new Error("采购数量必须大于 0。");
    }

    if (item.unitPrice !== null && item.unitPrice !== undefined && item.unitPrice < 0) {
      throw new Error("单价不能小于 0。");
    }
  }

  const supabase = getSupabaseClient();
  const { error: orderError } = await withTimeout(
    supabase
      .from("purchase_orders")
      .update({
        supplier_id: input.supplierId,
        created_by: input.createdBy || null,
        ordered_at: getOrderDateTime(input.orderDate),
        expected_arrival_date: input.expectedArrivalDate || null,
        notes: input.notes || null
      })
      .eq("id", input.purchaseOrderId)
      .eq("status", "draft"),
    "更新采购单"
  );

  if (orderError) {
    throw formatSupabaseError("更新采购单", orderError);
  }

  const itemUpdates = input.items.map((item) =>
    supabase
      .from("purchase_order_items")
      .update({
        ordered_quantity: item.orderedQuantity,
        unit_price: item.unitPrice ?? 0,
        notes: item.notes || null
      })
      .eq("id", item.id)
      .eq("purchase_order_id", input.purchaseOrderId)
  );

  const results = await Promise.all(
    itemUpdates.map((request) => withTimeout(request, "更新采购明细"))
  );
  const itemError = results.find((result) => result.error)?.error;

  if (itemError) {
    throw formatSupabaseError("更新采购明细", itemError);
  }
}

export async function updatePurchaseOrderStatus(
  purchaseOrderId: string,
  status: PurchaseOrderStatus
) {
  const supabase = getSupabaseClient();
  const updates: Partial<{
    status: PurchaseOrderStatus;
    ordered_at: string;
    received_at: string;
  }> = { status };

  if (status === "ordered") {
    updates.ordered_at = new Date().toISOString();
  }

  if (status === "received") {
    updates.received_at = new Date().toISOString();
  }

  const { error } = await withTimeout(
    supabase.from("purchase_orders").update(updates).eq("id", purchaseOrderId),
    "更新采购单状态"
  );

  if (error) {
    throw formatSupabaseError("更新采购单状态", error);
  }

  if (status === "received") {
    const detail = await getPurchaseOrderDetail(purchaseOrderId);
    const receivedRows = detail.items.map((item) =>
      supabase
        .from("purchase_order_items")
        .update({ received_quantity: item.ordered_quantity })
        .eq("id", item.id)
    );

    const results = await Promise.all(
      receivedRows.map((request) => withTimeout(request, "更新采购明细到货数量"))
    );
    const itemError = results.find((result) => result.error)?.error;

    if (itemError) {
      throw formatSupabaseError("更新采购明细到货数量", itemError);
    }
  }
}
