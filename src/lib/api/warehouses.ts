import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";
import type { ListPageParams, ListPageResult } from "@/lib/api/page-types";
import { normalizeRpcPage } from "@/lib/api/page-types";

export type WarehouseStatus = "active" | "inactive";

export type WarehouseRow = {
  id: string;
  warehouse_code: string;
  name: string;
  warehouse_type: string;
  address: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type WarehouseListRow = WarehouseRow & {
  inventory_sku_count: number;
  inventory_total_quantity: number;
};

export type WarehouseInventoryRow = {
  id: string;
  warehouse_id: string;
  sku_id: string;
  item_type: string;
  quantity_on_hand: number;
  unit: string;
  updated_at: string;
  sku: {
    id: string;
    sku_code: string;
    sku_name: string;
    sku_type: string;
    unit: string;
  } | null;
};

export type WarehouseStats = {
  totalWarehouses: number;
  materialWarehouses: number;
  finishedGoodWarehouses: number;
  fbaStagingWarehouses: number;
  warehousesWithInventory: number;
};

export type WarehousePageFilters = {
  warehouseType?: string;
  status?: string;
};

export type WarehousePageParams = ListPageParams<WarehousePageFilters>;

export type WarehousePageResult = ListPageResult<WarehouseListRow, WarehouseStats>;

export type CreateWarehouseInput = {
  warehouseCode: string;
  name: string;
  warehouseType: string;
  address?: string;
  status: WarehouseStatus;
};

export type UpdateWarehouseInput = {
  warehouseId: string;
  name: string;
  warehouseType: string;
  address?: string;
  status: WarehouseStatus;
};

type MaybeRelation<T> = T | T[] | null;

type InventoryItemSummary = {
  id: string;
  warehouse_id: string;
  sku_id: string;
  quantity_on_hand: number | string;
};

type RawWarehouseInventoryRow = Omit<WarehouseInventoryRow, "sku"> & {
  quantity_on_hand: number | string;
  sku: MaybeRelation<NonNullable<WarehouseInventoryRow["sku"]>>;
};

type WarehouseInventorySummary = {
  skuIds: Set<string>;
  totalQuantity: number;
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

function normalizeOptionalText(value?: string) {
  const normalized = value?.trim();

  return normalized ? normalized : null;
}

function assertWarehouseStatus(status: string): asserts status is WarehouseStatus {
  if (!["active", "inactive"].includes(status)) {
    throw new Error("仓库状态只能是 active 或 inactive。");
  }
}

async function ensureWarehouseCodeIsUnique(warehouseCode: string) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("warehouses")
      .select("id")
      .eq("warehouse_code", warehouseCode)
      .maybeSingle(),
    "检查仓库编码是否重复"
  );

  if (error) {
    throw formatSupabaseError("检查仓库编码是否重复", error);
  }

  if (data) {
    throw new Error("仓库编码已经存在，请换一个仓库编码。");
  }
}

function countInventoryByWarehouse(items: InventoryItemSummary[]) {
  const summaryByWarehouse = new Map<string, WarehouseInventorySummary>();

  items.forEach((item) => {
    const current =
      summaryByWarehouse.get(item.warehouse_id) ??
      ({
        skuIds: new Set<string>(),
        totalQuantity: 0
      } satisfies WarehouseInventorySummary);

    current.skuIds.add(item.sku_id);
    current.totalQuantity += Number(item.quantity_on_hand) || 0;
    summaryByWarehouse.set(item.warehouse_id, current);
  });

  return summaryByWarehouse;
}

function normalizeWarehouseInventoryRow(
  row: RawWarehouseInventoryRow
): WarehouseInventoryRow {
  return {
    ...row,
    quantity_on_hand: Number(row.quantity_on_hand) || 0,
    sku: singleRelation(row.sku)
  };
}

/**
 * @deprecated 主列表请使用 getWarehousesPage；下拉请使用 searchWarehouseOptions。
 * 保留原因：旧兼容入口，仍按批次读取避免 Supabase 1000 行截断，但不再作为主列表入口。
 */
export async function getWarehouses(): Promise<WarehouseListRow[]> {
  const supabase = getSupabaseClient();
  const [warehouseRows, inventoryRows] = await Promise.all([
    fetchAllSupabaseRows<WarehouseRow>(
      () =>
        supabase
        .from("warehouses")
        .select("*")
        .order("warehouse_code", { ascending: true }),
      "读取仓库列表"
    ),
    fetchAllSupabaseRows<InventoryItemSummary>(
      () =>
        supabase
        .from("inventory_items")
        .select("id, warehouse_id, sku_id, quantity_on_hand"),
      "统计仓库当前库存"
    )
  ]);

  const inventoryByWarehouse = countInventoryByWarehouse(inventoryRows);

  return warehouseRows.map((warehouse) => {
    const inventorySummary = inventoryByWarehouse.get(warehouse.id);

    return {
      ...warehouse,
      inventory_sku_count: inventorySummary?.skuIds.size ?? 0,
      inventory_total_quantity: inventorySummary?.totalQuantity ?? 0
    };
  });
}

const initialWarehouseStats: WarehouseStats = {
  totalWarehouses: 0,
  materialWarehouses: 0,
  finishedGoodWarehouses: 0,
  fbaStagingWarehouses: 0,
  warehousesWithInventory: 0
};

export async function getWarehousesPage(
  params: WarehousePageParams = {}
): Promise<WarehousePageResult> {
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.rpc("get_warehouses_page", {
      p_page: page,
      p_page_size: pageSize,
      p_keyword: params.keyword?.trim() || null,
      p_filters: params.filters ?? {},
      p_sort_by: params.sortBy ?? "warehouse_code",
      p_sort_direction: params.sortDirection ?? "asc"
    }),
    "读取仓库分页列表"
  );

  if (error) {
    throw formatSupabaseError("读取仓库分页列表", error);
  }

  return normalizeRpcPage<WarehouseListRow, WarehouseStats>(data, {
    page,
    pageSize,
    summary: initialWarehouseStats
  });
}

export async function searchWarehouseOptions(
  keyword = "",
  limit = 20,
  onlyActive = true
): Promise<WarehouseRow[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("warehouses")
    .select("id, warehouse_code, name, warehouse_type, address, status, created_at, updated_at")
    .order("warehouse_code", { ascending: true })
    .limit(limit);

  const normalizedKeyword = keyword.trim();

  if (normalizedKeyword) {
    query = query.or(
      [
        `warehouse_code.ilike.%${normalizedKeyword}%`,
        `name.ilike.%${normalizedKeyword}%`
      ].join(",")
    );
  }

  if (onlyActive) {
    query = query.eq("status", "active");
  }

  const { data, error } = await withTimeout(query, "搜索仓库下拉列表");

  if (error) {
    throw formatSupabaseError("搜索仓库下拉列表", error);
  }

  return (data ?? []) as WarehouseRow[];
}

export async function getWarehouseStats(): Promise<WarehouseStats> {
  const supabase = getSupabaseClient();
  const [
    totalResult,
    materialResult,
    finishedGoodResult,
    fbaResult,
    inventoryWarehouseResult
  ] = await Promise.all([
    withTimeout(
      supabase.from("warehouses").select("id", { count: "exact", head: true }),
      "统计仓库数量"
    ),
    withTimeout(
      supabase
        .from("warehouses")
        .select("id", { count: "exact", head: true })
        .eq("warehouse_type", "material"),
      "统计原材料仓数量"
    ),
    withTimeout(
      supabase
        .from("warehouses")
        .select("id", { count: "exact", head: true })
        .in("warehouse_type", ["finished_good", "finished_product"]),
      "统计成品仓数量"
    ),
    withTimeout(
      supabase
        .from("warehouses")
        .select("id", { count: "exact", head: true })
        .in("warehouse_type", ["fba", "fba_staging"]),
      "统计 FBA 仓数量"
    ),
    withTimeout(
      supabase
        .from("inventory_items")
        .select("warehouse_id")
        .gt("quantity_on_hand", 0),
      "统计有库存的仓库数量"
    )
  ]);

  if (totalResult.error) {
    throw formatSupabaseError("统计仓库数量", totalResult.error);
  }
  if (materialResult.error) {
    throw formatSupabaseError("统计原材料仓数量", materialResult.error);
  }
  if (finishedGoodResult.error) {
    throw formatSupabaseError("统计成品仓数量", finishedGoodResult.error);
  }
  if (fbaResult.error) {
    throw formatSupabaseError("统计 FBA 仓数量", fbaResult.error);
  }
  if (inventoryWarehouseResult.error) {
    throw formatSupabaseError("统计有库存的仓库数量", inventoryWarehouseResult.error);
  }

  const warehouseIdsWithInventory = new Set(
    ((inventoryWarehouseResult.data ?? []) as Array<{ warehouse_id: string | null }>)
      .map((row) => row.warehouse_id)
      .filter((warehouseId): warehouseId is string => Boolean(warehouseId))
  );

  return {
    totalWarehouses: totalResult.count ?? 0,
    materialWarehouses: materialResult.count ?? 0,
    finishedGoodWarehouses: finishedGoodResult.count ?? 0,
    fbaStagingWarehouses: fbaResult.count ?? 0,
    warehousesWithInventory: warehouseIdsWithInventory.size
  };
}

export async function createWarehouse(
  input: CreateWarehouseInput
): Promise<WarehouseRow> {
  const warehouseCode = input.warehouseCode.trim();
  const name = input.name.trim();
  const warehouseType = input.warehouseType.trim();

  if (!warehouseCode) {
    throw new Error("请填写仓库编码。");
  }

  if (!name) {
    throw new Error("请填写仓库名称。");
  }

  if (!warehouseType) {
    throw new Error("请选择仓库类型。");
  }

  assertWarehouseStatus(input.status);
  await ensureWarehouseCodeIsUnique(warehouseCode);

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase
      .from("warehouses")
      .insert({
        warehouse_code: warehouseCode,
        name,
        warehouse_type: warehouseType,
        address: normalizeOptionalText(input.address),
        status: input.status
      })
      .select("*")
      .single(),
    "新增仓库"
  );

  if (error) {
    throw formatSupabaseError("新增仓库", error);
  }

  return data as WarehouseRow;
}

export async function updateWarehouse(
  input: UpdateWarehouseInput
): Promise<void> {
  const name = input.name.trim();
  const warehouseType = input.warehouseType.trim();

  if (!input.warehouseId) {
    throw new Error("缺少仓库 ID。");
  }

  if (!name) {
    throw new Error("请填写仓库名称。");
  }

  if (!warehouseType) {
    throw new Error("请选择仓库类型。");
  }

  assertWarehouseStatus(input.status);

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("warehouses")
      .update({
        name,
        warehouse_type: warehouseType,
        address: normalizeOptionalText(input.address),
        status: input.status
      })
      .eq("id", input.warehouseId),
    "编辑仓库"
  );

  if (error) {
    throw formatSupabaseError("编辑仓库", error);
  }
}

export async function toggleWarehouseStatus(
  warehouseId: string,
  currentStatus: string
): Promise<WarehouseStatus> {
  if (!warehouseId) {
    throw new Error("缺少仓库 ID。");
  }

  const nextStatus: WarehouseStatus =
    currentStatus === "active" ? "inactive" : "active";
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase
      .from("warehouses")
      .update({ status: nextStatus })
      .eq("id", warehouseId),
    "启用或停用仓库"
  );

  if (error) {
    throw formatSupabaseError("启用或停用仓库", error);
  }

  return nextStatus;
}

export async function getWarehouseInventory(
  warehouseId: string
): Promise<WarehouseInventoryRow[]> {
  if (!warehouseId) {
    throw new Error("缺少仓库 ID。");
  }

  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<RawWarehouseInventoryRow>(
    () =>
      supabase
      .from("inventory_items")
      .select(
        `
          id,
          warehouse_id,
          sku_id,
          item_type,
          quantity_on_hand,
          unit,
          updated_at,
          sku:skus!inventory_items_sku_id_fkey (
            id,
            sku_code,
            sku_name,
            sku_type,
            unit
          )
        `
      )
      .eq("warehouse_id", warehouseId)
      .order("updated_at", { ascending: false }),
    "读取仓库库存"
  );

  return data
    .map(normalizeWarehouseInventoryRow)
    .sort((a, b) =>
      (a.sku?.sku_code ?? "").localeCompare(b.sku?.sku_code ?? "", "zh-CN")
    );
}
