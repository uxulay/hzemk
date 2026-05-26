import type {
  BulkActionResult,
  BulkImportResult,
  BulkImportValidationRow,
  CsvDataRow
} from "@/lib/bulk-types";
import { normalizeCsvValue } from "@/lib/utils/csv";
import { getSupabaseClient } from "@/lib/supabase/client";
import { fetchAllSupabaseRows } from "@/lib/supabase/pagination";

type Status = "active" | "inactive";

export type BrandImportInput = {
  rowNumber: number;
  brandCode: string;
  name: string;
  englishName: string | null;
  logoUrl: string | null;
  status: Status;
  notes: string | null;
};

export type ProductImportInput = {
  rowNumber: number;
  productCode: string;
  name: string;
  brandId: string | null;
  brandText: string | null;
  category: string | null;
  description: string | null;
  imageUrl: string | null;
  status: Status;
};

export type SkuImportInput = {
  rowNumber: number;
  skuCode: string;
  skuName: string;
  skuType: "finished_good" | "semi_finished";
  productId: string | null;
  productCode: string | null;
  unit: string;
  specs: string | null;
  status: Status;
};

export type SupplierImportInput = {
  rowNumber: number;
  supplierCode: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  status: Status;
};

export type WarehouseImportInput = {
  rowNumber: number;
  warehouseCode: string;
  name: string;
  warehouseType: string;
  address: string | null;
  status: Status;
};

export type BomImportInput = {
  rowNumber: number;
  finishedSkuCode: string;
  bomVersion: string;
  materialCode: string;
  quantityPer: number;
  lossRate: number;
  notes: string | null;
  status: Status;
  productSkuId: string;
  materialId: string;
  componentUnit: string;
  groupKey: string;
  existingBomHeaderId: string | null;
  willCreateHeader: boolean;
};

type CodeRow = {
  id: string;
  [key: string]: string;
};

type BrandMinimal = {
  id: string;
  brand_code: string;
  name: string;
  status?: string;
};

type ProductMinimal = {
  id: string;
  brand_id?: string | null;
  product_code: string;
  name: string;
  status?: string;
};

type SkuMinimal = {
  id: string;
  sku_code: string;
  sku_name: string;
  sku_type: string;
  unit: string;
  status?: string;
};

type SupplierMinimal = {
  id: string;
  supplier_code: string;
  name: string;
  status?: string;
};

type WarehouseMinimal = {
  id: string;
  warehouse_code: string;
  name: string;
  status?: string;
};

type BomHeaderMinimal = {
  id: string;
  product_sku_id: string;
  bom_code: string;
  version: string;
  status: Status;
};

type BomItemMinimal = {
  id: string;
  bom_header_id: string;
  material_id: string | null;
};

type MaterialMinimal = {
  id: string;
  material_code: string;
  material_name: string;
  unit: string;
  status?: string;
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

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = normalizeCsvValue(value);

  return normalized ? normalized : null;
}

function getCsvValue(row: CsvDataRow, keys: string[]) {
  for (const key of keys) {
    const value = normalizeCsvValue(row[key]);

    if (value) {
      return value;
    }
  }

  return "";
}

function normalizeLookupKey(value: string | null | undefined) {
  return normalizeCsvValue(value).toLowerCase();
}

function normalizeStatus(value: string | undefined): Status {
  const normalized = normalizeCsvValue(value).toLowerCase();

  return normalized === "inactive" ? "inactive" : "active";
}

function validateStatus(value: string | undefined, errors: string[]) {
  const normalized = normalizeCsvValue(value).toLowerCase();

  if (normalized && !["active", "inactive"].includes(normalized)) {
    errors.push("状态只能填写 active 或 inactive。");
  }
}

function getDuplicateSet(values: string[]) {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    if (!value) {
      return;
    }

    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return new Set(
    [...counts.entries()]
      .filter(([, count]) => count > 1)
      .map(([value]) => value)
  );
}

async function getExistingCodeSet(
  table: string,
  codeColumn: string,
  codes?: string[]
) {
  const uniqueCodes = Array.from(
    new Set(
      (codes ?? [])
        .map((code) => normalizeCsvValue(code))
        .filter(Boolean)
    )
  );

  if (codes && uniqueCodes.length === 0) {
    return new Set<string>();
  }

  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    (() => {
      let query = supabase.from(table).select(`id, ${codeColumn}`);

      if (codes) {
        query = query.in(codeColumn, uniqueCodes);
      }

      return query;
    })(),
    `读取 ${table} 编码`
  );

  if (error) {
    throw formatSupabaseError(`读取 ${table} 编码`, error);
  }

  return new Set(
    ((data ?? []) as unknown as CodeRow[]).map((row) =>
      normalizeCsvValue(row[codeColumn]).toLowerCase()
    )
  );
}

async function getRowsByIds<TRow>(table: string, columns: string, ids: string[]) {
  if (ids.length === 0) {
    return [];
  }

  const supabase = getSupabaseClient();
  const data = await fetchAllSupabaseRows<TRow>(
    () => supabase.from(table).select(columns).in("id", ids),
    `读取 ${table} 数据`
  );

  return data;
}

async function getBrandsForImport() {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from("brands").select("id, brand_code, name, status"),
    "读取品牌资料"
  );

  if (error) {
    throw formatSupabaseError("读取品牌资料", error);
  }

  return (data ?? []) as BrandMinimal[];
}

async function hasReference(
  table: string,
  column: string,
  value: string,
  action: string
) {
  const supabase = getSupabaseClient();
  const { data, error } = await withTimeout(
    supabase.from(table).select("id").eq(column, value).limit(1),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }

  return (data ?? []).length > 0;
}

async function deleteRow(table: string, id: string, action: string) {
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from(table).delete().eq("id", id),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }
}

async function deactivateRow(table: string, id: string, action: string) {
  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from(table).update({ status: "inactive" }).eq("id", id),
    action
  );

  if (error) {
    throw formatSupabaseError(action, error);
  }
}

function actionSuccess(
  id: string,
  label: string,
  action: "deleted" | "deactivated",
  message: string
): BulkActionResult {
  return {
    id,
    label,
    success: true,
    action,
    message
  };
}

function actionBlocked(
  id: string,
  label: string,
  message: string
): BulkActionResult {
  return {
    id,
    label,
    success: false,
    action: "blocked",
    message
  };
}

function actionFailed(id: string, label: string, message: string): BulkActionResult {
  return {
    id,
    label,
    success: false,
    action: "blocked",
    message
  };
}

export async function validateBrandImportRows(
  rows: CsvDataRow[]
): Promise<BulkImportValidationRow<BrandImportInput>[]> {
  const fileCodes = rows.map((row) =>
    normalizeLookupKey(getCsvValue(row, ["brand_code", "品牌编码"]))
  );
  const existingCodes = await getExistingCodeSet("brands", "brand_code", fileCodes);
  const duplicatedCodes = getDuplicateSet(fileCodes);

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const brandCode = getCsvValue(row, ["brand_code", "品牌编码"]);
    const name = getCsvValue(row, ["name", "brand_name", "品牌名称"]);
    const englishName = normalizeOptionalText(
      getCsvValue(row, ["english_name", "英文名称"])
    );
    const logoUrl = normalizeOptionalText(
      getCsvValue(row, ["logo_url", "Logo URL", "logo url"])
    );
    const notes = normalizeOptionalText(getCsvValue(row, ["remark", "notes", "备注"]));
    const statusText = getCsvValue(row, ["status", "状态"]);
    const errors: string[] = [];
    const codeKey = brandCode.toLowerCase();

    if (!brandCode) {
      errors.push("品牌编码必填。");
    }

    if (!name) {
      errors.push("品牌名称必填。");
    }

    validateStatus(statusText, errors);

    if (codeKey && existingCodes.has(codeKey)) {
      errors.push("品牌编码已经存在。");
    }

    if (codeKey && duplicatedCodes.has(codeKey)) {
      errors.push("同一个 CSV 文件内品牌编码重复。");
    }

    return {
      rowNumber,
      rawRow: row,
      data:
        errors.length === 0
          ? {
              rowNumber,
              brandCode,
              name,
              englishName,
              logoUrl,
              status: normalizeStatus(statusText),
              notes
            }
          : undefined,
      errors
    };
  });
}

export async function bulkImportBrands(
  inputs: BrandImportInput[]
): Promise<BulkImportResult> {
  if (inputs.length === 0) {
    return {
      successCount: 0,
      failedCount: 0,
      errors: []
    };
  }

  const existingCodes = await getExistingCodeSet(
    "brands",
    "brand_code",
    inputs.map((input) => input.brandCode)
  );
  const conflicts = inputs.filter((input) =>
    existingCodes.has(input.brandCode.toLowerCase())
  );

  if (conflicts.length > 0) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: conflicts.map((input) => ({
        rowNumber: input.rowNumber,
        label: input.brandCode,
        message: "品牌编码已经存在，请重新下载最新数据后再导入。"
      }))
    };
  }

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("brands").insert(
      inputs.map((input) => ({
        brand_code: input.brandCode,
        name: input.name,
        english_name: input.englishName,
        logo_url: input.logoUrl,
        status: input.status,
        notes: input.notes
      }))
    ),
    "批量导入品牌"
  );

  if (error) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: [
        {
          message: formatSupabaseError("批量导入品牌", error).message
        }
      ]
    };
  }

  return {
    successCount: inputs.length,
    failedCount: 0,
    errors: []
  };
}

export async function validateProductImportRows(
  rows: CsvDataRow[]
): Promise<BulkImportValidationRow<ProductImportInput>[]> {
  const productCodes = rows.map((row) =>
    normalizeCsvValue(row.spu || row.product_code)
  );
  const [existingCodes, brands] = await Promise.all([
    getExistingCodeSet("products", "product_code", productCodes),
    getBrandsForImport()
  ]);
  const seenCodes = new Set<string>();
  const brandByCode = new Map(
    brands.map((brand) => [normalizeLookupKey(brand.brand_code), brand])
  );
  const brandByName = new Map(
    brands.map((brand) => [normalizeLookupKey(brand.name), brand])
  );

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const productCode = normalizeCsvValue(row.spu || row.product_code);
    const name = normalizeCsvValue(row.name || row.product_name);
    const brandText =
      getCsvValue(row, [
        "brand",
        "brand_code",
        "brand_name",
        "品牌",
        "品牌编码",
        "品牌名称"
      ]) || null;
    const brand = brandText
      ? brandByCode.get(normalizeLookupKey(brandText)) ??
        brandByName.get(normalizeLookupKey(brandText)) ??
        null
      : null;
    const category = normalizeOptionalText(row.category);
    const description = normalizeOptionalText(row.remark || row.description);
    const imageUrl = normalizeOptionalText(row.image_url || row.product_image_url);
    const errors: string[] = [];

    if (!productCode) {
      errors.push("SPU 必填。");
    }

    if (!name) {
      errors.push("产品名称必填。");
    }

    validateStatus(row.status, errors);

    if (brandText && !brand) {
      errors.push("填写的品牌不存在，请先到品牌管理维护品牌。");
    }

    const codeKey = productCode.toLowerCase();
    const isExistingCode = Boolean(codeKey && existingCodes.has(codeKey));
    const isDuplicateInFile = Boolean(codeKey && seenCodes.has(codeKey));

    if (codeKey) {
      seenCodes.add(codeKey);
    }

    return {
      rowNumber,
      rawRow: row,
      data:
        errors.length === 0 && !isExistingCode && !isDuplicateInFile
          ? {
              rowNumber,
              productCode,
              name,
              brandId: brand?.id ?? null,
              brandText,
              category,
              description,
              imageUrl,
              status: normalizeStatus(row.status)
            }
          : undefined,
      errors,
      notes: [
        isExistingCode ? "SPU 已存在，本行默认跳过，不重复创建。" : "",
        isDuplicateInFile ? "同一个 CSV 文件内 SPU 重复，本行默认跳过。" : ""
      ].filter(Boolean)
    };
  });
}

export async function bulkImportProducts(
  inputs: ProductImportInput[]
): Promise<BulkImportResult> {
  if (inputs.length === 0) {
    return {
      successCount: 0,
      failedCount: 0,
      errors: []
    };
  }

  const existingCodes = await getExistingCodeSet(
    "products",
    "product_code",
    inputs.map((input) => input.productCode)
  );
  const conflicts = inputs.filter((input) =>
    existingCodes.has(input.productCode.toLowerCase())
  );

  if (conflicts.length > 0) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: conflicts.map((input) => ({
        rowNumber: input.rowNumber,
        label: input.productCode,
        message: "产品编码已经存在，请重新下载最新数据后再导入。"
      }))
    };
  }

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("products").insert(
      inputs.map((input) => ({
        product_code: input.productCode,
        name: input.name,
        brand_id: input.brandId,
        category: input.category,
        description: input.description,
        product_image_url: input.imageUrl,
        status: input.status
      }))
    ),
    "批量导入产品"
  );

  if (error) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: [
        {
          message: formatSupabaseError("批量导入产品", error).message
        }
      ]
    };
  }

  return {
    successCount: inputs.length,
    failedCount: 0,
    errors: []
  };
}

export async function validateSkuImportRows(
  rows: CsvDataRow[]
): Promise<BulkImportValidationRow<SkuImportInput>[]> {
  const supabase = getSupabaseClient();
  const skuCodes = rows.map((row) => normalizeCsvValue(row.sku_code));
  const productCodes = Array.from(
    new Set(rows.map((row) => normalizeCsvValue(row.product_code)).filter(Boolean))
  );
  const [existingSkuCodes, productRows] = await Promise.all([
    getExistingCodeSet("skus", "sku_code", skuCodes),
    withTimeout(
      productCodes.length > 0
        ? supabase
            .from("products")
            .select("id, product_code, name, status")
            .in("product_code", productCodes)
        : Promise.resolve({ data: [], error: null } as any),
      "读取产品编码"
    )
  ]);

  if (productRows.error) {
    throw formatSupabaseError("读取产品编码", productRows.error);
  }

  const productByCode = new Map(
    ((productRows.data ?? []) as ProductMinimal[]).map((product) => [
      product.product_code.toLowerCase(),
      product
    ])
  );
  const fileCodes = rows.map((row) =>
    normalizeCsvValue(row.sku_code).toLowerCase()
  );
  const duplicatedCodes = getDuplicateSet(fileCodes);

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const skuCode = normalizeCsvValue(row.sku_code);
    const skuName = normalizeCsvValue(row.sku_name || row.name);
    const skuType = normalizeCsvValue(row.sku_type).toLowerCase();
    const productCode = normalizeOptionalText(row.product_code);
    const unit = normalizeCsvValue(row.unit) || "pcs";
    const specs = normalizeOptionalText(row.remark || row.specs);
    const errors: string[] = [];

    if (!skuCode) {
      errors.push("SKU 编码必填。");
    }

    if (!skuName) {
      errors.push("SKU 名称必填。");
    }

    if (!["finished_good", "semi_finished"].includes(skuType)) {
      errors.push("SKU 类型只能是 finished_good 或 semi_finished。辅料请到“辅料管理”导入。");
    }

    if (skuType === "finished_good" && !productCode) {
      errors.push("成品 SKU 必须填写所属产品编码 product_code。");
    }

    validateStatus(row.status, errors);

    const skuCodeKey = skuCode.toLowerCase();

    if (skuCodeKey && existingSkuCodes.has(skuCodeKey)) {
      errors.push("SKU 编码已经存在。");
    }

    if (skuCodeKey && duplicatedCodes.has(skuCodeKey)) {
      errors.push("同一个 CSV 文件内 SKU 编码重复。");
    }

    const product = productCode
      ? productByCode.get(productCode.toLowerCase())
      : null;

    if (productCode && !product) {
      errors.push("填写的产品编码不存在。");
    }

    return {
      rowNumber,
      rawRow: row,
      data:
        errors.length === 0
          ? {
              rowNumber,
              skuCode,
              skuName,
              skuType: skuType as "finished_good" | "semi_finished",
              productId: product?.id ?? null,
              productCode,
              unit,
              specs,
              status: normalizeStatus(row.status)
            }
          : undefined,
      errors
    };
  });
}

export async function bulkImportSkus(
  inputs: SkuImportInput[]
): Promise<BulkImportResult> {
  if (inputs.length === 0) {
    return {
      successCount: 0,
      failedCount: 0,
      errors: []
    };
  }

  const existingCodes = await getExistingCodeSet(
    "skus",
    "sku_code",
    inputs.map((input) => input.skuCode)
  );
  const conflicts = inputs.filter((input) =>
    existingCodes.has(input.skuCode.toLowerCase())
  );

  if (conflicts.length > 0) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: conflicts.map((input) => ({
        rowNumber: input.rowNumber,
        label: input.skuCode,
        message: "SKU 编码已经存在，请重新下载最新数据后再导入。"
      }))
    };
  }

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("skus").insert(
      inputs.map((input) => ({
        product_id: input.productId,
        sku_code: input.skuCode,
        sku_name: input.skuName,
        sku_type: input.skuType,
        unit: input.unit,
        specs: input.specs,
        status: input.status
      }))
    ),
    "批量导入 SKU"
  );

  if (error) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: [
        {
          message: formatSupabaseError("批量导入 SKU", error).message
        }
      ]
    };
  }

  return {
    successCount: inputs.length,
    failedCount: 0,
    errors: []
  };
}

export async function validateSupplierImportRows(
  rows: CsvDataRow[]
): Promise<BulkImportValidationRow<SupplierImportInput>[]> {
  const fileCodes = rows.map((row) =>
    normalizeCsvValue(row.supplier_code).toLowerCase()
  );
  const existingCodes = await getExistingCodeSet(
    "suppliers",
    "supplier_code",
    fileCodes
  );
  const duplicatedCodes = getDuplicateSet(fileCodes);
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const supplierCode = normalizeCsvValue(row.supplier_code);
    const name = normalizeCsvValue(row.supplier_name || row.name);
    const email = normalizeOptionalText(row.email);
    const errors: string[] = [];

    if (!supplierCode) {
      errors.push("供应商编码必填。");
    }

    if (!name) {
      errors.push("供应商名称必填。");
    }

    if (email && !emailRegex.test(email)) {
      errors.push("邮箱格式不正确。");
    }

    validateStatus(row.status, errors);

    const codeKey = supplierCode.toLowerCase();

    if (codeKey && existingCodes.has(codeKey)) {
      errors.push("供应商编码已经存在。");
    }

    if (codeKey && duplicatedCodes.has(codeKey)) {
      errors.push("同一个 CSV 文件内供应商编码重复。");
    }

    return {
      rowNumber,
      rawRow: row,
      data:
        errors.length === 0
          ? {
              rowNumber,
              supplierCode,
              name,
              contactName: normalizeOptionalText(row.contact_name),
              phone: normalizeOptionalText(row.phone),
              email,
              address: normalizeOptionalText(row.address),
              notes: normalizeOptionalText(row.remark || row.notes),
              status: normalizeStatus(row.status)
            }
          : undefined,
      errors
    };
  });
}

export async function bulkImportSuppliers(
  inputs: SupplierImportInput[]
): Promise<BulkImportResult> {
  if (inputs.length === 0) {
    return {
      successCount: 0,
      failedCount: 0,
      errors: []
    };
  }

  const existingCodes = await getExistingCodeSet(
    "suppliers",
    "supplier_code",
    inputs.map((input) => input.supplierCode)
  );
  const conflicts = inputs.filter((input) =>
    existingCodes.has(input.supplierCode.toLowerCase())
  );

  if (conflicts.length > 0) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: conflicts.map((input) => ({
        rowNumber: input.rowNumber,
        label: input.supplierCode,
        message: "供应商编码已经存在，请重新下载最新数据后再导入。"
      }))
    };
  }

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("suppliers").insert(
      inputs.map((input) => ({
        supplier_code: input.supplierCode,
        name: input.name,
        contact_name: input.contactName,
        phone: input.phone,
        email: input.email,
        address: input.address,
        notes: input.notes,
        status: input.status
      }))
    ),
    "批量导入供应商"
  );

  if (error) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: [
        {
          message: formatSupabaseError("批量导入供应商", error).message
        }
      ]
    };
  }

  return {
    successCount: inputs.length,
    failedCount: 0,
    errors: []
  };
}

export async function validateWarehouseImportRows(
  rows: CsvDataRow[]
): Promise<BulkImportValidationRow<WarehouseImportInput>[]> {
  const fileCodes = rows.map((row) =>
    normalizeCsvValue(row.warehouse_code).toLowerCase()
  );
  const existingCodes = await getExistingCodeSet(
    "warehouses",
    "warehouse_code",
    fileCodes
  );
  const duplicatedCodes = getDuplicateSet(fileCodes);
  const allowedTypes = new Set([
    "material",
    "finished_good",
    "finished_product",
    "semi_finished",
    "fba_staging",
    "fba",
    "internal"
  ]);

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const warehouseCode = normalizeCsvValue(row.warehouse_code);
    const name = normalizeCsvValue(row.warehouse_name || row.name);
    const warehouseType =
      normalizeCsvValue(row.warehouse_type).toLowerCase() || "material";
    const errors: string[] = [];

    if (!warehouseCode) {
      errors.push("仓库编码必填。");
    }

    if (!name) {
      errors.push("仓库名称必填。");
    }

    if (!allowedTypes.has(warehouseType)) {
      errors.push(
        "仓库类型只能是 material、finished_good、finished_product、semi_finished、fba_staging、fba 或 internal。"
      );
    }

    validateStatus(row.status, errors);

    const codeKey = warehouseCode.toLowerCase();

    if (codeKey && existingCodes.has(codeKey)) {
      errors.push("仓库编码已经存在。");
    }

    if (codeKey && duplicatedCodes.has(codeKey)) {
      errors.push("同一个 CSV 文件内仓库编码重复。");
    }

    return {
      rowNumber,
      rawRow: row,
      data:
        errors.length === 0
          ? {
              rowNumber,
              warehouseCode,
              name,
              warehouseType,
              address: normalizeOptionalText(row.address),
              status: normalizeStatus(row.status)
            }
          : undefined,
      errors
    };
  });
}

export async function bulkImportWarehouses(
  inputs: WarehouseImportInput[]
): Promise<BulkImportResult> {
  if (inputs.length === 0) {
    return {
      successCount: 0,
      failedCount: 0,
      errors: []
    };
  }

  const existingCodes = await getExistingCodeSet(
    "warehouses",
    "warehouse_code",
    inputs.map((input) => input.warehouseCode)
  );
  const conflicts = inputs.filter((input) =>
    existingCodes.has(input.warehouseCode.toLowerCase())
  );

  if (conflicts.length > 0) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: conflicts.map((input) => ({
        rowNumber: input.rowNumber,
        label: input.warehouseCode,
        message: "仓库编码已经存在，请重新下载最新数据后再导入。"
      }))
    };
  }

  const supabase = getSupabaseClient();
  const { error } = await withTimeout(
    supabase.from("warehouses").insert(
      inputs.map((input) => ({
        warehouse_code: input.warehouseCode,
        name: input.name,
        warehouse_type: input.warehouseType,
        address: input.address,
        status: input.status
      }))
    ),
    "批量导入仓库"
  );

  if (error) {
    return {
      successCount: 0,
      failedCount: inputs.length,
      errors: [
        {
          message: formatSupabaseError("批量导入仓库", error).message
        }
      ]
    };
  }

  return {
    successCount: inputs.length,
    failedCount: 0,
    errors: []
  };
}

function normalizeCodePart(value: string) {
  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "BOM";
}

function createBomCode(skuCode: string, version: string) {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  const datePart = [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate())
  ].join("");
  const randomPart = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `BOM-${normalizeCodePart(skuCode)}-${normalizeCodePart(version)}-${datePart}-${randomPart}`;
}

export async function validateBomImportRows(
  rows: CsvDataRow[]
): Promise<BulkImportValidationRow<BomImportInput>[]> {
  const supabase = getSupabaseClient();
  const skuCodes = Array.from(
    new Set(rows.map((row) => normalizeCsvValue(row.finished_sku_code)).filter(Boolean))
  );
  const materialCodes = Array.from(
    new Set(rows.map((row) => normalizeCsvValue(row.material_code)).filter(Boolean))
  );
  const [skuResult, materialResult] = await Promise.all([
    withTimeout(
      skuCodes.length > 0
        ? supabase
            .from("skus")
            .select("id, sku_code, sku_name, sku_type, unit, status")
            .in("sku_code", skuCodes)
        : Promise.resolve({ data: [], error: null } as any),
      "读取 BOM 导入用 SKU"
    ),
    withTimeout(
      materialCodes.length > 0
        ? supabase
            .from("materials")
            .select("id, material_code, material_name, unit, status")
            .in("material_code", materialCodes)
        : Promise.resolve({ data: [], error: null } as any),
      "读取 BOM 导入用辅料"
    )
  ]);

  if (skuResult.error) {
    throw formatSupabaseError("读取 BOM 导入用 SKU", skuResult.error);
  }

  if (materialResult.error) {
    throw formatSupabaseError("读取 BOM 导入用辅料", materialResult.error);
  }

  const skuRows = (skuResult.data ?? []) as SkuMinimal[];
  const materialRows = (materialResult.data ?? []) as MaterialMinimal[];
  const skuIds = skuRows.map((sku) => sku.id);
  const bomHeaderResult = await withTimeout(
    skuIds.length > 0
      ? supabase
          .from("bom_headers")
          .select("id, product_sku_id, bom_code, version, status")
          .in("product_sku_id", skuIds)
      : Promise.resolve({ data: [], error: null } as any),
    "读取 BOM 主表"
  );

  if (bomHeaderResult.error) {
    throw formatSupabaseError("读取 BOM 主表", bomHeaderResult.error);
  }

  const bomHeaders = (bomHeaderResult.data ?? []) as BomHeaderMinimal[];
  const bomHeaderIds = bomHeaders.map((header) => header.id);
  const bomItemResult = await withTimeout(
    bomHeaderIds.length > 0
      ? supabase
          .from("bom_items")
          .select("id, bom_header_id, material_id")
          .in("bom_header_id", bomHeaderIds)
      : Promise.resolve({ data: [], error: null } as any),
    "读取 BOM 明细"
  );

  if (bomItemResult.error) {
    throw formatSupabaseError("读取 BOM 明细", bomItemResult.error);
  }

  const bomItems = (bomItemResult.data ?? []) as BomItemMinimal[];

  const skuByCode = new Map(
    skuRows.map((sku) => [
      sku.sku_code.toLowerCase(),
      sku
    ])
  );
  const materialByCode = new Map(
    materialRows.map((material) => [
      material.material_code.toLowerCase(),
      material
    ])
  );
  const headerBySkuVersion = new Map(
    bomHeaders.map((header) => [
      `${header.product_sku_id}||${header.version.toLowerCase()}`,
      header
    ])
  );
  const existingItems = new Set(
    bomItems.flatMap((item) => [
      item.material_id
        ? `${item.bom_header_id}||material:${item.material_id}`
        : ""
    ].filter(Boolean))
  );
  const fileMaterialKeys = rows.map((row) => {
    const finishedSkuCode = normalizeCsvValue(row.finished_sku_code).toLowerCase();
    const bomVersion = normalizeCsvValue(row.bom_version || row.version).toLowerCase();
    const materialCode = normalizeCsvValue(
      row.material_code || row.material_sku_code
    ).toLowerCase();

    return `${finishedSkuCode}||${bomVersion}||${materialCode}`;
  });
  const duplicatedMaterialKeys = getDuplicateSet(fileMaterialKeys);
  const statusesByGroup = new Map<string, Set<string>>();

  rows.forEach((row) => {
    const groupKey = `${normalizeCsvValue(row.finished_sku_code).toLowerCase()}||${normalizeCsvValue(
      row.bom_version || row.version
    ).toLowerCase()}`;
    const status = normalizeCsvValue(row.status).toLowerCase() || "active";
    const statuses = statusesByGroup.get(groupKey) ?? new Set<string>();

    statuses.add(status);
    statusesByGroup.set(groupKey, statuses);
  });

  return rows.map((row, index) => {
    const rowNumber = index + 2;
    const finishedSkuCode = normalizeCsvValue(row.finished_sku_code);
    const bomVersion = normalizeCsvValue(row.bom_version || row.version);
    const materialCode = normalizeCsvValue(
      row.material_code || row.material_sku_code
    );
    const quantityPerText = normalizeCsvValue(
      row.quantity_per_unit || row.quantity_per
    );
    const lossRateText = normalizeCsvValue(row.loss_rate);
    const quantityPer = Number(quantityPerText);
    const lossRate = lossRateText ? Number(lossRateText) : 0;
    const errors: string[] = [];
    const finishedSku = finishedSkuCode
      ? skuByCode.get(finishedSkuCode.toLowerCase())
      : null;
    const material = materialCode
      ? materialByCode.get(materialCode.toLowerCase())
      : null;
    if (!finishedSkuCode) {
      errors.push("成品 SKU 编码必填。");
    }

    if (!bomVersion) {
      errors.push("BOM 版本必填。");
    }

    if (!materialCode) {
      errors.push("辅料编码必填。");
    }

    if (!finishedSku) {
      errors.push("成品 SKU 编码不存在。");
    } else if (finishedSku.sku_type !== "finished_good") {
      errors.push("成品 SKU 必须是 sku_type = finished_good。");
    }

    if (!material) {
      errors.push("辅料编码不存在，请先到辅料管理维护。");
    }

    if (!quantityPerText || Number.isNaN(quantityPer) || quantityPer <= 0) {
      errors.push("每生产 1 个成品需要数量必须大于 0。");
    }

    if (lossRateText && (Number.isNaN(lossRate) || lossRate < 0)) {
      errors.push("损耗率不能小于 0。");
    }

    validateStatus(row.status, errors);

    const materialKey = `${finishedSkuCode.toLowerCase()}||${bomVersion.toLowerCase()}||${materialCode.toLowerCase()}`;

    if (duplicatedMaterialKeys.has(materialKey)) {
      errors.push("同一个 BOM 中不能重复添加同一个辅料。");
    }

    const groupStatusValues = statusesByGroup.get(
      `${finishedSkuCode.toLowerCase()}||${bomVersion.toLowerCase()}`
    );

    if (groupStatusValues && groupStatusValues.size > 1) {
      errors.push("同一个成品 SKU + BOM 版本的状态必须一致。");
    }

    const existingHeader =
      finishedSku && bomVersion
        ? headerBySkuVersion.get(
            `${finishedSku.id}||${bomVersion.toLowerCase()}`
          ) ?? null
        : null;

    if (
      existingHeader &&
      material &&
      existingItems.has(`${existingHeader.id}||material:${material.id}`)
    ) {
      errors.push("这个辅料已经存在于对应 BOM 明细中。");
    }

    const groupKey = `${finishedSkuCode} / ${bomVersion}`;

    return {
      rowNumber,
      rawRow: row,
      groupKey,
      notes:
        errors.length === 0
          ? [
              existingHeader
                ? `会写入已有 BOM：${existingHeader.bom_code}`
                : "会创建新的 BOM 主表"
            ]
          : undefined,
      data:
        errors.length === 0 && finishedSku && material
          ? {
              rowNumber,
              finishedSkuCode,
              bomVersion,
              materialCode,
              quantityPer,
              lossRate,
              notes: normalizeOptionalText(row.remark || row.notes),
              status: normalizeStatus(row.status),
              productSkuId: finishedSku.id,
              materialId: material.id,
              componentUnit: material.unit,
              groupKey,
              existingBomHeaderId: existingHeader?.id ?? null,
              willCreateHeader: !existingHeader
            }
          : undefined,
      errors
    };
  });
}

export async function bulkImportBomRows(
  inputs: BomImportInput[]
): Promise<BulkImportResult> {
  const errors: BulkImportResult["errors"] = [];
  let successCount = 0;

  const groups = new Map<string, BomImportInput[]>();

  inputs.forEach((input) => {
    const rows = groups.get(input.groupKey) ?? [];

    rows.push(input);
    groups.set(input.groupKey, rows);
  });

  for (const groupRows of groups.values()) {
    const firstRow = groupRows[0];
    const supabase = getSupabaseClient();
    const { data: existingHeader, error: existingHeaderError } = await withTimeout(
      supabase
        .from("bom_headers")
        .select("id, product_sku_id, bom_code, version, status")
        .eq("product_sku_id", firstRow.productSkuId)
        .eq("version", firstRow.bomVersion)
        .maybeSingle(),
      "确认 BOM 主表是否存在"
    );

    if (existingHeaderError) {
      groupRows.forEach((row) => {
        errors.push({
          rowNumber: row.rowNumber,
          label: row.groupKey,
          message: formatSupabaseError("确认 BOM 主表是否存在", existingHeaderError)
            .message
        });
      });
      continue;
    }

    let bomHeaderId = (existingHeader as BomHeaderMinimal | null)?.id ?? null;

    if (!bomHeaderId) {
      const { data: insertedHeader, error: insertHeaderError } = await withTimeout(
        supabase
          .from("bom_headers")
          .insert({
            product_sku_id: firstRow.productSkuId,
            bom_code: createBomCode(firstRow.finishedSkuCode, firstRow.bomVersion),
            version: firstRow.bomVersion,
            status: firstRow.status,
            notes: "批量导入创建"
          })
          .select("id")
          .single(),
        "创建 BOM 主表"
      );

      if (insertHeaderError) {
        groupRows.forEach((row) => {
          errors.push({
            rowNumber: row.rowNumber,
            label: row.groupKey,
            message: formatSupabaseError("创建 BOM 主表", insertHeaderError).message
          });
        });
        continue;
      }

      bomHeaderId = (insertedHeader as { id: string }).id;
    }

    for (const row of groupRows) {
      const { data: existingItem, error: existingItemError } = await withTimeout(
        supabase
          .from("bom_items")
          .select("id")
          .eq("bom_header_id", bomHeaderId)
          .eq("material_id", row.materialId)
          .maybeSingle(),
        "确认 BOM 明细是否重复"
      );

      if (existingItemError) {
        errors.push({
          rowNumber: row.rowNumber,
          label: row.materialCode,
          message: formatSupabaseError("确认 BOM 明细是否重复", existingItemError)
            .message
        });
        continue;
      }

      if (existingItem) {
        errors.push({
          rowNumber: row.rowNumber,
          label: row.materialCode,
          message: "这个辅料已经存在于对应 BOM 明细中。"
        });
        continue;
      }

      const { error } = await withTimeout(
        supabase.from("bom_items").insert({
          bom_header_id: bomHeaderId,
          material_id: row.materialId,
          quantity_per: row.quantityPer,
          unit: row.componentUnit,
          loss_rate: row.lossRate,
          notes: row.notes
        }),
        "创建 BOM 明细"
      );

      if (error) {
        errors.push({
          rowNumber: row.rowNumber,
          label: row.materialCode,
          message: formatSupabaseError("创建 BOM 明细", error).message
        });
      } else {
        successCount += 1;
      }
    }
  }

  return {
    successCount,
    failedCount: errors.length,
    errors
  };
}

export async function deactivateBrandsByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const brands = await getRowsByIds<BrandMinimal>(
    "brands",
    "id, brand_code, name, status",
    ids
  );

  const results: BulkActionResult[] = [];

  for (const brand of brands) {
    const label = `${brand.brand_code} / ${brand.name}`;

    try {
      await deactivateRow("brands", brand.id, "停用品牌");
      results.push(actionSuccess(brand.id, label, "deactivated", "已停用。"));
    } catch (error) {
      results.push(actionFailed(brand.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deleteBrandsByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const brands = await getRowsByIds<BrandMinimal>(
    "brands",
    "id, brand_code, name, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const brand of brands) {
    const label = `${brand.brand_code} / ${brand.name}`;

    try {
      const hasProducts = await hasReference(
        "products",
        "brand_id",
        brand.id,
        "检查品牌关联产品"
      );

      if (hasProducts) {
        results.push(
          actionBlocked(
            brand.id,
            label,
            "该品牌已有产品引用，不能删除。建议改为停用。"
          )
        );
        continue;
      }

      await deleteRow("brands", brand.id, "删除品牌");
      results.push(actionSuccess(brand.id, label, "deleted", "已删除。"));
    } catch (error) {
      results.push(actionFailed(brand.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deactivateProductsByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const products = await getRowsByIds<ProductMinimal>(
    "products",
    "id, product_code, name, status",
    ids
  );

  const results: BulkActionResult[] = [];

  for (const product of products) {
    const label = `${product.product_code} / ${product.name}`;

    try {
      await deactivateRow("products", product.id, "停用产品");
      results.push(actionSuccess(product.id, label, "deactivated", "已停用。"));
    } catch (error) {
      results.push(actionFailed(product.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deleteProductsByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const products = await getRowsByIds<ProductMinimal>(
    "products",
    "id, product_code, name, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const product of products) {
    const label = `${product.product_code} / ${product.name}`;

    try {
      const hasSkus = await hasReference(
        "skus",
        "product_id",
        product.id,
        "检查产品关联 SKU"
      );

      if (hasSkus) {
        results.push(
          actionBlocked(
            product.id,
            label,
            "该数据已有业务记录引用，不能删除。建议改为停用。"
          )
        );
        continue;
      }

      await deleteRow("products", product.id, "删除产品");
      results.push(actionSuccess(product.id, label, "deleted", "已删除。"));
    } catch (error) {
      results.push(actionFailed(product.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deactivateSkusByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const skus = await getRowsByIds<SkuMinimal>(
    "skus",
    "id, sku_code, sku_name, sku_type, unit, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const sku of skus) {
    const label = `${sku.sku_code} / ${sku.sku_name}`;

    try {
      await deactivateRow("skus", sku.id, "停用 SKU");
      results.push(actionSuccess(sku.id, label, "deactivated", "已停用。"));
    } catch (error) {
      results.push(actionFailed(sku.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deleteSkusByIds(ids: string[]): Promise<BulkActionResult[]> {
  const skus = await getRowsByIds<SkuMinimal>(
    "skus",
    "id, sku_code, sku_name, sku_type, unit, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const sku of skus) {
    const label = `${sku.sku_code} / ${sku.sku_name}`;

    try {
      const checks = await Promise.all([
        hasReference("bom_headers", "product_sku_id", sku.id, "检查 SKU 的 BOM 主表引用"),
        hasReference(
          "fba_replenishment_requests",
          "sku_id",
          sku.id,
          "检查 SKU 的 FBA 备货引用"
        ),
        hasReference("production_orders", "sku_id", sku.id, "检查 SKU 的生产任务引用"),
        hasReference(
          "purchase_order_items",
          "sku_id",
          sku.id,
          "检查 SKU 的采购单明细引用"
        ),
        hasReference("inventory_items", "sku_id", sku.id, "检查 SKU 的当前库存引用"),
        hasReference(
          "inventory_transactions",
          "sku_id",
          sku.id,
          "检查 SKU 的库存流水引用"
        )
      ]);

      if (checks.some(Boolean)) {
        results.push(
          actionBlocked(
            sku.id,
            label,
            "该数据已有业务记录引用，不能删除。建议改为停用。"
          )
        );
        continue;
      }

      await deleteRow("skus", sku.id, "删除 SKU");
      results.push(actionSuccess(sku.id, label, "deleted", "已删除。"));
    } catch (error) {
      results.push(actionFailed(sku.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deactivateSuppliersByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const suppliers = await getRowsByIds<SupplierMinimal>(
    "suppliers",
    "id, supplier_code, name, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const supplier of suppliers) {
    const label = `${supplier.supplier_code} / ${supplier.name}`;

    try {
      await deactivateRow("suppliers", supplier.id, "停用供应商");
      results.push(actionSuccess(supplier.id, label, "deactivated", "已停用。"));
    } catch (error) {
      results.push(actionFailed(supplier.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deleteSuppliersByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const suppliers = await getRowsByIds<SupplierMinimal>(
    "suppliers",
    "id, supplier_code, name, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const supplier of suppliers) {
    const label = `${supplier.supplier_code} / ${supplier.name}`;

    try {
      const [
        hasPurchaseOrders,
        hasDefaultMaterials,
        hasLegacyDefaultMaterialSkus
      ] = await Promise.all([
        hasReference(
          "purchase_orders",
          "supplier_id",
          supplier.id,
          "检查供应商采购单引用"
        ),
        hasReference(
          "materials",
          "default_supplier_id",
          supplier.id,
          "检查供应商默认辅料引用"
        ),
        hasReference(
          "skus",
          "default_supplier_id",
          supplier.id,
          "检查供应商旧辅料默认供应商引用"
        )
      ]);

      if (hasDefaultMaterials || hasLegacyDefaultMaterialSkus) {
        results.push(
          actionBlocked(
            supplier.id,
            label,
            "该供应商已被辅料设置为默认供应商，不能删除，可改为停用。"
          )
        );
        continue;
      }

      if (hasPurchaseOrders) {
        results.push(
          actionBlocked(
            supplier.id,
            label,
            "该数据已有业务记录引用，不能删除。建议改为停用。"
          )
        );
        continue;
      }

      await deleteRow("suppliers", supplier.id, "删除供应商");
      results.push(actionSuccess(supplier.id, label, "deleted", "已删除。"));
    } catch (error) {
      results.push(actionFailed(supplier.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deactivateWarehousesByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const warehouses = await getRowsByIds<WarehouseMinimal>(
    "warehouses",
    "id, warehouse_code, name, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const warehouse of warehouses) {
    const label = `${warehouse.warehouse_code} / ${warehouse.name}`;

    try {
      await deactivateRow("warehouses", warehouse.id, "停用仓库");
      results.push(actionSuccess(warehouse.id, label, "deactivated", "已停用。"));
    } catch (error) {
      results.push(actionFailed(warehouse.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deleteWarehousesByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const warehouses = await getRowsByIds<WarehouseMinimal>(
    "warehouses",
    "id, warehouse_code, name, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const warehouse of warehouses) {
    const label = `${warehouse.warehouse_code} / ${warehouse.name}`;

    try {
      const checks = await Promise.all([
        hasReference("inventory_items", "warehouse_id", warehouse.id, "检查仓库库存引用"),
        hasReference(
          "inventory_transactions",
          "warehouse_id",
          warehouse.id,
          "检查仓库库存流水引用"
        ),
        hasReference(
          "fba_replenishment_requests",
          "target_warehouse_id",
          warehouse.id,
          "检查仓库 FBA 备货引用"
        ),
        hasReference(
          "purchase_orders",
          "warehouse_id",
          warehouse.id,
          "检查仓库采购单引用"
        )
      ]);

      if (checks.some(Boolean)) {
        results.push(
          actionBlocked(
            warehouse.id,
            label,
            "该数据已有业务记录引用，不能删除。建议改为停用。"
          )
        );
        continue;
      }

      await deleteRow("warehouses", warehouse.id, "删除仓库");
      results.push(actionSuccess(warehouse.id, label, "deleted", "已删除。"));
    } catch (error) {
      results.push(actionFailed(warehouse.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deactivateBomHeadersByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const headers = await getRowsByIds<BomHeaderMinimal>(
    "bom_headers",
    "id, product_sku_id, bom_code, version, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const header of headers) {
    const label = `${header.bom_code} / ${header.version}`;

    try {
      await deactivateRow("bom_headers", header.id, "停用 BOM");
      results.push(actionSuccess(header.id, label, "deactivated", "已停用。"));
    } catch (error) {
      results.push(actionFailed(header.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deleteBomHeadersByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const headers = await getRowsByIds<BomHeaderMinimal>(
    "bom_headers",
    "id, product_sku_id, bom_code, version, status",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const header of headers) {
    const label = `${header.bom_code} / ${header.version}`;

    try {
      const hasProductionOrders = await hasReference(
        "production_orders",
        "bom_header_id",
        header.id,
        "检查 BOM 生产任务引用"
      );

      if (hasProductionOrders) {
        results.push(
          actionBlocked(
            header.id,
            label,
            "该 BOM 已被生产任务或物料需求使用，不能删除。建议改为停用。"
          )
        );
        continue;
      }

      const supabase = getSupabaseClient();
      const { error: itemDeleteError } = await withTimeout(
        supabase.from("bom_items").delete().eq("bom_header_id", header.id),
        "删除 BOM 明细"
      );

      if (itemDeleteError) {
        throw formatSupabaseError("删除 BOM 明细", itemDeleteError);
      }

      await deleteRow("bom_headers", header.id, "删除 BOM 主表");
      results.push(actionSuccess(header.id, label, "deleted", "已删除。"));
    } catch (error) {
      results.push(actionFailed(header.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

export async function deleteBomItemsByIds(
  ids: string[]
): Promise<BulkActionResult[]> {
  const items = await getRowsByIds<BomItemMinimal>(
    "bom_items",
    "id, bom_header_id, material_id",
    ids
  );
  const results: BulkActionResult[] = [];

  for (const item of items) {
    let label = item.id;

    try {
      const supabase = getSupabaseClient();
      const headerResult = await withTimeout(
        supabase
          .from("bom_headers")
          .select("id, product_sku_id, bom_code, version, status")
          .eq("id", item.bom_header_id)
          .single(),
        "读取 BOM 主表"
      );

      if (headerResult.error) {
        throw formatSupabaseError("读取 BOM 主表", headerResult.error);
      }

      let material: MaterialMinimal | null = null;

      if (item.material_id) {
        const materialResult = await withTimeout(
          supabase
            .from("materials")
            .select("id, material_code, material_name, unit")
            .eq("id", item.material_id)
            .single(),
          "读取 BOM 辅料"
        );

        if (materialResult.error) {
          throw formatSupabaseError("读取 BOM 辅料", materialResult.error);
        }

        material = materialResult.data as MaterialMinimal;
      }

      const header = headerResult.data as BomHeaderMinimal;

      label = `${header.bom_code} / ${
        material?.material_code ?? item.id
      }`;

      const hasProductionOrders = await hasReference(
        "production_orders",
        "bom_header_id",
        item.bom_header_id,
        "检查 BOM 生产任务引用"
      );

      if (hasProductionOrders) {
        results.push(
          actionBlocked(
            item.id,
            label,
            "该 BOM 已被生产任务或物料需求使用，不能删除明细。建议改为停用 BOM。"
          )
        );
        continue;
      }

      await deleteRow("bom_items", item.id, "删除 BOM 明细");
      results.push(actionSuccess(item.id, label, "deleted", "已删除。"));
    } catch (error) {
      results.push(actionFailed(item.id, label, getErrorMessage(error)));
    }
  }

  return results;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}
