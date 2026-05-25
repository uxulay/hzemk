import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";

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

export async function getBrandOptions(): Promise<BrandRow[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("brands").select("*").order("brand_code", { ascending: true }),
    "读取品牌下拉列表"
  );

  if (error) {
    throw formatSupabaseError("读取品牌下拉列表", error);
  }

  return (data ?? []) as BrandRow[];
}

export async function getBrandStats(): Promise<BrandStats> {
  const supabase = getSupabaseClient();
  const [brandRows, productRows] = await Promise.all([
    fetchAllSupabaseRows<{ id: string; status: string }>(
      () => supabase.from("brands").select("id, status"),
      "统计品牌数量"
    ),
    fetchAllSupabaseRows<ProductBrandLink>(
      () => supabase.from("products").select("id, brand_id").not("brand_id", "is", null),
      "统计已绑定品牌产品数量"
    )
  ]);

  return {
    totalBrands: brandRows.length,
    activeBrands: brandRows.filter((brand) => brand.status === "active").length,
    inactiveBrands: brandRows.filter((brand) => brand.status === "inactive").length,
    totalLinkedProducts: productRows.length
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
