import { getSupabaseClient } from "@/lib/supabase/client";

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
  product_code: string;
  name: string;
  category: string | null;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
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
  const { data, error } = await withTimeout(
    supabase
      .from("products")
      .select("*")
      .order("product_code", { ascending: true }),
    "读取产品列表"
  );

  if (error) {
    throw formatSupabaseError("读取产品列表", error);
  }

  return (data ?? []) as Product[];
}

export async function getSkus(): Promise<Sku[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("skus")
      .select("*")
      .eq("sku_type", "finished_good")
      .order("sku_code", { ascending: true }),
    "读取成品 SKU 列表"
  );

  if (error) {
    throw formatSupabaseError("读取成品 SKU 列表", error);
  }

  return (data ?? []) as Sku[];
}

export async function getProductSkus(productId: string): Promise<Sku[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("skus")
      .select("*")
      .eq("product_id", productId)
      .eq("sku_type", "finished_good")
      .order("sku_code", { ascending: true }),
    "读取产品 SKU 列表"
  );

  if (error) {
    throw formatSupabaseError("读取产品 SKU 列表", error);
  }

  return (data ?? []) as Sku[];
}

export async function getMaterialSkus(): Promise<Sku[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("skus")
      .select("*")
      .eq("sku_type", "material")
      .order("sku_code", { ascending: true }),
    "读取原材料 SKU 列表"
  );

  if (error) {
    throw formatSupabaseError("读取原材料 SKU 列表", error);
  }

  return (data ?? []) as Sku[];
}

export async function getSuppliers(): Promise<Supplier[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("suppliers")
      .select("*")
      .order("supplier_code", { ascending: true }),
    "读取供应商列表"
  );

  if (error) {
    throw formatSupabaseError("读取供应商列表", error);
  }

  return (data ?? []) as Supplier[];
}

export async function getWarehouses(): Promise<Warehouse[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("warehouses")
      .select("*")
      .order("warehouse_code", { ascending: true }),
    "读取仓库列表"
  );

  if (error) {
    throw formatSupabaseError("读取仓库列表", error);
  }

  return (data ?? []) as Warehouse[];
}
