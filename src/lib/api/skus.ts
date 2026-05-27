import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import type { BrandSummary } from "@/lib/brand-utils";
import { normalizeRpcPage } from "@/lib/api/page-types";

export type SkuStatus = "active" | "inactive";

export type SkuEditableType = "finished_good" | "semi_finished";

export type SkuProductOption = {
  id: string;
  brand_id: string | null;
  product_code: string;
  name: string;
  product_image_url: string | null;
  status: string;
  brand: BrandSummary | null;
};

export type SkuSupplierOption = {
  id: string;
  supplier_code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  status: string;
};

export type SkuRow = {
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

export type SkuListRow = SkuRow & {
  product: SkuProductOption | null;
  default_supplier: SkuSupplierOption | null;
  inventory_quantity: number;
  reserved_quantity: number;
  inventory_row_count: number;
};

export type GetSkusPageParams = {
  page: number;
  pageSize: number;
  keyword?: string;
  skuType?: string;
  status?: string;
  brandId?: string;
  productId?: string;
  supplierId?: string;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
};

export type SkusPageResult = {
  rows: SkuListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type SkuInventorySummary = {
  sku_id: string;
  quantity_on_hand: number;
  reserved_quantity: number;
  inventory_row_count: number;
};

export type CreateSkuInput = {
  skuCode: string;
  skuName: string;
  skuType: SkuEditableType;
  productId?: string;
  defaultSupplierId?: string;
  unit: string;
  specs?: string;
  status: SkuStatus;
};

export type UpdateSkuInput = {
  skuId: string;
  skuCode: string;
  skuName: string;
  skuType: string;
  productId?: string;
  defaultSupplierId?: string;
  unit: string;
  specs?: string;
  status: SkuStatus;
};

export type SkuBomHeaderUsage = {
  id: string;
  product_sku_id: string;
  bom_code: string;
  version: string;
  status: string;
  effective_from: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  item_count: number;
};

export type SkuBomProductSku = {
  id: string;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  unit: string;
  product: SkuProductOption | null;
};

export type SkuBomHeaderForMaterial = {
  id: string;
  product_sku_id: string;
  bom_code: string;
  version: string;
  status: string;
  effective_from: string | null;
  notes: string | null;
  product_sku: SkuBomProductSku | null;
};

export type SkuBomItemUsage = {
  id: string;
  bom_header_id: string;
  quantity_per: number;
  unit: string;
  loss_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  bom_header: SkuBomHeaderForMaterial | null;
};

export type SkuBomUsage = {
  skuId: string;
  skuType: string;
  finishedBomHeaders: SkuBomHeaderUsage[];
  materialBomItems: SkuBomItemUsage[];
};

type MaybeRelation<T> = T | T[] | null;

type RawSkuProductOption = Omit<SkuProductOption, "brand"> & {
  brand: MaybeRelation<BrandSummary>;
};

type RawSkuRow = SkuRow & {
  product: MaybeRelation<RawSkuProductOption>;
  default_supplier: MaybeRelation<SkuSupplierOption>;
};

type RawInventorySummaryRow = {
  sku_id: string;
  quantity_on_hand: number | string;
  reserved_quantity: number | string;
};

type RawSkuBomHeaderUsage = Omit<SkuBomHeaderUsage, "item_count"> & {
  items: Array<{ id: string }> | null;
};

type RawSkuBomProductSku = Omit<SkuBomProductSku, "product"> & {
  product: MaybeRelation<RawSkuProductOption>;
};

type RawSkuBomHeaderForMaterial = Omit<
  SkuBomHeaderForMaterial,
  "product_sku"
> & {
  product_sku: MaybeRelation<RawSkuBomProductSku>;
};

type RawSkuBomItemUsage = Omit<SkuBomItemUsage, "bom_header"> & {
  bom_header: MaybeRelation<RawSkuBomHeaderForMaterial>;
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

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeProductOption(row: RawSkuProductOption): SkuProductOption {
  return {
    ...row,
    brand: singleRelation(row.brand)
  };
}

function normalizeOptionalId(value?: string) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeFilterValue(value?: string) {
  const normalized = value?.trim();

  return normalized && normalized !== "all" ? normalized : undefined;
}

function escapeFilterKeyword(value: string) {
  return value.replace(/[%_,]/g, " ").trim();
}

function assertSkuStatus(status: string): asserts status is SkuStatus {
  if (!["active", "inactive"].includes(status)) {
    throw new Error("SKU 状态只能是 active 或 inactive。");
  }
}

function assertSkuEditableType(skuType: string): asserts skuType is SkuEditableType {
  if (!["finished_good", "semi_finished"].includes(skuType)) {
    throw new Error("SKU 类型只能是 finished_good 或 semi_finished。辅料请到“辅料管理”维护。");
  }
}

function getSkuSelect() {
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
    ),
    product:products!skus_product_id_fkey (
      id,
      brand_id,
      product_code,
      name,
      product_image_url,
      status,
      brand:brands!products_brand_id_fkey (
        id,
        brand_code,
        name,
        english_name,
        logo_url,
        status
      )
    )
  `;
}

function normalizeSkuRow(
  row: RawSkuRow,
  inventorySummary?: SkuInventorySummary
): SkuListRow {
  return {
    ...row,
    product: singleRelation(row.product)
      ? normalizeProductOption(singleRelation(row.product) as RawSkuProductOption)
      : null,
    default_supplier: singleRelation(row.default_supplier),
    inventory_quantity: inventorySummary?.quantity_on_hand ?? 0,
    reserved_quantity: inventorySummary?.reserved_quantity ?? 0,
    inventory_row_count: inventorySummary?.inventory_row_count ?? 0
  };
}

function normalizeBomHeaderUsage(row: RawSkuBomHeaderUsage): SkuBomHeaderUsage {
  return {
    id: row.id,
    product_sku_id: row.product_sku_id,
    bom_code: row.bom_code,
    version: row.version,
    status: row.status,
    effective_from: row.effective_from,
    notes: row.notes,
    created_at: row.created_at,
    updated_at: row.updated_at,
    item_count: row.items?.length ?? 0
  };
}

function normalizeBomProductSku(row: RawSkuBomProductSku): SkuBomProductSku {
  const product = singleRelation(row.product);

  return {
    ...row,
    product: product ? normalizeProductOption(product) : null
  };
}

function normalizeBomHeaderForMaterial(
  row: RawSkuBomHeaderForMaterial
): SkuBomHeaderForMaterial {
  const productSku = singleRelation(row.product_sku);

  return {
    ...row,
    product_sku: productSku ? normalizeBomProductSku(productSku) : null
  };
}

function normalizeBomItemUsage(row: RawSkuBomItemUsage): SkuBomItemUsage {
  const bomHeader = singleRelation(row.bom_header);

  return {
    ...row,
    quantity_per: Number(row.quantity_per),
    loss_rate: Number(row.loss_rate),
    bom_header: bomHeader ? normalizeBomHeaderForMaterial(bomHeader) : null
  };
}

async function ensureSkuCodeIsUnique(skuCode: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("skus").select("id").eq("sku_code", skuCode).maybeSingle(),
    "检查 SKU 编码是否重复"
  );

  if (error) {
    throw formatSupabaseError("检查 SKU 编码是否重复", error);
  }

  if (data) {
    throw new Error("SKU 编码已经存在，请换一个 SKU 编码。");
  }
}

function validateSkuBasics(input: {
  skuName: string;
  skuType: string;
  productId?: string;
  unit: string;
  status: string;
}) {
  if (!input.skuName.trim()) {
    throw new Error("请填写 SKU 名称。");
  }

  if (!input.skuType.trim()) {
    throw new Error("请选择 SKU 类型。");
  }

  if (!input.unit.trim()) {
    throw new Error("请填写单位。");
  }

  if (input.skuType === "finished_good" && !normalizeOptionalId(input.productId)) {
    throw new Error("成品 SKU 需要选择所属产品。");
  }

  assertSkuStatus(input.status);
}

export async function getSkuInventorySummary(): Promise<SkuInventorySummary[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawInventorySummaryRow>(
    () =>
      supabase
      .from("inventory_items")
      .select("sku_id, quantity_on_hand, reserved_quantity"),
    "读取 SKU 库存汇总"
  );

  const summaryBySku = new Map<string, SkuInventorySummary>();

  for (const row of data) {
    const current = summaryBySku.get(row.sku_id) ?? {
      sku_id: row.sku_id,
      quantity_on_hand: 0,
      reserved_quantity: 0,
      inventory_row_count: 0
    };

    current.quantity_on_hand += Number(row.quantity_on_hand);
    current.reserved_quantity += Number(row.reserved_quantity);
    current.inventory_row_count += 1;
    summaryBySku.set(row.sku_id, current);
  }

  return Array.from(summaryBySku.values());
}

async function getSkuInventorySummaryBySkuIds(
  skuIds: string[]
): Promise<SkuInventorySummary[]> {
  if (skuIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("inventory_items")
      .select("sku_id, quantity_on_hand, reserved_quantity")
      .in("sku_id", skuIds),
    "读取当前页 SKU 库存汇总"
  );

  if (error) {
    throw formatSupabaseError("读取当前页 SKU 库存汇总", error);
  }

  const summaryBySku = new Map<string, SkuInventorySummary>();

  for (const row of (data ?? []) as RawInventorySummaryRow[]) {
    const current = summaryBySku.get(row.sku_id) ?? {
      sku_id: row.sku_id,
      quantity_on_hand: 0,
      reserved_quantity: 0,
      inventory_row_count: 0
    };

    current.quantity_on_hand += Number(row.quantity_on_hand);
    current.reserved_quantity += Number(row.reserved_quantity);
    current.inventory_row_count += 1;
    summaryBySku.set(row.sku_id, current);
  }

  return Array.from(summaryBySku.values());
}

async function getProductIdsByBrand(brandId: string | null): Promise<string[]> {
  const supabase = getSupabaseClient();
  const pageSize = 1000;
  const productIds: string[] = [];
  let page = 0;

  while (true) {
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const query = supabase
      .from("products")
      .select("id")
      .order("product_code", { ascending: true })
      .range(from, to);

    const { data, error } = await withTimeout(
      brandId ? query.eq("brand_id", brandId) : query.is("brand_id", null),
      "按品牌读取产品 ID"
    );

    if (error) {
      throw formatSupabaseError("按品牌读取产品 ID", error);
    }

    const rows = (data ?? []) as Array<{ id: string }>;
    productIds.push(...rows.map((row) => row.id));

    if (rows.length < pageSize) {
      break;
    }

    page += 1;
  }

  return productIds;
}

export async function getSkusPage(
  params: GetSkusPageParams
): Promise<SkusPageResult> {
  const supabase = getSupabaseClient();
  const pageSize = Math.min(Math.max(params.pageSize || 100, 1), 100);
  const safePage = Math.max(params.page || 1, 1);
  const { data, error } = await withTimeout(
    supabase.rpc("get_skus_page", {
      p_page: safePage,
      p_page_size: pageSize,
      p_keyword: params.keyword?.trim() || null,
      p_filters: {
        skuType: params.skuType ?? "all",
        status: params.status ?? "all",
        brandId: params.brandId ?? "all",
        productId: params.productId ?? "all",
        supplierId: params.supplierId ?? "all"
      },
      p_sort_by: params.sortBy ?? "sku_code",
      p_sort_direction: params.sortDirection ?? "asc"
    }),
    "分页读取 SKU 列表"
  );

  if (error) {
    throw new Error(
      `分页读取 SKU 列表失败：${error.message}。请确认已经在 Supabase SQL Editor 执行 supabase/performance-rpc-and-indexes.sql。`
    );
  }

  const page = normalizeRpcPage<SkuListRow, undefined>(data, {
    page: safePage,
    pageSize,
    summary: undefined
  });

  return {
    rows: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    totalPages: page.totalPages
  };
}

/**
 * @deprecated 主列表请使用 getSkusPage；表单选择请使用 getProductsForSkuForm 或业务侧远程搜索。
 * 保留原因：debug/旧兼容入口，仍按批次读取避免 Supabase 1000 行截断，但不再作为主列表入口。
 */
export async function getSkus(): Promise<SkuListRow[]> {
  const supabase = getSupabaseClient();
  const [skuRows, inventorySummary] = await Promise.all([
    fetchAllSupabaseRows<RawSkuRow>(
      () =>
        supabase
        .from("skus")
        .select(getSkuSelect())
        .in("sku_type", ["finished_good", "finished_product", "semi_finished"])
        .order("sku_code", { ascending: true }),
      "读取 SKU 列表"
    ),
    getSkuInventorySummary()
  ]);

  const inventoryBySku = new Map(
    inventorySummary.map((summary) => [summary.sku_id, summary])
  );

  return skuRows.map((row) =>
    normalizeSkuRow(row, inventoryBySku.get(row.id))
  );
}

export async function getProductsForSkuForm(
  keyword = "",
  limit = 20
): Promise<SkuProductOption[]> {
  const supabase = getSupabaseClient();
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const normalizedKeyword = escapeFilterKeyword(keyword);
  let query = supabase
      .from("products")
      .select(
        `
          id,
          brand_id,
          product_code,
          name,
          product_image_url,
          status,
          brand:brands!products_brand_id_fkey (
            id,
            brand_code,
            name,
            english_name,
            logo_url,
            status
          )
        `
      )
      .order("product_code", { ascending: true })
      .limit(safeLimit);

  if (normalizedKeyword) {
    query = query.or(
      `product_code.ilike.%${normalizedKeyword}%,name.ilike.%${normalizedKeyword}%`
    );
  } else {
    query = query.eq("status", "active");
  }

  const { data, error } = await withTimeout(
    query,
    "读取产品下拉列表"
  );

  if (error) {
    throw formatSupabaseError("读取产品下拉列表", error);
  }

  return ((data ?? []) as unknown as RawSkuProductOption[]).map(
    normalizeProductOption
  );
}

export async function createSku(input: CreateSkuInput): Promise<SkuRow> {
  const skuCode = input.skuCode.trim();
  const skuName = input.skuName.trim();
  const unit = input.unit.trim();
  const productId = normalizeOptionalId(input.productId);
  if (!skuCode) {
    throw new Error("请填写 SKU 编码。");
  }

  validateSkuBasics({
    skuName,
    skuType: input.skuType,
    productId: productId ?? undefined,
    unit,
    status: input.status
  });
  assertSkuEditableType(input.skuType);
  await ensureSkuCodeIsUnique(skuCode);

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("skus")
      .insert({
        product_id: productId,
        sku_code: skuCode,
        sku_name: skuName,
        sku_type: input.skuType,
        default_supplier_id: null,
        unit,
        specs: normalizeOptionalText(input.specs),
        status: input.status
      })
      .select("*")
      .single(),
    "新增 SKU"
  );

  if (error) {
    throw formatSupabaseError("新增 SKU", error);
  }

  return data as SkuRow;
}

export async function updateSku(input: UpdateSkuInput): Promise<void> {
  const skuName = input.skuName.trim();
  const unit = input.unit.trim();
  const productId = normalizeOptionalId(input.productId);
  if (!input.skuId) {
    throw new Error("缺少 SKU ID。");
  }

  validateSkuBasics({
    skuName,
    skuType: input.skuType,
    productId: productId ?? undefined,
    unit,
    status: input.status
  });

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("skus")
      .update({
        sku_name: skuName,
        product_id: productId,
        default_supplier_id: null,
        unit,
        specs: normalizeOptionalText(input.specs),
        status: input.status
      })
      .eq("id", input.skuId),
    "编辑 SKU"
  );

  if (error) {
    throw formatSupabaseError("编辑 SKU", error);
  }
}

export async function toggleSkuStatus(
  skuId: string,
  currentStatus: string
): Promise<SkuStatus> {
  if (!skuId) {
    throw new Error("缺少 SKU ID。");
  }

  const nextStatus: SkuStatus =
    currentStatus === "active" ? "inactive" : "active";
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("skus").update({ status: nextStatus }).eq("id", skuId),
    "启用或停用 SKU"
  );

  if (error) {
    throw formatSupabaseError("启用或停用 SKU", error);
  }

  return nextStatus;
}

async function getFinishedSkuBomHeaders(
  skuId: string
): Promise<SkuBomHeaderUsage[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawSkuBomHeaderUsage>(
    () =>
      supabase
      .from("bom_headers")
      .select(
        `
          id,
          product_sku_id,
          bom_code,
          version,
          status,
          effective_from,
          notes,
          created_at,
          updated_at,
          items:bom_items!bom_items_bom_header_id_fkey (
            id
          )
        `
      )
      .eq("product_sku_id", skuId)
      .order("created_at", { ascending: false }),
    "读取成品 SKU 的 BOM 关联"
  );

  return data.map(normalizeBomHeaderUsage);
}

async function getMaterialSkuBomItems(
  _skuId: string
): Promise<SkuBomItemUsage[]> {
  return [];
}

export async function getSkuBomUsage(input: {
  skuId: string;
  skuType: string;
}): Promise<SkuBomUsage> {
  if (!input.skuId) {
    throw new Error("缺少 SKU ID。");
  }

  if (input.skuType === "finished_good") {
    return {
      skuId: input.skuId,
      skuType: input.skuType,
      finishedBomHeaders: await getFinishedSkuBomHeaders(input.skuId),
      materialBomItems: []
    };
  }

  const [finishedBomHeaders, materialBomItems] = await Promise.all([
    getFinishedSkuBomHeaders(input.skuId),
    getMaterialSkuBomItems(input.skuId)
  ]);

  return {
    skuId: input.skuId,
    skuType: input.skuType,
    finishedBomHeaders,
    materialBomItems
  };
}
