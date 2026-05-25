import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";

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

export async function getWarehouseStats(): Promise<WarehouseStats> {
  const supabase = getSupabaseClient();
  const [warehouseRows, inventoryRows] = await Promise.all([
    fetchAllSupabaseRows<{ id: string; warehouse_type: string }>(
      () => supabase.from("warehouses").select("id, warehouse_type"),
      "统计仓库数量"
    ),
    fetchAllSupabaseRows<InventoryItemSummary>(
      () => supabase.from("inventory_items").select("id, warehouse_id, sku_id, quantity_on_hand"),
      "统计有库存的仓库数量"
    )
  ]);

  const inventoryByWarehouse = countInventoryByWarehouse(inventoryRows);

  return {
    totalWarehouses: warehouseRows.length,
    materialWarehouses: warehouseRows.filter(
      (warehouse) => warehouse.warehouse_type === "material"
    ).length,
    finishedGoodWarehouses: warehouseRows.filter((warehouse) =>
      ["finished_good", "finished_product"].includes(warehouse.warehouse_type)
    ).length,
    fbaStagingWarehouses: warehouseRows.filter((warehouse) =>
      ["fba", "fba_staging"].includes(warehouse.warehouse_type)
    ).length,
    warehousesWithInventory: [...inventoryByWarehouse.values()].filter(
      (summary) => summary.totalQuantity > 0
    ).length
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
