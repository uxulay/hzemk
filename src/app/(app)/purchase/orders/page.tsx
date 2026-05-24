"use client";

import { useEffect, useMemo, useState } from "react";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import { getSuppliers, type Supplier } from "@/lib/api/master-data";
import {
  createPurchaseOrder,
  createManualPurchaseOrder,
  createPurchaseOrderNo,
  getExistingPurchaseOrderNos,
  getMaterialSkuOptions,
  getPurchaseProfileOptions,
  getPurchaseOrderDetail,
  getPurchaseOrders,
  getShortageMaterialRequirements,
  updatePurchaseOrder,
  updatePurchaseOrderStatus,
  type MaterialSkuOption,
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
    key: "material_sku_code",
    label: "原材料 SKU 编码",
    required: true,
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
    material_sku_code: "MAT-001",
    quantity: "100",
    unit_price: "1.5",
    remark: "同供应商同预计到货日会合并为一张采购单"
  }
];

type DraftItem = {
  materialRequirementId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  productionOrderNo: string;
  orderedQuantity: string;
  shortageQuantity: number;
  unit: string;
  unitPrice: string;
};

type ManualItem = {
  localId: string;
  itemId?: string;
  skuId: string;
  skuCode: string;
  skuName: string;
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
  skuId: string;
  skuCode: string;
  skuName: string;
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
    skuId: "",
    skuCode: "",
    skuName: "",
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

function getMaterialSkuLabel(sku: MaterialSkuOption) {
  return `${sku.sku_code} / ${sku.sku_name}`;
}

function MaterialSkuSearchSelect({
  skus,
  value,
  disabled,
  onChange
}: {
  skus: MaterialSkuOption[];
  value: string;
  disabled: boolean;
  onChange: (skuId: string) => void;
}) {
  const [keyword, setKeyword] = useState("");
  const selectedSku = skus.find((sku) => sku.id === value);
  const normalizedKeyword = keyword.trim().toLowerCase();
  const filteredSkus = normalizedKeyword
    ? skus.filter((sku) =>
        getMaterialSkuLabel(sku).toLowerCase().includes(normalizedKeyword)
      )
    : skus.slice(0, 8);

  return (
    <div className="tableSearchPicker">
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        disabled={disabled}
        placeholder={
          selectedSku ? `当前：${getMaterialSkuLabel(selectedSku)}` : "搜索原材料"
        }
      />
      {selectedSku ? <strong>{getMaterialSkuLabel(selectedSku)}</strong> : null}
      <div className="searchPickerList">
        {filteredSkus.length === 0 ? (
          <p className="tableHint">没有匹配的原材料。</p>
        ) : (
          filteredSkus.map((sku) => (
            <button
              type="button"
              key={sku.id}
              className={sku.id === value ? "active" : undefined}
              onClick={() => {
                onChange(sku.id);
                setKeyword("");
              }}
              disabled={disabled}
            >
              {getMaterialSkuLabel(sku)}
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
    "原材料编码",
    "原材料名称",
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
      item.sku?.sku_code ?? "",
      item.sku?.sku_name ?? "",
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

function getDraftItem(requirement: ShortageMaterialRequirement): DraftItem {
  return {
    materialRequirementId: requirement.id,
    skuId: requirement.material_sku_id,
    skuCode: requirement.material_sku?.sku_code ?? "-",
    skuName: requirement.material_sku?.sku_name ?? "-",
    productionOrderNo: requirement.production_order?.production_order_no ?? "-",
    orderedQuantity: String(Number(requirement.shortage_quantity)),
    shortageQuantity: Number(requirement.shortage_quantity),
    unit: requirement.unit,
    unitPrice: ""
  };
}

export default function PurchaseOrdersPage() {
  const [shortages, setShortages] = useState<ShortageMaterialRequirement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [materialSkus, setMaterialSkus] = useState<MaterialSkuOption[]>([]);
  const [purchaseProfiles, setPurchaseProfiles] = useState<
    PurchaseProfileOption[]
  >([]);
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>(
    []
  );
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(getTodayInputValue());
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [notes, setNotes] = useState("");
  const [createdBy, setCreatedBy] = useState("");
  const [manualForm, setManualForm] = useState<ManualFormState | null>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [shortagePage, setShortagePage] = useState(1);
  const [orderPage, setOrderPage] = useState(1);
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

  const paginatedPurchaseOrders = useMemo(
    () => paginateItems(purchaseOrders, orderPage),
    [orderPage, purchaseOrders]
  );

  const draftTotalAmount = draftItems.reduce((sum, item) => {
    const quantity = Number(item.orderedQuantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;

    return sum + quantity * unitPrice;
  }, 0);

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        shortageData,
        orderData,
        supplierData,
        materialSkuData,
        purchaseProfileData
      ] = await Promise.all([
        getShortageMaterialRequirements(),
        getPurchaseOrders(),
        getSuppliers(),
        getMaterialSkuOptions(),
        getPurchaseProfileOptions()
      ]);

      setShortages(shortageData);
      setPurchaseOrders(orderData);
      setSuppliers(supplierData);
      setMaterialSkus(materialSkuData);
      setPurchaseProfiles(purchaseProfileData);
      setSelectedRequirementIds((current) =>
        current.filter((id) => shortageData.some((item) => item.id === id))
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setShortages([]);
      setPurchaseOrders([]);
      setSuppliers([]);
      setMaterialSkus([]);
      setPurchaseProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

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
    setDraftItems(requirements.map(getDraftItem));
    setSupplierId("");
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
          skuId: item.sku_id,
          skuCode: item.sku?.sku_code ?? "",
          skuName: item.sku?.sku_name ?? "",
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

      return {
        ...current,
        items: current.items.map((item) => {
          if (item.localId !== localId) {
            return item;
          }

          if (field === "skuId") {
            const sku = materialSkus.find((option) => option.id === value);

            return {
              ...item,
              skuId: value,
              skuCode: sku?.sku_code ?? "",
              skuName: sku?.sku_name ?? "",
              unit: sku?.unit ?? ""
            };
          }

          return {
            ...item,
            [field]: value
          };
        })
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

      return {
        ...current,
        items: current.items.filter((item) => item.localId !== localId)
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

      const created = await createPurchaseOrder({
        supplierId,
        createdBy,
        orderDate,
        expectedArrivalDate,
        notes,
        items: draftItems.map((item) => ({
          skuId: item.skuId,
          materialRequirementId: item.materialRequirementId,
          orderedQuantity: Number(item.orderedQuantity),
          unit: item.unit,
          unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
          notes: `来源生产任务：${item.productionOrderNo}`
        }))
      });

      setSuccessMessage(`采购单 ${created.purchase_order_no} 创建成功。`);
      setDraftItems([]);
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

  const validateImportRows = async (
    rows: Record<string, string>[]
  ): Promise<BulkImportValidationRow<PurchaseImportInput>[]> => {
    const supplierByCode = new Map(
      suppliers.map((supplier) => [supplier.supplier_code, supplier])
    );
    const skuByCode = new Map(materialSkus.map((sku) => [sku.sku_code, sku]));
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
      const skuCode = row.material_sku_code?.trim() ?? "";
      const key = `${groupKey}:${skuCode}`;

      duplicateKeyCount.set(key, (duplicateKeyCount.get(key) ?? 0) + 1);
    });

    return rows.map((row, index) => {
      const errors: string[] = [];
      const notes: string[] = [];
      const purchaseOrderNo = row.purchase_order_no?.trim() ?? "";
      const supplierCode = row.supplier_code?.trim() ?? "";
      const orderDate = row.order_date?.trim() || getTodayInputValue();
      const expectedArrivalDate = row.expected_arrival_date?.trim() ?? "";
      const skuCode = row.material_sku_code?.trim() ?? "";
      const quantity = Number(row.quantity);
      const unitPrice = row.unit_price ? Number(row.unit_price) : 0;
      const supplier = supplierByCode.get(supplierCode);
      const sku = skuByCode.get(skuCode);
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

      if (!skuCode) {
        errors.push("material_sku_code 必填。");
      } else if (!sku) {
        errors.push("原材料 SKU 编码不存在，或不是 material 类型。");
      }

      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push("quantity 必须大于 0。");
      }

      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        errors.push("unit_price 不能小于 0。");
      }

      if (duplicateKeyCount.get(`${groupKey}:${skuCode}`)! > 1) {
        notes.push("同一采购单内存在重复原材料，请检查。");
      }

      return {
        rowNumber: index + 2,
        rawRow: row,
        groupKey,
        errors,
        notes,
        data:
          supplier && sku
            ? {
                purchaseOrderNo,
                supplierId: supplier.id,
                supplierCode,
                orderDate,
                expectedArrivalDate,
                skuId: sku.id,
                skuCode: sku.sku_code,
                skuName: sku.sku_name,
                unit: sku.unit,
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

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">采购管理</p>
          <h2>采购单</h2>
          <p>
            采购人员可以从缺料物料生成采购单，也可以主动创建常用原材料、包材和辅料采购单。
          </p>
        </div>
        <div className="pageHeroActions">
          <span className="statusPill">Supabase 数据</span>
          <div className="rowActions">
            <button
              className="primaryButton successButton"
              type="button"
              onClick={openManualCreateForm}
              disabled={loading}
            >
              + 新建采购单
            </button>
            <button
              type="button"
              onClick={() => setImportDialogOpen(true)}
              disabled={loading}
            >
              批量导入采购单
            </button>
          </div>
        </div>
      </section>

      {successMessage ? (
        <div className="successNotice">
          <strong>操作成功</strong>
          <p>{successMessage}</p>
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
                  <th>原材料编码</th>
                  <th>原材料名称</th>
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
                        aria-label={`选择${requirement.material_sku?.sku_code ?? "缺料物料"}`}
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
                    <td>{requirement.material_sku?.sku_code ?? "-"}</td>
                    <td>{requirement.material_sku?.sku_name ?? "-"}</td>
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

        {!loading && purchaseOrders.length === 0 ? (
          <div className="emptyState">暂无采购单</div>
        ) : null}

        {!loading && purchaseOrders.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>采购单号</th>
                  <th>供应商</th>
                  <th>采购负责人</th>
                  <th>状态</th>
                  <th>下单日期</th>
                  <th>预计到货日期</th>
                  <th>总金额</th>
                  <th>明细数量</th>
                  <th>创建来源</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedPurchaseOrders.map((order) => {
                  const updating = statusUpdatingId === order.id;

                  return (
                    <tr key={order.id}>
                      <td>{order.purchase_order_no}</td>
                      <td>
                        <strong>{order.supplier?.name ?? "-"}</strong>
                        <span>{order.supplier?.supplier_code ?? "-"}</span>
                      </td>
                      <td>{order.created_by_profile?.full_name ?? "-"}</td>
                      <td>
                        <span className={`tablePill purchase-status-${order.status}`}>
                          {purchaseStatusLabels[order.status] ?? order.status}
                        </span>
                      </td>
                      <td>{formatDate(order.ordered_at)}</td>
                      <td>{formatDate(order.expected_arrival_date)}</td>
                      <td>{formatMoney(order.total_amount)}</td>
                      <td>{order.item_count}</td>
                      <td>{purchaseSourceLabels[order.source] ?? "-"}</td>
                      <td>{formatDateTime(order.created_at)}</td>
                      <td>
                        <div className="rowActions">
                          <button
                            type="button"
                            onClick={() => viewDetail(order.id)}
                            disabled={detailLoading}
                          >
                            查看详情
                          </button>
                          <button
                            type="button"
                            onClick={() => openManualEditForm(order.id)}
                            disabled={detailLoading || order.status !== "draft"}
                          >
                            编辑
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(order.id, "ordered")}
                            disabled={
                              updating ||
                              order.status === "ordered" ||
                              order.status === "received" ||
                              order.status === "cancelled"
                            }
                          >
                            标记为已下单
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(order.id, "received")}
                            disabled={
                              updating ||
                              order.status === "received" ||
                              order.status === "cancelled"
                            }
                          >
                            标记为已到货
                          </button>
                          <button type="button" onClick={() => exportOrder(order)}>
                            导出
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

        {!loading && purchaseOrders.length > 0 ? (
          <Pagination
            page={orderPage}
            pageSize={DEFAULT_PAGE_SIZE}
            total={purchaseOrders.length}
            onPageChange={setOrderPage}
          />
        ) : null}
      </section>

      {detail ? (
        <Modal
          open={Boolean(detail)}
          eyebrow="采购单详情"
          title={detail.purchase_order_no}
          maxWidth="xl"
          onClose={() => setDetail(null)}
        >

          <div className="detailGrid">
            <div className="detailItem">
              <span>供应商</span>
              <strong>{detail.supplier?.name ?? "-"}</strong>
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
            <div className="detailItem detailItemWide">
              <span>备注</span>
              <strong>{detail.notes ?? "-"}</strong>
            </div>
          </div>

          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>原材料 SKU</th>
                  <th>原材料名称</th>
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
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sku?.sku_code ?? "-"}</td>
                    <td>{item.sku?.sku_name ?? "-"}</td>
                    <td>{formatQuantity(item.ordered_quantity)}</td>
                    <td>{formatQuantity(item.received_quantity)}</td>
                    <td>{item.unit}</td>
                    <td>{formatMoney(item.unit_price)}</td>
                    <td>
                      {formatMoney(
                        Number(item.ordered_quantity) * Number(item.unit_price ?? 0)
                      )}
                    </td>
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

          <div className="modalFooter">
            <strong>合计：{formatMoney(detail.total_amount)}</strong>
            <div className="rowActions">
              <button type="button" onClick={() => exportOrder(detail)}>
                导出采购单
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
              <label>
                供应商
                <select
                  value={manualForm.supplierId}
                  onChange={(event) =>
                    updateManualForm("supplierId", event.target.value)
                  }
                  disabled={submitting}
                  required
                >
                  <option value="">请选择供应商</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_code} / {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

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

            <div className="sectionHeader">
              <div>
                <p className="eyebrow">采购明细</p>
                <h3>原材料</h3>
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
                    <th>原材料 SKU</th>
                    <th>原材料名称</th>
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
                            <MaterialSkuSearchSelect
                              skus={materialSkus}
                              value={item.skuId}
                              disabled={submitting}
                              onChange={(skuId) =>
                                updateManualItem(item.localId, "skuId", skuId)
                              }
                            />
                          ) : (
                            <strong>{item.skuCode}</strong>
                          )}
                        </td>
                        <td>{item.skuName || "-"}</td>
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
              <label>
                供应商
                <select
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  disabled={submitting}
                  required
                >
                  <option value="">请选择供应商</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_code} / {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

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

            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>原材料 SKU</th>
                    <th>原材料名称</th>
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
                          <strong>{item.skuCode}</strong>
                          <span>{item.productionOrderNo}</span>
                        </td>
                        <td>{item.skuName}</td>
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
