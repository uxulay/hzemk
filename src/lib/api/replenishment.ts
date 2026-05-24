import type {
  BulkImportResult,
  BulkImportValidationRow,
  CsvDataRow
} from "@/lib/bulk-types";
import { getSupabaseClient } from "@/lib/supabase/client";
import { normalizeCsvValue } from "@/lib/utils/csv";
import type { BrandSummary } from "@/lib/brand-utils";

export type FbaRequestStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "rejected"
  | "in_production"
  | "completed"
  | "shipped";

export type FbaRequestPriority = "low" | "normal" | "high" | "urgent";

export type CreateFbaReplenishmentInput = {
  skuId: string;
  targetWarehouseId?: string | null;
  fbaWarehouseCode?: string;
  requestedQuantity: number;
  targetShipDate?: string | null;
  priority: string;
  amazonSite: string;
  notes?: string;
};

export type CreateFbaReplenishmentDocumentInput = {
  amazonSite: string;
  targetWarehouseId: string;
  fbaWarehouseCode?: string;
  targetShipDate?: string | null;
  priority: string;
  notes?: string;
  items: Array<{
    productId: string | null;
    skuId: string;
    requestedQuantity: number;
    remark?: string | null;
  }>;
};

export type CreatedFbaReplenishment = {
  id: string;
  request_no: string;
};

export type FbaReplenishmentRequestItem = {
  id: string;
  request_id: string;
  product_id: string | null;
  sku_id: string;
  requested_quantity: number;
  remark: string | null;
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
  product: {
    id: string;
    brand_id: string | null;
    product_code: string;
    name: string;
    product_image_url: string | null;
    brand: BrandSummary | null;
  } | null;
};

export type FbaReplenishmentRequest = {
  id: string;
  request_no: string;
  requested_by: string | null;
  sku_id: string;
  target_warehouse_id: string | null;
  fba_warehouse_code: string | null;
  requested_quantity: number;
  target_ship_date: string | null;
  priority: FbaRequestPriority;
  status: FbaRequestStatus;
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
  requested_by_profile: {
    id: string;
    full_name: string;
    email: string;
  } | null;
  items: FbaReplenishmentRequestItem[];
  product_count: number;
  sku_count: number;
  total_requested_quantity: number;
};

export type GetFbaReplenishmentRequestsOptions = {
  status?: FbaRequestStatus | "all";
};

export type FbaReplenishmentImportInput = {
  rowNumber: number;
  skuCode: string;
  skuId: string;
  targetWarehouseCode: string | null;
  targetWarehouseId: string | null;
  fbaWarehouseCode: string | null;
  requestedQuantity: number;
  expectedDate: string | null;
  priority: FbaRequestPriority;
  amazonSite: string;
  remark: string | null;
};

export type FbaReplenishmentSkuOption = {
  id: string;
  product_id: string | null;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  amazon_sku: string | null;
  fnsku: string | null;
  unit: string;
  specs: string | null;
  status: string;
  product: {
    id: string;
    brand_id: string | null;
    product_code: string;
    name: string;
    product_image_url: string | null;
    brand: BrandSummary | null;
  } | null;
  current_stock: number;
  has_active_bom: boolean;
};

type MaybeRelation<T> = T | T[] | null;

type RawFbaReplenishmentRequest = Omit<
  FbaReplenishmentRequest,
  | "sku"
  | "target_warehouse"
  | "requested_by_profile"
  | "items"
  | "product_count"
  | "sku_count"
  | "total_requested_quantity"
> & {
  sku: MaybeRelation<
    Omit<NonNullable<FbaReplenishmentRequest["sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<NonNullable<FbaReplenishmentRequest["sku"]>["product"]>
      >;
    }
  >;
  target_warehouse: MaybeRelation<
    NonNullable<FbaReplenishmentRequest["target_warehouse"]>
  >;
  requested_by_profile: MaybeRelation<
    NonNullable<FbaReplenishmentRequest["requested_by_profile"]>
  >;
  items: RawFbaReplenishmentRequestItem[] | null;
};

type RawFbaReplenishmentRequestItem = Omit<
  FbaReplenishmentRequestItem,
  "sku" | "product"
> & {
  sku: MaybeRelation<
    Omit<NonNullable<FbaReplenishmentRequestItem["sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<NonNullable<FbaReplenishmentRequestItem["sku"]>["product"]>
      >;
    }
  >;
  product: MaybeRelation<NonNullable<FbaReplenishmentRequestItem["product"]>>;
};

type ImportSkuRow = {
  id: string;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  status?: string;
};

type ImportWarehouseRow = {
  id: string;
  warehouse_code: string;
  name: string;
  status?: string;
};

type RawFbaReplenishmentSkuOption = Omit<
  FbaReplenishmentSkuOption,
  "product" | "current_stock" | "has_active_bom"
> & {
  product: MaybeRelation<NonNullable<FbaReplenishmentSkuOption["product"]>>;
};

type InventoryStockRow = {
  sku_id: string;
  item_type: string | null;
  quantity_on_hand: number | string | null;
};

type ActiveBomRow = {
  product_sku_id: string;
};

const importPriorities: FbaRequestPriority[] = [
  "low",
  "normal",
  "high",
  "urgent"
];

const finishedSkuTypes = ["finished_good", "finished_product"];

const importAmazonSites = new Set([
  "US",
  "CA",
  "MX",
  "UK",
  "DE",
  "FR",
  "IT",
  "ES",
  "JP"
]);

const importRowKeys = [
  "sku_code",
  "target_warehouse_code",
  "fba_warehouse_code",
  "requested_quantity",
  "expected_date",
  "priority",
  "remark",
  "amazon_site"
];

function formatSupabaseError(action: string, error: { message: string }) {
  return new Error(`${action}失败：${error.message}`);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
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

function createRequestNo() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("");
  const timePart = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `FBA-RQ-${datePart}-${timePart}-${randomPart}`;
}

function buildNotes(amazonSite: string, notes?: string) {
  const cleanSite = amazonSite.trim() || "US";
  const cleanNotes = notes?.trim();

  if (!cleanNotes) {
    return `亚马逊站点：${cleanSite}`;
  }

  return `亚马逊站点：${cleanSite}\n备注：${cleanNotes}`;
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeCsvValue(value);

  return normalized ? normalized : null;
}

function getDuplicateImportRows(rows: CsvDataRow[]) {
  const counts = new Map<string, number>();

  rows.forEach((row) => {
    const key = importRowKeys
      .map((field) => normalizeCsvValue(row[field]).toLowerCase())
      .join("||");

    if (!key.replace(/\|/g, "")) {
      return;
    }

    counts.set(key, (counts.get(key) ?? 0) + 1);
  });

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([key]) => key)
  );
}

function isValidDateText(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function normalizeImportPriority(
  value: string | undefined,
  errors: string[],
  notes: string[]
) {
  const priority = normalizeCsvValue(value).toLowerCase();

  if (!priority) {
    notes.push("优先级为空，默认按 normal 普通处理。");
    return "normal" as FbaRequestPriority;
  }

  if (!importPriorities.includes(priority as FbaRequestPriority)) {
    errors.push("优先级只能填写 low、normal、high 或 urgent。");
    return null;
  }

  return priority as FbaRequestPriority;
}

function normalizeImportAmazonSite(
  value: string | undefined,
  errors: string[],
  notes: string[]
) {
  const amazonSite = normalizeCsvValue(value).toUpperCase();

  if (!amazonSite) {
    notes.push("亚马逊站点为空，默认按 US 处理。");
    return "US";
  }

  if (!importAmazonSites.has(amazonSite)) {
    errors.push("亚马逊站点只能填写 US、CA、MX、UK、DE、FR、IT、ES 或 JP。");
    return null;
  }

  return amazonSite;
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

function isFinishedSkuType(value: string | null | undefined) {
  return Boolean(value && finishedSkuTypes.includes(value));
}

function normalizeFbaSkuOption(
  sku: RawFbaReplenishmentSkuOption,
  stockBySkuId: Map<string, number>,
  activeBomSkuIds: Set<string>
): FbaReplenishmentSkuOption {
  return {
    ...sku,
    product: normalizeProductBrand(singleRelation(sku.product)),
    current_stock: stockBySkuId.get(sku.id) ?? 0,
    has_active_bom: activeBomSkuIds.has(sku.id)
  };
}

function normalizeFbaReplenishmentRequest(
  request: RawFbaReplenishmentRequest
): FbaReplenishmentRequest {
  const sku = singleRelation(request.sku);
  const product = normalizeProductBrand(singleRelation(sku?.product ?? null));
  const items = (request.items ?? []).map(normalizeFbaRequestItem);
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
            created_at: request.created_at,
            updated_at: request.updated_at,
            sku: {
              ...sku,
              product
            },
            product
          }
        ];
  const productIds = new Set(
    compatibleItems.map((item) => item.product_id).filter(Boolean)
  );
  const totalRequestedQuantity = compatibleItems.reduce(
    (sum, item) => sum + Number(item.requested_quantity),
    0
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
    items: compatibleItems,
    product_count: productIds.size,
    sku_count: compatibleItems.length,
    total_requested_quantity: totalRequestedQuantity
  };
}

function normalizeFbaRequestItem(
  item: RawFbaReplenishmentRequestItem
): FbaReplenishmentRequestItem {
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

export async function createFbaReplenishmentRequest(
  input: CreateFbaReplenishmentInput
): Promise<CreatedFbaReplenishment> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .insert({
        request_no: createRequestNo(),
        requested_by: null,
        sku_id: input.skuId,
        target_warehouse_id: input.targetWarehouseId || null,
        fba_warehouse_code: input.fbaWarehouseCode?.trim() || null,
        requested_quantity: input.requestedQuantity,
        target_ship_date: input.targetShipDate || null,
        priority: input.priority || "normal",
        status: "submitted",
        accepted_by: null,
        accepted_at: null,
        rejected_reason: null,
        notes: buildNotes(input.amazonSite, input.notes)
      })
      .select("id, request_no")
      .single(),
    "创建 FBA 备货需求"
  );

  if (error) {
    throw formatSupabaseError("创建 FBA 备货需求", error);
  }

  return data as CreatedFbaReplenishment;
}

export async function createFbaReplenishmentDocument(
  input: CreateFbaReplenishmentDocumentInput
): Promise<CreatedFbaReplenishment> {
  const normalizedItems = input.items
    .map((item) => ({
      ...item,
      requestedQuantity: Number(item.requestedQuantity),
      remark: item.remark?.trim() || null
    }))
    .filter((item) => item.requestedQuantity > 0);
  const duplicateSkuIds = normalizedItems
    .map((item) => item.skuId)
    .filter((skuId, index, skuIds) => skuIds.indexOf(skuId) !== index);

  if (!input.amazonSite.trim()) {
    throw new Error("亚马逊站点必填。");
  }

  if (!input.targetWarehouseId) {
    throw new Error("目标 FBA 仓库必填。");
  }

  if (normalizedItems.length === 0) {
    throw new Error("至少要填写一个 SKU 的备货数量。");
  }

  if (duplicateSkuIds.length > 0) {
    throw new Error("同一张备货单里不能重复提交相同 SKU。");
  }

  const invalidQuantityItem = normalizedItems.find(
    (item) =>
      !Number.isFinite(item.requestedQuantity) || item.requestedQuantity <= 0
  );

  if (invalidQuantityItem) {
    throw new Error("SKU 备货数量必须是大于 0 的数字。");
  }

  const firstItem = normalizedItems[0];
  const totalRequestedQuantity = normalizedItems.reduce(
    (sum, item) => sum + item.requestedQuantity,
    0
  );
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .insert({
        request_no: createRequestNo(),
        requested_by: null,
        sku_id: firstItem.skuId,
        target_warehouse_id: input.targetWarehouseId,
        fba_warehouse_code: input.fbaWarehouseCode?.trim() || null,
        requested_quantity: totalRequestedQuantity,
        target_ship_date: input.targetShipDate || null,
        priority: input.priority || "normal",
        status: "submitted",
        accepted_by: null,
        accepted_at: null,
        rejected_reason: null,
        notes: buildNotes(input.amazonSite, input.notes)
      })
      .select("id, request_no")
      .single(),
    "创建 FBA 备货单主表"
  );

  if (error) {
    throw formatSupabaseError("创建 FBA 备货单主表", error);
  }

  const created = data as CreatedFbaReplenishment;
  const itemRows = normalizedItems.map((item) => ({
    request_id: created.id,
    product_id: item.productId,
    sku_id: item.skuId,
    requested_quantity: item.requestedQuantity,
    remark: item.remark
  }));
  const { error: itemError } = await withTimeout(
    supabase.from("fba_replenishment_request_items").insert(itemRows),
    "创建 FBA 备货单明细"
  );

  if (itemError) {
    await supabase
      .from("fba_replenishment_requests")
      .update({
        status: "draft",
        notes: `${buildNotes(input.amazonSite, input.notes)}\n系统提示：明细创建失败，这张主表不要继续流转。`
      })
      .eq("id", created.id);
    throw new Error(
      `备货单主表已创建，但明细创建失败，系统已把主表退回草稿，避免误流转：${itemError.message}`
    );
  }

  return created;
}

export async function getFbaReplenishmentSkuOptions(): Promise<
  FbaReplenishmentSkuOption[]
> {
  const supabase = getSupabaseClient();
  const [skuResult, stockResult, bomResult] = await Promise.all([
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
            amazon_sku,
            fnsku,
            unit,
            specs,
            status,
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
          `
        )
        .in("sku_type", finishedSkuTypes)
        .order("sku_code", { ascending: true }),
      "读取可备货 SKU"
    ),
    withTimeout(
      supabase
        .from("inventory_items")
        .select("sku_id, item_type, quantity_on_hand"),
      "读取成品库存"
    ),
    withTimeout(
      supabase
        .from("bom_headers")
        .select("product_sku_id")
        .eq("status", "active"),
      "读取启用 BOM"
    )
  ]);

  if (skuResult.error) {
    throw formatSupabaseError("读取可备货 SKU", skuResult.error);
  }

  if (stockResult.error) {
    throw formatSupabaseError("读取成品库存", stockResult.error);
  }

  if (bomResult.error) {
    throw formatSupabaseError("读取启用 BOM", bomResult.error);
  }

  const stockBySkuId = new Map<string, number>();

  ((stockResult.data ?? []) as InventoryStockRow[])
    .filter((row) => isFinishedSkuType(row.item_type))
    .forEach((row) => {
      stockBySkuId.set(
        row.sku_id,
        (stockBySkuId.get(row.sku_id) ?? 0) + Number(row.quantity_on_hand ?? 0)
      );
    });

  const activeBomSkuIds = new Set(
    ((bomResult.data ?? []) as ActiveBomRow[]).map((row) => row.product_sku_id)
  );

  return ((skuResult.data ?? []) as unknown as RawFbaReplenishmentSkuOption[])
    .filter((sku) => isFinishedSkuType(sku.sku_type))
    .map((sku) => normalizeFbaSkuOption(sku, stockBySkuId, activeBomSkuIds));
}

export async function validateFbaReplenishmentImportRows(
  rows: CsvDataRow[]
): Promise<BulkImportValidationRow<FbaReplenishmentImportInput>[]> {
  const supabase = getSupabaseClient();
  const [skuResult, warehouseResult] = await Promise.all([
    withTimeout(
      supabase.from("skus").select("id, sku_code, sku_name, sku_type, status"),
      "读取 SKU 数据"
    ),
    withTimeout(
      supabase.from("warehouses").select("id, warehouse_code, name, status"),
      "读取仓库数据"
    )
  ]);

  if (skuResult.error) {
    throw formatSupabaseError("读取 SKU 数据", skuResult.error);
  }

  if (warehouseResult.error) {
    throw formatSupabaseError("读取仓库数据", warehouseResult.error);
  }

  const skuByCode = new Map(
    ((skuResult.data ?? []) as ImportSkuRow[]).map((sku) => [
      normalizeCsvValue(sku.sku_code).toLowerCase(),
      sku
    ])
  );
  const warehouseByCode = new Map(
    ((warehouseResult.data ?? []) as ImportWarehouseRow[]).map((warehouse) => [
      normalizeCsvValue(warehouse.warehouse_code).toLowerCase(),
      warehouse
    ])
  );
  const duplicatedRows = getDuplicateImportRows(rows);

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const skuCode = normalizeCsvValue(row.sku_code);
    const targetWarehouseCode = normalizeOptionalText(row.target_warehouse_code);
    const fbaWarehouseCode = normalizeOptionalText(row.fba_warehouse_code);
    const requestedQuantityText = normalizeCsvValue(row.requested_quantity);
    const requestedQuantity = Number(requestedQuantityText);
    const expectedDate = normalizeOptionalText(row.expected_date);
    const remark = normalizeOptionalText(row.remark || row.notes);
    const errors: string[] = [];
    const notes: string[] = [];
    const sku = skuCode ? skuByCode.get(skuCode.toLowerCase()) : null;
    const warehouse = targetWarehouseCode
      ? warehouseByCode.get(targetWarehouseCode.toLowerCase())
      : null;
    const priority = normalizeImportPriority(row.priority, errors, notes);
    const amazonSite = normalizeImportAmazonSite(row.amazon_site, errors, notes);
    const duplicateKey = importRowKeys
      .map((field) => normalizeCsvValue(row[field]).toLowerCase())
      .join("||");

    if (!skuCode) {
      errors.push("sku_code 必填。");
    }

    if (skuCode && !sku) {
      errors.push("sku_code 在 skus 表里找不到。");
    }

    if (sku && !["finished_good", "finished_product"].includes(sku.sku_type)) {
      errors.push("sku_code 必须是成品 SKU，不能导入原材料 SKU。");
    }

    if (targetWarehouseCode && !warehouse) {
      errors.push("target_warehouse_code 在 warehouses 表里找不到。");
    }

    if (
      !requestedQuantityText ||
      !Number.isFinite(requestedQuantity) ||
      requestedQuantity <= 0
    ) {
      errors.push("requested_quantity 必填，且必须大于 0。");
    }

    if (expectedDate && !isValidDateText(expectedDate)) {
      errors.push("expected_date 必须是正确的 YYYY-MM-DD 日期。");
    }

    if (duplicatedRows.has(duplicateKey)) {
      errors.push("同一个 CSV 里有完全重复的行，请检查。");
    }

    if (!targetWarehouseCode) {
      notes.push("目标仓库编码为空，会按空目标仓库写入。");
    }

    return {
      rowNumber,
      rawRow: row,
      notes: notes.length > 0 ? notes : undefined,
      data:
        errors.length === 0 && sku && priority && amazonSite
          ? {
              rowNumber,
              skuCode,
              skuId: sku.id,
              targetWarehouseCode,
              targetWarehouseId: warehouse?.id ?? null,
              fbaWarehouseCode,
              requestedQuantity,
              expectedDate,
              priority,
              amazonSite,
              remark
            }
          : undefined,
      errors
    };
  });
}

export async function bulkImportFbaReplenishmentRequests(
  inputs: FbaReplenishmentImportInput[]
): Promise<BulkImportResult> {
  const errors: BulkImportResult["errors"] = [];
  let successCount = 0;

  for (const input of inputs) {
    try {
      await createFbaReplenishmentRequest({
        skuId: input.skuId,
        targetWarehouseId: input.targetWarehouseId,
        fbaWarehouseCode: input.fbaWarehouseCode ?? undefined,
        requestedQuantity: input.requestedQuantity,
        targetShipDate: input.expectedDate,
        priority: input.priority,
        amazonSite: input.amazonSite,
        notes: input.remark ?? undefined
      });

      successCount += 1;
    } catch (error) {
      errors.push({
        rowNumber: input.rowNumber,
        label: input.skuCode,
        message: getErrorMessage(error)
      });
    }
  }

  return {
    successCount,
    failedCount: inputs.length - successCount,
    errors
  };
}

export async function getFbaReplenishmentRequests(
  options: GetFbaReplenishmentRequestsOptions = {}
): Promise<FbaReplenishmentRequest[]> {
  const supabase = getSupabaseClient();
  let query = supabase
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
          email
        ),
        items:fba_replenishment_request_items!fba_replenishment_request_items_request_id_fkey (
          id,
          request_id,
          product_id,
          sku_id,
          requested_quantity,
          remark,
          created_at,
          updated_at,
          sku:skus!fba_replenishment_request_items_sku_id_fkey (
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
    .order("created_at", { ascending: false });

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  const { data, error } = await withTimeout(query, "读取 FBA 备货需求列表");

  if (error) {
    throw formatSupabaseError("读取 FBA 备货需求列表", error);
  }

  const rows = (data ?? []) as unknown as RawFbaReplenishmentRequest[];

  return rows.map(normalizeFbaReplenishmentRequest);
}
