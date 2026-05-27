import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import type { ListPageParams } from "@/lib/api/page-types";

export type SupplierStatus = "active" | "inactive";

export type SupplierRow = {
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

export type SupplierListRow = SupplierRow & {
  purchase_order_count: number;
  default_material_count: number;
};

export type SupplierPurchaseOrderRow = {
  id: string;
  purchase_order_no: string;
  supplier_id: string | null;
  status: string;
  ordered_at: string | null;
  expected_arrival_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type SupplierDefaultMaterialRow = {
  id: string;
  default_supplier_id: string | null;
  sku_code: string;
  sku_name: string;
  unit: string;
  specs: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type SupplierStats = {
  totalSuppliers: number;
  activeSuppliers: number;
  inactiveSuppliers: number;
  suppliersWithPurchaseOrders: number;
  suppliersWithDefaultMaterials: number;
};

export type SupplierListFilters = {
  status?: string;
};

export type SupplierPageResult = {
  rows: SupplierListRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type CreateSupplierInput = {
  supplierCode: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status: SupplierStatus;
};

export type UpdateSupplierInput = {
  supplierId: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  status: SupplierStatus;
};

type SupplierPurchaseOrderLink = {
  id: string;
  supplier_id: string | null;
};

type SupplierDefaultMaterialLink = {
  id: string;
  default_supplier_id: string | null;
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

function assertSupplierStatus(status: string): asserts status is SupplierStatus {
  if (!["active", "inactive"].includes(status)) {
    throw new Error("供应商状态只能是 active 或 inactive。");
  }
}

async function ensureSupplierCodeIsUnique(supplierCode: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("suppliers")
      .select("id")
      .eq("supplier_code", supplierCode)
      .maybeSingle(),
    "检查供应商编码是否重复"
  );

  if (error) {
    throw formatSupabaseError("检查供应商编码是否重复", error);
  }

  if (data) {
    throw new Error("供应商编码已经存在，请换一个供应商编码。");
  }
}

function countPurchaseOrdersBySupplier(purchaseOrders: SupplierPurchaseOrderLink[]) {
  const orderCountBySupplier = new Map<string, number>();

  purchaseOrders.forEach((purchaseOrder) => {
    if (!purchaseOrder.supplier_id) {
      return;
    }

    orderCountBySupplier.set(
      purchaseOrder.supplier_id,
      (orderCountBySupplier.get(purchaseOrder.supplier_id) ?? 0) + 1
    );
  });

  return orderCountBySupplier;
}

function countDefaultMaterialsBySupplier(materials: SupplierDefaultMaterialLink[]) {
  const materialCountBySupplier = new Map<string, number>();

  materials.forEach((material) => {
    if (!material.default_supplier_id) {
      return;
    }

    materialCountBySupplier.set(
      material.default_supplier_id,
      (materialCountBySupplier.get(material.default_supplier_id) ?? 0) + 1
    );
  });

  return materialCountBySupplier;
}

/**
 * @deprecated 主列表请使用 getSuppliersPage；下拉请使用 searchMaterialSupplierOptions 等远程搜索入口。
 * 保留原因：旧兼容入口，仍按批次读取避免 Supabase 1000 行截断，但不再作为主列表入口。
 */
export async function getSuppliers(): Promise<SupplierListRow[]> {
  const supabase = getSupabaseClient();
  const [supplierRows, purchaseOrderRows, defaultMaterialRows] =
    await Promise.all([
    fetchAllSupabaseRows<SupplierRow>(
      () =>
        supabase
        .from("suppliers")
        .select("*")
        .order("supplier_code", { ascending: true }),
      "读取供应商列表"
    ),
    fetchAllSupabaseRows<SupplierPurchaseOrderLink>(
      () => supabase.from("purchase_orders").select("id, supplier_id"),
      "统计供应商关联采购单数量"
    ),
    fetchAllSupabaseRows<SupplierDefaultMaterialLink>(
      () =>
        supabase
        .from("materials")
        .select("id, default_supplier_id")
        .not("default_supplier_id", "is", null),
      "统计供应商关联辅料数量"
    )
  ]);

  const orderCountBySupplier = countPurchaseOrdersBySupplier(purchaseOrderRows);
  const materialCountBySupplier = countDefaultMaterialsBySupplier(defaultMaterialRows);

  return supplierRows.map((supplier) => ({
    ...supplier,
    purchase_order_count: orderCountBySupplier.get(supplier.id) ?? 0,
    default_material_count: materialCountBySupplier.get(supplier.id) ?? 0
  }));
}

export async function getSuppliersPage(
  params: ListPageParams<SupplierListFilters> = {}
): Promise<SupplierPageResult> {
  const supabase = getSupabaseClient();
  const pageSize = Math.min(Math.max(params.pageSize ?? 20, 1), 100);
  const page = Math.max(params.page ?? 1, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const keyword = params.keyword?.trim() ?? "";
  const status = params.filters?.status;
  let query = supabase
    .from("suppliers")
    .select(
      "id, supplier_code, name, contact_name, phone, email, address, status, notes, created_at, updated_at",
      { count: "exact" }
    )
    .order(params.sortBy ?? "supplier_code", {
      ascending: params.sortDirection !== "desc"
    })
    .range(from, to);

  if (keyword) {
    const escapedKeyword = keyword.replace(/[%_,]/g, " ").trim();
    query = query.or(
      `supplier_code.ilike.%${escapedKeyword}%,name.ilike.%${escapedKeyword}%,contact_name.ilike.%${escapedKeyword}%`
    );
  }

  if (status && status !== "all") {
    query = query.eq("status", status);
  }

  const { data, error, count } = await withTimeout(query, "分页读取供应商列表");

  if (error) {
    throw formatSupabaseError("分页读取供应商列表", error);
  }

  const supplierRows = (data ?? []) as SupplierRow[];
  const supplierIds = supplierRows.map((supplier) => supplier.id);
  const [purchaseOrderRows, defaultMaterialRows] =
    supplierIds.length > 0
      ? await Promise.all([
          withTimeout(
            supabase
              .from("purchase_orders")
              .select("id, supplier_id")
              .in("supplier_id", supplierIds),
            "统计当前页供应商关联采购单数量"
          ),
          withTimeout(
            supabase
              .from("materials")
              .select("id, default_supplier_id")
              .in("default_supplier_id", supplierIds),
            "统计当前页供应商关联辅料数量"
          )
        ])
      : [
          { data: [], error: null },
          { data: [], error: null }
        ];

  if (purchaseOrderRows.error) {
    throw formatSupabaseError(
      "统计当前页供应商关联采购单数量",
      purchaseOrderRows.error
    );
  }

  if (defaultMaterialRows.error) {
    throw formatSupabaseError(
      "统计当前页供应商关联辅料数量",
      defaultMaterialRows.error
    );
  }

  const orderCountBySupplier = countPurchaseOrdersBySupplier(
    (purchaseOrderRows.data ?? []) as SupplierPurchaseOrderLink[]
  );
  const materialCountBySupplier = countDefaultMaterialsBySupplier(
    (defaultMaterialRows.data ?? []) as SupplierDefaultMaterialLink[]
  );
  const total = count ?? 0;

  return {
    rows: supplierRows.map((supplier) => ({
      ...supplier,
      purchase_order_count: orderCountBySupplier.get(supplier.id) ?? 0,
      default_material_count: materialCountBySupplier.get(supplier.id) ?? 0
    })),
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

export async function getSupplierStats(): Promise<SupplierStats> {
  const supabase = getSupabaseClient();
  const [
    totalResult,
    activeResult,
    inactiveResult,
    purchaseOrderRows,
    defaultMaterialRows
  ] =
    await Promise.all([
    withTimeout(
      supabase.from("suppliers").select("id", { count: "exact", head: true }),
      "统计供应商数量"
    ),
    withTimeout(
      supabase
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("status", "active"),
      "统计启用供应商数量"
    ),
    withTimeout(
      supabase
        .from("suppliers")
        .select("id", { count: "exact", head: true })
        .eq("status", "inactive"),
      "统计停用供应商数量"
    ),
    withTimeout(
      supabase
        .from("purchase_orders")
        .select("supplier_id")
        .not("supplier_id", "is", null),
      "统计已产生采购单的供应商数量"
    ),
    withTimeout(
      supabase
        .from("materials")
        .select("default_supplier_id")
        .not("default_supplier_id", "is", null),
      "统计已关联辅料的供应商数量"
    )
  ]);

  if (totalResult.error) {
    throw formatSupabaseError("统计供应商数量", totalResult.error);
  }
  if (activeResult.error) {
    throw formatSupabaseError("统计启用供应商数量", activeResult.error);
  }
  if (inactiveResult.error) {
    throw formatSupabaseError("统计停用供应商数量", inactiveResult.error);
  }
  if (purchaseOrderRows.error) {
    throw formatSupabaseError(
      "统计已产生采购单的供应商数量",
      purchaseOrderRows.error
    );
  }
  if (defaultMaterialRows.error) {
    throw formatSupabaseError(
      "统计已关联辅料的供应商数量",
      defaultMaterialRows.error
    );
  }

  const supplierIdsWithPurchaseOrders = new Set(
    ((purchaseOrderRows.data ?? []) as SupplierPurchaseOrderLink[])
      .map((purchaseOrder) => purchaseOrder.supplier_id)
      .filter((supplierId): supplierId is string => Boolean(supplierId))
  );
  const supplierIdsWithDefaultMaterials = new Set(
    ((defaultMaterialRows.data ?? []) as SupplierDefaultMaterialLink[])
      .map((material) => material.default_supplier_id)
      .filter((supplierId): supplierId is string => Boolean(supplierId))
  );

  return {
    totalSuppliers: totalResult.count ?? 0,
    activeSuppliers: activeResult.count ?? 0,
    inactiveSuppliers: inactiveResult.count ?? 0,
    suppliersWithPurchaseOrders: supplierIdsWithPurchaseOrders.size,
    suppliersWithDefaultMaterials: supplierIdsWithDefaultMaterials.size
  };
}

export async function createSupplier(
  input: CreateSupplierInput
): Promise<SupplierRow> {
  const supplierCode = input.supplierCode.trim();
  const name = input.name.trim();

  if (!supplierCode) {
    throw new Error("请填写供应商编码。");
  }

  if (!name) {
    throw new Error("请填写供应商名称。");
  }

  assertSupplierStatus(input.status);
  await ensureSupplierCodeIsUnique(supplierCode);

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("suppliers")
      .insert({
        supplier_code: supplierCode,
        name,
        contact_name: normalizeOptionalText(input.contactName),
        phone: normalizeOptionalText(input.phone),
        email: normalizeOptionalText(input.email),
        address: normalizeOptionalText(input.address),
        notes: normalizeOptionalText(input.notes),
        status: input.status
      })
      .select("*")
      .single(),
    "新增供应商"
  );

  if (error) {
    throw formatSupabaseError("新增供应商", error);
  }

  return data as SupplierRow;
}

export async function updateSupplier(input: UpdateSupplierInput): Promise<void> {
  const name = input.name.trim();

  if (!input.supplierId) {
    throw new Error("缺少供应商 ID。");
  }

  if (!name) {
    throw new Error("请填写供应商名称。");
  }

  assertSupplierStatus(input.status);

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("suppliers")
      .update({
        name,
        contact_name: normalizeOptionalText(input.contactName),
        phone: normalizeOptionalText(input.phone),
        email: normalizeOptionalText(input.email),
        address: normalizeOptionalText(input.address),
        notes: normalizeOptionalText(input.notes),
        status: input.status
      })
      .eq("id", input.supplierId),
    "编辑供应商"
  );

  if (error) {
    throw formatSupabaseError("编辑供应商", error);
  }
}

export async function toggleSupplierStatus(
  supplierId: string,
  currentStatus: string
): Promise<SupplierStatus> {
  if (!supplierId) {
    throw new Error("缺少供应商 ID。");
  }

  const nextStatus: SupplierStatus =
    currentStatus === "active" ? "inactive" : "active";
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("suppliers")
      .update({ status: nextStatus })
      .eq("id", supplierId),
    "启用或停用供应商"
  );

  if (error) {
    throw formatSupabaseError("启用或停用供应商", error);
  }

  return nextStatus;
}

export async function getSupplierPurchaseOrders(
  supplierId: string
): Promise<SupplierPurchaseOrderRow[]> {
  if (!supplierId) {
    throw new Error("缺少供应商 ID。");
  }

  const supabase = getSupabaseClient();
  return fetchAllSupabaseRows<SupplierPurchaseOrderRow>(
    () =>
      supabase
      .from("purchase_orders")
      .select(
        "id, purchase_order_no, supplier_id, status, ordered_at, expected_arrival_date, notes, created_at, updated_at"
      )
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false }),
    "读取供应商关联采购单"
  );
}

export async function getSupplierDefaultMaterials(
  supplierId: string
): Promise<SupplierDefaultMaterialRow[]> {
  if (!supplierId) {
    throw new Error("缺少供应商 ID。");
  }

  const supabase = getSupabaseClient();
  const rows = await fetchAllSupabaseRows<{
    id: string;
    default_supplier_id: string | null;
    material_code: string;
    material_name: string;
    unit: string;
    specs: string | null;
    status: string;
    created_at: string;
    updated_at: string;
  }>(
    () =>
      supabase
      .from("materials")
      .select(
        "id, default_supplier_id, material_code, material_name, unit, specs, status, created_at, updated_at"
      )
      .eq("default_supplier_id", supplierId)
      .order("material_code", { ascending: true }),
    "读取供应商关联辅料"
  );

  return rows.map((row) => ({
    id: row.id,
    default_supplier_id: row.default_supplier_id,
    sku_code: row.material_code,
    sku_name: row.material_name,
    unit: row.unit,
    specs: row.specs,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  }));
}
