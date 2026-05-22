import { getSupabaseClient } from "@/lib/supabase/client";

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

export type SupplierStats = {
  totalSuppliers: number;
  activeSuppliers: number;
  inactiveSuppliers: number;
  suppliersWithPurchaseOrders: number;
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

export async function getSuppliers(): Promise<SupplierListRow[]> {
  const supabase = getSupabaseClient();
  const [supplierResult, purchaseOrderResult] = await Promise.all([
    withTimeout(
      supabase
        .from("suppliers")
        .select("*")
        .order("supplier_code", { ascending: true }),
      "读取供应商列表"
    ),
    withTimeout(
      supabase.from("purchase_orders").select("id, supplier_id"),
      "统计供应商关联采购单数量"
    )
  ]);

  if (supplierResult.error) {
    throw formatSupabaseError("读取供应商列表", supplierResult.error);
  }

  if (purchaseOrderResult.error) {
    throw formatSupabaseError(
      "统计供应商关联采购单数量",
      purchaseOrderResult.error
    );
  }

  const orderCountBySupplier = countPurchaseOrdersBySupplier(
    (purchaseOrderResult.data ?? []) as SupplierPurchaseOrderLink[]
  );

  return ((supplierResult.data ?? []) as SupplierRow[]).map((supplier) => ({
    ...supplier,
    purchase_order_count: orderCountBySupplier.get(supplier.id) ?? 0
  }));
}

export async function getSupplierStats(): Promise<SupplierStats> {
  const supabase = getSupabaseClient();
  const [supplierResult, purchaseOrderResult] = await Promise.all([
    withTimeout(
      supabase.from("suppliers").select("id, status"),
      "统计供应商数量"
    ),
    withTimeout(
      supabase.from("purchase_orders").select("id, supplier_id"),
      "统计已产生采购单的供应商数量"
    )
  ]);

  if (supplierResult.error) {
    throw formatSupabaseError("统计供应商数量", supplierResult.error);
  }

  if (purchaseOrderResult.error) {
    throw formatSupabaseError(
      "统计已产生采购单的供应商数量",
      purchaseOrderResult.error
    );
  }

  const suppliers = (supplierResult.data ?? []) as Array<{
    id: string;
    status: string;
  }>;
  const supplierIdsWithPurchaseOrders = new Set(
    ((purchaseOrderResult.data ?? []) as SupplierPurchaseOrderLink[])
      .map((purchaseOrder) => purchaseOrder.supplier_id)
      .filter((supplierId): supplierId is string => Boolean(supplierId))
  );

  return {
    totalSuppliers: suppliers.length,
    activeSuppliers: suppliers.filter((supplier) => supplier.status === "active")
      .length,
    inactiveSuppliers: suppliers.filter(
      (supplier) => supplier.status === "inactive"
    ).length,
    suppliersWithPurchaseOrders: supplierIdsWithPurchaseOrders.size
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
  const { data, error } = await withTimeout(
    supabase
      .from("purchase_orders")
      .select(
        "id, purchase_order_no, supplier_id, status, ordered_at, expected_arrival_date, notes, created_at, updated_at"
      )
      .eq("supplier_id", supplierId)
      .order("created_at", { ascending: false }),
    "读取供应商关联采购单"
  );

  if (error) {
    throw formatSupabaseError("读取供应商关联采购单", error);
  }

  return (data ?? []) as SupplierPurchaseOrderRow[];
}
