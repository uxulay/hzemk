"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMockRole } from "@/components/auth/mock-role-provider";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  getProducts,
  getWarehouses,
  type Product,
  type Warehouse
} from "@/lib/api/master-data";
import {
  createFbaReplenishmentDocument,
  getFbaReplenishmentSkuOptions,
  getFbaReplenishmentRequests,
  type CreateFbaReplenishmentDocumentInput,
  type FbaReplenishmentRequest,
  type FbaReplenishmentRequestItem,
  type FbaReplenishmentSkuOption,
  type FbaRequestStatus
} from "@/lib/api/replenishment";
import {
  downloadCsvTemplate,
  normalizeCsvValue,
  parseCsv,
  type CsvTemplateField
} from "@/lib/utils/csv";
import { getBrandCodeName } from "@/lib/brand-utils";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

type StatusFilter = FbaRequestStatus | "all";

type CreateRequestFormState = {
  targetWarehouseId: string;
  targetShipDate: string;
  notes: string;
};

type DraftReplenishmentItem = {
  skuId: string;
  productId: string | null;
  productName: string;
  productCode: string;
  brandId: string | null;
  brandLabel: string;
  productImageUrl: string | null;
  skuName: string;
  skuCode: string;
  specs: string | null;
  currentStock: number;
  quantity: string;
  remark: string;
  hasActiveBom: boolean;
};

type ImportIssue = {
  rowNumber: number;
  skuCode: string;
  reason: string;
};

type ImportSummary = {
  successSkuCount: number;
  duplicateMergeCount: number;
  existingMergeCount: number;
  failedRowCount: number;
  issues: ImportIssue[];
  notes: string[];
};

type ParsedImportRow = {
  rowNumber: number;
  sku: FbaReplenishmentSkuOption;
  quantity: number;
  remark: string;
  expectedDeliveryDate: string | null;
  warehouseId: string | null;
};

type PickerSkuState = {
  checked: boolean;
  quantity: string;
  remark: string;
};

const initialCreateForm: CreateRequestFormState = {
  targetWarehouseId: "",
  targetShipDate: "",
  notes: ""
};

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "draft", label: "草稿" },
  { value: "submitted", label: "已提交" },
  { value: "accepted", label: "已接单" },
  { value: "rejected", label: "已拒绝" },
  { value: "in_production", label: "生产中" },
  { value: "completed", label: "已完成" },
  { value: "shipped", label: "已发往 FBA" }
];

const statusLabels: Record<FbaRequestStatus, string> = {
  draft: "草稿",
  submitted: "已提交",
  accepted: "已接单",
  rejected: "已拒绝",
  in_production: "生产中",
  completed: "已完成",
  shipped: "已发往 FBA"
};

const priorityLabels: Record<string, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急"
};

const importTemplateFields: CsvTemplateField[] = [
  {
    key: "SKU编码",
    label: "SKU 编码",
    required: true,
    example: "100001"
  },
  {
    key: "本次备货数量",
    label: "本次备货数量",
    required: true,
    example: "300"
  },
  {
    key: "备注",
    label: "备注",
    example: "1米黑色备货"
  }
];

const importTemplateRows = [
  {
    SKU编码: "100001",
    本次备货数量: "300",
    备注: "1米黑色备货"
  },
  {
    SKU编码: "100002",
    本次备货数量: "500",
    备注: "2米黑色备货"
  }
];

const importFieldAliases = {
  skuCode: ["SKU编码", "SKU 编码", "sku_code", "sku code", "sku"],
  quantity: [
    "本次备货数量",
    "备货数量",
    "quantity",
    "requested_quantity",
    "requested quantity"
  ],
  remark: ["备注", "remark", "notes", "明细备注"],
  expectedDeliveryDate: [
    "期望发货日期",
    "期望完成日期",
    "expected_delivery_date",
    "expected_date"
  ],
  warehouse: [
    "目的仓库",
    "目标仓库",
    "warehouse",
    "target_warehouse_code",
    "warehouse_code"
  ]
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "读取失败，请稍后重试。";
}

function formatDate(value: string | null) {
  return value || "-";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatQuantity(value: number) {
  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function parseNotes(notes: string | null) {
  if (!notes?.trim()) {
    return {
      amazonSite: "-",
      displayNotes: "-"
    };
  }

  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const noteLines: string[] = [];
  let amazonSite = "-";

  for (const line of lines) {
    const siteMatch = line.match(/^亚马逊站点[:：]\s*(.+)$/);
    const noteMatch = line.match(/^备注[:：]\s*(.*)$/);

    if (siteMatch) {
      amazonSite = siteMatch[1];
      continue;
    }

    if (noteMatch) {
      if (noteMatch[1]) {
        noteLines.push(noteMatch[1]);
      }
      continue;
    }

    noteLines.push(line);
  }

  return {
    amazonSite,
    displayNotes: noteLines.join("\n") || "-"
  };
}

function getSkuSearchText(request: FbaReplenishmentRequest) {
  return [
    request.request_no,
    request.sku?.sku_code,
    request.sku?.sku_name,
    request.sku?.amazon_sku,
    request.sku?.fnsku,
    request.sku?.product?.brand?.name,
    request.sku?.product?.brand?.brand_code,
    ...request.items.flatMap((item) => [
      item.product?.name,
      item.product?.brand?.name,
      item.product?.brand?.brand_code,
      item.sku?.sku_code,
      item.sku?.sku_name,
      item.sku?.specs
    ])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getRequestBrandSummary(request: FbaReplenishmentRequest) {
  const brandLabels = new Set(
    request.items
      .map((item) => item.product ?? item.sku?.product ?? null)
      .map((product) => getBrandCodeName(product?.brand))
  );

  const labels = [...brandLabels];

  if (labels.length === 0) {
    return "无品牌";
  }

  if (labels.length <= 2) {
    return labels.join("、");
  }

  return `${labels[0]} 等 ${labels.length} 个品牌`;
}

function isPositiveNumberText(value: string) {
  const text = value.trim();
  const quantity = Number(text);

  return text !== "" && Number.isFinite(quantity) && quantity > 0;
}

function sortWarehouses(warehouses: Warehouse[]) {
  const priority: Record<string, number> = {
    fba: 1,
    finished_product: 2,
    finished_good: 2,
    internal: 3,
    semi_finished: 4,
    material: 5
  };

  return [...warehouses].sort((first, second) => {
    const firstPriority = priority[first.warehouse_type] ?? 99;
    const secondPriority = priority[second.warehouse_type] ?? 99;

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority;
    }

    return first.warehouse_code.localeCompare(second.warehouse_code);
  });
}

function groupRequestItemsByProduct(items: FbaReplenishmentRequestItem[]) {
  const groups = new Map<
    string,
    {
      productName: string;
      productCode: string;
      brandLabel: string;
      brandId: string | null;
      imageUrl: string | null;
      items: FbaReplenishmentRequestItem[];
    }
  >();

  for (const item of items) {
    const product = item.product ?? item.sku?.product ?? null;
    const key = product?.id ?? item.product_id ?? "unknown";
    const current = groups.get(key);

    if (current) {
      current.items.push(item);
      continue;
    }

    groups.set(key, {
      productName: product?.name ?? "未关联产品",
      productCode: product?.product_code ?? "-",
      brandLabel: getBrandCodeName(product?.brand),
      brandId: product?.brand?.id ?? null,
      imageUrl: product?.product_image_url ?? null,
      items: [item]
    });
  }

  return [...groups.values()];
}

function formatToday() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function normalizeHeaderKey(value: string) {
  return normalizeCsvValue(value).replace(/\s+/g, "").toLowerCase();
}

function getAliasedCsvValue(row: Record<string, string>, aliases: string[]) {
  const normalizedAliases = new Set(aliases.map(normalizeHeaderKey));
  const match = Object.entries(row).find(([key]) =>
    normalizedAliases.has(normalizeHeaderKey(key))
  );

  return normalizeCsvValue(match?.[1]);
}

function isValidDateText(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function createDraftItemFromSku(
  sku: FbaReplenishmentSkuOption,
  quantity: number | string,
  remark = ""
): DraftReplenishmentItem {
  return {
    skuId: sku.id,
    productId: sku.product_id,
    productName: sku.product?.name ?? "未关联产品",
    productCode: sku.product?.product_code ?? "-",
    brandId: sku.product?.brand?.id ?? null,
    brandLabel: getBrandCodeName(sku.product?.brand),
    productImageUrl: sku.product?.product_image_url ?? null,
    skuName: sku.sku_name,
    skuCode: sku.sku_code,
    specs: sku.specs,
    currentStock: sku.current_stock,
    quantity: String(quantity),
    remark,
    hasActiveBom: sku.has_active_bom
  };
}

function mergeRemarks(first: string, second: string) {
  const cleanFirst = first.trim();
  const cleanSecond = second.trim();

  if (!cleanFirst) {
    return cleanSecond;
  }

  if (!cleanSecond || cleanFirst.includes(cleanSecond)) {
    return cleanFirst;
  }

  return `${cleanFirst}；${cleanSecond}`;
}

function mergeDraftItems(
  currentItems: DraftReplenishmentItem[],
  incomingItems: DraftReplenishmentItem[]
) {
  const itemBySkuId = new Map(
    currentItems.map((item) => [
      item.skuId,
      {
        ...item
      }
    ])
  );
  let existingMergeCount = 0;

  incomingItems.forEach((item) => {
    const existing = itemBySkuId.get(item.skuId);

    if (!existing) {
      itemBySkuId.set(item.skuId, item);
      return;
    }

    existingMergeCount += 1;
    itemBySkuId.set(item.skuId, {
      ...existing,
      quantity: String(Number(existing.quantity || 0) + Number(item.quantity || 0)),
      remark: mergeRemarks(existing.remark, item.remark)
    });
  });

  return {
    items: [...itemBySkuId.values()].sort((first, second) =>
      first.skuCode.localeCompare(second.skuCode)
    ),
    existingMergeCount
  };
}

function findWarehouseByImportValue(value: string, warehouses: Warehouse[]) {
  const normalized = normalizeHeaderKey(value);

  if (!normalized) {
    return null;
  }

  return (
    warehouses.find(
      (warehouse) =>
        normalizeHeaderKey(warehouse.warehouse_code) === normalized ||
        normalizeHeaderKey(warehouse.name) === normalized
    ) ?? null
  );
}

export default function ReplenishmentPage() {
  const { user } = useMockRole();
  const [requests, setRequests] = useState<FbaReplenishmentRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [skuOptions, setSkuOptions] = useState<FbaReplenishmentSkuOption[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [skuKeyword, setSkuKeyword] = useState("");
  const [selectedRequest, setSelectedRequest] =
    useState<FbaReplenishmentRequest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] =
    useState<CreateRequestFormState>(initialCreateForm);
  const [draftItems, setDraftItems] = useState<DraftReplenishmentItem[]>([]);
  const [createNoticeMessage, setCreateNoticeMessage] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [importErrorMessage, setImportErrorMessage] = useState("");
  const [importingFile, setImportingFile] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");
  const [activePickerProductId, setActivePickerProductId] = useState("");
  const [pickerSkuState, setPickerSkuState] = useState<
    Record<string, PickerSkuState>
  >({});
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createErrorMessage, setCreateErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const todayText = useMemo(() => formatToday(), []);

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        const [productData, skuData, warehouseData] = await Promise.all([
          getProducts(),
          getFbaReplenishmentSkuOptions(),
          getWarehouses()
        ]);

        if (isMounted) {
          setProducts(productData);
          setSkuOptions(skuData);
          setWarehouses(sortWarehouses(warehouseData));
        }
      } catch (error) {
        if (isMounted) {
          setCreateErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setLoadingOptions(false);
        }
      }
    }

    async function loadRequests() {
      try {
        setLoading(true);
        setErrorMessage("");
        setSelectedRequest(null);

        const data = await getFbaReplenishmentRequests({
          status: statusFilter
        });

        if (isMounted) {
          setRequests(data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error));
          setRequests([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOptions();
    loadRequests();

    return () => {
      isMounted = false;
    };
  }, [statusFilter]);

  const filteredRequests = useMemo(() => {
    const keyword = skuKeyword.trim().toLowerCase();

    return requests.filter((request) =>
      (!keyword || getSkuSearchText(request).includes(keyword)) &&
      (brandFilter === "all" ||
        request.items.some((item) => {
          const product = item.product ?? item.sku?.product ?? null;

          return brandFilter === "none"
            ? !product?.brand?.id
            : product?.brand?.id === brandFilter;
        }))
    );
  }, [brandFilter, requests, skuKeyword]);

  const paginatedRequests = useMemo(
    () => paginateItems(filteredRequests, page),
    [filteredRequests, page]
  );
  const skuByCode = useMemo(() => {
    return new Map(
      skuOptions.map((sku) => [normalizeCsvValue(sku.sku_code).toLowerCase(), sku])
    );
  }, [skuOptions]);
  const skuById = useMemo(() => {
    return new Map(skuOptions.map((sku) => [sku.id, sku]));
  }, [skuOptions]);
  const brandOptions = useMemo(() => {
    const brandById = new Map<string, NonNullable<Product["brand"]>>();

    products.forEach((product) => {
      if (product.brand) {
        brandById.set(product.brand.id, product.brand);
      }
    });

    return [...brandById.values()].sort((first, second) =>
      first.brand_code.localeCompare(second.brand_code, "zh-CN")
    );
  }, [products]);
  const skusByProductId = useMemo(() => {
    const groups = new Map<string, FbaReplenishmentSkuOption[]>();

    skuOptions.forEach((sku) => {
      if (!sku.product_id) {
        return;
      }

      const current = groups.get(sku.product_id) ?? [];
      current.push(sku);
      groups.set(sku.product_id, current);
    });

    return groups;
  }, [skuOptions]);
  const draftSkuCount = draftItems.length;
  const draftTotalQuantity = useMemo(
    () =>
      draftItems.reduce((sum, item) => {
        const quantity = Number(item.quantity);

        return Number.isFinite(quantity) && quantity > 0 ? sum + quantity : sum;
      }, 0),
    [draftItems]
  );
  const filteredPickerProducts = useMemo(() => {
    const keyword = pickerSearch.trim().toLowerCase();

    return products.filter((product) => {
      const productSkus = skusByProductId.get(product.id) ?? [];

      if (productSkus.length === 0) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      const productText = [
        product.name,
        product.product_code,
        product.brand?.name,
        product.brand?.brand_code
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const skuText = productSkus
        .flatMap((sku) => [sku.sku_name, sku.sku_code, sku.specs])
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return productText.includes(keyword) || skuText.includes(keyword);
    });
  }, [pickerSearch, products, skusByProductId]);
  const activePickerProduct =
    filteredPickerProducts.find((product) => product.id === activePickerProductId) ??
    filteredPickerProducts[0] ??
    null;
  const activePickerSkus = activePickerProduct
    ? skusByProductId.get(activePickerProduct.id) ?? []
    : [];

  useEffect(() => {
    setPage(1);
  }, [brandFilter, skuKeyword, statusFilter]);

  const refreshRequests = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSelectedRequest(null);

      const data = await getFbaReplenishmentRequests({
        status: statusFilter
      });
      setRequests(data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setCreateOpen(true);
    setCreateErrorMessage("");
    setCreateNoticeMessage("");
    setSuccessMessage("");
  };

  const updateCreateForm = (field: keyof CreateRequestFormState, value: string) => {
    setCreateForm((current) => ({
      ...current,
      [field]: value
    }));
    setCreateErrorMessage("");
    setCreateNoticeMessage("");
    setSuccessMessage("");
  };

  const openImportModal = () => {
    setImportOpen(true);
    setImportFileName("");
    setImportSummary(null);
    setImportErrorMessage("");
    setCreateErrorMessage("");
    setCreateNoticeMessage("");

    if (importInputRef.current) {
      importInputRef.current.value = "";
    }
  };

  const openPickerModal = () => {
    const firstProductWithSku = products.find(
      (product) => (skusByProductId.get(product.id) ?? []).length > 0
    );

    setPickerOpen(true);
    setPickerSearch("");
    setActivePickerProductId(firstProductWithSku?.id ?? "");
    setPickerSkuState({});
    setCreateErrorMessage("");
    setCreateNoticeMessage("");
  };

  const updateDraftItem = (
    skuId: string,
    field: "quantity" | "remark",
    value: string
  ) => {
    setDraftItems((current) =>
      current.map((item) =>
        item.skuId === skuId
          ? {
              ...item,
              [field]: value
            }
          : item
      )
    );
    setCreateErrorMessage("");
    setCreateNoticeMessage("");
    setSuccessMessage("");
  };

  const removeDraftItem = (skuId: string) => {
    setDraftItems((current) => current.filter((item) => item.skuId !== skuId));
    setCreateErrorMessage("");
    setCreateNoticeMessage("");
  };

  const clearDraftItems = () => {
    if (draftItems.length === 0) {
      return;
    }

    if (!window.confirm("确定要清空当前所有备货明细吗？")) {
      return;
    }

    setDraftItems([]);
    setCreateErrorMessage("");
    setCreateNoticeMessage("备货明细已清空。");
  };

  const updatePickerSku = (
    skuId: string,
    field: keyof PickerSkuState,
    value: string | boolean
  ) => {
    setPickerSkuState((current) => ({
      ...current,
      [skuId]: {
        checked:
          field === "checked"
            ? Boolean(value)
            : current[skuId]?.checked ?? false,
        quantity:
          field === "quantity"
            ? String(value)
            : current[skuId]?.quantity ?? "",
        remark:
          field === "remark" ? String(value) : current[skuId]?.remark ?? ""
      }
    }));
    setCreateErrorMessage("");
  };

  const confirmPickerSelection = () => {
    const selectedRows = Object.entries(pickerSkuState)
      .filter(([, state]) => state.checked)
      .map(([skuId, state]) => ({
        sku: skuById.get(skuId),
        quantity: state.quantity,
        remark: state.remark
      }));

    if (selectedRows.length === 0) {
      setCreateErrorMessage("请先勾选至少一个 SKU。");
      return;
    }

    const invalidRow = selectedRows.find(
      (row) => !row.sku || !isPositiveNumberText(row.quantity)
    );

    if (invalidRow) {
      setCreateErrorMessage("勾选的 SKU 必须填写大于 0 的备货数量。");
      return;
    }

    const incomingItems = selectedRows.map((row) =>
      createDraftItemFromSku(
        row.sku as FbaReplenishmentSkuOption,
        Number(row.quantity),
        row.remark
      )
    );
    const mergeResult = mergeDraftItems(draftItems, incomingItems);

    setDraftItems(mergeResult.items);
    setPickerOpen(false);
    setPickerSkuState({});
    setCreateNoticeMessage(
      mergeResult.existingMergeCount > 0
        ? `已添加 ${incomingItems.length} 个 SKU；已存在 SKU，数量已合并 ${mergeResult.existingMergeCount} 个。`
        : `已添加 ${incomingItems.length} 个 SKU。`
    );
    setCreateErrorMessage("");
  };

  const handleImportFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    try {
      setImportingFile(true);
      setImportFileName(file.name);
      setImportSummary(null);
      setImportErrorMessage("");
      setCreateErrorMessage("");
      setCreateNoticeMessage("");

      if (!file.name.toLowerCase().endsWith(".csv")) {
        throw new Error("当前先支持 CSV 文件，请把 Excel 另存为 CSV 后再上传。");
      }

      const parsed = parseCsv(await file.text());

      if (parsed.rows.length === 0) {
        throw new Error("CSV 里没有可导入的数据行。");
      }

      const parsedRows: ParsedImportRow[] = [];
      const issues: ImportIssue[] = [];

      parsed.rows.forEach((row, index) => {
        const rowNumber = index + 2;
        const skuCode = getAliasedCsvValue(row, importFieldAliases.skuCode);
        const quantityText = getAliasedCsvValue(row, importFieldAliases.quantity);
        const remark = getAliasedCsvValue(row, importFieldAliases.remark);
        const expectedDeliveryDate = getAliasedCsvValue(
          row,
          importFieldAliases.expectedDeliveryDate
        );
        const warehouseText = getAliasedCsvValue(row, importFieldAliases.warehouse);
        const rowErrors: string[] = [];
        const quantity = Number(quantityText);
        const sku = skuCode ? skuByCode.get(skuCode.toLowerCase()) : null;
        const warehouse = warehouseText
          ? findWarehouseByImportValue(warehouseText, warehouses)
          : null;

        if (!skuCode) {
          rowErrors.push("SKU 编码为空");
        }

        if (!quantityText) {
          rowErrors.push("本次备货数量为空");
        } else if (!Number.isFinite(quantity) || quantity <= 0) {
          rowErrors.push("本次备货数量必须是大于 0 的数字");
        }

        if (skuCode && !sku) {
          rowErrors.push(`SKU 编码 ${skuCode} 不存在`);
        }

        if (expectedDeliveryDate && !isValidDateText(expectedDeliveryDate)) {
          rowErrors.push("期望发货日期必须是 YYYY-MM-DD 格式");
        }

        if (warehouseText && !warehouse) {
          rowErrors.push(`目的仓库 ${warehouseText} 不存在`);
        }

        if (rowErrors.length > 0) {
          issues.push({
            rowNumber,
            skuCode: skuCode || "-",
            reason: rowErrors.join("；")
          });
          return;
        }

        parsedRows.push({
          rowNumber,
          sku: sku as FbaReplenishmentSkuOption,
          quantity,
          remark,
          expectedDeliveryDate: expectedDeliveryDate || null,
          warehouseId: warehouse?.id ?? null
        });
      });

      const rowBySkuId = new Map<
        string,
        {
          sku: FbaReplenishmentSkuOption;
          quantity: number;
          remark: string;
        }
      >();
      let duplicateMergeCount = 0;

      parsedRows.forEach((row) => {
        const existing = rowBySkuId.get(row.sku.id);

        if (!existing) {
          rowBySkuId.set(row.sku.id, {
            sku: row.sku,
            quantity: row.quantity,
            remark: row.remark
          });
          return;
        }

        duplicateMergeCount += 1;
        rowBySkuId.set(row.sku.id, {
          ...existing,
          quantity: existing.quantity + row.quantity,
          remark: mergeRemarks(existing.remark, row.remark)
        });
      });

      const incomingItems = [...rowBySkuId.values()].map((row) =>
        createDraftItemFromSku(row.sku, row.quantity, row.remark)
      );
      const mergeResult = mergeDraftItems(draftItems, incomingItems);
      const uniqueWarehouseIds = new Set(
        parsedRows.map((row) => row.warehouseId).filter(Boolean)
      );
      const uniqueExpectedDates = new Set(
        parsedRows.map((row) => row.expectedDeliveryDate).filter(Boolean)
      );
      const notes: string[] = [];

      if (uniqueWarehouseIds.size === 1 && !createForm.targetWarehouseId) {
        const [warehouseId] = [...uniqueWarehouseIds] as string[];
        setCreateForm((current) => ({
          ...current,
          targetWarehouseId: current.targetWarehouseId || warehouseId
        }));
        notes.push("文件里的目的仓库已自动带入顶部基础信息。");
      } else if (uniqueWarehouseIds.size > 1) {
        notes.push("文件里有多个目的仓库，系统不会按行拆仓，请在顶部统一选择目的仓库。");
      }

      if (uniqueExpectedDates.size === 1 && !createForm.targetShipDate) {
        const [expectedDate] = [...uniqueExpectedDates] as string[];
        setCreateForm((current) => ({
          ...current,
          targetShipDate: current.targetShipDate || expectedDate
        }));
        notes.push("文件里的期望发货日期已自动带入顶部基础信息。");
      } else if (uniqueExpectedDates.size > 1) {
        notes.push("文件里有多个期望发货日期，系统不会按行拆日期，请在顶部统一选择期望发货日期。");
      }

      const noBomCount = incomingItems.filter((item) => !item.hasActiveBom).length;

      if (noBomCount > 0) {
        notes.push(`有 ${noBomCount} 个 SKU 暂未找到启用 BOM，后续排产算料前需要补齐。`);
      }

      setDraftItems(mergeResult.items);
      setImportSummary({
        successSkuCount: incomingItems.length,
        duplicateMergeCount,
        existingMergeCount: mergeResult.existingMergeCount,
        failedRowCount: issues.length,
        issues,
        notes
      });

      if (incomingItems.length > 0) {
        setCreateNoticeMessage(
          `导入完成：成功导入 ${incomingItems.length} 个 SKU。`
        );
      }
    } catch (error) {
      setImportSummary(null);
      setImportErrorMessage(getErrorMessage(error));
    } finally {
      setImportingFile(false);

      if (importInputRef.current) {
        importInputRef.current.value = "";
      }
    }
  };

  const downloadImportErrorReport = () => {
    if (!importSummary?.issues.length) {
      return;
    }

    downloadCsvTemplate(
      "fba-replenishment-import-errors.csv",
      [
        { key: "行号", label: "行号" },
        { key: "SKU编码", label: "SKU 编码" },
        { key: "错误原因", label: "错误原因" }
      ],
      importSummary.issues.map((issue) => ({
        行号: String(issue.rowNumber),
        SKU编码: issue.skuCode,
        错误原因: issue.reason
      }))
    );
  };

  const buildCreateInput = (): CreateFbaReplenishmentDocumentInput | string => {
    if (!createForm.targetWarehouseId) {
      return "请选择目的仓库。";
    }

    if (draftItems.length === 0) {
      return "请先导入或添加至少一条 SKU 明细。";
    }

    const invalidItem = draftItems.find(
      (item) => !isPositiveNumberText(item.quantity)
    );

    if (invalidItem) {
      return `SKU ${invalidItem.skuCode} 的备货数量必须是大于 0 的数字。`;
    }

    const missingSku = draftItems.find((item) => !skuById.has(item.skuId));

    if (missingSku) {
      return `SKU ${missingSku.skuCode} 当前在系统里不存在，请删除后重新导入。`;
    }

    return {
      amazonSite: "US",
      targetWarehouseId: createForm.targetWarehouseId,
      fbaWarehouseCode: "",
      targetShipDate: createForm.targetShipDate || null,
      priority: "normal",
      notes: createForm.notes,
      items: draftItems.map((item) => ({
        productId: item.productId,
        skuId: item.skuId,
        requestedQuantity: Number(item.quantity),
        remark: item.remark
      }))
    };
  };

  const handleCreateRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const input = buildCreateInput();

    if (typeof input === "string") {
      setCreateErrorMessage(input);
      return;
    }

    try {
      setSubmitting(true);
      setCreateErrorMessage("");
      setSuccessMessage("");

      const created = await createFbaReplenishmentDocument(input);
      setCreateOpen(false);
      setCreateForm(initialCreateForm);
      setDraftItems([]);
      setCreateNoticeMessage("");
      setImportSummary(null);
      await refreshRequests();
      setSuccessMessage(`创建成功：${created.request_no}`);
    } catch (error) {
      setCreateErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">FBA 备货</p>
          <h2>FBA 备货需求</h2>
          <p>
            按整张备货单查看运营需求。一张单可以包含多个产品和多个 SKU 明细。
          </p>
        </div>
        <div className="pageHeroActions">
          <span className="statusPill">Supabase 数据</span>
          <button
            className="primaryButton successButton"
            type="button"
            onClick={openCreateModal}
          >
            + 创建备货单
          </button>
        </div>
      </section>

      {successMessage ? (
        <div className="successNotice">
          <strong>操作成功</strong>
          <p>{successMessage}</p>
        </div>
      ) : null}

      <section className="listPanel">
        <div className="listToolbar">
          <label>
            状态
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              disabled={loading}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            SKU 搜索
            <input
              value={skuKeyword}
              onChange={(event) => setSkuKeyword(event.target.value)}
              placeholder="输入 SKU 编码或名称"
            />
          </label>

          <label>
            品牌
            <select
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              disabled={loading}
            >
              <option value="all">全部品牌</option>
              <option value="none">无品牌</option>
              {brandOptions.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {getBrandCodeName(brand)}
                </option>
              ))}
            </select>
          </label>

          <button
            className="secondaryButton"
            type="button"
            onClick={refreshRequests}
            disabled={loading}
          >
            {loading ? "正在刷新..." : "刷新列表"}
          </button>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取 FBA 备货需求列表...</div>
        ) : null}

        {errorMessage ? (
          <div className="debugError">
            <strong>查询失败</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {!loading && !errorMessage && filteredRequests.length === 0 ? (
          <div className="emptyState">暂无 FBA 备货需求</div>
        ) : null}

        {!loading && !errorMessage && filteredRequests.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>备货单号</th>
                  <th>亚马逊站点</th>
                  <th>目标 FBA 仓库</th>
                  <th>产品数量</th>
                  <th>品牌</th>
                  <th>SKU 数量</th>
                  <th>总备货数量</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>创建人</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((request) => {
                  const notes = parseNotes(request.notes);

                  return (
                    <tr key={request.id}>
                      <td>{request.request_no}</td>
                      <td>{notes.amazonSite}</td>
                      <td>
                        <strong>{request.target_warehouse?.name ?? "-"}</strong>
                        <span>{request.fba_warehouse_code ?? "-"}</span>
                      </td>
                      <td>{request.product_count}</td>
                      <td>{getRequestBrandSummary(request)}</td>
                      <td>{request.sku_count}</td>
                      <td>{formatQuantity(request.total_requested_quantity)}</td>
                      <td>
                        <span className={`tablePill status-${request.status}`}>
                          {statusLabels[request.status] ?? request.status}
                        </span>
                      </td>
                      <td>{priorityLabels[request.priority] ?? request.priority}</td>
                      <td>{request.requested_by_profile?.full_name ?? "-"}</td>
                      <td>{formatDateTime(request.created_at)}</td>
                      <td>
                        <div className="rowActions">
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(request)}
                          >
                            查看
                          </button>
                          <button type="button" disabled>
                            编辑
                          </button>
                          <button type="button" disabled>
                            删除
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && !errorMessage && filteredRequests.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={filteredRequests.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {selectedRequest ? (
        <Modal
          open={Boolean(selectedRequest)}
          eyebrow="备货需求详情"
          title={selectedRequest.request_no}
          onClose={() => setSelectedRequest(null)}
        >
          <div className="detailGrid">
            <DetailItem
              label="亚马逊站点"
              value={parseNotes(selectedRequest.notes).amazonSite}
            />
            <DetailItem
              label="目标仓库"
              value={`${selectedRequest.target_warehouse?.name ?? "-"} / ${
                selectedRequest.target_warehouse?.warehouse_code ?? "-"
              }`}
            />
            <DetailItem
              label="FBA 仓库代码"
              value={selectedRequest.fba_warehouse_code ?? "-"}
            />
            <DetailItem
              label="备货数量"
              value={formatQuantity(selectedRequest.total_requested_quantity)}
            />
            <DetailItem
              label="产品数量"
              value={String(selectedRequest.product_count)}
            />
            <DetailItem label="SKU 数量" value={String(selectedRequest.sku_count)} />
            <DetailItem
              label="期望完成日期"
              value={formatDate(selectedRequest.target_ship_date)}
            />
            <DetailItem
              label="状态"
              value={statusLabels[selectedRequest.status] ?? selectedRequest.status}
            />
            <DetailItem
              label="优先级"
              value={
                priorityLabels[selectedRequest.priority] ??
                selectedRequest.priority
              }
            />
            <DetailItem
              label="创建人"
              value={
                selectedRequest.requested_by_profile
                  ? `${selectedRequest.requested_by_profile.full_name} / ${selectedRequest.requested_by_profile.email}`
                  : "-"
              }
            />
            <DetailItem
              label="创建时间"
              value={formatDateTime(selectedRequest.created_at)}
            />
            <DetailItem
              label="更新时间"
              value={formatDateTime(selectedRequest.updated_at)}
            />
            <DetailItem
              label="拒绝原因"
              value={selectedRequest.rejected_reason ?? "-"}
            />
            <DetailItem
              label="备注"
              value={parseNotes(selectedRequest.notes).displayNotes}
              wide
            />
          </div>

          <div className="groupList">
            {groupRequestItemsByProduct(selectedRequest.items).map((group) => (
              <section className="productGroup" key={group.productCode}>
                <ProductHeader
                  imageUrl={group.imageUrl}
                  name={group.productName}
                  code={group.productCode}
                  brandLabel={group.brandLabel}
                />
                <div className="tableWrap compactTableWrap">
                  <table className="dataTable compactDataTable">
                    <thead>
                      <tr>
                        <th>SKU 编码</th>
                        <th>SKU 名称 / 规格</th>
                        <th>备货数量</th>
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.sku?.sku_code ?? "-"}</td>
                          <td>
                            <strong>{item.sku?.sku_name ?? "-"}</strong>
                            <span>{item.sku?.specs ?? "-"}</span>
                          </td>
                          <td>{formatQuantity(item.requested_quantity)}</td>
                          <td className="notesCell">{item.remark ?? "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </Modal>
      ) : null}

      <Modal
        open={createOpen}
        eyebrow="运营创建"
        title="创建 FBA 备货单"
        maxWidth="xl"
        onClose={() => {
          if (!submitting) {
            setCreateOpen(false);
          }
        }}
      >
        {loadingOptions ? (
          <div className="debugNotice">正在读取产品、SKU、库存和仓库数据...</div>
        ) : null}

        {createErrorMessage ? (
          <div className="debugError">
            <strong>操作失败</strong>
            <p>{createErrorMessage}</p>
          </div>
        ) : null}

        {createNoticeMessage ? (
          <div className="successNotice">
            <strong>处理完成</strong>
            <p>{createNoticeMessage}</p>
          </div>
        ) : null}

        <form
          className="dataForm replenishmentCreateForm"
          onSubmit={handleCreateRequest}
        >
          <div className="fullField createMetaGrid">
            <DetailItem label="备货单号" value="提交时自动生成" />
            <DetailItem label="需求人" value={user.name} />
            <DetailItem label="需求日期" value={todayText} />
          </div>

          <label>
            目的仓库
            <select
              value={createForm.targetWarehouseId}
              onChange={(event) =>
                updateCreateForm("targetWarehouseId", event.target.value)
              }
              disabled={loadingOptions || submitting}
            >
              <option value="">请选择目标仓库</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} / {warehouse.warehouse_code}
                </option>
              ))}
            </select>
          </label>

          <label>
            期望发货日期
            <input
              type="date"
              value={createForm.targetShipDate}
              onChange={(event) =>
                updateCreateForm("targetShipDate", event.target.value)
              }
              disabled={submitting}
            />
          </label>

          <label className="fullField">
            备注
            <textarea
              value={createForm.notes}
              onChange={(event) => updateCreateForm("notes", event.target.value)}
              placeholder="例如：按近期销量安排补货。"
              disabled={submitting}
            />
          </label>

          <div className="fullField detailActionBar">
            <div className="rowActions">
              <button
                type="button"
                onClick={() =>
                  downloadCsvTemplate(
                    "fba-replenishment-detail-template.csv",
                    importTemplateFields,
                    importTemplateRows
                  )
                }
                disabled={submitting}
              >
                下载导入模板
              </button>
              <button
                className="primaryButton successButton"
                type="button"
                onClick={openImportModal}
                disabled={loadingOptions || submitting}
              >
                批量导入
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={openPickerModal}
                disabled={loadingOptions || submitting}
              >
                添加产品/SKU
              </button>
              <button
                className="secondaryButton"
                type="button"
                onClick={clearDraftItems}
                disabled={draftItems.length === 0 || submitting}
              >
                清空明细
              </button>
            </div>
          </div>

          <div className="fullField">
            {draftItems.length === 0 ? (
              <div className="emptyState">暂无备货明细，请先批量导入或添加 SKU。</div>
            ) : (
              <div className="tableWrap compactTableWrap">
                <table className="dataTable replenishmentDetailTable">
                  <thead>
                    <tr>
                      <th>产品图片</th>
                      <th>产品名称/SPU</th>
                      <th>品牌</th>
                      <th>SKU 名称</th>
                      <th>SKU 编码</th>
                      <th>规格/米数</th>
                      <th>当前成品库存</th>
                      <th>本次备货数量</th>
                      <th>备注</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {draftItems.map((item) => (
                      <tr key={item.skuId}>
                        <td>
                          <ProductImage
                            imageUrl={item.productImageUrl}
                            name={item.productName}
                          />
                        </td>
                        <td>
                          <strong>{item.productName}</strong>
                          <span>{item.productCode}</span>
                        </td>
                        <td>{item.brandLabel}</td>
                        <td>{item.skuName}</td>
                        <td>{item.skuCode}</td>
                        <td>
                          <span>{item.specs ?? "-"}</span>
                          {!item.hasActiveBom ? (
                            <span className="tableHint dangerText">
                              未找到启用 BOM
                            </span>
                          ) : null}
                        </td>
                        <td>{formatQuantity(item.currentStock)}</td>
                        <td>
                          <input
                            className="tableNumberInput"
                            min="0.0001"
                            step="1"
                            type="number"
                            value={item.quantity}
                            onChange={(event) =>
                              updateDraftItem(
                                item.skuId,
                                "quantity",
                                event.target.value
                              )
                            }
                            disabled={submitting}
                          />
                        </td>
                        <td>
                          <input
                            className="tableTextInput"
                            value={item.remark}
                            onChange={(event) =>
                              updateDraftItem(
                                item.skuId,
                                "remark",
                                event.target.value
                              )
                            }
                            disabled={submitting}
                          />
                        </td>
                        <td>
                          <button
                            className="secondaryButton"
                            type="button"
                            onClick={() => removeDraftItem(item.skuId)}
                            disabled={submitting}
                          >
                            删除
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="detailSummaryBar fullField">
            <span>
              SKU 种类数量
              <strong>{draftSkuCount}</strong>
            </span>
            <span>
              备货总数量
              <strong>{formatQuantity(draftTotalQuantity)}</strong>
            </span>
          </div>

          <div className="formActions fullField">
            <button
              className="primaryButton successButton"
              type="submit"
              disabled={loadingOptions || submitting}
            >
              {submitting ? "正在创建..." : "提交备货单"}
            </button>
          </div>
        </form>

        <Modal
          open={importOpen}
          eyebrow="批量导入"
          title="导入 SKU 明细"
          maxWidth="lg"
          onClose={() => {
            if (!importingFile) {
              setImportOpen(false);
            }
          }}
        >
          <div className="bulkInlineArea">
            <div className="rowActions">
              <button
                type="button"
                onClick={() =>
                  downloadCsvTemplate(
                    "fba-replenishment-detail-template.csv",
                    importTemplateFields,
                    importTemplateRows
                  )
                }
              >
                下载导入模板
              </button>
              <button
                className="primaryButton successButton"
                type="button"
                onClick={() => importInputRef.current?.click()}
                disabled={importingFile}
              >
                批量导入
              </button>
            </div>

            <div className="bulkUploadBox">
              <input
                ref={importInputRef}
                className="hiddenFileInput"
                type="file"
                accept=".csv,text/csv"
                onChange={(event) => handleImportFile(event.target.files?.[0])}
                disabled={importingFile}
              />
              <span>
                {importFileName
                  ? `已选择：${importFileName}`
                  : "模板字段：SKU编码、本次备货数量、备注。"}
              </span>
            </div>

            {importingFile ? (
              <div className="debugNotice">正在解析和校验 CSV...</div>
            ) : null}

            {importErrorMessage ? (
              <div className="debugError">
                <strong>导入失败</strong>
                <p>{importErrorMessage}</p>
              </div>
            ) : null}

            {importSummary ? (
              <div
                className={
                  importSummary.failedRowCount > 0
                    ? "warningNotice"
                    : "successNotice"
                }
              >
                <strong>导入完成</strong>
                <div className="importResultGrid">
                  <span>
                    成功导入 <strong>{importSummary.successSkuCount}</strong> 个 SKU
                  </span>
                  <span>
                    自动合并重复 SKU{" "}
                    <strong>{importSummary.duplicateMergeCount}</strong> 个
                  </span>
                  <span>
                    已存在 SKU，数量已合并{" "}
                    <strong>{importSummary.existingMergeCount}</strong> 个
                  </span>
                  <span>
                    失败 <strong>{importSummary.failedRowCount}</strong> 行
                  </span>
                </div>

                {importSummary.notes.length > 0 ? (
                  <div className="bulkErrorList importNoteList">
                    {importSummary.notes.map((note) => (
                      <span key={note}>{note}</span>
                    ))}
                  </div>
                ) : null}

                {importSummary.issues.length > 0 ? (
                  <>
                    <div className="bulkErrorList importFailureList">
                      {importSummary.issues.map((issue) => (
                        <span key={`${issue.rowNumber}-${issue.reason}`}>
                          第 {issue.rowNumber} 行：{issue.skuCode}，{issue.reason}
                        </span>
                      ))}
                    </div>
                    <button
                      className="secondaryButton"
                      type="button"
                      onClick={downloadImportErrorReport}
                    >
                      下载错误报告
                    </button>
                  </>
                ) : null}
              </div>
            ) : null}

            <div className="modalFooter bulkInlineFooter">
              <span>
                成功行会先加入当前备货明细，错误行可修改 CSV 后重新上传。
              </span>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => importInputRef.current?.click()}
                  disabled={importingFile}
                >
                  重新上传
                </button>
                <button
                  className="primaryButton successButton"
                  type="button"
                  onClick={() => setImportOpen(false)}
                  disabled={importingFile}
                >
                  完成
                </button>
              </div>
            </div>
          </div>
        </Modal>

        <Modal
          open={pickerOpen}
          eyebrow="添加产品/SKU"
          title="选择产品和 SKU"
          maxWidth="xl"
          onClose={() => setPickerOpen(false)}
        >
          <label className="skuPickerSearch">
            搜索
            <input
              value={pickerSearch}
              onChange={(event) => setPickerSearch(event.target.value)}
              placeholder="产品名称、SPU、品牌、SKU 名称、SKU 编码、规格/米数"
            />
          </label>

          <div className="skuPickerLayout">
            <div className="skuPickerProducts">
              {filteredPickerProducts.length === 0 ? (
                <div className="emptyState">没有匹配的产品。</div>
              ) : null}

              {filteredPickerProducts.map((product) => {
                const isActive = activePickerProduct?.id === product.id;

                return (
                  <button
                    className={
                      isActive
                        ? "skuPickerProductButton active"
                        : "skuPickerProductButton"
                    }
                    type="button"
                    onClick={() => setActivePickerProductId(product.id)}
                    key={product.id}
                  >
                    <ProductHeader
                      imageUrl={product.product_image_url ?? null}
                      name={product.name}
                      code={product.product_code}
                      brandLabel={getBrandCodeName(product.brand)}
                    />
                  </button>
                );
              })}
            </div>

            <div className="skuPickerSkus">
              {!activePickerProduct ? (
                <div className="emptyState">请选择产品。</div>
              ) : (
                <div className="tableWrap compactTableWrap">
                  <table className="dataTable skuPickerSkuTable">
                    <thead>
                      <tr>
                        <th>选择</th>
                        <th>SKU 名称</th>
                        <th>SKU 编码</th>
                        <th>规格/米数</th>
                        <th>当前成品库存</th>
                        <th>本次备货数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activePickerSkus.map((sku) => {
                        const state = pickerSkuState[sku.id] ?? {
                          checked: false,
                          quantity: "",
                          remark: ""
                        };

                        return (
                          <tr key={sku.id}>
                            <td>
                              <input
                                className="tableCheckbox"
                                type="checkbox"
                                checked={state.checked}
                                onChange={(event) =>
                                  updatePickerSku(
                                    sku.id,
                                    "checked",
                                    event.target.checked
                                  )
                                }
                              />
                            </td>
                            <td>{sku.sku_name}</td>
                            <td>{sku.sku_code}</td>
                            <td>
                              <span>{sku.specs ?? "-"}</span>
                              {!sku.has_active_bom ? (
                                <span className="tableHint dangerText">
                                  未找到启用 BOM
                                </span>
                              ) : null}
                            </td>
                            <td>{formatQuantity(sku.current_stock)}</td>
                            <td>
                              <input
                                className="tableNumberInput"
                                min="0.0001"
                                step="1"
                                type="number"
                                value={state.quantity}
                                onChange={(event) =>
                                  updatePickerSku(
                                    sku.id,
                                    "quantity",
                                    event.target.value
                                  )
                                }
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="modalFooter">
            <span>勾选 SKU 并填写数量后加入当前备货单。</span>
            <div className="rowActions">
              <button type="button" onClick={() => setPickerOpen(false)}>
                取消
              </button>
              <button
                className="primaryButton successButton"
                type="button"
                onClick={confirmPickerSelection}
              >
                确认添加
              </button>
            </div>
          </div>
        </Modal>
      </Modal>
    </main>
  );
}

function ProductImage({
  imageUrl,
  name
}: {
  imageUrl: string | null;
  name: string;
}) {
  return imageUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img className="productThumb" src={imageUrl} alt={name} />
  ) : (
    <div className="productThumb productThumbPlaceholder">图</div>
  );
}

function ProductHeader({
  imageUrl,
  name,
  code,
  brandLabel
}: {
  imageUrl: string | null;
  name: string;
  code: string;
  brandLabel?: string;
}) {
  return (
    <div className="productHeader">
      <ProductImage imageUrl={imageUrl} name={name} />
      <div>
        <strong>{name}</strong>
        <span>{code}</span>
        {brandLabel ? <span>{brandLabel}</span> : null}
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  wide = false
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "detailItem detailItemWide" : "detailItem"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
