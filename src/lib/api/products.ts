import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import type { BrandSummary } from "@/lib/brand-utils";

export type ProductStatus = "active" | "inactive";

export type ProductRow = {
  id: string;
  brand_id: string | null;
  product_code: string;
  name: string;
  category: string | null;
  description: string | null;
  product_image_url: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  brand: BrandSummary | null;
};

export type ProductListRow = ProductRow & {
  sku_count: number;
};

export type ProductSkuRow = {
  id: string;
  product_id: string | null;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  unit: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ProductStats = {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  totalSkus: number;
};

export type CreateProductInput = {
  productCode: string;
  name: string;
  brandId?: string;
  category?: string;
  description?: string;
  productImageUrl?: string;
  status: ProductStatus;
};

export type UpdateProductInput = {
  productId: string;
  name: string;
  brandId?: string;
  category?: string;
  description?: string;
  productImageUrl?: string;
  status: ProductStatus;
};

type SkuProductLink = {
  id: string;
  product_id: string | null;
};

type MaybeRelation<T> = T | T[] | null;

type RawProductRow = Omit<ProductRow, "brand"> & {
  brand: MaybeRelation<BrandSummary>;
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

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function normalizeOptionalId(value?: string) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function singleRelation<T>(value: MaybeRelation<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function assertProductStatus(status: string): asserts status is ProductStatus {
  if (!["active", "inactive"].includes(status)) {
    throw new Error("产品状态只能是 active 或 inactive。");
  }
}

async function ensureProductCodeIsUnique(productCode: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("products")
      .select("id")
      .eq("product_code", productCode)
      .maybeSingle(),
    "检查产品编码是否重复"
  );

  if (error) {
    throw formatSupabaseError("检查产品编码是否重复", error);
  }

  if (data) {
    throw new Error("产品编码已经存在，请换一个产品编码。");
  }
}

function countSkusByProduct(skus: SkuProductLink[]) {
  const skuCountByProduct = new Map<string, number>();

  skus.forEach((sku) => {
    if (!sku.product_id) {
      return;
    }

    skuCountByProduct.set(
      sku.product_id,
      (skuCountByProduct.get(sku.product_id) ?? 0) + 1
    );
  });

  return skuCountByProduct;
}

function getProductSelect() {
  return `
    id,
    brand_id,
    product_code,
    name,
    category,
    description,
    product_image_url,
    status,
    created_at,
    updated_at,
    brand:brands!products_brand_id_fkey (
      id,
      brand_code,
      name,
      english_name,
      logo_url,
      status
    )
  `;
}

function normalizeProduct(row: RawProductRow): ProductRow {
  return {
    ...row,
    brand: singleRelation(row.brand)
  };
}

export async function getProducts(): Promise<ProductListRow[]> {
  const supabase = getSupabaseClient();
  const [productRows, skuRows] = await Promise.all([
    fetchAllSupabaseRows<RawProductRow>(
      () =>
        supabase
        .from("products")
        .select(getProductSelect())
        .order("product_code", { ascending: true }),
      "读取产品列表"
    ),
    fetchAllSupabaseRows<SkuProductLink>(
      () => supabase.from("skus").select("id, product_id"),
      "统计产品关联 SKU 数量"
    )
  ]);

  const skuCountByProduct = countSkusByProduct(skuRows);

  return productRows
    .map(normalizeProduct)
    .map((product) => ({
      ...product,
      sku_count: skuCountByProduct.get(product.id) ?? 0
    }));
}

export async function getProductStats(): Promise<ProductStats> {
  const supabase = getSupabaseClient();
  const [productResult, activeResult, inactiveResult, skuResult] = await Promise.all([
    withTimeout(
      supabase.from("products").select("id", { count: "exact", head: true }),
      "统计产品数量"
    ),
    withTimeout(
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      "统计启用产品数量"
    ),
    withTimeout(
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .eq("status", "inactive"),
      "统计停用产品数量"
    ),
    withTimeout(
      supabase.from("skus").select("id", { count: "exact", head: true }),
      "统计 SKU 数量"
    )
  ]);

  if (productResult.error) {
    throw formatSupabaseError("统计产品数量", productResult.error);
  }

  if (skuResult.error) {
    throw formatSupabaseError("统计 SKU 数量", skuResult.error);
  }
  if (activeResult.error) {
    throw formatSupabaseError("统计启用产品数量", activeResult.error);
  }
  if (inactiveResult.error) {
    throw formatSupabaseError("统计停用产品数量", inactiveResult.error);
  }

  return {
    totalProducts: productResult.count ?? 0,
    activeProducts: activeResult.count ?? 0,
    inactiveProducts: inactiveResult.count ?? 0,
    totalSkus: skuResult.count ?? 0
  };
}

export async function createProduct(
  input: CreateProductInput
): Promise<ProductRow> {
  const productCode = input.productCode.trim();
  const name = input.name.trim();

  if (!productCode) {
    throw new Error("请填写产品编码。");
  }

  if (!name) {
    throw new Error("请填写产品名称。");
  }

  assertProductStatus(input.status);
  await ensureProductCodeIsUnique(productCode);

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("products")
      .insert({
        product_code: productCode,
        brand_id: normalizeOptionalId(input.brandId),
        name,
        category: normalizeOptionalText(input.category),
        description: normalizeOptionalText(input.description),
        product_image_url: normalizeOptionalText(input.productImageUrl),
        status: input.status
      })
      .select(getProductSelect())
      .single(),
    "新增产品"
  );

  if (error) {
    throw formatSupabaseError("新增产品", error);
  }

  return normalizeProduct(data as unknown as RawProductRow);
}

export async function updateProduct(input: UpdateProductInput): Promise<void> {
  const name = input.name.trim();

  if (!input.productId) {
    throw new Error("缺少产品 ID。");
  }

  if (!name) {
    throw new Error("请填写产品名称。");
  }

  assertProductStatus(input.status);

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("products")
      .update({
        name,
        brand_id: normalizeOptionalId(input.brandId),
        category: normalizeOptionalText(input.category),
        description: normalizeOptionalText(input.description),
        product_image_url: normalizeOptionalText(input.productImageUrl),
        status: input.status
      })
      .eq("id", input.productId),
    "编辑产品"
  );

  if (error) {
    throw formatSupabaseError("编辑产品", error);
  }
}

export async function toggleProductStatus(
  productId: string,
  currentStatus: string
): Promise<ProductStatus> {
  if (!productId) {
    throw new Error("缺少产品 ID。");
  }

  const nextStatus: ProductStatus =
    currentStatus === "active" ? "inactive" : "active";
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("products").update({ status: nextStatus }).eq("id", productId),
    "启用或停用产品"
  );

  if (error) {
    throw formatSupabaseError("启用或停用产品", error);
  }

  return nextStatus;
}

export async function getProductSkus(
  productId: string
): Promise<ProductSkuRow[]> {
  if (!productId) {
    throw new Error("缺少产品 ID。");
  }

  const supabase = getSupabaseClient();
  return fetchAllSupabaseRows<ProductSkuRow>(
    () =>
      supabase
      .from("skus")
      .select(
        "id, product_id, sku_code, sku_name, sku_type, unit, status, created_at, updated_at"
      )
      .eq("product_id", productId)
      .order("sku_code", { ascending: true }),
    "读取产品关联 SKU"
  );
}
