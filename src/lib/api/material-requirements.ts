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
  material_sku_id: string | null;
  material_id: string | null;
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
    specs: string | null;
    unit: string;
  } | null;
  material: {
    id: string;
    material_code: string;
    material_name: string;
    specs: string | null;
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
  "production_order" | "material_sku" | "material" | "bom_item"
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
  material: MaybeRelation<NonNullable<MaterialRequirementRow["material"]>>;
};

type BomItemLookupRow = {
  bom_header_id: string;
  component_sku_id: string | null;
  material_id: string | null;
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
  const material = singleRelation(row.material);
  const bomHeaderId = productionOrder?.bom_header_id ?? "";
  const materialBomItemKey = row.material_id
    ? `${bomHeaderId}:material:${row.material_id}`
    : "";
  const legacyBomItemKey = row.material_sku_id
    ? `${bomHeaderId}:sku:${row.material_sku_id}`
    : "";

  return {
    ...row,
    production_order: productionOrder
      ? {
          ...productionOrder,
          finished_sku: singleRelation(productionOrder.finished_sku)
        }
      : null,
    material_sku: materialSku,
    material,
    bom_item:
      bomItemMap.get(materialBomItemKey) ??
      bomItemMap.get(legacyBomItemKey) ??
      null
  };
}

async function getBomItemMap(rows: RawMaterialRequirementRow[]) {
  const supabase = getSupabaseClient();
  const bomHeaderIds = uniqueValues(
    rows.map((row) => singleRelation(row.production_order)?.bom_header_id)
  );
  const materialSkuIds = uniqueValues(rows.map((row) => row.material_sku_id));
  const materialIds = uniqueValues(rows.map((row) => row.material_id));
  const bomItemMap = new Map<string, MaterialRequirementRow["bom_item"]>();

  if (bomHeaderIds.length === 0) {
    return bomItemMap;
  }

  const { data, error } = await withTimeout(
    supabase
      .from("bom_items")
      .select(
        "bom_header_id, component_sku_id, material_id, quantity_per, loss_rate, unit"
      )
      .in("bom_header_id", bomHeaderIds),
    "读取物料需求对应的 BOM 明细"
  );

  if (error) {
    throw formatSupabaseError("读取物料需求对应的 BOM 明细", error);
  }

  for (const item of (data ?? []) as BomItemLookupRow[]) {
    const bomItem = {
      quantity_per: item.quantity_per,
      loss_rate: item.loss_rate,
      unit: item.unit
    };

    if (item.material_id && materialIds.includes(item.material_id)) {
      bomItemMap.set(`${item.bom_header_id}:material:${item.material_id}`, bomItem);
    }

    if (item.component_sku_id && materialSkuIds.includes(item.component_sku_id)) {
      bomItemMap.set(
        `${item.bom_header_id}:sku:${item.component_sku_id}`,
        bomItem
      );
    }
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
        material_id,
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
          specs,
          unit
        ),
        material:materials!material_requirements_material_id_fkey (
          id,
          material_code,
          material_name,
          specs,
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
