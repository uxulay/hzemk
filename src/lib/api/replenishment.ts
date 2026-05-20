import { getSupabaseClient } from "@/lib/supabase/client";

export type FbaRequestStatus =
  | "draft"
  | "submitted"
  | "accepted"
  | "rejected"
  | "in_production"
  | "completed"
  | "shipped";

export type FbaRequestPriority = "low" | "normal" | "high" | "urgent";

export type CreateFbaReplenishmentInput = {
  skuId: string;
  targetWarehouseId: string;
  fbaWarehouseCode?: string;
  requestedQuantity: number;
  targetShipDate: string;
  priority: string;
  amazonSite: string;
  notes?: string;
};

export type CreatedFbaReplenishment = {
  id: string;
  request_no: string;
};

export type FbaReplenishmentRequest = {
  id: string;
  request_no: string;
  requested_by: string | null;
  sku_id: string;
  target_warehouse_id: string | null;
  fba_warehouse_code: string | null;
  requested_quantity: number;
  target_ship_date: string | null;
  priority: FbaRequestPriority;
  status: FbaRequestStatus;
  accepted_by: string | null;
  accepted_at: string | null;
  rejected_reason: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  sku: {
    id: string;
    product_id: string | null;
    sku_code: string;
    sku_name: string;
    amazon_sku: string | null;
    fnsku: string | null;
    product: {
      id: string;
      product_code: string;
      name: string;
    } | null;
  } | null;
  target_warehouse: {
    id: string;
    warehouse_code: string;
    name: string;
    warehouse_type: string;
  } | null;
  requested_by_profile: {
    id: string;
    full_name: string;
    email: string;
  } | null;
};

export type GetFbaReplenishmentRequestsOptions = {
  status?: FbaRequestStatus | "all";
};

type MaybeRelation<T> = T | T[] | null;

type RawFbaReplenishmentRequest = Omit<
  FbaReplenishmentRequest,
  "sku" | "target_warehouse" | "requested_by_profile"
> & {
  sku: MaybeRelation<
    Omit<NonNullable<FbaReplenishmentRequest["sku"]>, "product"> & {
      product: MaybeRelation<
        NonNullable<NonNullable<FbaReplenishmentRequest["sku"]>["product"]>
      >;
    }
  >;
  target_warehouse: MaybeRelation<
    NonNullable<FbaReplenishmentRequest["target_warehouse"]>
  >;
  requested_by_profile: MaybeRelation<
    NonNullable<FbaReplenishmentRequest["requested_by_profile"]>
  >;
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

function createRequestNo() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("");
  const timePart = [
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds())
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `FBA-RQ-${datePart}-${timePart}-${randomPart}`;
}

function buildNotes(amazonSite: string, notes?: string) {
  const cleanNotes = notes?.trim();

  if (!cleanNotes) {
    return `亚马逊站点：${amazonSite}`;
  }

  return `亚马逊站点：${amazonSite}\n备注：${cleanNotes}`;
}

function singleRelation<T>(value: MaybeRelation<T>): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function normalizeFbaReplenishmentRequest(
  request: RawFbaReplenishmentRequest
): FbaReplenishmentRequest {
  const sku = singleRelation(request.sku);
  const product = singleRelation(sku?.product ?? null);

  return {
    ...request,
    sku: sku
      ? {
          ...sku,
          product
        }
      : null,
    target_warehouse: singleRelation(request.target_warehouse),
    requested_by_profile: singleRelation(request.requested_by_profile)
  };
}

export async function createFbaReplenishmentRequest(
  input: CreateFbaReplenishmentInput
): Promise<CreatedFbaReplenishment> {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("fba_replenishment_requests")
      .insert({
        request_no: createRequestNo(),
        requested_by: null,
        sku_id: input.skuId,
        target_warehouse_id: input.targetWarehouseId,
        fba_warehouse_code: input.fbaWarehouseCode?.trim() || null,
        requested_quantity: input.requestedQuantity,
        target_ship_date: input.targetShipDate,
        priority: input.priority,
        status: "submitted",
        accepted_by: null,
        accepted_at: null,
        rejected_reason: null,
        notes: buildNotes(input.amazonSite, input.notes)
      })
      .select("id, request_no")
      .single(),
    "创建 FBA 备货需求"
  );

  if (error) {
    throw formatSupabaseError("创建 FBA 备货需求", error);
  }

  return data as CreatedFbaReplenishment;
}

export async function getFbaReplenishmentRequests(
  options: GetFbaReplenishmentRequestsOptions = {}
): Promise<FbaReplenishmentRequest[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("fba_replenishment_requests")
    .select(
      `
        id,
        request_no,
        requested_by,
        sku_id,
        target_warehouse_id,
        fba_warehouse_code,
        requested_quantity,
        target_ship_date,
        priority,
        status,
        accepted_by,
        accepted_at,
        rejected_reason,
        notes,
        created_at,
        updated_at,
        sku:skus!fba_replenishment_requests_sku_id_fkey (
          id,
          product_id,
          sku_code,
          sku_name,
          amazon_sku,
          fnsku,
          product:products!skus_product_id_fkey (
            id,
            product_code,
            name
          )
        ),
        target_warehouse:warehouses!fba_replenishment_requests_target_warehouse_id_fkey (
          id,
          warehouse_code,
          name,
          warehouse_type
        ),
        requested_by_profile:profiles!fba_replenishment_requests_requested_by_fkey (
          id,
          full_name,
          email
        )
      `
    )
    .order("created_at", { ascending: false });

  if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  const { data, error } = await withTimeout(query, "读取 FBA 备货需求列表");

  if (error) {
    throw formatSupabaseError("读取 FBA 备货需求列表", error);
  }

  const rows = (data ?? []) as unknown as RawFbaReplenishmentRequest[];

  return rows.map(normalizeFbaReplenishmentRequest);
}
