import type {
  BulkActionResult,
  BulkImportResult,
  BulkImportValidationRow,
  CsvDataRow
} from "@/lib/bulk-types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import { normalizeCsvValue } from "@/lib/utils/csv";

export type MaterialStatus = "active" | "inactive";

export type MaterialSupplier = {
  id: string;
  supplier_code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  status: string;
};

export type MaterialRow = {
  id: string;
  product_id: string | null;
  default_supplier_id: string | null;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  amazon_sku: string | null;
  fnsku: string | null;
  unit: string;
  specs: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type MaterialListRow = MaterialRow & {
  default_supplier: MaterialSupplier | null;
  inventory_quantity: number;
  reserved_quantity: number;
  safety_stock_quantity: number;
  inventory_row_count: number;
  bom_usage_count: number;
  purchase_usage_count: number;
};

export type MaterialInventoryLocation = {
  id: string;
  warehouse_id: string;
  sku_id: string;
  item_type: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  safety_stock_quantity: number;
  unit: string;
  updated_at: string;
  warehouse: {
    id: string;
    warehouse_code: string;
    name: string;
    warehouse_type: string;
    status: string;
  } | null;
};

export type MaterialBomUsage = {
  id: string;
  bom_header_id: string;
  component_sku_id: string;
  quantity_per: number;
  unit: string;
  loss_rate: number;
  notes: string | null;
  bom_header: {
    id: string;
    bom_code: string;
    version: string;
    status: string;
    product_sku: {
      id: string;
      sku_code: string;
      sku_name: string;
      unit: string;
    } | null;
  } | null;
};

export type MaterialPurchaseRecord = {
  id: string;
  purchase_order_id: string;
  sku_id: string;
  ordered_quantity: number;
  received_quantity: number;
  unit: string;
  unit_price: number | null;
  notes: string | null;
  created_at: string;
  purchase_order: {
    id: string;
    purchase_order_no: string;
    status: string;
    ordered_at: string | null;
    expected_arrival_date: string | null;
    supplier: {
      id: string;
      supplier_code: string;
      name: string;
    } | null;
  } | null;
};

export type MaterialInventoryTransaction = {
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
};

export type MaterialDetail = {
  material: MaterialListRow;
  inventoryItems: MaterialInventoryLocation[];
  bomUsages: MaterialBomUsage[];
  purchaseRecords: MaterialPurchaseRecord[];
  inventoryTransactions: MaterialInventoryTransaction[];
};

export type CreateMaterialInput = {
  skuCode: string;
  skuName: string;
  unit: string;
  specs?: string;
  defaultSupplierId?: string;
  status: MaterialStatus;
};

export type UpdateMaterialInput = {
  materialId: string;
  skuName: string;
  unit: string;
  specs?: string;
  defaultSupplierId?: string;
  status: MaterialStatus;
};

export type MaterialImportInput = {
  rowNumber: number;
  skuCode: string;
  skuName: string;
  unit: string;
  specs: string | null;
  defaultSupplierId: string | null;
  supplierCode: string | null;
  supplierName: string | null;
  status: MaterialStatus;
};

type MaybeRelation<T> = T | T[] | null;

type RawMaterialRow = MaterialRow & {
  default_supplier: MaybeRelation<MaterialSupplier>;
};

type RawInventorySummaryRow = {
  sku_id: string;
  quantity_on_hand: number | string;
  reserved_quantity: number | string;
  safety_stock_quantity: number | string | null;
};

type MaterialInventorySummary = {
  sku_id: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  safety_stock_quantity: number;
  inventory_row_count: number;
};

type RawReferenceRow = {
  id: string;
  [key: string]: string;
};

type RawMaterialInventoryLocation = Omit<
  MaterialInventoryLocation,
  "warehouse" | "quantity_on_hand" | "reserved_quantity" | "safety_stock_quantity"
> & {
  quantity_on_hand: number | string;
  reserved_quantity: number | string;
  safety_stock_quantity: number | string | null;
  warehouse: MaybeRelation<MaterialInventoryLocation["warehouse"]>;
};

type RawMaterialBomUsage = Omit<
  MaterialBomUsage,
  "bom_header" | "quantity_per" | "loss_rate"
> & {
  quantity_per: number | string;
  loss_rate: number | string;
  bom_header: MaybeRelation<
    Omit<NonNullable<MaterialBomUsage["bom_header"]>, "product_sku"> & {
      product_sku: MaybeRelation<
        NonNullable<NonNullable<MaterialBomUsage["bom_header"]>["product_sku"]>
      >;
    }
  >;
};

type RawMaterialPurchaseRecord = Omit<
  MaterialPurchaseRecord,
  "purchase_order" | "ordered_quantity" | "received_quantity" | "unit_price"
> & {
  ordered_quantity: number | string;
  received_quantity: number | string;
  unit_price: number | string | null;
  purchase_order: MaybeRelation<
    Omit<NonNullable<MaterialPurchaseRecord["purchase_order"]>, "supplier"> & {
      supplier: MaybeRelation<
        NonNullable<NonNullable<MaterialPurchaseRecord["purchase_order"]>["supplier"]>
      >;
    }
  >;
};

type RawMaterialInventoryTransaction = Omit<
  MaterialInventoryTransaction,
  "warehouse" | "quantity"
> & {
  quantity: number | string;
  warehouse: MaybeRelation<MaterialInventoryTransaction["warehouse"]>;
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

function getMaterialSelect() {
  return `
    id,
    product_id,
    default_supplier_id,
    sku_code,
    sku_name,
    sku_type,
    amazon_sku,
    fnsku,
    unit,
    specs,
    status,
    created_at,
    updated_at,
    default_supplier:suppliers!skus_default_supplier_id_fkey (
      id,
      supplier_code,
      name,
      contact_name,
      phone,
      status
    )
  `;
}

function normalizeOptionalText(value?: string | null) {
  const normalized = normalizeCsvValue(value);

  return normalized ? normalized : null;
}

function normalizeOptionalId(value?: string | null) {
  const normalized = normalizeCsvValue(value);

  return normalized ? normalized : null;
}

function normalizeStatus(value: string | undefined): MaterialStatus {
  const normalized = normalizeCsvValue(value).toLowerCase();

  return normalized === "inactive" ? "inactive" : "active";
}

function validateStatus(value: string | undefined, errors: string[]) {
  const normalized = normalizeCsvValue(value).toLowerCase();

  if (normalized && !["active", "inactive"].includes(normalized)) {
    errors.push("状态只能填写 active 或 inactive。");
  }
}

function assertMaterialStatus(status: string): asserts status is MaterialStatus {
  if (!["active", "inactive"].includes(status)) {
    throw new Error("状态只能是 active 或 inactive。");
  }
}

function getCsvValue(row: CsvDataRow, keys: string[]) {
  for (const key of keys) {
    const value = normalizeCsvValue(row[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function getDuplicateSet(values: string[]) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    if (!value) {
      return;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([value]) => value)
  );
}

async function getExistingSkuCodeSet() {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<{ sku_code: string }>(
    () => supabase.from("skus").select("id, sku_code"),
    "读取 SKU 编码"
  );

  return new Set(
    data.map((row) => row.sku_code.toLowerCase())
  );
}

async function getMaterialSuppliersForLookup() {
  const supabase = getSupabaseClient();
  return fetchAllSupabaseRows<MaterialSupplier>(
    () =>
      supabase
      .from("suppliers")
      .select("id, supplier_code, name, contact_name, phone, status")
      .order("supplier_code", { ascending: true }),
    "读取供应商资料"
  );
}

export async function getMaterialSupplierOptions(): Promise<MaterialSupplier[]> {
  return getMaterialSuppliersForLookup();
}

function findSupplierForImport(input: {
  supplierCode: string;
  supplierName: string;
  suppliers: MaterialSupplier[];
  errors: string[];
}) {
  const supplierCode = input.supplierCode.trim();
  const supplierName = input.supplierName.trim();

  if (!supplierCode && !supplierName) {
    return null;
  }

  if (supplierCode) {
    const matched = input.suppliers.find(
      (supplier) =>
        supplier.supplier_code.toLowerCase() === supplierCode.toLowerCase()
    );

    if (!matched) {
      input.errors.push("默认供应商编码匹配不到已有供应商。");
    }

    return matched ?? null;
  }

  const matchedByName = input.suppliers.filter(
    (supplier) => supplier.name.toLowerCase() === supplierName.toLowerCase()
  );

  if (matchedByName.length === 0) {
    input.errors.push("默认供应商名称匹配不到已有供应商。");
    return null;
  }

  if (matchedByName.length > 1) {
    input.errors.push("默认供应商名称匹配到多个供应商，请改用供应商编码。");
    return null;
  }

  return matchedByName[0];
}

async function ensureMaterialCodeIsUnique(skuCode: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("skus").select("id").eq("sku_code", skuCode).maybeSingle(),
    "检查辅料编码是否重复"
  );

  if (error) {
    throw formatSupabaseError("检查辅料编码是否重复", error);
  }

  if (data) {
    throw new Error("辅料编码已经存在，请换一个编码。");
  }
}

function validateMaterialBasics(input: {
  skuName: string;
  unit: string;
  status: string;
}) {
  if (!input.skuName.trim()) {
    throw new Error("请填写辅料名称。");
  }

  if (!input.unit.trim()) {
    throw new Error("请填写单位。");
  }

  assertMaterialStatus(input.status);
}

function normalizeMaterialRow(
  row: MaterialRow | RawMaterialRow,
  inventorySummary?: MaterialInventorySummary,
  bomUsageCount = 0,
  purchaseUsageCount = 0
): MaterialListRow {
  const rawDefaultSupplier =
    "default_supplier" in row ? singleRelation(row.default_supplier) : null;

  return {
    ...row,
    default_supplier: rawDefaultSupplier,
    inventory_quantity: inventorySummary?.quantity_on_hand ?? 0,
    reserved_quantity: inventorySummary?.reserved_quantity ?? 0,
    safety_stock_quantity: inventorySummary?.safety_stock_quantity ?? 0,
    inventory_row_count: inventorySummary?.inventory_row_count ?? 0,
    bom_usage_count: bomUsageCount,
    purchase_usage_count: purchaseUsageCount
  };
}

function normalizeInventoryLocation(
  row: RawMaterialInventoryLocation
): MaterialInventoryLocation {
  return {
    ...row,
    quantity_on_hand: Number(row.quantity_on_hand),
    reserved_quantity: Number(row.reserved_quantity),
    safety_stock_quantity: Number(row.safety_stock_quantity ?? 0),
    warehouse: singleRelation(row.warehouse)
  };
}

function normalizeBomUsage(row: RawMaterialBomUsage): MaterialBomUsage {
  const bomHeader = singleRelation(row.bom_header);
  const productSku = bomHeader ? singleRelation(bomHeader.product_sku) : null;

  return {
    ...row,
    quantity_per: Number(row.quantity_per),
    loss_rate: Number(row.loss_rate),
    bom_header: bomHeader
      ? {
          ...bomHeader,
          product_sku: productSku
        }
      : null
  };
}

function normalizePurchaseRecord(
  row: RawMaterialPurchaseRecord
): MaterialPurchaseRecord {
  const purchaseOrder = singleRelation(row.purchase_order);

  return {
    ...row,
    ordered_quantity: Number(row.ordered_quantity),
    received_quantity: Number(row.received_quantity),
    unit_price: row.unit_price === null ? null : Number(row.unit_price),
    purchase_order: purchaseOrder
      ? {
          ...purchaseOrder,
          supplier: singleRelation(purchaseOrder.supplier)
        }
      : null
  };
}

function normalizeInventoryTransaction(
  row: RawMaterialInventoryTransaction
): MaterialInventoryTransaction {
  return {
    ...row,
    quantity: Number(row.quantity),
    warehouse: singleRelation(row.warehouse)
  };
}

async function getRowsByIds<TRow>(
  table: string,
  columns: string,
  ids: string[]
) {
  if (ids.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<TRow>(
    () => supabase.from(table).select(columns).in("id", ids),
    `读取 ${table} 数据`
  );

  return data;
}

async function hasReference(
  table: string,
  column: string,
  value: string,
  action: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from(table).select("id").eq(column, value).limit(1),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []).length > 0;
}

function actionSuccess(
  id: string,
  label: string,
  action: "deleted" | "deactivated",
  message: string
): BulkActionResult {
  return {
    id,
    label,
    success: true,
    action,
    message
  };
}

function actionBlocked(
  id: string,
  label: string,
  message: string
): BulkActionResult {
  return {
    id,
    label,
    success: false,
    action: "blocked",
    message
  };
}

function actionFailed(id: string, label: string, message: string): BulkActionResult {
  return {
    id,
    label,
    success: false,
    action: "blocked",
    message
  };
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

async function deleteRow(table: string, id: string, action: string) {
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from(table).delete().eq("id", id),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }
}

async function deactivateRow(table: string, id: string, action: string) {
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from(table).update({ status: "inactive" }).eq("id", id),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }
}

async function getInventorySummaryBySkuIds(ids: string[]) {
  const summaryBySku = new Map<string, MaterialInventorySummary>();

  if (ids.length === 0) {
    return summaryBySku;
  }

  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawInventorySummaryRow>(
    () =>
      supabase
      .from("inventory_items")
      .select(
        "sku_id, quantity_on_hand, reserved_quantity, safety_stock_quantity"
      )
      .in("sku_id", ids),
    "读取辅料库存汇总"
  );

  for (const row of data) {
    const current = summaryBySku.get(row.sku_id) ?? {
      sku_id: row.sku_id,
      quantity_on_hand: 0,
      reserved_quantity: 0,
      safety_stock_quantity: 0,
      inventory_row_count: 0
    };

    current.quantity_on_hand += Number(row.quantity_on_hand);
    current.reserved_quantity += Number(row.reserved_quantity);
    current.safety_stock_quantity += Number(row.safety_stock_quantity ?? 0);
    current.inventory_row_count += 1;
    summaryBySku.set(row.sku_id, current);
  }

  return summaryBySku;
}

async function getReferenceCounts(
  table: string,
  column: string,
  ids: string[],
  action: string
) {
  const counts = new Map<string, number>();

  if (ids.length === 0) {
    return counts;
  }

  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawReferenceRow>(
    () => supabase.from(table).select(`id, ${column}`).in(column, ids),
    action
  );

  for (const row of data) {
    const key = row[column];

    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  return counts;
}

export async function getMaterials(): Promise<MaterialListRow[]> {
  const supabase = getSupabaseClient();
  const materialRows = await fetchAllSupabaseRows<RawMaterialRow>(
    () =>
      supabase
      .from("skus")
      .select(getMaterialSelect())
      .eq("sku_type", "material")
      .order("sku_code", { ascending: true }),
    "读取辅料列表"
  );

  const materialIds = materialRows.map((material) => material.id);
  const [inventoryBySku, bomCounts, purchaseCounts] = await Promise.all([
    getInventorySummaryBySkuIds(materialIds),
    getReferenceCounts("bom_items", "component_sku_id", materialIds, "统计 BOM 引用"),
    getReferenceCounts(
      "purchase_order_items",
      "sku_id",
      materialIds,
      "统计采购引用"
    )
  ]);

  return materialRows.map((row) =>
    normalizeMaterialRow(
      row,
      inventoryBySku.get(row.id),
      bomCounts.get(row.id) ?? 0,
      purchaseCounts.get(row.id) ?? 0
    )
  );
}

export async function createMaterial(
  input: CreateMaterialInput
): Promise<MaterialRow> {
  const skuCode = input.skuCode.trim();
  const skuName = input.skuName.trim();
  const unit = input.unit.trim() || "pcs";
  const defaultSupplierId = normalizeOptionalId(input.defaultSupplierId);

  if (!skuCode) {
    throw new Error("请填写辅料编码。");
  }

  validateMaterialBasics({
    skuName,
    unit,
    status: input.status
  });
  await ensureMaterialCodeIsUnique(skuCode);

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("skus")
      .insert({
        product_id: null,
        sku_code: skuCode,
        sku_name: skuName,
        sku_type: "material",
        default_supplier_id: defaultSupplierId,
        amazon_sku: null,
        fnsku: null,
        unit,
        specs: normalizeOptionalText(input.specs),
        status: input.status
      })
      .select("*")
      .single(),
    "新增辅料"
  );

  if (error) {
    throw formatSupabaseError("新增辅料", error);
  }

  return data as MaterialRow;
}

export async function updateMaterial(input: UpdateMaterialInput): Promise<void> {
  const skuName = input.skuName.trim();
  const unit = input.unit.trim() || "pcs";
  const defaultSupplierId = normalizeOptionalId(input.defaultSupplierId);

  if (!input.materialId) {
    throw new Error("缺少辅料 ID。");
  }

  validateMaterialBasics({
    skuName,
    unit,
    status: input.status
  });

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("skus")
      .update({
        sku_name: skuName,
        unit,
        specs: normalizeOptionalText(input.specs),
        default_supplier_id: defaultSupplierId,
        status: input.status
      })
      .eq("id", input.materialId)
      .eq("sku_type", "material"),
    "编辑辅料"
  );

  if (error) {
    throw formatSupabaseError("编辑辅料", error);
  }
}

export async function toggleMaterialStatus(
  materialId: string,
  currentStatus: string
): Promise<MaterialStatus> {
  if (!materialId) {
    throw new Error("缺少辅料 ID。");
  }

  const nextStatus: MaterialStatus =
    currentStatus === "active" ? "inactive" : "active";
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("skus")
      .update({ status: nextStatus })
      .eq("id", materialId)
      .eq("sku_type", "material"),
    "启用或停用辅料"
  );

  if (error) {
    throw formatSupabaseError("启用或停用辅料", error);
  }

  return nextStatus;
}

export async function getMaterialDetail(
  materialId: string
): Promise<MaterialDetail> {
  const supabase = getSupabaseClient();
  const { data: materialData, error: materialError } = await withTimeout(
    supabase
      .from("skus")
      .select(getMaterialSelect())
      .eq("id", materialId)
      .eq("sku_type", "material")
      .single(),
    "读取辅料详情"
  );

  if (materialError) {
    throw formatSupabaseError("读取辅料详情", materialError);
  }

  const [inventoryBySku, bomCounts, purchaseCounts] = await Promise.all([
    getInventorySummaryBySkuIds([materialId]),
    getReferenceCounts("bom_items", "component_sku_id", [materialId], "统计 BOM 引用"),
    getReferenceCounts(
      "purchase_order_items",
      "sku_id",
      [materialId],
      "统计采购引用"
    )
  ]);
  const material = normalizeMaterialRow(
    materialData as unknown as RawMaterialRow,
    inventoryBySku.get(materialId),
    bomCounts.get(materialId) ?? 0,
    purchaseCounts.get(materialId) ?? 0
  );

  const [inventoryResult, bomResult, purchaseResult, transactionResult] =
    await Promise.all([
      fetchAllSupabaseRows<RawMaterialInventoryLocation>(
        () =>
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
              safety_stock_quantity,
              unit,
              updated_at,
              warehouse:warehouses!inventory_items_warehouse_id_fkey (
                id,
                warehouse_code,
                name,
                warehouse_type,
                status
              )
            `
          )
          .eq("sku_id", materialId)
          .order("updated_at", { ascending: false }),
        "读取辅料库存明细"
      ),
      fetchAllSupabaseRows<RawMaterialBomUsage>(
        () =>
          supabase
          .from("bom_items")
          .select(
            `
              id,
              bom_header_id,
              component_sku_id,
              quantity_per,
              unit,
              loss_rate,
              notes,
              bom_header:bom_headers!bom_items_bom_header_id_fkey (
                id,
                bom_code,
                version,
                status,
                product_sku:skus!bom_headers_product_sku_id_fkey (
                  id,
                  sku_code,
                  sku_name,
                  unit
                )
              )
            `
          )
          .eq("component_sku_id", materialId)
          .order("created_at", { ascending: false }),
        "读取辅料 BOM 引用"
      ),
      withTimeout(
        supabase
          .from("purchase_order_items")
          .select(
            `
              id,
              purchase_order_id,
              sku_id,
              ordered_quantity,
              received_quantity,
              unit,
              unit_price,
              notes,
              created_at,
              purchase_order:purchase_orders!purchase_order_items_purchase_order_id_fkey (
                id,
                purchase_order_no,
                status,
                ordered_at,
                expected_arrival_date,
                supplier:suppliers!purchase_orders_supplier_id_fkey (
                  id,
                  supplier_code,
                  name
                )
              )
            `
          )
          .eq("sku_id", materialId)
          .order("created_at", { ascending: false })
          .limit(8),
        "读取最近采购记录"
      ),
      withTimeout(
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
              notes,
              warehouse:warehouses!inventory_transactions_warehouse_id_fkey (
                id,
                warehouse_code,
                name
              )
            `
          )
          .eq("sku_id", materialId)
          .order("occurred_at", { ascending: false })
          .limit(8),
        "读取最近库存流水"
      )
    ]);

  if (purchaseResult.error) {
    throw formatSupabaseError("读取最近采购记录", purchaseResult.error);
  }

  if (transactionResult.error) {
    throw formatSupabaseError("读取最近库存流水", transactionResult.error);
  }

  return {
    material,
    inventoryItems: inventoryResult.map(normalizeInventoryLocation),
    bomUsages: bomResult.map(normalizeBomUsage),
    purchaseRecords: (
      (purchaseResult.data ?? []) as unknown as RawMaterialPurchaseRecord[]
    ).map(normalizePurchaseRecord),
    inventoryTransactions: (
      (transactionResult.data ?? []) as unknown as RawMaterialInventoryTransaction[]
    ).map(normalizeInventoryTransaction)
  };
}

export async function validateMaterialImportRows(
  rows: CsvDataRow[]
): Promise<BulkImportValidationRow<MaterialImportInput>[]> {
  const [existingCodes, suppliers] = await Promise.all([
    getExistingSkuCodeSet(),
    getMaterialSuppliersForLookup()
  ]);
  const fileCodes = rows.map((row) =>
    getCsvValue(row, ["辅料编码", "sku_code"]).toLowerCase()
  );
  const duplicatedCodes = getDuplicateSet(fileCodes);

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const skuCode = getCsvValue(row, ["辅料编码", "sku_code"]);
    const skuName = getCsvValue(row, ["辅料名称", "sku_name", "name"]);
    const unit = getCsvValue(row, ["单位", "unit"]) || "pcs";
    const specs = normalizeOptionalText(getCsvValue(row, ["规格", "specs", "remark"]));
    const supplierCode = getCsvValue(row, ["默认供应商编码", "supplier_code"]);
    const supplierName = getCsvValue(row, ["默认供应商名称", "supplier_name"]);
    const statusText = getCsvValue(row, ["状态", "status"]);
    const errors: string[] = [];

    if (!skuCode) {
      errors.push("辅料编码必填。");
    }

    if (!skuName) {
      errors.push("辅料名称必填。");
    }

    validateStatus(statusText, errors);
    const supplier = findSupplierForImport({
      supplierCode,
      supplierName,
      suppliers,
      errors
    });

    const skuCodeKey = skuCode.toLowerCase();

    if (skuCodeKey && existingCodes.has(skuCodeKey)) {
      errors.push("辅料编码已经存在。");
    }

    if (skuCodeKey && duplicatedCodes.has(skuCodeKey)) {
      errors.push("同一个 CSV 文件内辅料编码重复。");
    }

    return {
      rowNumber,
      rawRow: row,
      data:
        errors.length === 0
          ? {
              rowNumber,
              skuCode,
              skuName,
              unit,
              specs,
              defaultSupplierId: supplier?.id ?? null,
              supplierCode: supplier?.supplier_code ?? (supplierCode || null),
              supplierName: supplier?.name ?? (supplierName || null),
              status: normalizeStatus(statusText)
            }
          : undefined,
      errors,
      notes:
        errors.length === 0
          ? [
              supplier
                ? `导入时会固定写入 sku_type = material，并关联默认供应商 ${supplier.supplier_code}。`
                : "导入时会固定写入 sku_type = material，默认供应商留空。"
            ]
          : undefined
    };
  });
}

export async function bulkImportMaterials(
  inputs: MaterialImportInput[]
): Promise<BulkImportResult> {
  if (inputs.length === 0) {
    return {
      successCount: 0,
      failedCount: 0,
      errors: []
    };
  }

  const existingCodes = await getExistingSkuCodeSet();
  const conflicts = inputs.filter((input) =>
    existingCodes.has(input.skuCode.toLowerCase())
  );

  if (conflicts.length > 0) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: conflicts.map((input) => ({
        rowNumber: input.rowNumber,
        label: input.skuCode,
        message: "辅料编码已经存在，请重新下载最新数据后再导入。"
      }))
    };
  }

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("skus").insert(
      inputs.map((input) => ({
        product_id: null,
        sku_code: input.skuCode,
        sku_name: input.skuName,
        sku_type: "material",
        default_supplier_id: input.defaultSupplierId,
        amazon_sku: null,
        fnsku: null,
        unit: input.unit,
        specs: input.specs,
        status: input.status
      }))
    ),
    "批量导入辅料"
  );

  if (error) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: [
        {
          message: formatSupabaseError("批量导入辅料", error).message
        }
      ]
    };
  }

  return {
    successCount: inputs.length,
    failedCount: 0,
    errors: []
  };
}

export async function deactivateMaterialsByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const materials = await getRowsByIds<MaterialRow>(
    "skus",
    "id, product_id, default_supplier_id, sku_code, sku_name, sku_type, amazon_sku, fnsku, unit, specs, status, created_at, updated_at",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const material of materials) {
    const label = `${material.sku_code} / ${material.sku_name}`;

    try {
      if (material.sku_type !== "material") {
        results.push(actionBlocked(material.id, label, "只能停用辅料资料。"));
        continue;
      }

      await deactivateRow("skus", material.id, "停用辅料");
      results.push(actionSuccess(material.id, label, "deactivated", "已停用。"));
    } catch (error) {
      results.push(actionFailed(material.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deleteMaterialsByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const materials = await getRowsByIds<MaterialRow>(
    "skus",
    "id, product_id, default_supplier_id, sku_code, sku_name, sku_type, amazon_sku, fnsku, unit, specs, status, created_at, updated_at",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const material of materials) {
    const label = `${material.sku_code} / ${material.sku_name}`;

    try {
      if (material.sku_type !== "material") {
        results.push(actionBlocked(material.id, label, "只能删除辅料资料。"));
        continue;
      }

      const checks = await Promise.all([
        hasReference(
          "bom_headers",
          "product_sku_id",
          material.id,
          "检查辅料 BOM 主表引用"
        ),
        hasReference(
          "bom_items",
          "component_sku_id",
          material.id,
          "检查辅料 BOM 明细引用"
        ),
        hasReference(
          "material_requirements",
          "material_sku_id",
          material.id,
          "检查辅料物料需求引用"
        ),
        hasReference(
          "purchase_order_items",
          "sku_id",
          material.id,
          "检查辅料采购单引用"
        ),
        hasReference(
          "inventory_items",
          "sku_id",
          material.id,
          "检查辅料当前库存引用"
        ),
        hasReference(
          "inventory_transactions",
          "sku_id",
          material.id,
          "检查辅料库存流水引用"
        )
      ]);

      if (checks.some(Boolean)) {
        results.push(
          actionBlocked(
            material.id,
            label,
            "该辅料已有 BOM / 采购 / 库存记录引用，不能删除，可改为停用。"
          )
        );
        continue;
      }

      await deleteRow("skus", material.id, "删除辅料");
      results.push(actionSuccess(material.id, label, "deleted", "已删除。"));
    } catch (error) {
      results.push(actionFailed(material.id, label, getErrorMessage(error)));
    }
  }

  return results;
}
