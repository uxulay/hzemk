import { getSupabaseClient } from "@/lib/supabase/client";

export type MaterialRequirementStatus =
  | "enough"
  | "shortage"
  | "purchased"
  | "received"
  | "ready"
  | "pending"
  | "reserved";

export type MaterialRequirementStatusFilter =
  | "all"
  | "enough"
  | "shortage"
  | "purchased"
  | "received";

export type MaterialRequirementRow = {
  id: string;
  production_order_id: string;
  replenishment_request_id: string | null;
  material_sku_id: string;
  required_quantity: number;
  available_quantity: number;
  shortage_quantity: number;
  reserved_quantity: number;
  unit: string;
  status: MaterialRequirementStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
  production_order: {
    id: string;
    production_order_no: string;
    sku_id: string;
    bom_header_id: string | null;
    planned_quantity: number;
    finished_sku: {
      id: string;
      sku_code: string;
      sku_name: string;
    } | null;
  } | null;
  material_sku: {
    id: string;
    sku_code: string;
    sku_name: string;
    unit: string;
  } | null;
  bom_item: {
    quantity_per: number;
    loss_rate: number;
    unit: string;
  } | null;
};

type MaybeRelation<T> = T | T[] | null;

type RawMaterialRequirementRow = Omit<
  MaterialRequirementRow,
  "production_order" | "material_sku" | "bom_item"
> & {
  production_order: MaybeRelation<
    Omit<NonNullable<MaterialRequirementRow["production_order"]>, "finished_sku"> & {
      finished_sku: MaybeRelation<
        NonNullable<
          NonNullable<MaterialRequirementRow["production_order"]>["finished_sku"]
        >
      >;
    }
  >;
  material_sku: MaybeRelation<NonNullable<MaterialRequirementRow["material_sku"]>>;
};

type BomItemLookupRow = {
  bom_header_id: string;
  component_sku_id: string;
  quantity_per: number;
  loss_rate: number;
  unit: string;
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

function uniqueValues(values: Array<string | null | undefined>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

function normalizeMaterialRequirement(
  row: RawMaterialRequirementRow,
  bomItemMap: Map<string, MaterialRequirementRow["bom_item"]>
): MaterialRequirementRow {
  const productionOrder = singleRelation(row.production_order);
  const materialSku = singleRelation(row.material_sku);
  const bomHeaderId = productionOrder?.bom_header_id ?? "";
  const bomItemKey = `${bomHeaderId}:${row.material_sku_id}`;

  return {
    ...row,
    production_order: productionOrder
      ? {
          ...productionOrder,
          finished_sku: singleRelation(productionOrder.finished_sku)
        }
      : null,
    material_sku: materialSku,
    bom_item: bomItemMap.get(bomItemKey) ?? null
  };
}

async function getBomItemMap(rows: RawMaterialRequirementRow[]) {
  const supabase = getSupabaseClient();
  const bomHeaderIds = uniqueValues(
    rows.map((row) => singleRelation(row.production_order)?.bom_header_id)
  );
  const materialSkuIds = uniqueValues(rows.map((row) => row.material_sku_id));
  const bomItemMap = new Map<string, MaterialRequirementRow["bom_item"]>();

  if (bomHeaderIds.length === 0 || materialSkuIds.length === 0) {
    return bomItemMap;
  }

  const { data, error } = await withTimeout(
    supabase
      .from("bom_items")
      .select("bom_header_id, component_sku_id, quantity_per, loss_rate, unit")
      .in("bom_header_id", bomHeaderIds)
      .in("component_sku_id", materialSkuIds),
    "读取物料需求对应的 BOM 明细"
  );

  if (error) {
    throw formatSupabaseError("读取物料需求对应的 BOM 明细", error);
  }

  for (const item of (data ?? []) as BomItemLookupRow[]) {
    bomItemMap.set(`${item.bom_header_id}:${item.component_sku_id}`, {
      quantity_per: item.quantity_per,
      loss_rate: item.loss_rate,
      unit: item.unit
    });
  }

  return bomItemMap;
}

export async function getMaterialRequirements(options: {
  status?: MaterialRequirementStatusFilter;
} = {}): Promise<MaterialRequirementRow[]> {
  const supabase = getSupabaseClient();
  let query = supabase
    .from("material_requirements")
    .select(
      `
        id,
        production_order_id,
        replenishment_request_id,
        material_sku_id,
        required_quantity,
        available_quantity,
        shortage_quantity,
        reserved_quantity,
        unit,
        status,
        notes,
        created_at,
        updated_at,
        production_order:production_orders!material_requirements_production_order_id_fkey (
          id,
          production_order_no,
          sku_id,
          bom_header_id,
          planned_quantity,
          finished_sku:skus!production_orders_sku_id_fkey (
            id,
            sku_code,
            sku_name
          )
        ),
        material_sku:skus!material_requirements_material_sku_id_fkey (
          id,
          sku_code,
          sku_name,
          unit
        )
      `
    )
    .order("created_at", { ascending: false });

  if (options.status === "enough") {
    query = query.in("status", ["enough", "ready"]);
  } else if (options.status && options.status !== "all") {
    query = query.eq("status", options.status);
  }

  const { data, error } = await withTimeout(query, "读取物料需求列表");

  if (error) {
    throw formatSupabaseError("读取物料需求列表", error);
  }

  const rows = (data ?? []) as unknown as RawMaterialRequirementRow[];
  const bomItemMap = await getBomItemMap(rows);

  return rows.map((row) => normalizeMaterialRequirement(row, bomItemMap));
}
