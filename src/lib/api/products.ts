import { getSupabaseClient } from "@/lib/supabase/client";

export type ProductStatus = "active" | "inactive";

export type ProductRow = {
  id: string;
  product_code: string;
  name: string;
  category: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
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
  description?: string;
  status: ProductStatus;
};

export type UpdateProductInput = {
  productId: string;
  name: string;
  description?: string;
  status: ProductStatus;
};

type SkuProductLink = {
  id: string;
  product_id: string | null;
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

export async function getProducts(): Promise<ProductListRow[]> {
  const supabase = getSupabaseClient();
  const [productResult, skuResult] = await Promise.all([
    withTimeout(
      supabase
        .from("products")
        .select("*")
        .order("product_code", { ascending: true }),
      "读取产品列表"
    ),
    withTimeout(
      supabase.from("skus").select("id, product_id"),
      "统计产品关联 SKU 数量"
    )
  ]);

  if (productResult.error) {
    throw formatSupabaseError("读取产品列表", productResult.error);
  }

  if (skuResult.error) {
    throw formatSupabaseError("统计产品关联 SKU 数量", skuResult.error);
  }

  const skuCountByProduct = countSkusByProduct(
    (skuResult.data ?? []) as SkuProductLink[]
  );

  return ((productResult.data ?? []) as ProductRow[]).map((product) => ({
    ...product,
    sku_count: skuCountByProduct.get(product.id) ?? 0
  }));
}

export async function getProductStats(): Promise<ProductStats> {
  const supabase = getSupabaseClient();
  const [productResult, skuResult] = await Promise.all([
    withTimeout(supabase.from("products").select("id, status"), "统计产品数量"),
    withTimeout(supabase.from("skus").select("id"), "统计 SKU 数量")
  ]);

  if (productResult.error) {
    throw formatSupabaseError("统计产品数量", productResult.error);
  }

  if (skuResult.error) {
    throw formatSupabaseError("统计 SKU 数量", skuResult.error);
  }

  const products = (productResult.data ?? []) as Array<{
    id: string;
    status: string;
  }>;

  return {
    totalProducts: products.length,
    activeProducts: products.filter((product) => product.status === "active")
      .length,
    inactiveProducts: products.filter((product) => product.status === "inactive")
      .length,
    totalSkus: (skuResult.data ?? []).length
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
        name,
        description: normalizeOptionalText(input.description),
        status: input.status
      })
      .select("*")
      .single(),
    "新增产品"
  );

  if (error) {
    throw formatSupabaseError("新增产品", error);
  }

  return data as ProductRow;
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
        description: normalizeOptionalText(input.description),
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
  const { data, error } = await withTimeout(
    supabase
      .from("skus")
      .select(
        "id, product_id, sku_code, sku_name, sku_type, unit, status, created_at, updated_at"
      )
      .eq("product_id", productId)
      .order("sku_code", { ascending: true }),
    "读取产品关联 SKU"
  );

  if (error) {
    throw formatSupabaseError("读取产品关联 SKU", error);
  }

  return (data ?? []) as ProductSkuRow[];
}
