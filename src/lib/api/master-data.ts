import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import type { BrandSummary } from "@/lib/brand-utils";

export type Role = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export type Product = {
  id: string;
  brand_id: string | null;
  product_code: string;
  name: string;
  category: string | null;
  description: string | null;
  product_image_url?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  brand: BrandSummary | null;
};

export type Sku = {
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
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: string;
  supplier_code: string;
  name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type Warehouse = {
  id: string;
  warehouse_code: string;
  name: string;
  warehouse_type: string;
  address: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type MaybeRelation<T> = T | T[] | null;

type RawProduct = Omit<Product, "brand"> & {
  brand: MaybeRelation<BrandSummary>;
};

function formatSupabaseError(action: string, error: { message: string }) {
  return new Error(`${action}失败：${error.message}`);
}

async function withTimeout<T>(promise: PromiseLike<T>, action: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${action}超时：请检查 Supabase 地址、anon key、网络和 RLS 策略。`));
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

function normalizeProduct(row: RawProduct): Product {
  return {
    ...row,
    brand: singleRelation(row.brand)
  };
}

export async function getRoles(): Promise<Role[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("roles").select("*").order("code", { ascending: true }),
    "读取角色列表"
  );

  if (error) {
    throw formatSupabaseError("读取角色列表", error);
  }

  return (data ?? []) as Role[];
}

export async function getProducts(): Promise<Product[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawProduct>(
    () =>
      supabase
      .from("products")
      .select(
        `
          *,
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
      .order("product_code", { ascending: true }),
    "读取产品列表"
  );

  return data.map(normalizeProduct);
}

export async function getSkus(): Promise<Sku[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<Sku>(
    () =>
      supabase
      .from("skus")
      .select("*")
      .eq("sku_type", "finished_good")
      .order("sku_code", { ascending: true }),
    "读取成品 SKU 列表"
  );

  return data;
}

export async function getProductSkus(productId: string): Promise<Sku[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<Sku>(
    () =>
      supabase
      .from("skus")
      .select("*")
      .eq("product_id", productId)
      .eq("sku_type", "finished_good")
      .order("sku_code", { ascending: true }),
    "读取产品 SKU 列表"
  );

  return data;
}

export async function getMaterialSkus(): Promise<Sku[]> {
  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<Sku>(
    () =>
      supabase
      .from("skus")
      .select("*")
      .eq("sku_type", "material")
      .order("sku_code", { ascending: true }),
    "读取原材料 SKU 列表"
  );

  return data;
}

export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = getSupabaseClient();
  return fetchAllSupabaseRows<Supplier>(
    () =>
      supabase
      .from("suppliers")
      .select("*")
      .order("supplier_code", { ascending: true }),
    "读取供应商列表"
  );
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const supabase = getSupabaseClient();
  return fetchAllSupabaseRows<Warehouse>(
    () =>
      supabase
      .from("warehouses")
      .select("*")
      .order("warehouse_code", { ascending: true }),
    "读取仓库列表"
  );
}
