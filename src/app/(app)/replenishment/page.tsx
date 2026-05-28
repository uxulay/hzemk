"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useMockRole } from "@/components/auth/mock-role-provider";
import { Modal } from "@/components/Modal";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { DrawerForm } from "@/components/ui/DrawerForm";
import { EllipsisText } from "@/components/ui/ellipsis-text";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowActions } from "@/components/ui/row-actions";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DownloadIcon, PlusIcon, UploadIcon } from "@/components/ui/icons";
import { type Product, type Warehouse } from "@/lib/api/master-data";
import { searchWarehouseOptions } from "@/lib/api/warehouses";
import {
  createFbaReplenishmentDocument,
  getFbaReplenishmentSkuOptions,
  getReplenishmentRequestsPage,
  searchFbaReplenishmentSkuOptions,
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
import { DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

type StatusFilter = FbaRequestStatus | "all";

type CreateRequestFormState = {
  platform: string;
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

function toProductOption(
  product: NonNullable<FbaReplenishmentSkuOption["product"]>
): Product {
  return {
    id: product.id,
    brand_id: product.brand_id,
    product_code: product.product_code,
    name: product.name,
    category: null,
    description: null,
    product_image_url: product.product_image_url,
    status: "active",
    created_at: "",
    updated_at: "",
    brand: product.brand
  };
}

function getProductsFromSkuOptions(skuData: FbaReplenishmentSkuOption[]) {
  return Array.from(
    new Map(
      skuData
        .map((sku) => sku.product)
        .filter(
          (
            product
          ): product is NonNullable<FbaReplenishmentSkuOption["product"]> =>
            Boolean(product)
        )
        .map((product) => [product.id, toProductOption(product)])
    ).values()
  );
}

const initialCreateForm: CreateRequestFormState = {
  platform: "US",
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

  return (
    text !== "" &&
    Number.isFinite(quantity) &&
    Number.isInteger(quantity) &&
    quantity > 0
  );
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
  const [platformFilter, setPlatformFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [skuKeyword, setSkuKeyword] = useState("");
  const [targetShipDateStart, setTargetShipDateStart] = useState("");
  const [targetShipDateEnd, setTargetShipDateEnd] = useState("");
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
  const [totalRequests, setTotalRequests] = useState(0);
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
        const [skuData, warehouseData] = await Promise.all([
          getFbaReplenishmentSkuOptions(),
          searchWarehouseOptions("", 20)
        ]);

        if (isMounted) {
          setProducts(getProductsFromSkuOptions(skuData));
          setSkuOptions(skuData);
          setWarehouses(sortWarehouses(warehouseData as Warehouse[]));
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

        const data = await getReplenishmentRequestsPage({
          page,
          pageSize: DEFAULT_PAGE_SIZE,
          keyword: skuKeyword,
          filters: {
            status: statusFilter,
            brandId: brandFilter,
            targetShipDateStart,
            targetShipDateEnd
          }
        });

        if (isMounted) {
          setRequests(data.rows);
          setTotalRequests(data.total);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error));
          setRequests([]);
          setTotalRequests(0);
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
  }, [page, statusFilter, skuKeyword, brandFilter, targetShipDateStart, targetShipDateEnd]);

  useEffect(() => {
    if (!pickerOpen) {
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const skuData = await searchFbaReplenishmentSkuOptions(pickerSearch, 20);

        if (!cancelled) {
          setSkuOptions(skuData);
          setProducts(getProductsFromSkuOptions(skuData));
        }
      } catch (error) {
        if (!cancelled) {
          setCreateErrorMessage(getErrorMessage(error));
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [pickerOpen, pickerSearch]);

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
  }, [brandFilter, platformFilter, skuKeyword, statusFilter, targetShipDateStart, targetShipDateEnd]);

  const refreshRequests = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSelectedRequest(null);

      const data = await getReplenishmentRequestsPage({
        page,
        pageSize: DEFAULT_PAGE_SIZE,
        keyword: skuKeyword,
        filters: {
          status: statusFilter,
          brandId: brandFilter,
          targetShipDateStart,
          targetShipDateEnd
        }
      });
      setRequests(data.rows);
      setTotalRequests(data.total);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequests([]);
      setTotalRequests(0);
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
      setCreateErrorMessage("勾选的 SKU 备货数量必须是大于 0 的整数。");
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
        } else if (!isPositiveNumberText(quantityText)) {
          rowErrors.push("本次备货数量必须是大于 0 的整数");
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

      const duplicateSkuIds = new Set(
        parsedRows
          .map((row) => row.sku.id)
          .filter((skuId, index, skuIds) => skuIds.indexOf(skuId) !== index)
      );

      if (duplicateSkuIds.size > 0) {
        parsedRows
          .filter((row) => duplicateSkuIds.has(row.sku.id))
          .forEach((row) => {
            issues.push({
              rowNumber: row.rowNumber,
              skuCode: row.sku.sku_code,
              reason: "文件内重复 SKU，请合并成一行后再导入"
            });
          });
      }

      const validParsedRows = parsedRows.filter(
        (row) => !duplicateSkuIds.has(row.sku.id)
      );
      const rowBySkuId = new Map<
        string,
        {
          sku: FbaReplenishmentSkuOption;
          quantity: number;
          remark: string;
        }
      >();
      let duplicateMergeCount = duplicateSkuIds.size;

      validParsedRows.forEach((row) => {
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
        validParsedRows.map((row) => row.warehouseId).filter(Boolean)
      );
      const uniqueExpectedDates = new Set(
        validParsedRows.map((row) => row.expectedDeliveryDate).filter(Boolean)
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
      return `SKU ${invalidItem.skuCode} 的备货数量必须是大于 0 的整数。`;
    }

    const missingSku = draftItems.find((item) => !skuById.has(item.skuId));

    if (missingSku) {
      return `SKU ${missingSku.skuCode} 当前在系统里不存在，请删除后重新导入。`;
    }

    return {
      amazonSite: createForm.platform || "US",
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

  const platformOptions = useMemo(() => {
    const platforms = new Set(
      requests
        .map((request) => parseNotes(request.notes).amazonSite)
        .filter((platform) => platform && platform !== "-")
    );

    return ["all", ...[...platforms].sort((first, second) => first.localeCompare(second))];
  }, [requests]);
  const visibleRequests = useMemo(() => {
    if (platformFilter === "all") {
      return requests;
    }

    return requests.filter(
      (request) => parseNotes(request.notes).amazonSite === platformFilter
    );
  }, [platformFilter, requests]);
  const skuStockById = useMemo(
    () => new Map(skuOptions.map((sku) => [sku.id, sku.current_stock])),
    [skuOptions]
  );
  const getRequestSummary = (request: FbaReplenishmentRequest) => {
    const items = request.items.slice(0, 2);
    const labels = items.map((item) => {
      const product = item.product ?? item.sku?.product ?? null;
      const productName = product?.name ?? "未关联产品";
      const skuCode = item.sku?.sku_code ?? "-";

      return `${productName} / ${skuCode}`;
    });
    const extraCount = Math.max(0, request.items.length - labels.length);

    return {
      main: labels.join("、") || request.sku?.sku_name || "-",
      extra: extraCount > 0 ? `等 ${extraCount} 项` : ""
    };
  };
  const getItemStock = (item: FbaReplenishmentRequestItem) =>
    skuStockById.get(item.sku_id);
  const getItemShortage = (item: FbaReplenishmentRequestItem) => {
    const stock = getItemStock(item);

    if (stock === undefined) {
      return null;
    }

    return Math.max(0, Number(item.requested_quantity) - stock);
  };
  const resetFilters = () => {
    setSkuKeyword("");
    setStatusFilter("all");
    setPlatformFilter("all");
    setBrandFilter("all");
    setTargetShipDateStart("");
    setTargetShipDateEnd("");
    setPage(1);
  };
  const openHeaderImport = () => {
    openCreateModal();
    openImportModal();
  };
  const exportRequests = () => {
    downloadCsvTemplate(
      "fba-replenishment-list.csv",
      [
        { key: "备货单号", label: "备货单号" },
        { key: "平台", label: "平台" },
        { key: "SKU数", label: "SKU 数" },
        { key: "总数量", label: "总数量" },
        { key: "运营", label: "运营" },
        { key: "计划发货", label: "计划发货" },
        { key: "状态", label: "状态" }
      ],
      visibleRequests.map((request) => ({
        备货单号: request.request_no,
        平台: parseNotes(request.notes).amazonSite,
        SKU数: String(request.sku_count),
        总数量: String(request.total_requested_quantity),
        运营: request.requested_by_profile?.full_name ?? "",
        计划发货: request.target_ship_date ?? "",
        状态: statusLabels[request.status] ?? request.status
      }))
    );
  };
  const requestColumns: DataTableColumn<FbaReplenishmentRequest>[] = [
    {
      key: "request_no",
      title: "备货单号",
      width: 150,
      render: (request) => (
        <button
          className="linkButton"
          type="button"
          onClick={() => setSelectedRequest(request)}
        >
          {request.request_no}
        </button>
      )
    },
    {
      key: "platform",
      title: "平台",
      width: 92,
      render: (request) => parseNotes(request.notes).amazonSite
    },
    {
      key: "summary",
      title: "产品/SKU 汇总",
      render: (request) => {
        const summary = getRequestSummary(request);
        const firstItem = request.items[0];
        const product = firstItem?.product ?? firstItem?.sku?.product ?? null;

        return (
          <InfoCell
            imageUrl={product?.product_image_url ?? null}
            imageAlt={product?.name ?? "产品"}
            title={summary.main}
            subtitle={summary.extra || getRequestBrandSummary(request)}
          />
        );
      }
    },
    {
      key: "quantity",
      title: "SKU数 / 总数量",
      width: 130,
      render: (request) => (
        <span className="metricText">
          {request.sku_count} / {formatQuantity(request.total_requested_quantity)}
        </span>
      )
    },
    {
      key: "operator",
      title: "运营",
      width: 92,
      render: (request) => request.requested_by_profile?.full_name ?? "-"
    },
    {
      key: "target_ship_date",
      title: "计划发货",
      width: 112,
      render: (request) => formatDate(request.target_ship_date)
    },
    {
      key: "status",
      title: "状态",
      width: 98,
      render: (request) => (
        <StatusBadge status={request.status} label={statusLabels[request.status]} />
      )
    },
    {
      key: "actions",
      title: "操作",
      width: 150,
      render: (request) => (
        <RowActions
          onView={() => setSelectedRequest(request)}
          moreActions={[
            {
              label: "编辑",
              disabled: true,
              onClick: () => undefined
            },
            {
              label: "生成排产建议",
              onClick: () => {
                window.location.href = "/production/planning";
              }
            }
          ]}
        />
      )
    }
  ];

  return (
    <main className="pageShell">
      <PageHeader
        title="备货需求"
        secondaryActions={
          <>
            <button className="secondaryButton" type="button" onClick={openHeaderImport}>
              <UploadIcon size={14} />
              导入
            </button>
            <button className="secondaryButton" type="button" onClick={exportRequests}>
              <DownloadIcon size={14} />
              导出
            </button>
          </>
        }
        primaryAction={
          <button className="primaryButton" type="button" onClick={openCreateModal}>
            <PlusIcon size={14} />
            新增备货单
          </button>
        }
      />

      {successMessage ? (
        <div className="successNotice">
          <strong>操作成功</strong>
          <p>{successMessage}</p>
        </div>
      ) : null}

      <section className="listPanel">
        <SearchFilterBar
          searchLabel="搜索"
          searchValue={skuKeyword}
          searchPlaceholder="单号 / 产品 / SKU / 运营"
          onSearchChange={setSkuKeyword}
          onReset={resetFilters}
          filters={
            <>
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
                平台
                <select
                  value={platformFilter}
                  onChange={(event) => setPlatformFilter(event.target.value)}
                  disabled={loading}
                >
                  {platformOptions.map((platform) => (
                    <option key={platform} value={platform}>
                      {platform === "all" ? "全部平台" : platform}
                    </option>
                  ))}
                </select>
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
            </>
          }
          dateFilters={
            <>
              <label>
                计划发货起
                <input
                  type="date"
                  value={targetShipDateStart}
                  onChange={(event) => setTargetShipDateStart(event.target.value)}
                  disabled={loading}
                />
              </label>
              <label>
                计划发货止
                <input
                  type="date"
                  value={targetShipDateEnd}
                  onChange={(event) => setTargetShipDateEnd(event.target.value)}
                  disabled={loading}
                />
              </label>
            </>
          }
          rightActions={
            <button
              className="secondaryButton"
              type="button"
              onClick={refreshRequests}
              disabled={loading}
            >
              {loading ? "刷新中" : "刷新"}
            </button>
          }
        />

        {errorMessage ? (
          <div className="debugError">
            <strong>查询失败</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        <DataTable
          columns={requestColumns}
          rows={visibleRequests}
          getRowKey={(request) => request.id}
          loading={loading}
          loadingText="正在读取备货需求列表..."
          emptyText="暂无备货需求"
          minWidth={960}
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          total={platformFilter === "all" ? totalRequests : visibleRequests.length}
          onPageChange={setPage}
        />
      </section>

      {selectedRequest ? (
        <DetailDrawer
          open={Boolean(selectedRequest)}
          title="备货单详情"
          width="lg"
          onClose={() => setSelectedRequest(null)}
          footer={
            <>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setSelectedRequest(null)}
              >
                关闭
              </button>
              <button className="secondaryButton" type="button" disabled>
                编辑
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  window.location.href = "/production/planning";
                }}
              >
                生成排产建议
              </button>
            </>
          }
        >
          <section className="drawerSection">
            <div className="drawerSectionHeader">
              <h4>基本信息</h4>
            </div>
            <div className="detailGrid compactDetailGrid">
              <DetailItem label="备货单号" value={selectedRequest.request_no} />
              <DetailItem
                label="平台"
                value={parseNotes(selectedRequest.notes).amazonSite}
              />
              <DetailItem
                label="运营"
                value={selectedRequest.requested_by_profile?.full_name ?? "-"}
              />
              <DetailItem
                label="创建时间"
                value={formatDateTime(selectedRequest.created_at)}
              />
              <DetailItem
                label="计划发货"
                value={formatDate(selectedRequest.target_ship_date)}
              />
              <div className="detailItem">
                <span>状态</span>
                <StatusBadge
                  status={selectedRequest.status}
                  label={statusLabels[selectedRequest.status]}
                />
              </div>
              <DetailItem
                label="目标仓库"
                value={`${selectedRequest.target_warehouse?.name ?? "-"} / ${
                  selectedRequest.target_warehouse?.warehouse_code ?? "-"
                }`}
              />
              <DetailItem
                label="SKU / 数量"
                value={`${selectedRequest.sku_count} / ${formatQuantity(
                  selectedRequest.total_requested_quantity
                )}`}
              />
              <DetailItem
                label="备注"
                value={parseNotes(selectedRequest.notes).displayNotes}
                wide
              />
            </div>
          </section>

          <section className="drawerSection">
            <div className="drawerSectionHeader">
              <h4>SKU 明细</h4>
              <span>共 {selectedRequest.items.length} 项</span>
            </div>
            <div className="tableWrap compactTableWrap noHorizontalScroll">
              <table className="dataTable compactDataTable drawerDetailTable">
                <thead>
                  <tr>
                    <th>产品信息</th>
                    <th>SKU</th>
                    <th>需求数量</th>
                    <th>当前成品库存</th>
                    <th>预计可生产</th>
                    <th>缺口</th>
                    <th>备注</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedRequest.items.map((item) => {
                    const stock = getItemStock(item);
                    const shortage = getItemShortage(item);
                    const product = item.product ?? item.sku?.product ?? null;

                    return (
                      <tr key={item.id}>
                        <td>
                          <InfoCell
                            imageUrl={product?.product_image_url ?? null}
                            imageAlt={product?.name ?? "产品"}
                            title={product?.name ?? "未关联产品"}
                            subtitle={product?.product_code ?? "-"}
                          />
                        </td>
                        <td>
                          <EllipsisText title={item.sku?.sku_code ?? undefined}>
                            {item.sku?.sku_code ?? "-"}
                          </EllipsisText>
                          <span className="tableSubText">
                            {item.sku?.sku_name ?? "-"}
                          </span>
                        </td>
                        <td>{formatQuantity(item.requested_quantity)}</td>
                        <td>
                          {stock === undefined ? "未加载" : formatQuantity(stock)}
                        </td>
                        <td>{stock === undefined ? "待算料" : "排产后计算"}</td>
                        <td>
                          {shortage === null || shortage === 0 ? (
                            <span className="goodText">
                              {shortage === null ? "-" : "充足"}
                            </span>
                          ) : (
                            <span className="dangerText">
                              {formatQuantity(shortage)}
                            </span>
                          )}
                        </td>
                        <td className="notesCell">{item.remark ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </DetailDrawer>
      ) : null}

      <DrawerForm
        open={createOpen}
        title="创建备货单"
        width="lg"
        onClose={() => {
          if (!submitting) {
            setCreateOpen(false);
          }
        }}
        footer={
          <>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setCreateOpen(false)}
              disabled={submitting}
            >
              取消
            </button>
            <button
              className="primaryButton"
              type="submit"
              form="replenishment-create-form"
              disabled={loadingOptions || submitting}
            >
              {submitting ? "正在创建..." : "提交备货单"}
            </button>
          </>
        }
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
          id="replenishment-create-form"
          className="dataForm replenishmentCreateForm"
          onSubmit={handleCreateRequest}
        >
          <div className="fullField createMetaGrid">
            <DetailItem label="备货单号" value="提交时自动生成" />
            <DetailItem label="需求人" value={user.name} />
            <DetailItem label="需求日期" value={todayText} />
          </div>

          <label>
            平台
            <select
              value={createForm.platform}
              onChange={(event) =>
                updateCreateForm("platform", event.target.value)
              }
              disabled={submitting}
            >
              <option value="US">US</option>
              <option value="CA">CA</option>
              <option value="MX">MX</option>
              <option value="UK">UK</option>
              <option value="DE">DE</option>
              <option value="FR">FR</option>
              <option value="IT">IT</option>
              <option value="ES">ES</option>
              <option value="JP">JP</option>
            </select>
          </label>

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
                            inputMode="numeric"
                            min="1"
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

            <div
              className="bulkUploadBox dragUploadBox"
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                handleImportFile(event.dataTransfer.files?.[0]);
              }}
            >
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
                  : "拖拽上传 Excel 导出的 CSV，或点击按钮选择文件。"}
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
                    文件重复 SKU{" "}
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
                                inputMode="numeric"
                                min="1"
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
      </DrawerForm>
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
