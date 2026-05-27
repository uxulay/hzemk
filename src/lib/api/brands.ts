import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import type { ListPageParams, ListPageResult } from "@/lib/api/page-types";
import { normalizeRpcPage } from "@/lib/api/page-types";

export type BrandStatus = "active" | "inactive";

export type BrandRow = {
  id: string;
  brand_code: string;
  name: string;
  english_name: string | null;
  logo_url: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type BrandListRow = BrandRow & {
  product_count: number;
};

export type BrandStats = {
  totalBrands: number;
  activeBrands: number;
  inactiveBrands: number;
  totalLinkedProducts: number;
};

export type BrandPageFilters = {
  status?: string;
};

export type BrandPageParams = ListPageParams<BrandPageFilters>;

export type BrandPageResult = ListPageResult<BrandListRow, BrandStats>;

export type CreateBrandInput = {
  brandCode: string;
  name: string;
  englishName?: string;
  logoUrl?: string;
  status: BrandStatus;
  notes?: string;
};

export type UpdateBrandInput = {
  brandId: string;
  name: string;
  englishName?: string;
  logoUrl?: string;
  status: BrandStatus;
  notes?: string;
};

type ProductBrandLink = {
  id: string;
  brand_id: string | null;
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

function assertBrandStatus(status: string): asserts status is BrandStatus {
  if (!["active", "inactive"].includes(status)) {
    throw new Error("品牌状态只能是 active 或 inactive。");
  }
}

async function ensureBrandCodeIsUnique(brandCode: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("brands").select("id").eq("brand_code", brandCode).maybeSingle(),
    "检查品牌编码是否重复"
  );

  if (error) {
    throw formatSupabaseError("检查品牌编码是否重复", error);
  }

  if (data) {
    throw new Error("品牌编码已经存在，请换一个品牌编码。");
  }
}

function countProductsByBrand(products: ProductBrandLink[]) {
  const productCountByBrand = new Map<string, number>();

  products.forEach((product) => {
    if (!product.brand_id) {
      return;
    }

    productCountByBrand.set(
      product.brand_id,
      (productCountByBrand.get(product.brand_id) ?? 0) + 1
    );
  });

  return productCountByBrand;
}

/**
 * @deprecated 主列表请使用 getBrandsPage；下拉请使用 searchBrandOptions/getBrandOptions。
 * 保留原因：debug/旧页面兼容，仍按批次读取避免 Supabase 1000 行截断，但不再作为主列表入口。
 */
export async function getBrands(): Promise<BrandListRow[]> {
  const supabase = getSupabaseClient();
  const [brandRows, productRows] = await Promise.all([
    fetchAllSupabaseRows<BrandRow>(
      () => supabase.from("brands").select("*").order("brand_code", { ascending: true }),
      "读取品牌列表"
    ),
    fetchAllSupabaseRows<ProductBrandLink>(
      () => supabase.from("products").select("id, brand_id"),
      "统计品牌关联产品数量"
    )
  ]);

  const productCountByBrand = countProductsByBrand(productRows);

  return brandRows.map((brand) => ({
    ...brand,
    product_count: productCountByBrand.get(brand.id) ?? 0
  }));
}

export async function getBrandsPage(
  params: BrandPageParams = {}
): Promise<BrandPageResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.rpc("get_brands_page", {
      p_page: page,
      p_page_size: pageSize,
      p_keyword: params.keyword?.trim() || null,
      p_filters: params.filters ?? {},
      p_sort_by: params.sortBy ?? "brand_code",
      p_sort_direction: params.sortDirection ?? "asc"
    }),
    "读取品牌分页列表"
  );

  if (error) {
    throw formatSupabaseError("读取品牌分页列表", error);
  }

  return normalizeRpcPage<BrandListRow, BrandStats>(data, {
    page,
    pageSize,
    summary: initialBrandStats
  });
}

const initialBrandStats: BrandStats = {
  totalBrands: 0,
  activeBrands: 0,
  inactiveBrands: 0,
  totalLinkedProducts: 0
};

export async function searchBrandOptions(
  keyword = "",
  limit = 20,
  onlyActive = false
): Promise<BrandRow[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("brands")
    .select("id, brand_code, name, english_name, logo_url, status, notes, created_at, updated_at")
    .order("brand_code", { ascending: true })
    .limit(limit);

  const normalizedKeyword = keyword.trim();

  if (normalizedKeyword) {
    query = query.or(
      [
        `brand_code.ilike.%${normalizedKeyword}%`,
        `name.ilike.%${normalizedKeyword}%`,
        `english_name.ilike.%${normalizedKeyword}%`
      ].join(",")
    );
  }

  if (onlyActive) {
    query = query.eq("status", "active");
  }

  const { data, error } = await withTimeout(
    query,
    "读取品牌下拉列表"
  );

  if (error) {
    throw formatSupabaseError("读取品牌下拉列表", error);
  }

  return (data ?? []) as BrandRow[];
}

export async function getBrandOptions(): Promise<BrandRow[]> {
  return searchBrandOptions("", 20);
}

export async function getBrandStats(): Promise<BrandStats> {
  const supabase = getSupabaseClient();
  const [totalResult, activeResult, inactiveResult, linkedProductsResult] =
    await Promise.all([
    withTimeout(
      supabase.from("brands").select("id", { count: "exact", head: true }),
      "统计品牌数量"
    ),
    withTimeout(
      supabase
        .from("brands")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      "统计启用品牌数量"
    ),
    withTimeout(
      supabase
        .from("brands")
        .select("id", { count: "exact", head: true })
        .eq("status", "inactive"),
      "统计停用品牌数量"
    ),
    withTimeout(
      supabase
        .from("products")
        .select("id", { count: "exact", head: true })
        .not("brand_id", "is", null),
      "统计已绑定品牌产品数量"
    )
  ]);

  if (totalResult.error) {
    throw formatSupabaseError("统计品牌数量", totalResult.error);
  }
  if (activeResult.error) {
    throw formatSupabaseError("统计启用品牌数量", activeResult.error);
  }
  if (inactiveResult.error) {
    throw formatSupabaseError("统计停用品牌数量", inactiveResult.error);
  }
  if (linkedProductsResult.error) {
    throw formatSupabaseError("统计已绑定品牌产品数量", linkedProductsResult.error);
  }

  return {
    totalBrands: totalResult.count ?? 0,
    activeBrands: activeResult.count ?? 0,
    inactiveBrands: inactiveResult.count ?? 0,
    totalLinkedProducts: linkedProductsResult.count ?? 0
  };
}

export async function createBrand(input: CreateBrandInput): Promise<BrandRow> {
  const brandCode = input.brandCode.trim();
  const name = input.name.trim();

  if (!brandCode) {
    throw new Error("请填写品牌编码。");
  }

  if (!name) {
    throw new Error("请填写品牌名称。");
  }

  assertBrandStatus(input.status);
  await ensureBrandCodeIsUnique(brandCode);

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("brands")
      .insert({
        brand_code: brandCode,
        name,
        english_name: normalizeOptionalText(input.englishName),
        logo_url: normalizeOptionalText(input.logoUrl),
        status: input.status,
        notes: normalizeOptionalText(input.notes)
      })
      .select("*")
      .single(),
    "新增品牌"
  );

  if (error) {
    throw formatSupabaseError("新增品牌", error);
  }

  return data as BrandRow;
}

export async function updateBrand(input: UpdateBrandInput): Promise<void> {
  const name = input.name.trim();

  if (!input.brandId) {
    throw new Error("缺少品牌 ID。");
  }

  if (!name) {
    throw new Error("请填写品牌名称。");
  }

  assertBrandStatus(input.status);

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("brands")
      .update({
        name,
        english_name: normalizeOptionalText(input.englishName),
        logo_url: normalizeOptionalText(input.logoUrl),
        status: input.status,
        notes: normalizeOptionalText(input.notes)
      })
      .eq("id", input.brandId),
    "编辑品牌"
  );

  if (error) {
    throw formatSupabaseError("编辑品牌", error);
  }
}

export async function toggleBrandStatus(
  brandId: string,
  currentStatus: string
): Promise<BrandStatus> {
  if (!brandId) {
    throw new Error("缺少品牌 ID。");
  }

  const nextStatus: BrandStatus =
    currentStatus === "active" ? "inactive" : "active";
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("brands").update({ status: nextStatus }).eq("id", brandId),
    "启用或停用品牌"
  );

  if (error) {
    throw formatSupabaseError("启用或停用品牌", error);
  }

  return nextStatus;
}
