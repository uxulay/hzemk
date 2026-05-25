import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import type { BrandSummary } from "@/lib/brand-utils";

export type BomStatus = "active" | "inactive";

export type BomSkuOption = {
  id: string;
  product_id: string | null;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  unit: string;
  status: string;
  product: {
    id: string;
    brand_id: string | null;
    product_code: string;
    name: string;
    product_image_url: string | null;
    brand: BrandSummary | null;
  } | null;
};

export type BomHeaderRow = {
  id: string;
  product_sku_id: string;
  bom_code: string;
  version: string;
  status: BomStatus;
  effective_from: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  product_sku: BomSkuOption | null;
};

export type BomListRow = BomHeaderRow & {
  item_count: number;
};

export type BomItemRow = {
  id: string;
  bom_header_id: string;
  component_sku_id: string;
  quantity_per: number;
  unit: string;
  loss_rate: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  component_sku: BomSkuOption | null;
};

export type BomDetail = BomHeaderRow & {
  items: BomItemRow[];
};

export type CreateBomHeaderInput = {
  productSkuId: string;
  version: string;
  status: BomStatus;
  notes?: string;
};

export type AddBomItemInput = {
  bomHeaderId: string;
  componentSkuId: string;
  quantityPer: number;
  lossRate: number;
  notes?: string;
};

export type UpdateBomItemInput = {
  bomItemId: string;
  quantityPer: number;
  lossRate: number;
  notes?: string;
};

type MaybeRelation<T> = T | T[] | null;

type RawBomSkuOption = Omit<BomSkuOption, "product"> & {
  product: MaybeRelation<
    Omit<NonNullable<BomSkuOption["product"]>, "brand"> & {
      brand: MaybeRelation<BrandSummary>;
    }
  >;
};

type RawBomHeaderRow = Omit<BomHeaderRow, "product_sku"> & {
  product_sku: MaybeRelation<RawBomSkuOption>;
};

type RawBomListRow = RawBomHeaderRow & {
  items: Array<{ id: string }> | null;
};

type RawBomItemRow = Omit<BomItemRow, "component_sku"> & {
  component_sku: MaybeRelation<RawBomSkuOption>;
};

type InsertedBomHeader = {
  id: string;
  bom_code: string;
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

function normalizeSkuOption(row: RawBomSkuOption): BomSkuOption {
  const product = singleRelation(row.product);

  return {
    ...row,
    product: product
      ? {
          ...product,
          brand: singleRelation(product.brand)
        }
      : null
  };
}

function normalizeBomHeader(row: RawBomHeaderRow): BomHeaderRow {
  const productSku = singleRelation(row.product_sku);

  return {
    ...row,
    product_sku: productSku ? normalizeSkuOption(productSku) : null
  };
}

function normalizeBomListRow(row: RawBomListRow): BomListRow {
  return {
    ...normalizeBomHeader(row),
    item_count: row.items?.length ?? 0
  };
}

function normalizeBomItem(row: RawBomItemRow): BomItemRow {
  const componentSku = singleRelation(row.component_sku);

  return {
    ...row,
    component_sku: componentSku ? normalizeSkuOption(componentSku) : null
  };
}

function getSkuSelect() {
  return `
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
  `;
}

function getBomHeaderSelect() {
  return `
    id,
    product_sku_id,
    bom_code,
    version,
    status,
    effective_from,
    notes,
    created_at,
    updated_at,
    product_sku:skus!bom_headers_product_sku_id_fkey (
      ${getSkuSelect()}
    )
  `;
}

function normalizeCodePart(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "BOM";
}

function createBomCode(skuCode: string, version: string) {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `BOM-${normalizeCodePart(skuCode)}-${normalizeCodePart(version)}-${datePart}-${randomPart}`;
}

async function getSkuById(skuId: string, action: string): Promise<BomSkuOption> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("skus").select(getSkuSelect()).eq("id", skuId).single(),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return normalizeSkuOption(data as unknown as RawBomSkuOption);
}

async function ensureBomVersionIsNotDuplicated(
  productSkuId: string,
  version: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("bom_headers")
      .select("id")
      .eq("product_sku_id", productSkuId)
      .eq("version", version)
      .maybeSingle(),
    "检查 BOM 版本是否重复"
  );

  if (error) {
    throw formatSupabaseError("检查 BOM 版本是否重复", error);
  }

  if (data) {
    throw new Error("这个成品 SKU 已经有相同版本的 BOM，请换一个版本号。");
  }
}

export async function getBomList(): Promise<BomListRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("bom_headers")
      .select(
        `
          ${getBomHeaderSelect()},
          items:bom_items!bom_items_bom_header_id_fkey (
            id
          )
        `
      )
      .order("created_at", { ascending: false }),
    "读取 BOM 列表"
  );

  if (error) {
    throw formatSupabaseError("读取 BOM 列表", error);
  }

  return ((data ?? []) as unknown as RawBomListRow[]).map(normalizeBomListRow);
}

export async function getBomDetail(bomHeaderId: string): Promise<BomDetail> {
  const supabase = getSupabaseClient();
  const { data: headerData, error: headerError } = await withTimeout(
    supabase
      .from("bom_headers")
      .select(getBomHeaderSelect())
      .eq("id", bomHeaderId)
      .single(),
    "读取 BOM 主表"
  );

  if (headerError) {
    throw formatSupabaseError("读取 BOM 主表", headerError);
  }

  const { data: itemData, error: itemError } = await withTimeout(
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
          created_at,
          updated_at,
          component_sku:skus!bom_items_component_sku_id_fkey (
            ${getSkuSelect()}
          )
        `
      )
      .eq("bom_header_id", bomHeaderId)
      .order("created_at", { ascending: true }),
    "读取 BOM 明细"
  );

  if (itemError) {
    throw formatSupabaseError("读取 BOM 明细", itemError);
  }

  return {
    ...normalizeBomHeader(headerData as unknown as RawBomHeaderRow),
    items: ((itemData ?? []) as unknown as RawBomItemRow[]).map(normalizeBomItem)
  };
}

export async function createBomHeader(
  input: CreateBomHeaderInput
): Promise<InsertedBomHeader> {
  const version = input.version.trim();

  if (!input.productSkuId) {
    throw new Error("请选择成品 SKU。");
  }

  if (!version) {
    throw new Error("请填写 BOM 版本。");
  }

  if (!["active", "inactive"].includes(input.status)) {
    throw new Error("BOM 状态只能是 active 或 inactive。");
  }

  const productSku = await getSkuById(input.productSkuId, "读取成品 SKU");

  if (productSku.sku_type !== "finished_good") {
    throw new Error("只能为 sku_type = finished_good 的成品 SKU 创建 BOM。");
  }

  await ensureBomVersionIsNotDuplicated(input.productSkuId, version);

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("bom_headers")
      .insert({
        product_sku_id: input.productSkuId,
        bom_code: createBomCode(productSku.sku_code, version),
        version,
        status: input.status,
        notes: input.notes?.trim() || null
      })
      .select("id, bom_code")
      .single(),
    "新增 BOM"
  );

  if (error) {
    throw formatSupabaseError("新增 BOM", error);
  }

  return data as InsertedBomHeader;
}

export async function addBomItem(input: AddBomItemInput): Promise<void> {
  if (!input.bomHeaderId) {
    throw new Error("请先选择 BOM。");
  }

  if (!input.componentSkuId) {
    throw new Error("请选择原材料 SKU。");
  }

  if (Number(input.quantityPer) <= 0) {
    throw new Error("单位用量必须大于 0。");
  }

  if (Number(input.lossRate) < 0) {
    throw new Error("损耗率不能小于 0。");
  }

  const materialSku = await getSkuById(input.componentSkuId, "读取原材料 SKU");

  if (materialSku.sku_type !== "material") {
    throw new Error("只能把 sku_type = material 的原材料 SKU 加入 BOM，不能把成品 SKU 当成原材料。");
  }

  const supabase = getSupabaseClient();
  const { data: existingItem, error: existingError } = await withTimeout(
    supabase
      .from("bom_items")
      .select("id")
      .eq("bom_header_id", input.bomHeaderId)
      .eq("component_sku_id", input.componentSkuId)
      .maybeSingle(),
    "检查 BOM 原材料是否重复"
  );

  if (existingError) {
    throw formatSupabaseError("检查 BOM 原材料是否重复", existingError);
  }

  if (existingItem) {
    throw new Error("这个原材料已经在当前 BOM 明细里，不能重复添加。");
  }

  const { error } = await withTimeout(
    supabase.from("bom_items").insert({
      bom_header_id: input.bomHeaderId,
      component_sku_id: input.componentSkuId,
      quantity_per: input.quantityPer,
      unit: materialSku.unit,
      loss_rate: input.lossRate,
      notes: input.notes?.trim() || null
    }),
    "添加 BOM 原材料"
  );

  if (error) {
    throw formatSupabaseError("添加 BOM 原材料", error);
  }
}

export async function updateBomItem(input: UpdateBomItemInput): Promise<void> {
  if (!input.bomItemId) {
    throw new Error("缺少 BOM 明细 ID。");
  }

  if (Number(input.quantityPer) <= 0) {
    throw new Error("单位用量必须大于 0。");
  }

  if (Number(input.lossRate) < 0) {
    throw new Error("损耗率不能小于 0。");
  }

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("bom_items")
      .update({
        quantity_per: input.quantityPer,
        loss_rate: input.lossRate,
        notes: input.notes?.trim() || null
      })
      .eq("id", input.bomItemId),
    "更新 BOM 明细"
  );

  if (error) {
    throw formatSupabaseError("更新 BOM 明细", error);
  }
}

export async function toggleBomStatus(
  bomHeaderId: string,
  currentStatus?: BomStatus
): Promise<BomStatus> {
  if (!bomHeaderId) {
    throw new Error("缺少 BOM ID。");
  }

  let nextStatus: BomStatus;

  if (currentStatus) {
    nextStatus = currentStatus === "active" ? "inactive" : "active";
  } else {
    const supabase = getSupabaseClient();
    const { data, error } = await withTimeout(
      supabase.from("bom_headers").select("status").eq("id", bomHeaderId).single(),
      "读取 BOM 状态"
    );

    if (error) {
      throw formatSupabaseError("读取 BOM 状态", error);
    }

    nextStatus =
      (data as { status: BomStatus }).status === "active" ? "inactive" : "active";
  }

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("bom_headers").update({ status: nextStatus }).eq("id", bomHeaderId),
    "启用或停用 BOM"
  );

  if (error) {
    throw formatSupabaseError("启用或停用 BOM", error);
  }

  return nextStatus;
}

export async function getFinishedGoodSkus(): Promise<BomSkuOption[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawBomSkuOption>(
    () =>
      supabase
      .from("skus")
      .select(getSkuSelect())
      .eq("sku_type", "finished_good")
      .order("sku_code", { ascending: true }),
    "读取成品 SKU 列表"
  );

  return data.map(normalizeSkuOption);
}

export async function getMaterialSkus(): Promise<BomSkuOption[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawBomSkuOption>(
    () =>
      supabase
      .from("skus")
      .select(getSkuSelect())
      .eq("sku_type", "material")
      .order("sku_code", { ascending: true }),
    "读取原材料 SKU 列表"
  );

  return data.map(normalizeSkuOption);
}
