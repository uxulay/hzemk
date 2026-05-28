"use client";

import { toBlob, toPng } from "html-to-image";
import { useEffect, useMemo, useRef, useState } from "react";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  SupplierSearchSelect,
  type SupplierSearchOption
} from "@/components/SupplierSearchSelect";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowActions } from "@/components/ui/row-actions";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { type Supplier } from "@/lib/api/master-data";
import { searchMaterialSupplierOptions } from "@/lib/api/materials";
import {
  createPurchaseOrder,
  createManualPurchaseOrder,
  createPurchaseOrderNo,
  getExistingPurchaseOrderNos,
  getPurchaseMaterialOptions,
  getPurchaseOrdersPage,
  getPurchaseProfileOptions,
  getPurchaseOrderDetail,
  searchPurchaseMaterialOptions,
  getShortageMaterialRequirements,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  type PurchaseMaterialOption,
  type PurchaseOrderItem,
  type PurchaseOrderSource,
  type PurchaseProfileOption,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type ShortageMaterialRequirement
} from "@/lib/api/purchase";
import type {
  BulkImportResult,
  BulkImportValidationRow
} from "@/lib/bulk-types";
import type { CsvTemplateField } from "@/lib/utils/csv";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

const purchaseStatusLabels: Record<PurchaseOrderStatus, string> = {
  draft: "草稿",
  ordered: "已下单",
  partially_received: "部分到货",
  received: "已到货",
  cancelled: "已取消"
};

const purchaseSourceLabels: Record<PurchaseOrderSource, string> = {
  shortage: "缺料生成",
  manual: "手动创建",
  bulk_import: "批量导入"
};

const defaultPurchaseCompanyName = "HZEMK 采购中心";

const purchaseImportFields: CsvTemplateField[] = [
  { key: "purchase_order_no", label: "采购单号", example: "PUR-20260601-1234" },
  { key: "supplier_code", label: "供应商编码", required: true, example: "SUP-001" },
  { key: "order_date", label: "下单日期", example: "2026-06-01" },
  {
    key: "expected_arrival_date",
    label: "预计到货日期",
    example: "2026-06-08"
  },
  {
    key: "material_code",
    label: "辅料编码",
    required: true,
    aliases: ["辅料编码", "material_sku_code", "sku_code"],
    example: "MAT-001"
  },
  { key: "quantity", label: "采购数量", required: true, example: "100" },
  { key: "unit_price", label: "单价", example: "1.5" },
  { key: "remark", label: "备注", example: "常用包材备货" }
];

const purchaseImportSampleRows = [
  {
    purchase_order_no: "",
    supplier_code: "SUP-001",
    order_date: "2026-06-01",
    expected_arrival_date: "2026-06-08",
    material_code: "MAT-001",
    quantity: "100",
    unit_price: "1.5",
    remark: "同供应商同预计到货日会合并为一张采购单"
  }
];

type DraftItem = {
  materialRequirementId: string;
  materialId: string | null;
  skuId: string;
  materialCode: string;
  materialName: string;
  specs: string | null;
  productionOrderNo: string;
  defaultSupplierId: string | null;
  defaultSupplierLabel: string;
  orderedQuantity: string;
  shortageQuantity: number;
  unit: string;
  unitPrice: string;
};

type ManualItem = {
  localId: string;
  itemId?: string;
  materialId: string;
  skuId: string;
  materialCode: string;
  materialName: string;
  specs: string | null;
  unit: string;
  quantity: string;
  unitPrice: string;
  notes: string;
};

type ManualFormState = {
  mode: "create" | "edit";
  purchaseOrderId?: string;
  purchaseOrderNo?: string;
  supplierId: string;
  createdBy: string;
  orderDate: string;
  expectedArrivalDate: string;
  notes: string;
  items: ManualItem[];
};

type PurchaseImportInput = {
  purchaseOrderNo: string;
  supplierId: string;
  supplierCode: string;
  orderDate: string;
  expectedArrivalDate: string;
  materialId: string;
  skuId: string | null;
  materialCode: string;
  materialName: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  remark: string;
  groupKey: string;
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

function toSupplierRows(nextSuppliers: SupplierSearchOption[]): Supplier[] {
  return nextSuppliers.map((supplier) => ({
    id: supplier.id,
    supplier_code: supplier.supplier_code,
    name: supplier.name,
    contact_name: supplier.contact_name ?? null,
    phone: supplier.phone ?? null,
    email: "",
    address: "",
    status: supplier.status ?? "active",
    notes: null,
    created_at: "",
    updated_at: ""
  }));
}

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function getLineAmount(item: Pick<PurchaseOrderItem, "ordered_quantity" | "unit_price">) {
  return Number(item.ordered_quantity) * Number(item.unit_price ?? 0);
}

function getOrderTotalQuantity(order: PurchaseOrder) {
  return order.items.reduce(
    (sum, item) => sum + Number(item.ordered_quantity || 0),
    0
  );
}

function getOrderItemSummary(order: PurchaseOrder) {
  const totalQuantity = getOrderTotalQuantity(order);

  return `${order.item_count} 种 / ${formatQuantity(totalQuantity)}`;
}

function getSupplierSubtitle(order: PurchaseOrder) {
  const contact = order.supplier?.contact_name ?? "";
  const phone = order.supplier?.phone ?? "";
  const contactText = [contact, phone].filter(Boolean).join(" / ");

  return contactText || order.supplier?.supplier_code || "未维护联系人";
}

function getOrderMaker(order: PurchaseOrder) {
  return (
    order.created_by_profile?.full_name ||
    order.created_by_profile?.email ||
    "系统生成"
  );
}

function sanitizeFileNamePart(value: string) {
  return value.trim().replace(/[\\/:*?"<>|\s]+/g, "_") || "未填写";
}

function getPurchaseOrderImageFileName(order: PurchaseOrder) {
  const supplierName = order.supplier?.name ?? "未填写供应商";

  return `采购单_${sanitizeFileNamePart(order.purchase_order_no)}_${sanitizeFileNamePart(
    supplierName
  )}.png`;
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function toDateInputValue(value: string | null | undefined) {
  if (!value) {
    return "";
  }

  return value.slice(0, 10);
}

function getTodayInputValue() {
  return new Date().toISOString().slice(0, 10);
}

function isDateText(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function getManualEmptyItem(): ManualItem {
  return {
    localId: crypto.randomUUID(),
    materialId: "",
    skuId: "",
    materialCode: "",
    materialName: "",
    specs: null,
    unit: "",
    quantity: "",
    unitPrice: "0",
    notes: ""
  };
}

function getEmptyManualForm(): ManualFormState {
  return {
    mode: "create",
    supplierId: "",
    createdBy: "",
    orderDate: getTodayInputValue(),
    expectedArrivalDate: "",
    notes: "",
    items: [getManualEmptyItem()]
  };
}

function getPurchaseMaterialLabel(material: PurchaseMaterialOption) {
  return `${material.material_code} / ${material.material_name}`;
}

function getSupplierOptionLabel(supplier: Supplier) {
  const statusText = supplier.status === "inactive" ? " / 停用" : "";

  return `${supplier.supplier_code} / ${supplier.name}${statusText}`;
}

function getMaterialDefaultSupplierLabel(
  material: Pick<PurchaseMaterialOption, "default_supplier">
) {
  if (!material.default_supplier) {
    return "未设置";
  }

  const statusText =
    material.default_supplier.status === "inactive" ? " / 停用" : "";

  return `${material.default_supplier.supplier_code} / ${material.default_supplier.name}${statusText}`;
}

function getDefaultSupplierSummary(
  items: Array<{ materialId: string }>,
  materials: PurchaseMaterialOption[]
) {
  const selectedMaterials = items
    .map((item) => materials.find((material) => material.id === item.materialId))
    .filter((material): material is PurchaseMaterialOption => Boolean(material));
  const supplierIds = Array.from(
    new Set(
      selectedMaterials
        .map((material) => material.default_supplier_id)
        .filter((supplierId): supplierId is string => Boolean(supplierId))
    )
  );
  const missingCount = selectedMaterials.filter(
    (material) => !material.default_supplier_id
  ).length;

  return {
    selectedCount: selectedMaterials.length,
    supplierIds,
    missingCount
  };
}

function MaterialSearchSelect({
  materials,
  value,
  disabled,
  onSearch,
  onOptionsChange,
  onChange
}: {
  materials: PurchaseMaterialOption[];
  value: string;
  disabled: boolean;
  onSearch: (keyword: string) => Promise<PurchaseMaterialOption[]>;
  onOptionsChange: (materials: PurchaseMaterialOption[]) => void;
  onChange: (materialId: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const [searching, setSearching] = useState(false);
  const selectedMaterial = materials.find((material) => material.id === value);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredMaterials = normalizedKeyword
    ? materials.filter((material) =>
        [
          material.material_code,
          material.material_name,
          material.specs ?? ""
        ]
          .join(" / ")
          .toLowerCase()
          .includes(normalizedKeyword)
      )
    : materials.slice(0, 8);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const nextMaterials = await onSearch(keyword);

        if (!cancelled) {
          onOptionsChange(nextMaterials);
        }
      } finally {
        if (!cancelled) {
          setSearching(false);
        }
      }
    }, 300);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [keyword, onOptionsChange, onSearch]);

  return (
    <div className="tableSearchPicker">
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        disabled={disabled}
        placeholder={
          selectedMaterial
            ? `当前：${getPurchaseMaterialLabel(selectedMaterial)}`
            : "搜索辅料"
        }
      />
      {selectedMaterial ? (
        <strong>{getPurchaseMaterialLabel(selectedMaterial)}</strong>
      ) : null}
      <div className="searchPickerList">
        {searching ? (
          <p className="tableHint">正在搜索辅料...</p>
        ) : filteredMaterials.length === 0 ? (
          <p className="tableHint">没有匹配的辅料。</p>
        ) : (
          filteredMaterials.map((material) => (
            <button
              type="button"
              key={material.id}
              className={material.id === value ? "active" : undefined}
              onClick={() => {
                onChange(material.id);
                setKeyword("");
              }}
              disabled={disabled}
            >
              {getPurchaseMaterialLabel(material)}
              <span>默认供应商：{getMaterialDefaultSupplierLabel(material)}</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

function getImportValue(row: Record<string, string>, keys: string[]) {
  for (const key of keys) {
    const value = row[key]?.trim();

    if (value) {
      return value;
    }
  }

  return "";
}

function downloadPurchaseOrderCsv(order: PurchaseOrder) {
  if (order.items.length === 0) {
    throw new Error("这张采购单没有明细，暂时不能导出。");
  }

  const headers = [
    "采购单号",
    "供应商",
    "联系人",
    "联系电话",
    "邮箱",
    "下单日期",
    "预计到货日期",
    "辅料编码",
    "辅料名称",
    "规格",
    "单位",
    "采购数量",
    "单价",
    "小计",
    "备注"
  ];
  const rows = order.items.map((item) => {
    const subtotal = Number(item.ordered_quantity) * Number(item.unit_price ?? 0);

    return [
      order.purchase_order_no,
      order.supplier?.name ?? "",
      order.supplier?.contact_name ?? "",
      order.supplier?.phone ?? "",
      order.supplier?.email ?? "",
      formatDate(order.ordered_at),
      formatDate(order.expected_arrival_date),
      item.material?.material_code ?? item.sku?.sku_code ?? "",
      item.material?.material_name ?? item.sku?.sku_name ?? "",
      item.material?.specs ?? item.sku?.specs ?? "",
      item.unit,
      Number(item.ordered_quantity),
      Number(item.unit_price ?? 0),
      subtotal.toFixed(2),
      item.notes ?? order.notes ?? ""
    ];
  });
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeSupplierName = (order.supplier?.name ?? "未填写供应商").replace(
    /[\\/:*?"<>|]/g,
    "-"
  );

  link.href = url;
  link.download = `${order.purchase_order_no}-${safeSupplierName}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function downloadPurchaseOrderListCsv(orders: PurchaseOrder[]) {
  const headers = [
    "采购单号",
    "供应商",
    "物料种类",
    "采购总数量",
    "采购金额",
    "预计到货日期",
    "状态",
    "创建时间"
  ];
  const rows = orders.map((order) => [
    order.purchase_order_no,
    order.supplier?.name ?? "",
    order.item_count,
    getOrderTotalQuantity(order),
    order.total_amount.toFixed(2),
    formatDate(order.expected_arrival_date),
    purchaseStatusLabels[order.status] ?? order.status,
    formatDateTime(order.created_at)
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
  const blob = new Blob([`\uFEFF${csv}`], {
    type: "text/csv;charset=utf-8"
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = `采购单列表_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function getDraftItem(requirement: ShortageMaterialRequirement): DraftItem {
  const defaultSupplierId = requirement.material?.default_supplier_id ?? null;
  const defaultSupplierLabel = requirement.material
    ? getMaterialDefaultSupplierLabel(requirement.material)
    : "未设置";

  return {
    materialRequirementId: requirement.id,
    materialId: requirement.material_id,
    skuId: "",
    materialCode: requirement.material?.material_code ?? "-",
    materialName: requirement.material?.material_name ?? "-",
    specs: requirement.material?.specs ?? null,
    productionOrderNo: requirement.production_order?.production_order_no ?? "-",
    defaultSupplierId,
    defaultSupplierLabel,
    orderedQuantity: String(Number(requirement.shortage_quantity)),
    shortageQuantity: Number(requirement.shortage_quantity),
    unit: requirement.unit,
    unitPrice: ""
  };
}

export default function PurchaseOrdersPage() {
  const purchaseOrderImageRef = useRef<HTMLDivElement | null>(null);
  const [shortages, setShortages] = useState<ShortageMaterialRequirement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materials, setMaterials] = useState<PurchaseMaterialOption[]>([]);
  const [purchaseProfiles, setPurchaseProfiles] = useState<
    PurchaseProfileOption[]
  >([]);
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>(
    []
  );
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [draftSupplierNotice, setDraftSupplierNotice] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] =
    useState<PurchaseOrderStatus | "all">("all");
  const [orderKeyword, setOrderKeyword] = useState("");
  const [orderStartDate, setOrderStartDate] = useState("");
  const [orderEndDate, setOrderEndDate] = useState("");
  const [orderDate, setOrderDate] = useState(getTodayInputValue());
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [notes, setNotes] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [manualForm, setManualForm] = useState<ManualFormState | null>(null);
  const [manualSupplierNotice, setManualSupplierNotice] = useState("");
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [imagePreviewOrder, setImagePreviewOrder] =
    useState<PurchaseOrder | null>(null);
  const [imageExporting, setImageExporting] = useState(false);
  const [imageActionMessage, setImageActionMessage] = useState("");
  const [generatedOrders, setGeneratedOrders] = useState<
    Array<{ id: string; purchaseOrderNo: string }>
  >([]);
  const [shortagePage, setShortagePage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
  const [totalPurchaseOrders, setTotalPurchaseOrders] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedRequirements = useMemo(() => {
    const selectedIds = new Set(selectedRequirementIds);
    return shortages.filter((item) => selectedIds.has(item.id));
  }, [selectedRequirementIds, shortages]);

  const allShortagesSelected =
    shortages.length > 0 && selectedRequirementIds.length === shortages.length;

  const paginatedShortages = useMemo(
    () => paginateItems(shortages, shortagePage),
    [shortagePage, shortages]
  );

  const draftTotalAmount = draftItems.reduce((sum, item) => {
    const quantity = Number(item.orderedQuantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;

    return sum + quantity * unitPrice;
  }, 0);

  const imageGeneratedAt = useMemo(
    () => new Date().toISOString(),
    [imagePreviewOrder?.id]
  );
  const updatePurchaseMaterialOptions = useMemo(
    () => (nextMaterials: PurchaseMaterialOption[]) => setMaterials(nextMaterials),
    []
  );
  const updateSupplierOptions = useMemo(
    () => (nextSuppliers: SupplierSearchOption[]) => {
      setSuppliers(toSupplierRows(nextSuppliers));
    },
    []
  );

  const getSupplierNameById = (targetSupplierId: string) => {
    const supplier = suppliers.find((item) => item.id === targetSupplierId);

    return supplier ? getSupplierOptionLabel(supplier) : "默认供应商";
  };

  const getDraftSupplierDecision = (items: DraftItem[]) => {
    const supplierIds = Array.from(
      new Set(
        items
          .map((item) => item.defaultSupplierId)
          .filter((itemSupplierId): itemSupplierId is string =>
            Boolean(itemSupplierId)
          )
      )
    );
    const missingCount = items.filter((item) => !item.defaultSupplierId).length;

    return {
      supplierIds,
      missingCount,
      canAutoSplit:
        items.length > 0 && supplierIds.length > 1 && missingCount === 0
    };
  };

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        shortageData,
        orderData,
        supplierData,
        materialData,
        purchaseProfileData
      ] = await Promise.all([
        getShortageMaterialRequirements(),
        getPurchaseOrdersPage({
          page: orderPage,
          pageSize: DEFAULT_PAGE_SIZE,
          keyword: orderKeyword,
          filters: {
            status: orderStatusFilter,
            supplierId: supplierFilter,
            startDate: orderStartDate,
            endDate: orderEndDate
          }
        }),
        searchMaterialSupplierOptions("", 20),
        getPurchaseMaterialOptions(),
        getPurchaseProfileOptions()
      ]);

      setShortages(shortageData);
      setPurchaseOrders(orderData.rows);
      setTotalPurchaseOrders(orderData.total);
      setSuppliers(toSupplierRows(supplierData));
      setMaterials(materialData);
      setPurchaseProfiles(purchaseProfileData);
      setSelectedRequirementIds((current) =>
        current.filter((id) => shortageData.some((item) => item.id === id))
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setShortages([]);
      setPurchaseOrders([]);
      setTotalPurchaseOrders(0);
      setSuppliers([]);
      setMaterials([]);
      setPurchaseProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, [
    orderPage,
    orderKeyword,
    orderStatusFilter,
    supplierFilter,
    orderStartDate,
    orderEndDate
  ]);

  useEffect(() => {
    setOrderPage(1);
  }, [orderKeyword, orderStatusFilter, supplierFilter, orderStartDate, orderEndDate]);

  const toggleRequirement = (requirementId: string) => {
    setSelectedRequirementIds((current) =>
      current.includes(requirementId)
        ? current.filter((id) => id !== requirementId)
        : [...current, requirementId]
    );
  };

  const toggleAllShortages = () => {
    setSelectedRequirementIds(
      allShortagesSelected ? [] : shortages.map((item) => item.id)
    );
  };

  const openDraftForm = (requirements: ShortageMaterialRequirement[]) => {
    if (requirements.length === 0) {
      setErrorMessage("请先选择要采购的缺料物料。");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setGeneratedOrders([]);
    const nextDraftItems = requirements.map(getDraftItem);
    const supplierDecision = getDraftSupplierDecision(nextDraftItems);

    setDraftItems(nextDraftItems);
    if (supplierDecision.supplierIds.length === 1 && supplierDecision.missingCount === 0) {
      const [nextSupplierId] = supplierDecision.supplierIds;

      setSupplierId(nextSupplierId);
      setDraftSupplierNotice(
        `已根据辅料默认供应商自动带出：${getSupplierNameById(nextSupplierId)}。`
      );
    } else if (supplierDecision.canAutoSplit) {
      setSupplierId("");
      setDraftSupplierNotice(
        `这些缺料辅料默认供应商不一致，提交时会按默认供应商自动拆成 ${supplierDecision.supplierIds.length} 张采购单。`
      );
    } else if (supplierDecision.supplierIds.length > 0) {
      setSupplierId("");
      setDraftSupplierNotice(
        "部分辅料未设置默认供应商，或默认供应商不完全一致，请手动选择供应商，或分开生成采购单。"
      );
    } else {
      setSupplierId("");
      setDraftSupplierNotice("这些缺料辅料还没有默认供应商，请手动选择供应商。");
    }
    setCreatedBy("");
    setOrderDate(getTodayInputValue());
    setExpectedArrivalDate("");
    setNotes("");
  };

  const closeDraftForm = () => {
    if (submitting) {
      return;
    }

    setDraftItems([]);
    setDraftSupplierNotice("");
  };

  const updateDraftItem = (
    materialRequirementId: string,
    field: "orderedQuantity" | "unitPrice",
    value: string
  ) => {
    setDraftItems((current) =>
      current.map((item) =>
        item.materialRequirementId === materialRequirementId
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const openManualCreateForm = () => {
    setErrorMessage("");
    setSuccessMessage("");
    setGeneratedOrders([]);
    setManualSupplierNotice("");
    setManualForm(getEmptyManualForm());
  };

  const openManualEditForm = async (purchaseOrderId: string) => {
    try {
      setDetailLoading(true);
      setErrorMessage("");
      const order = await getPurchaseOrderDetail(purchaseOrderId);

      if (order.status !== "draft") {
        setErrorMessage("只有草稿状态的采购单可以编辑。");
        return;
      }

      setManualSupplierNotice("");
      setManualForm({
        mode: "edit",
        purchaseOrderId: order.id,
        purchaseOrderNo: order.purchase_order_no,
        supplierId: order.supplier_id ?? "",
        createdBy: order.created_by ?? "",
        orderDate: toDateInputValue(order.ordered_at) || getTodayInputValue(),
        expectedArrivalDate: order.expected_arrival_date ?? "",
        notes: order.notes ?? "",
        items: order.items.map((item) => ({
          localId: item.id,
          itemId: item.id,
          materialId: item.material_id ?? "",
          skuId: item.sku_id ?? "",
          materialCode: item.material?.material_code ?? item.sku?.sku_code ?? "",
          materialName: item.material?.material_name ?? item.sku?.sku_name ?? "",
          specs: item.material?.specs ?? item.sku?.specs ?? null,
          unit: item.unit,
          quantity: String(Number(item.ordered_quantity)),
          unitPrice: String(Number(item.unit_price ?? 0)),
          notes: item.notes ?? ""
        }))
      });
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const closeManualForm = () => {
    if (!submitting) {
      setManualForm(null);
      setManualSupplierNotice("");
    }
  };

  const updateManualForm = <TField extends keyof ManualFormState>(
    field: TField,
    value: ManualFormState[TField]
  ) => {
    setManualForm((current) => (current ? { ...current, [field]: value } : current));
  };

  const updateManualItem = (
    localId: string,
    field: keyof ManualItem,
    value: string
  ) => {
    setManualForm((current) => {
      if (!current) {
        return current;
      }

      const nextItems = current.items.map((item) => {
        if (item.localId !== localId) {
          return item;
        }

        if (field === "materialId") {
          const material = materials.find((option) => option.id === value);

          return {
            ...item,
            materialId: value,
            skuId: "",
            materialCode: material?.material_code ?? "",
            materialName: material?.material_name ?? "",
            specs: material?.specs ?? null,
            unit: material?.unit ?? ""
          };
        }

        return {
          ...item,
          [field]: value
        };
      });

      if (field !== "materialId" || current.mode !== "create") {
        return {
          ...current,
          items: nextItems
        };
      }

      const supplierDecision = getDefaultSupplierSummary(nextItems, materials);
      const nextSupplierId =
        supplierDecision.selectedCount > 0 &&
        supplierDecision.supplierIds.length === 1 &&
        supplierDecision.missingCount === 0
          ? supplierDecision.supplierIds[0]
          : "";

      if (nextSupplierId) {
        setManualSupplierNotice(
          `已根据辅料默认供应商自动带出：${getSupplierNameById(nextSupplierId)}。`
        );
      } else if (supplierDecision.supplierIds.length > 1) {
        setManualSupplierNotice(
          "已选择的辅料默认供应商不一致，请手动选择供应商，或拆成多张采购单。"
        );
      } else if (supplierDecision.selectedCount > 0) {
        setManualSupplierNotice(
          "部分辅料未设置默认供应商，请手动确认供应商。"
        );
      } else {
        setManualSupplierNotice("");
      }

      return {
        ...current,
        supplierId: nextSupplierId,
        items: nextItems
      };
    });
  };

  const addManualItem = () => {
    setManualForm((current) =>
      current ? { ...current, items: [...current.items, getManualEmptyItem()] } : current
    );
  };

  const removeManualItem = (localId: string) => {
    setManualForm((current) => {
      if (!current || current.items.length <= 1) {
        return current;
      }

      const nextItems = current.items.filter((item) => item.localId !== localId);

      if (current.mode !== "create") {
        return {
          ...current,
          items: nextItems
        };
      }

      const supplierDecision = getDefaultSupplierSummary(nextItems, materials);
      const nextSupplierId =
        supplierDecision.selectedCount > 0 &&
        supplierDecision.supplierIds.length === 1 &&
        supplierDecision.missingCount === 0
          ? supplierDecision.supplierIds[0]
          : "";

      setManualSupplierNotice(
        nextSupplierId
          ? `已根据辅料默认供应商自动带出：${getSupplierNameById(nextSupplierId)}。`
          : ""
      );

      return {
        ...current,
        supplierId: nextSupplierId,
        items: nextItems
      };
    });
  };

  const manualTotalAmount = (manualForm?.items ?? []).reduce((sum, item) => {
    return sum + (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
  }, 0);

  const submitPurchaseOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");
      setGeneratedOrders([]);

      const supplierDecision = getDraftSupplierDecision(draftItems);
      const toPurchaseInputItems = (items: DraftItem[]) =>
        items.map((item) => ({
          materialId: item.materialId,
          skuId: item.skuId,
          materialRequirementId: item.materialRequirementId,
          orderedQuantity: Number(item.orderedQuantity),
          unit: item.unit,
          unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
          notes: `来源生产任务：${item.productionOrderNo}`
        }));

      if (!supplierId && supplierDecision.canAutoSplit) {
        const createdLinks: Array<{ id: string; purchaseOrderNo: string }> = [];

        for (const defaultSupplierId of supplierDecision.supplierIds) {
          const groupItems = draftItems.filter(
            (item) => item.defaultSupplierId === defaultSupplierId
          );
          const created = await createPurchaseOrder({
            supplierId: defaultSupplierId,
            createdBy,
            orderDate,
            expectedArrivalDate,
            notes,
            items: toPurchaseInputItems(groupItems)
          });

          createdLinks.push({
            id: created.id,
            purchaseOrderNo: created.purchase_order_no
          });
        }

        setGeneratedOrders(createdLinks);
        setSuccessMessage(
          `已按默认供应商拆分生成 ${createdLinks.length} 张采购单：${createdLinks
            .map((item) => item.purchaseOrderNo)
            .join("、")}。`
        );
      } else {
        if (!supplierId) {
          throw new Error("请选择供应商，或只选择已设置默认供应商且可自动拆分的缺料辅料。");
        }

        const created = await createPurchaseOrder({
          supplierId,
          createdBy,
          orderDate,
          expectedArrivalDate,
          notes,
          items: toPurchaseInputItems(draftItems)
        });

        setSuccessMessage(`采购单 ${created.purchase_order_no} 创建成功。`);
        setGeneratedOrders([
          {
            id: created.id,
            purchaseOrderNo: created.purchase_order_no
          }
        ]);
      }
      setDraftItems([]);
      setDraftSupplierNotice("");
      setSelectedRequirementIds([]);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitManualPurchaseOrder = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!manualForm) {
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const items = manualForm.items.map((item) => ({
        materialId: item.materialId,
        skuId: item.skuId,
        orderedQuantity: Number(item.quantity),
        unit: item.unit,
        unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
        notes: item.notes
      }));

      if (manualForm.mode === "edit" && manualForm.purchaseOrderId) {
        await updatePurchaseOrder({
          purchaseOrderId: manualForm.purchaseOrderId,
          supplierId: manualForm.supplierId,
          createdBy: manualForm.createdBy,
          orderDate: manualForm.orderDate,
          expectedArrivalDate: manualForm.expectedArrivalDate,
          notes: manualForm.notes,
          items: manualForm.items.map((item) => ({
            id: item.itemId ?? "",
            orderedQuantity: Number(item.quantity),
            unitPrice: item.unitPrice ? Number(item.unitPrice) : 0,
            notes: item.notes
          }))
        });
        setSuccessMessage(`采购单 ${manualForm.purchaseOrderNo} 已更新。`);
      } else {
        const created = await createManualPurchaseOrder({
          supplierId: manualForm.supplierId,
          createdBy: manualForm.createdBy,
          orderDate: manualForm.orderDate,
          expectedArrivalDate: manualForm.expectedArrivalDate,
          notes: manualForm.notes,
          source: "manual",
          items
        });
        setSuccessMessage(`采购单 ${created.purchase_order_no} 创建成功。`);
        setGeneratedOrders([
          {
            id: created.id,
            purchaseOrderNo: created.purchase_order_no
          }
        ]);
      }

      setManualForm(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const viewDetail = async (purchaseOrderId: string) => {
    try {
      setDetailLoading(true);
      setErrorMessage("");
      setDetail(await getPurchaseOrderDetail(purchaseOrderId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (
    purchaseOrderId: string,
    status: PurchaseOrderStatus
  ) => {
    try {
      setStatusUpdatingId(purchaseOrderId);
      setErrorMessage("");
      setSuccessMessage("");

      await updatePurchaseOrderStatus(purchaseOrderId, status);
      setSuccessMessage(`采购单状态已更新为${purchaseStatusLabels[status]}。`);
      await loadPageData();

      if (detail?.id === purchaseOrderId) {
        setDetail(await getPurchaseOrderDetail(purchaseOrderId));
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  const exportOrder = async (order: PurchaseOrder) => {
    try {
      setErrorMessage("");
      const detailOrder =
        order.items.length > 0 ? order : await getPurchaseOrderDetail(order.id);
      downloadPurchaseOrderCsv(detailOrder);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    }
  };

  const openOrderImagePreview = async (order: PurchaseOrder | string) => {
    try {
      setDetailLoading(true);
      setErrorMessage("");
      setImageActionMessage("");

      const detailOrder =
        typeof order === "string"
          ? await getPurchaseOrderDetail(order)
          : order.items.length > 0
            ? order
            : await getPurchaseOrderDetail(order.id);

      setImagePreviewOrder(detailOrder);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const downloadOrderImage = async () => {
    if (!purchaseOrderImageRef.current || !imagePreviewOrder) {
      return;
    }

    try {
      setImageExporting(true);
      setImageActionMessage("");
      const dataUrl = await toPng(purchaseOrderImageRef.current, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 2
      });
      const link = document.createElement("a");

      link.href = dataUrl;
      link.download = getPurchaseOrderImageFileName(imagePreviewOrder);
      document.body.appendChild(link);
      link.click();
      link.remove();
      setImageActionMessage("采购单图片已下载。");
    } catch (error) {
      setImageActionMessage(getErrorMessage(error));
    } finally {
      setImageExporting(false);
    }
  };

  const copyOrderImage = async () => {
    if (!purchaseOrderImageRef.current) {
      return;
    }

    try {
      setImageExporting(true);
      setImageActionMessage("");

      if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") {
        throw new Error("当前浏览器不支持直接复制图片，请使用下载图片。");
      }

      const blob = await toBlob(purchaseOrderImageRef.current, {
        backgroundColor: "#ffffff",
        cacheBust: true,
        pixelRatio: 2
      });

      if (!blob) {
        throw new Error("图片生成失败，请重试下载。");
      }

      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type || "image/png"]: blob
        })
      ]);
      setImageActionMessage("采购单图片已复制，可以直接粘贴发送。");
    } catch (error) {
      setImageActionMessage(getErrorMessage(error));
    } finally {
      setImageExporting(false);
    }
  };

  const validateImportRows = async (
    rows: Record<string, string>[]
  ): Promise<BulkImportValidationRow<PurchaseImportInput>[]> => {
    const supplierByCode = new Map(
      suppliers.map((supplier) => [supplier.supplier_code, supplier])
    );
    const materialByCode = new Map(
      materials.map((material) => [material.material_code, material])
    );
    const providedOrderNos = rows
      .map((row) => row.purchase_order_no?.trim() ?? "")
      .filter(Boolean);
    const existingOrderNos = new Set(
      await getExistingPurchaseOrderNos(providedOrderNos)
    );

    const duplicateKeyCount = new Map<string, number>();
    rows.forEach((row) => {
      const orderNo = row.purchase_order_no?.trim() ?? "";
      const supplierCode = row.supplier_code?.trim() ?? "";
      const expectedArrivalDate = row.expected_arrival_date?.trim() ?? "";
      const groupKey = orderNo || `auto:${supplierCode}:${expectedArrivalDate}`;
      const materialCode = getImportValue(row, [
        "material_code",
        "辅料编码",
        "material_sku_code",
        "sku_code"
      ]);
      const key = `${groupKey}:${materialCode}`;

      duplicateKeyCount.set(key, (duplicateKeyCount.get(key) ?? 0) + 1);
    });

    return rows.map((row, index) => {
      const errors: string[] = [];
      const notes: string[] = [];
      const purchaseOrderNo = row.purchase_order_no?.trim() ?? "";
      const supplierCode = row.supplier_code?.trim() ?? "";
      const orderDate = row.order_date?.trim() || getTodayInputValue();
      const expectedArrivalDate = row.expected_arrival_date?.trim() ?? "";
      const materialCode = getImportValue(row, [
        "material_code",
        "辅料编码",
        "material_sku_code",
        "sku_code"
      ]);
      const quantity = Number(row.quantity);
      const unitPrice = row.unit_price ? Number(row.unit_price) : 0;
      const supplier = supplierByCode.get(supplierCode);
      const material = materialByCode.get(materialCode);
      const groupKey =
        purchaseOrderNo || `auto:${supplierCode}:${expectedArrivalDate}`;

      if (!supplierCode) {
        errors.push("supplier_code 必填。");
      } else if (!supplier) {
        errors.push("供应商编码不存在。");
      }

      if (purchaseOrderNo && existingOrderNos.has(purchaseOrderNo)) {
        errors.push("采购单号已存在，第一版不会覆盖旧单。");
      }

      if (orderDate && !isDateText(orderDate)) {
        errors.push("order_date 必须是 YYYY-MM-DD。");
      }

      if (expectedArrivalDate && !isDateText(expectedArrivalDate)) {
        errors.push("expected_arrival_date 必须是 YYYY-MM-DD。");
      }

      if (!materialCode) {
        errors.push("material_code 必填。");
      } else if (!material) {
        errors.push("辅料编码不存在，或辅料已停用。");
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push("quantity 必须大于 0。");
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        errors.push("unit_price 不能小于 0。");
      }

      if (duplicateKeyCount.get(`${groupKey}:${materialCode}`)! > 1) {
        notes.push("同一采购单内存在重复辅料，请检查。");
      }

      return {
        rowNumber: index + 2,
        rawRow: row,
        groupKey,
        errors,
        notes,
        data:
          supplier && material
            ? {
                purchaseOrderNo,
                supplierId: supplier.id,
                supplierCode,
                orderDate,
                expectedArrivalDate,
                materialId: material.id,
                skuId: null,
                materialCode: material.material_code,
                materialName: material.material_name,
                unit: material.unit,
                quantity,
                unitPrice,
                remark: row.remark?.trim() ?? "",
                groupKey
              }
            : undefined
      };
    });
  };

  const importPurchaseOrders = async (
    rows: BulkImportValidationRow<PurchaseImportInput>[]
  ): Promise<BulkImportResult> => {
    const groups = new Map<string, PurchaseImportInput[]>();

    rows.forEach((row) => {
      if (!row.data) {
        return;
      }

      groups.set(row.data.groupKey, [
        ...(groups.get(row.data.groupKey) ?? []),
        row.data
      ]);
    });

    const errors: BulkImportResult["errors"] = [];
    let successCount = 0;

    for (const [groupKey, groupRows] of groups) {
      try {
        const firstRow = groupRows[0];
        const orderNo = firstRow.purchaseOrderNo || createPurchaseOrderNo();
        const remarks = groupRows
          .map((row) => row.remark)
          .filter(Boolean)
          .join("；");

        await createManualPurchaseOrder({
          purchaseOrderNo: orderNo,
          supplierId: firstRow.supplierId,
          orderDate: firstRow.orderDate,
          expectedArrivalDate: firstRow.expectedArrivalDate,
          notes: remarks,
          source: "bulk_import",
          items: groupRows.map((row) => ({
            materialId: row.materialId,
            skuId: row.skuId,
            orderedQuantity: row.quantity,
            unit: row.unit,
            unitPrice: row.unitPrice,
            notes: row.remark
          }))
        });
        successCount += 1;
      } catch (error) {
        errors.push({
          label: groupKey,
          message: getErrorMessage(error)
        });
      }
    }

    await loadPageData();

    return {
      successCount,
      failedCount: errors.length,
      errors
    };
  };

  const resetOrderFilters = () => {
    setOrderKeyword("");
    setOrderStatusFilter("all");
    setSupplierFilter("all");
    setOrderStartDate("");
    setOrderEndDate("");
    setOrderPage(1);
  };

  const purchaseOrderColumns: DataTableColumn<PurchaseOrder>[] = [
    {
      key: "purchase_order_no",
      title: "采购单号",
      width: 150,
      render: (order) => (
        <button
          className="linkButton"
          type="button"
          onClick={() => viewDetail(order.id)}
          disabled={detailLoading}
        >
          {order.purchase_order_no}
        </button>
      )
    },
    {
      key: "supplier",
      title: "供应商信息",
      width: 210,
      render: (order) => (
        <InfoCell
          title={order.supplier?.name ?? "未设置供应商"}
          subtitle={getSupplierSubtitle(order)}
        />
      )
    },
    {
      key: "items",
      title: "物料数量",
      width: 120,
      render: (order) => getOrderItemSummary(order)
    },
    {
      key: "amount",
      title: "采购金额",
      width: 110,
      align: "right",
      render: (order) => formatMoney(order.total_amount)
    },
    {
      key: "expected_arrival_date",
      title: "交期",
      width: 110,
      render: (order) => formatDate(order.expected_arrival_date)
    },
    {
      key: "status",
      title: "状态",
      width: 110,
      render: (order) => (
        <StatusBadge status={order.status} label={purchaseStatusLabels[order.status]} />
      )
    },
    {
      key: "created_at",
      title: "创建时间",
      width: 150,
      render: (order) => formatDateTime(order.created_at)
    },
    {
      key: "actions",
      title: "操作",
      width: 190,
      render: (order) => {
        const updating = statusUpdatingId === order.id;

        return (
          <RowActions
            onView={() => viewDetail(order.id)}
            onEdit={() => openManualEditForm(order.id)}
            moreActions={[
              {
                label: "导出 CSV",
                onClick: () => exportOrder(order)
              },
              {
                label: "导出图片",
                onClick: () => openOrderImagePreview(order),
                disabled: detailLoading
              },
              {
                label: "标记已下单",
                onClick: () => updateStatus(order.id, "ordered"),
                disabled:
                  updating ||
                  order.status === "ordered" ||
                  order.status === "received" ||
                  order.status === "cancelled"
              },
              {
                label: "标记已到货",
                onClick: () => updateStatus(order.id, "received"),
                disabled:
                  updating ||
                  order.status === "received" ||
                  order.status === "cancelled"
              },
              {
                label: "取消采购单",
                onClick: () => updateStatus(order.id, "cancelled"),
                danger: true,
                disabled: updating || order.status === "cancelled" || order.status === "received"
              }
            ]}
          />
        );
      }
    }
  ];

  return (
    <main className="pageShell">
      <PageHeader
        title="采购单"
        secondaryActions={
          <>
            <button
              type="button"
              onClick={() => setImportDialogOpen(true)}
              disabled={loading}
            >
              导入
            </button>
            <button
              type="button"
              onClick={() => downloadPurchaseOrderListCsv(purchaseOrders)}
              disabled={loading || purchaseOrders.length === 0}
            >
              导出
            </button>
          </>
        }
        primaryAction={
          <button
            className="primaryButton"
            type="button"
            onClick={openManualCreateForm}
            disabled={loading}
          >
            新增采购单
          </button>
        }
      />

      {successMessage ? (
        <div className="successNotice">
          <strong>操作成功</strong>
          <p>{successMessage}</p>
          {generatedOrders.length > 0 ? (
            <div className="generatedOrderActions">
              {generatedOrders.map((order) => (
                <div key={order.id}>
                  <span>{order.purchaseOrderNo}</span>
                  <button type="button" onClick={() => viewDetail(order.id)}>
                    查看
                  </button>
                  <button
                    type="button"
                    onClick={() => openOrderImagePreview(order.id)}
                  >
                    导出图片
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="debugError">
          <strong>操作失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">缺料物料</p>
            <h3>待采购清单</h3>
          </div>
          <div className="rowActions">
            <button
              type="button"
              onClick={() => openDraftForm(selectedRequirements)}
              disabled={loading || selectedRequirements.length === 0}
            >
              生成采购单
            </button>
            <button type="button" onClick={loadPageData} disabled={loading}>
              {loading ? "正在刷新..." : "刷新"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取采购数据...</div>
        ) : null}

        {!loading && shortages.length === 0 ? (
          <div className="emptyState">暂无缺料物料</div>
        ) : null}

        {!loading && shortages.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="选择全部缺料物料"
                      checked={allShortagesSelected}
                      onChange={toggleAllShortages}
                      type="checkbox"
                    />
                  </th>
                  <th>生产任务单号</th>
                  <th>成品 SKU</th>
                  <th>辅料编码</th>
                  <th>辅料名称</th>
                  <th>默认供应商</th>
                  <th>单位</th>
                  <th>总需求数量</th>
                  <th>当前库存数量</th>
                  <th>缺料数量</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedShortages.map((requirement) => (
                  <tr className="shortageRow" key={requirement.id}>
                    <td>
                      <input
                        aria-label={`选择${
                          requirement.material?.material_code ?? "缺料辅料"
                        }`}
                        checked={selectedRequirementIds.includes(requirement.id)}
                        onChange={() => toggleRequirement(requirement.id)}
                        type="checkbox"
                      />
                    </td>
                    <td>
                      {requirement.production_order?.production_order_no ?? "-"}
                    </td>
                    <td>
                      <strong>
                        {requirement.production_order?.finished_sku?.sku_code ??
                          "-"}
                      </strong>
                      <span>
                        {requirement.production_order?.finished_sku?.sku_name ??
                          "-"}
                      </span>
                    </td>
                    <td>
                      {requirement.material?.material_code ??
                        "-"}
                    </td>
                    <td>
                      {requirement.material?.material_name ??
                        "-"}
                    </td>
                    <td>
                      {requirement.material
                        ? getMaterialDefaultSupplierLabel(requirement.material)
                        : "-"}
                    </td>
                    <td>{requirement.unit}</td>
                    <td>{formatQuantity(requirement.required_quantity)}</td>
                    <td>{formatQuantity(requirement.available_quantity)}</td>
                    <td>{formatQuantity(requirement.shortage_quantity)}</td>
                    <td>
                      <span className="tablePill material-status-shortage">
                        缺料
                      </span>
                    </td>
                    <td>
                      <div className="rowActions">
                        <button
                          type="button"
                          onClick={() => openDraftForm([requirement])}
                        >
                          加入采购单草稿
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && shortages.length > 0 ? (
          <Pagination
            page={shortagePage}
            pageSize={DEFAULT_PAGE_SIZE}
            total={shortages.length}
            onPageChange={setShortagePage}
          />
        ) : null}
      </section>

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">采购单</p>
            <h3>采购单列表</h3>
          </div>
        </div>

        <SearchFilterBar
          searchLabel="搜索"
          searchValue={orderKeyword}
          searchPlaceholder="采购单号 / 供应商 / 物料 / 备注"
          onSearchChange={setOrderKeyword}
          onReset={resetOrderFilters}
          filters={
            <>
              <label>
                状态
                <select
                  value={orderStatusFilter}
                  onChange={(event) =>
                    setOrderStatusFilter(
                      event.target.value as PurchaseOrderStatus | "all"
                    )
                  }
                  disabled={loading}
                >
                  <option value="all">全部状态</option>
                  <option value="draft">草稿</option>
                  <option value="ordered">已下单</option>
                  <option value="partially_received">部分到货</option>
                  <option value="received">已到货</option>
                  <option value="cancelled">已取消</option>
                </select>
              </label>

              <label>
                供应商
                <select
                  value={supplierFilter}
                  onChange={(event) => setSupplierFilter(event.target.value)}
                  disabled={loading}
                >
                  <option value="all">全部供应商</option>
                  <option value="none">未设置供应商</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {getSupplierOptionLabel(supplier)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          }
          dateFilters={
            <>
              <label>
                创建/交期开始
                <input
                  type="date"
                  value={orderStartDate}
                  onChange={(event) => setOrderStartDate(event.target.value)}
                  disabled={loading}
                />
              </label>
              <label>
                创建/交期结束
                <input
                  type="date"
                  value={orderEndDate}
                  onChange={(event) => setOrderEndDate(event.target.value)}
                  disabled={loading}
                />
              </label>
            </>
          }
          rightActions={
            <button className="secondaryButton" type="button" onClick={loadPageData}>
              {loading ? "正在刷新..." : "刷新"}
            </button>
          }
        />

        <DataTable
          columns={purchaseOrderColumns}
          rows={purchaseOrders}
          getRowKey={(order) => order.id}
          loading={loading}
          emptyText="暂无采购单"
          minWidth={1040}
        />

        {!loading && totalPurchaseOrders > 0 ? (
          <Pagination
            page={orderPage}
            pageSize={DEFAULT_PAGE_SIZE}
            total={totalPurchaseOrders}
            onPageChange={setOrderPage}
          />
        ) : null}
      </section>

      {detail ? (
        <DetailDrawer
          open={Boolean(detail)}
          title={detail.purchase_order_no}
          width="lg"
          onClose={() => setDetail(null)}
          footer={
            <>
              <button type="button" onClick={() => setDetail(null)}>
                关闭
              </button>
              <button
                type="button"
                onClick={() => openManualEditForm(detail.id)}
                disabled={detail.status !== "draft"}
              >
                编辑
              </button>
              <button type="button" onClick={() => exportOrder(detail)}>
                导出采购单
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  window.location.href = `/inventory/inbound?tab=purchase&purchaseOrderNo=${encodeURIComponent(
                    detail.purchase_order_no
                  )}`;
                }}
                disabled={detail.status === "received" || detail.status === "cancelled"}
              >
                创建入库单
              </button>
            </>
          }
        >

          <div className="detailGrid">
            <div className="detailItem">
              <span>供应商</span>
              <strong>{detail.supplier?.name ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>供应商编码</span>
              <strong>{detail.supplier?.supplier_code ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>联系人</span>
              <strong>{detail.supplier?.contact_name ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>联系电话</span>
              <strong>{detail.supplier?.phone ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>邮箱</span>
              <strong>{detail.supplier?.email ?? "-"}</strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>地址</span>
              <strong>{detail.supplier?.address ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>状态</span>
              <strong>{purchaseStatusLabels[detail.status] ?? detail.status}</strong>
            </div>
            <div className="detailItem">
              <span>创建来源</span>
              <strong>{purchaseSourceLabels[detail.source] ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>下单日期</span>
              <strong>{formatDate(detail.ordered_at)}</strong>
            </div>
            <div className="detailItem">
              <span>预计到货日期</span>
              <strong>{formatDate(detail.expected_arrival_date)}</strong>
            </div>
            <div className="detailItem">
              <span>总金额</span>
              <strong>{formatMoney(detail.total_amount)}</strong>
            </div>
            <div className="detailItem">
              <span>合计数量</span>
              <strong>{formatQuantity(getOrderTotalQuantity(detail))}</strong>
            </div>
            <div className="detailItem">
              <span>制单人</span>
              <strong>{getOrderMaker(detail)}</strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>备注</span>
              <strong>{detail.notes ?? "-"}</strong>
            </div>
          </div>

          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>序号</th>
                  <th>辅料编码</th>
                  <th>辅料名称</th>
                  <th>规格</th>
                  <th>采购数量</th>
                  <th>已到货数量</th>
                  <th>单位</th>
                  <th>单价</th>
                  <th>小计</th>
                  <th>关联物料需求</th>
                  <th>来源生产任务</th>
                  <th>明细备注</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item, index) => (
                  <tr key={item.id}>
                    <td>{index + 1}</td>
                    <td>{item.material?.material_code ?? item.sku?.sku_code ?? "-"}</td>
                    <td>{item.material?.material_name ?? item.sku?.sku_name ?? "-"}</td>
                    <td className="notesCell">
                      {item.material?.specs ?? item.sku?.specs ?? "-"}
                    </td>
                    <td>{formatQuantity(item.ordered_quantity)}</td>
                    <td>{formatQuantity(item.received_quantity)}</td>
                    <td>{item.unit}</td>
                    <td>{formatMoney(item.unit_price)}</td>
                    <td>{formatMoney(getLineAmount(item))}</td>
                    <td>{item.material_requirement_id ?? "-"}</td>
                    <td>
                      {item.material_requirement?.production_order
                        ?.production_order_no ?? "-"}
                    </td>
                    <td className="notesCell">{item.notes ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="modalFooter drawerInnerFooter">
            <strong>
              合计数量：{formatQuantity(getOrderTotalQuantity(detail))}，合计金额：
              {formatMoney(detail.total_amount)}
            </strong>
            <div className="rowActions">
              <button type="button" onClick={() => exportOrder(detail)}>
                导出 CSV
              </button>
              <button type="button" onClick={() => openOrderImagePreview(detail)}>
                导出采购单图片
              </button>
              <button
                type="button"
                onClick={() => updateStatus(detail.id, "ordered")}
                disabled={
                  statusUpdatingId === detail.id ||
                  detail.status === "ordered" ||
                  detail.status === "received" ||
                  detail.status === "cancelled"
                }
              >
                标记已下单
              </button>
              <button
                type="button"
                onClick={() => updateStatus(detail.id, "received")}
                disabled={
                  statusUpdatingId === detail.id ||
                  detail.status === "received" ||
                  detail.status === "cancelled"
                }
              >
                标记已到货
              </button>
              <button type="button" onClick={() => setDetail(null)}>
                关闭
              </button>
            </div>
          </div>
        </DetailDrawer>
      ) : null}

      {imagePreviewOrder ? (
        <Modal
          open={Boolean(imagePreviewOrder)}
          eyebrow="采购单图片"
          title={`${imagePreviewOrder.purchase_order_no} 图片预览`}
          maxWidth="xl"
          onClose={() => {
            if (!imageExporting) {
              setImagePreviewOrder(null);
              setImageActionMessage("");
            }
          }}
        >
          <div className="purchaseImagePreviewShell">
            <div className="purchaseImagePaper" ref={purchaseOrderImageRef}>
              <div className="purchaseImageHeader">
                <div>
                  <p>{defaultPurchaseCompanyName}</p>
                  <h2>采购单</h2>
                </div>
                <div className="purchaseImageNo">
                  <span>采购单号</span>
                  <strong>{imagePreviewOrder.purchase_order_no}</strong>
                </div>
              </div>

              <div className="purchaseImageMeta">
                <div>
                  <span>下单日期</span>
                  <strong>{formatDate(imagePreviewOrder.ordered_at)}</strong>
                </div>
                <div>
                  <span>预计到货日期</span>
                  <strong>
                    {formatDate(imagePreviewOrder.expected_arrival_date)}
                  </strong>
                </div>
                <div>
                  <span>采购状态</span>
                  <strong>
                    {purchaseStatusLabels[imagePreviewOrder.status] ??
                      imagePreviewOrder.status}
                  </strong>
                </div>
              </div>

              <section className="purchaseImageBlock">
                <h3>供应商信息</h3>
                <div className="purchaseImageInfoGrid">
                  <div>
                    <span>供应商名称</span>
                    <strong>{imagePreviewOrder.supplier?.name ?? "-"}</strong>
                  </div>
                  <div>
                    <span>联系人</span>
                    <strong>
                      {imagePreviewOrder.supplier?.contact_name ?? "-"}
                    </strong>
                  </div>
                  <div>
                    <span>电话</span>
                    <strong>{imagePreviewOrder.supplier?.phone ?? "-"}</strong>
                  </div>
                  <div>
                    <span>地址</span>
                    <strong>{imagePreviewOrder.supplier?.address ?? "-"}</strong>
                  </div>
                </div>
              </section>

              <section className="purchaseImageBlock">
                <h3>采购明细</h3>
                <table className="purchaseImageTable">
                  <thead>
                    <tr>
                      <th>序号</th>
                      <th>辅料编码</th>
                      <th>辅料名称</th>
                      <th>规格</th>
                      <th>单位</th>
                      <th>采购数量</th>
                      <th>单价</th>
                      <th>金额</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {imagePreviewOrder.items.map((item, index) => (
                      <tr key={item.id}>
                        <td>{index + 1}</td>
                        <td>
                          {item.material?.material_code ?? item.sku?.sku_code ?? "-"}
                        </td>
                        <td>
                          {item.material?.material_name ?? item.sku?.sku_name ?? "-"}
                        </td>
                        <td>{item.material?.specs ?? item.sku?.specs ?? "-"}</td>
                        <td>{item.unit}</td>
                        <td>{formatQuantity(item.ordered_quantity)}</td>
                        <td>{formatMoney(item.unit_price)}</td>
                        <td>{formatMoney(getLineAmount(item))}</td>
                        <td>{item.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              <div className="purchaseImageTotals">
                <div>
                  <span>合计数量</span>
                  <strong>
                    {formatQuantity(getOrderTotalQuantity(imagePreviewOrder))}
                  </strong>
                </div>
                <div>
                  <span>合计金额</span>
                  <strong>{formatMoney(imagePreviewOrder.total_amount)}</strong>
                </div>
              </div>

              <div className="purchaseImageFooter">
                <div>
                  <span>备注</span>
                  <strong>{imagePreviewOrder.notes ?? "-"}</strong>
                </div>
                <div>
                  <span>制单人</span>
                  <strong>{getOrderMaker(imagePreviewOrder)}</strong>
                </div>
                <div>
                  <span>生成时间</span>
                  <strong>{formatDateTime(imageGeneratedAt)}</strong>
                </div>
              </div>
            </div>
          </div>

          {imageActionMessage ? (
            <div className="debugNotice">{imageActionMessage}</div>
          ) : null}

          <div className="modalFooter">
            <strong>{getPurchaseOrderImageFileName(imagePreviewOrder)}</strong>
            <div className="rowActions">
              <button
                type="button"
                onClick={copyOrderImage}
                disabled={imageExporting}
              >
                {imageExporting ? "正在生成..." : "复制采购单图片"}
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={downloadOrderImage}
                disabled={imageExporting}
              >
                {imageExporting ? "正在生成..." : "下载图片"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setImagePreviewOrder(null);
                  setImageActionMessage("");
                }}
                disabled={imageExporting}
              >
                关闭
              </button>
            </div>
          </div>
        </Modal>
      ) : null}

      {manualForm ? (
        <Modal
          open={Boolean(manualForm)}
          eyebrow={manualForm.mode === "edit" ? "编辑采购单" : "新建采购单"}
          title={
            manualForm.mode === "edit"
              ? manualForm.purchaseOrderNo ?? "编辑采购单"
              : "手动创建采购单"
          }
          maxWidth="xl"
          onClose={closeManualForm}
        >
          <form onSubmit={submitManualPurchaseOrder}>
            <div className="dataForm purchaseForm">
              <SupplierSearchSelect
                label="供应商"
                suppliers={suppliers}
                value={manualForm.supplierId}
                disabled={submitting}
                placeholder="搜索供应商"
                onSearch={searchMaterialSupplierOptions}
                onOptionsChange={updateSupplierOptions}
                onChange={(nextSupplierId) => {
                  updateManualForm("supplierId", nextSupplierId);
                  if (nextSupplierId) {
                    setManualSupplierNotice(
                      `已手动选择供应商：${getSupplierNameById(nextSupplierId)}。`
                    );
                  } else {
                    setManualSupplierNotice("");
                  }
                }}
              />

              <label>
                采购负责人
                <select
                  value={manualForm.createdBy}
                  onChange={(event) =>
                    updateManualForm("createdBy", event.target.value)
                  }
                  disabled={submitting}
                >
                  <option value="">暂不指定</option>
                  {purchaseProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name} / {profile.email}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                下单日期
                <input
                  type="date"
                  value={manualForm.orderDate}
                  onChange={(event) =>
                    updateManualForm("orderDate", event.target.value)
                  }
                  disabled={submitting}
                />
              </label>

              <label>
                预计到货日期
                <input
                  type="date"
                  value={manualForm.expectedArrivalDate}
                  onChange={(event) =>
                    updateManualForm("expectedArrivalDate", event.target.value)
                  }
                  disabled={submitting}
                />
              </label>

              <label className="fullField">
                备注
                <textarea
                  value={manualForm.notes}
                  onChange={(event) =>
                    updateManualForm("notes", event.target.value)
                  }
                  disabled={submitting}
                  placeholder="可填写采购说明"
                />
              </label>
            </div>

            {manualSupplierNotice ? (
              <div className="debugNotice">{manualSupplierNotice}</div>
            ) : null}

            <div className="sectionHeader">
              <div>
                <p className="eyebrow">采购明细</p>
                <h3>辅料</h3>
              </div>
              {manualForm.mode === "create" ? (
                <div className="rowActions">
                  <button type="button" onClick={addManualItem} disabled={submitting}>
                    添加明细
                  </button>
                </div>
              ) : null}
            </div>

            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>辅料编码</th>
                    <th>辅料名称</th>
                    <th>规格</th>
                    <th>默认供应商</th>
                    <th>单位</th>
                    <th>采购数量</th>
                    <th>单价</th>
                    <th>小计</th>
                    <th>备注</th>
                    {manualForm.mode === "create" ? <th>操作</th> : null}
                  </tr>
                </thead>
                <tbody>
                  {manualForm.items.map((item) => {
                    const subtotal =
                      (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);

                    return (
                      <tr key={item.localId}>
                        <td>
                          {manualForm.mode === "create" ? (
                            <MaterialSearchSelect
                              materials={materials}
                              value={item.materialId}
                              disabled={submitting}
                              onSearch={searchPurchaseMaterialOptions}
                              onOptionsChange={updatePurchaseMaterialOptions}
                              onChange={(materialId) =>
                                updateManualItem(
                                  item.localId,
                                  "materialId",
                                  materialId
                                )
                              }
                            />
                          ) : (
                            <strong>{item.materialCode}</strong>
                          )}
                        </td>
                        <td>{item.materialName || "-"}</td>
                        <td>{item.specs || "-"}</td>
                        <td>
                          {item.materialId
                            ? getMaterialDefaultSupplierLabel(
                                materials.find(
                                  (material) => material.id === item.materialId
                                ) ??
                                  {
                                    default_supplier: null
                                  }
                              )
                            : "-"}
                        </td>
                        <td>{item.unit || "-"}</td>
                        <td>
                          <input
                            className="tableInput"
                            min="0.0001"
                            step="0.0001"
                            type="number"
                            value={item.quantity}
                            onChange={(event) =>
                              updateManualItem(
                                item.localId,
                                "quantity",
                                event.target.value
                              )
                            }
                            disabled={submitting}
                            required
                          />
                        </td>
                        <td>
                          <input
                            className="tableInput"
                            min="0"
                            step="0.0001"
                            type="number"
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateManualItem(
                                item.localId,
                                "unitPrice",
                                event.target.value
                              )
                            }
                            disabled={submitting}
                          />
                        </td>
                        <td>{formatMoney(subtotal)}</td>
                        <td>
                          <input
                            className="tableInput"
                            type="text"
                            value={item.notes}
                            onChange={(event) =>
                              updateManualItem(
                                item.localId,
                                "notes",
                                event.target.value
                              )
                            }
                            disabled={submitting}
                            placeholder="可选"
                          />
                        </td>
                        {manualForm.mode === "create" ? (
                          <td>
                            <div className="rowActions">
                              <button
                                type="button"
                                onClick={() => removeManualItem(item.localId)}
                                disabled={submitting || manualForm.items.length <= 1}
                              >
                                删除
                              </button>
                            </div>
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modalFooter">
              <strong>合计：{formatMoney(manualTotalAmount)}</strong>
              <div className="rowActions">
                <button type="button" onClick={closeManualForm} disabled={submitting}>
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "正在保存..." : "保存采购单"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}

      <BulkImportDialog<PurchaseImportInput>
        open={importDialogOpen}
        title="批量导入采购单"
        description="上传 CSV 后会先预览和校验。只有全部通过后，点击确认导入才会写入采购单主表和明细表。"
        templateFileName="purchase-orders-import-template.csv"
        fields={purchaseImportFields}
        sampleRows={purchaseImportSampleRows}
        validateRows={validateImportRows}
        onImport={importPurchaseOrders}
        onClose={() => setImportDialogOpen(false)}
        renderPreviewSummary={(rows) => {
          const validRows = rows.filter((row) => row.errors.length === 0);
          const orderCount = new Set(validRows.map((row) => row.groupKey)).size;

          return (
            <div className="debugNotice">
              将生成 {orderCount} 张采购单，{validRows.length} 条采购明细。
            </div>
          );
        }}
      />

      {draftItems.length > 0 ? (
        <Modal
          open={draftItems.length > 0}
          eyebrow="创建采购单"
          title="采购单草稿"
          maxWidth="xl"
          onClose={() => {
            if (!submitting) {
              closeDraftForm();
            }
          }}
        >
          <form onSubmit={submitPurchaseOrder}>
            <div className="dataForm purchaseForm">
              <SupplierSearchSelect
                label="供应商"
                suppliers={suppliers}
                value={supplierId}
                disabled={submitting}
                placeholder="搜索供应商"
                onSearch={searchMaterialSupplierOptions}
                onOptionsChange={updateSupplierOptions}
                onChange={(nextSupplierId) => {
                  setSupplierId(nextSupplierId);
                  if (nextSupplierId) {
                    setDraftSupplierNotice(
                      `已手动选择供应商：${getSupplierNameById(nextSupplierId)}。`
                    );
                  } else {
                    setDraftSupplierNotice("");
                  }
                }}
              />

              <label>
                采购负责人
                <select
                  value={createdBy}
                  onChange={(event) => setCreatedBy(event.target.value)}
                  disabled={submitting}
                >
                  <option value="">暂不指定</option>
                  {purchaseProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.full_name} / {profile.email}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                下单日期
                <input
                  type="date"
                  value={orderDate}
                  onChange={(event) => setOrderDate(event.target.value)}
                  disabled={submitting}
                />
              </label>

              <label>
                预计到货日期
                <input
                  type="date"
                  value={expectedArrivalDate}
                  onChange={(event) => setExpectedArrivalDate(event.target.value)}
                  disabled={submitting}
                />
              </label>

              <label className="fullField">
                备注
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={submitting}
                  placeholder="可填写采购说明"
                />
              </label>
            </div>

            {draftSupplierNotice ? (
              <div className="debugNotice">{draftSupplierNotice}</div>
            ) : null}

            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>辅料编码</th>
                    <th>辅料名称</th>
                    <th>规格</th>
                    <th>默认供应商</th>
                    <th>采购数量</th>
                    <th>单位</th>
                    <th>单价</th>
                    <th>小计</th>
                    <th>关联物料需求</th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((item) => {
                    const subtotal =
                      (Number(item.orderedQuantity) || 0) *
                      (Number(item.unitPrice) || 0);

                    return (
                      <tr key={item.materialRequirementId}>
                        <td>
                          <strong>{item.materialCode}</strong>
                          <span>{item.productionOrderNo}</span>
                        </td>
                        <td>{item.materialName}</td>
                        <td>{item.specs ?? "-"}</td>
                        <td>{item.defaultSupplierLabel}</td>
                        <td>
                          <input
                            className="tableInput"
                            min="0.0001"
                            step="0.0001"
                            type="number"
                            value={item.orderedQuantity}
                            onChange={(event) =>
                              updateDraftItem(
                                item.materialRequirementId,
                                "orderedQuantity",
                                event.target.value
                              )
                            }
                            disabled={submitting}
                            required
                          />
                          <span>默认缺料 {formatQuantity(item.shortageQuantity)}</span>
                        </td>
                        <td>{item.unit}</td>
                        <td>
                          <input
                            className="tableInput"
                            min="0"
                            step="0.0001"
                            type="number"
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateDraftItem(
                                item.materialRequirementId,
                                "unitPrice",
                                event.target.value
                              )
                            }
                            disabled={submitting}
                            placeholder="可为空"
                          />
                        </td>
                        <td>{formatMoney(subtotal)}</td>
                        <td>{item.materialRequirementId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modalFooter">
              <strong>合计：{formatMoney(draftTotalAmount)}</strong>
              <div className="rowActions">
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={closeDraftForm}
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "正在创建..." : "提交采购单"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
