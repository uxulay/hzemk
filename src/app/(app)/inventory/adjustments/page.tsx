"use client";

import { useEffect, useMemo, useState } from "react";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  adjustInventoryByWarehouseSku,
  bulkAdjustInventory,
  bulkCreateOtherInbound,
  bulkCreateOtherOutbound,
  createOtherInbound,
  createOtherOutbound,
  getInventoryForAdjustment,
  getInventoryTransactions,
  getRecentAdjustmentTransactions,
  getSkuOptionsForInventory,
  getWarehousesForFilter,
  inventoryAdjustmentImportFields,
  otherInboundImportFields,
  otherOutboundImportFields,
  validateOtherInboundImportRows,
  validateOtherOutboundImportRows,
  validateInventoryAdjustmentImportRows,
  type InventorySkuOption,
  type InventoryAdjustmentMode,
  type InventoryAdjustmentReason,
  type InventoryAdjustmentValidationRow,
  type InventoryAdjustmentRow,
  type InventoryAdjustmentSkuTypeFilter,
  type InventoryTransactionRow,
  type InventoryTransactionWarehouse,
  type OtherInventoryMovementValidationRow
} from "@/lib/api/inventory";

type InventoryMovementTab = "other_in" | "other_out" | "adjustment" | "records";
type OtherMovementKind = "inbound" | "outbound";

const skuTypeOptions: Array<{
  value: InventoryAdjustmentSkuTypeFilter;
  label: string;
}> = [
  { value: "all", label: "全部 SKU 类型" },
  { value: "material", label: "辅料" },
  { value: "finished_good", label: "成品" }
];

const adjustmentModeOptions: Array<{
  value: InventoryAdjustmentMode;
  label: string;
}> = [
  { value: "increase", label: "增加库存" },
  { value: "decrease", label: "减少库存" },
  { value: "set_to", label: "直接修正为指定库存" }
];

const adjustmentReasonOptions: Array<{
  value: InventoryAdjustmentReason;
  label: string;
}> = [
  { value: "initial_stock", label: "期初库存" },
  { value: "stocktake_gain", label: "盘盈" },
  { value: "stocktake_loss", label: "盘亏" },
  { value: "damage_loss", label: "破损报废" },
  { value: "sample_use", label: "样品领用" },
  { value: "data_correction", label: "数据修正" },
  { value: "other", label: "其他" }
];

const skuTypeLabels: Record<string, string> = {
  material: "辅料",
  finished_good: "成品",
  finished_product: "成品"
};

const movementTabs: Array<{
  value: InventoryMovementTab;
  label: string;
}> = [
  { value: "other_in", label: "其他入库" },
  { value: "other_out", label: "其他出库" },
  { value: "adjustment", label: "库存调整" },
  { value: "records", label: "收发记录" }
];

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

function roundQuantity(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function getSkuTypeLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return skuTypeLabels[value] ?? value;
}

function getUnit(item: InventoryAdjustmentRow | null) {
  if (!item) {
    return "-";
  }

  return item.sku?.unit ?? item.unit ?? "-";
}

function parseAdjustmentReason(notes: string | null) {
  const match = notes?.match(/调整原因：(.+?)(?:\n|$)/);

  return match?.[1]?.trim() || "-";
}

function parseAdjustmentRemark(notes: string | null) {
  const match = notes?.match(/操作备注：([\s\S]*)$/);
  const remark = match?.[1]?.trim();

  if (!remark || remark === "-") {
    return "-";
  }

  return remark;
}

function parseOtherMovementReason(notes: string | null) {
  const match = notes?.match(/[入出]库原因：(.+?)(?:\n|$)/);

  return match?.[1]?.trim() || "-";
}

function parseOtherMovementRemark(notes: string | null) {
  return parseAdjustmentRemark(notes);
}

function getAdjustmentSignedQuantity(transaction: InventoryTransactionRow) {
  const match = transaction.notes?.match(/调整差异：\s*([+-]?\d+(?:\.\d+)?)/);

  if (match?.[1]) {
    return Number(match[1]);
  }

  return Number(transaction.quantity);
}

function formatAdjustmentQuantity(transaction: InventoryTransactionRow) {
  const signedQuantity = getAdjustmentSignedQuantity(transaction);

  if (signedQuantity > 0) {
    return `+${formatQuantity(signedQuantity)}`;
  }

  if (signedQuantity < 0) {
    return `-${formatQuantity(Math.abs(signedQuantity))}`;
  }

  return formatQuantity(signedQuantity);
}

function getTransactionSignedQuantity(transaction: InventoryTransactionRow) {
  if (transaction.transaction_type === "adjustment") {
    return getAdjustmentSignedQuantity(transaction);
  }

  const quantity = Number(transaction.quantity);

  if (
    transaction.transaction_type === "material_out" ||
    transaction.transaction_type === "product_out"
  ) {
    return -Math.abs(quantity);
  }

  return Math.abs(quantity);
}

function formatMovementQuantity(transaction: InventoryTransactionRow) {
  const signedQuantity = getTransactionSignedQuantity(transaction);

  if (signedQuantity > 0) {
    return `+${formatQuantity(signedQuantity)}`;
  }

  if (signedQuantity < 0) {
    return `-${formatQuantity(Math.abs(signedQuantity))}`;
  }

  return formatQuantity(signedQuantity);
}

function getTransactionItemCode(transaction: InventoryTransactionRow) {
  return (
    transaction.material?.material_code ??
    transaction.product_sku?.sku_code ??
    transaction.sku?.sku_code ??
    "-"
  );
}

function getTransactionItemName(transaction: InventoryTransactionRow) {
  return (
    transaction.material?.material_name ??
    transaction.product_sku?.sku_name ??
    transaction.sku?.sku_name ??
    "-"
  );
}

function getTransactionItemSubtitle(transaction: InventoryTransactionRow) {
  return (
    transaction.material?.specs ??
    transaction.product_sku?.product?.name ??
    transaction.sku?.product?.name ??
    "-"
  );
}

function getTransactionTypeLabel(transaction: InventoryTransactionRow) {
  if (transaction.transaction_type === "adjustment") {
    return "库存调整";
  }

  const isInbound =
    transaction.transaction_type === "material_in" ||
    transaction.transaction_type === "product_in";

  return isInbound ? "其他入库" : "其他出库";
}

function getMovementSkuTypeLabel(sku: InventorySkuOption) {
  return getSkuTypeLabel(sku.sku_type);
}

function getOperatorLabel(transaction: InventoryTransactionRow) {
  return (
    transaction.operator?.full_name ||
    transaction.operator?.email ||
    transaction.operator_id ||
    "-"
  );
}

export default function InventoryAdjustmentsPage() {
  const [activeTab, setActiveTab] = useState<InventoryMovementTab>("other_in");
  const [inventoryItems, setInventoryItems] = useState<InventoryAdjustmentRow[]>(
    []
  );
  const [recentAdjustments, setRecentAdjustments] = useState<
    InventoryTransactionRow[]
  >([]);
  const [movementRecords, setMovementRecords] = useState<
    InventoryTransactionRow[]
  >([]);
  const [warehouses, setWarehouses] = useState<InventoryTransactionWarehouse[]>(
    []
  );
  const [skuOptions, setSkuOptions] = useState<InventorySkuOption[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [skuKeyword, setSkuKeyword] = useState("");
  const [skuType, setSkuType] =
    useState<InventoryAdjustmentSkuTypeFilter>("all");
  const [newAdjustmentWarehouseId, setNewAdjustmentWarehouseId] = useState("");
  const [newAdjustmentSkuId, setNewAdjustmentSkuId] = useState("");
  const [newAdjustmentSkuKeyword, setNewAdjustmentSkuKeyword] = useState("");
  const [adjustmentPickerOpen, setAdjustmentPickerOpen] = useState(false);
  const [adjustmentImportOpen, setAdjustmentImportOpen] = useState(false);
  const [otherMovementOpen, setOtherMovementOpen] = useState(false);
  const [otherMovementImportOpen, setOtherMovementImportOpen] = useState(false);
  const [otherMovementKind, setOtherMovementKind] =
    useState<OtherMovementKind>("inbound");
  const [otherMovementWarehouseId, setOtherMovementWarehouseId] = useState("");
  const [otherMovementSkuId, setOtherMovementSkuId] = useState("");
  const [otherMovementSkuKeyword, setOtherMovementSkuKeyword] = useState("");
  const [otherMovementQuantity, setOtherMovementQuantity] = useState("");
  const [otherMovementReason, setOtherMovementReason] = useState("");
  const [otherMovementNotes, setOtherMovementNotes] = useState("");
  const [selectedItem, setSelectedItem] =
    useState<InventoryAdjustmentRow | null>(null);
  const [adjustmentMode, setAdjustmentMode] =
    useState<InventoryAdjustmentMode>("increase");
  const [adjustmentQuantity, setAdjustmentQuantity] = useState("");
  const [targetQuantity, setTargetQuantity] = useState("");
  const [adjustmentReason, setAdjustmentReason] =
    useState<InventoryAdjustmentReason>("stocktake_gain");
  const [adjustmentNotes, setAdjustmentNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const currentQuantity = Number(selectedItem?.quantity_on_hand ?? 0);
  const unit = getUnit(selectedItem);

  const filteredSkuOptions = useMemo(() => {
    const keyword = newAdjustmentSkuKeyword.trim().toLowerCase();

    return skuOptions.filter((sku) => {
      const typeMatched =
        skuType === "all" ||
        (skuType === "material" && sku.sku_type === "material") ||
        (skuType === "finished_good" &&
          (sku.sku_type === "finished_good" ||
            sku.sku_type === "finished_product"));

      if (!typeMatched) {
        return false;
      }

      if (!keyword) {
        return true;
      }

      return [sku.sku_code, sku.sku_name, sku.product?.name]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword));
    });
  }, [newAdjustmentSkuKeyword, skuOptions, skuType]);

  const filteredOtherMovementSkuOptions = useMemo(() => {
    const keyword = otherMovementSkuKeyword.trim().toLowerCase();

    if (!keyword) {
      return skuOptions;
    }

    return skuOptions.filter((sku) =>
      [sku.sku_code, sku.sku_name, sku.product?.name, sku.material?.material_name]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword))
    );
  }, [otherMovementSkuKeyword, skuOptions]);

  const selectedOtherMovementSku = useMemo(
    () => skuOptions.find((sku) => sku.id === otherMovementSkuId) ?? null,
    [otherMovementSkuId, skuOptions]
  );

  const filteredMovementRecords = useMemo(() => {
    const keyword = skuKeyword.trim().toLowerCase();

    return movementRecords.filter((transaction) => {
      const matchesKeyword =
        !keyword ||
        [
          transaction.transaction_no,
          getTransactionItemCode(transaction),
          getTransactionItemName(transaction),
          getTransactionItemSubtitle(transaction),
          transaction.notes ?? ""
        ]
          .join(" / ")
          .toLowerCase()
          .includes(keyword);
      const matchesWarehouse =
        !warehouseId || transaction.warehouse_id === warehouseId;
      const matchesSkuType =
        skuType === "all" ||
        (skuType === "material" && transaction.material) ||
        (skuType === "finished_good" && !transaction.material);

      return matchesKeyword && matchesWarehouse && matchesSkuType;
    });
  }, [movementRecords, skuKeyword, skuType, warehouseId]);

  const adjustmentPreview = useMemo(() => {
    if (!selectedItem) {
      return null;
    }

    if (adjustmentMode === "set_to") {
      if (!targetQuantity.trim()) {
        return null;
      }

      const parsedTargetQuantity = Number(targetQuantity);

      if (!Number.isFinite(parsedTargetQuantity)) {
        return null;
      }

      const afterQuantity = roundQuantity(parsedTargetQuantity);
      const signedDifference = roundQuantity(afterQuantity - currentQuantity);

      return {
        afterQuantity,
        signedDifference,
        adjustmentQuantity: Math.abs(signedDifference)
      };
    }

    if (!adjustmentQuantity.trim()) {
      return null;
    }

    const parsedAdjustmentQuantity = Number(adjustmentQuantity);

    if (!Number.isFinite(parsedAdjustmentQuantity)) {
      return null;
    }

    const signedDifference =
      adjustmentMode === "increase"
        ? roundQuantity(parsedAdjustmentQuantity)
        : roundQuantity(-parsedAdjustmentQuantity);

    return {
      afterQuantity: roundQuantity(currentQuantity + signedDifference),
      signedDifference,
      adjustmentQuantity: Math.abs(signedDifference)
    };
  }, [
    adjustmentMode,
    adjustmentQuantity,
    currentQuantity,
    selectedItem,
    targetQuantity
  ]);

  const buildFilters = () => ({
    warehouseId,
    skuKeyword,
    skuType
  });

  const loadPageData = async (filters = buildFilters()) => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        inventoryData,
        warehouseData,
        adjustmentData,
        inboundTransactionData,
        outboundTransactionData,
        skuData
      ] =
        await Promise.all([
          getInventoryForAdjustment(filters),
          getWarehousesForFilter(),
          getRecentAdjustmentTransactions(),
          getInventoryTransactions({ transactionType: "material_in" }),
          getInventoryTransactions({ transactionType: "material_out" }),
          getSkuOptionsForInventory()
        ]);
      const [productInboundData, productOutboundData] = await Promise.all([
        getInventoryTransactions({ transactionType: "product_in" }),
        getInventoryTransactions({ transactionType: "product_out" })
      ]);
      const otherInboundRecords = [...inboundTransactionData, ...productInboundData]
        .filter(
          (transaction) =>
            !transaction.purchase_order_id &&
            !transaction.production_order_id &&
            !transaction.replenishment_request_id
        );
      const otherOutboundRecords = [...outboundTransactionData, ...productOutboundData]
        .filter((transaction) => !transaction.replenishment_request_id);

      setInventoryItems(inventoryData);
      setWarehouses(warehouseData);
      setRecentAdjustments(adjustmentData);
      setMovementRecords(
        [...otherInboundRecords, ...otherOutboundRecords, ...adjustmentData].sort(
          (first, second) =>
            new Date(second.occurred_at).getTime() -
            new Date(first.occurred_at).getTime()
        )
      );
      setSkuOptions(skuData.filter((sku) => sku.status === "active"));
      setNewAdjustmentWarehouseId((current) => current || warehouseData[0]?.id || "");
      setOtherMovementWarehouseId((current) => current || warehouseData[0]?.id || "");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setInventoryItems([]);
      setRecentAdjustments([]);
      setMovementRecords([]);
      setSkuOptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialWarehouseId = params.get("warehouseId") ?? "";
    const initialSkuKeyword = params.get("skuKeyword") ?? "";

    if (initialWarehouseId) {
      setWarehouseId(initialWarehouseId);
      setNewAdjustmentWarehouseId(initialWarehouseId);
      setOtherMovementWarehouseId(initialWarehouseId);
    }

    if (initialSkuKeyword) {
      setSkuKeyword(initialSkuKeyword);
      setNewAdjustmentSkuKeyword(initialSkuKeyword);
    }

    loadPageData({
      warehouseId: initialWarehouseId,
      skuKeyword: initialSkuKeyword,
      skuType: "all"
    });
  }, []);

  useEffect(() => {
    const keyword = newAdjustmentSkuKeyword.trim().toLowerCase();

    if (!keyword || newAdjustmentSkuId) {
      return;
    }

    const matchedSku = filteredSkuOptions.find(
      (sku) =>
        sku.sku_code.toLowerCase() === keyword ||
        sku.sku_name.toLowerCase() === keyword
    ) ?? filteredSkuOptions[0];

    if (matchedSku) {
      setNewAdjustmentSkuId(matchedSku.id);
    }
  }, [filteredSkuOptions, newAdjustmentSkuId, newAdjustmentSkuKeyword]);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const skuData = await getSkuOptionsForInventory(
          newAdjustmentSkuKeyword || otherMovementSkuKeyword,
          20
        );
        setSkuOptions(skuData.filter((sku) => sku.status === "active"));
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [newAdjustmentSkuKeyword, otherMovementSkuKeyword]);

  const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadPageData();
  };

  const resetFilters = () => {
    const nextFilters = {
      warehouseId: "",
      skuKeyword: "",
      skuType: "all" as InventoryAdjustmentSkuTypeFilter
    };

    setWarehouseId("");
    setSkuKeyword("");
    setSkuType("all");
    loadPageData(nextFilters);
  };

  const openAdjustmentForm = (
    item: InventoryAdjustmentRow,
    defaults: Partial<{
      adjustmentMode: InventoryAdjustmentMode;
      adjustmentReason: InventoryAdjustmentReason;
    }> = {}
  ) => {
    setSelectedItem(item);
    setAdjustmentMode(defaults.adjustmentMode ?? "set_to");
    setAdjustmentQuantity("");
    setTargetQuantity(String(item.quantity_on_hand));
    setAdjustmentReason(defaults.adjustmentReason ?? "stocktake_gain");
    setAdjustmentNotes("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openAdjustmentPicker = () => {
    setAdjustmentPickerOpen(true);
    setNewAdjustmentWarehouseId(
      newAdjustmentWarehouseId || warehouseId || warehouses[0]?.id || ""
    );
    setNewAdjustmentSkuKeyword(skuKeyword);
    setNewAdjustmentSkuId("");
    setAdjustmentMode("set_to");
    setAdjustmentReason("initial_stock");
    setAdjustmentQuantity("");
    setTargetQuantity("");
    setAdjustmentNotes("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openOtherMovementForm = (kind: OtherMovementKind) => {
    setOtherMovementKind(kind);
    setOtherMovementOpen(true);
    setOtherMovementWarehouseId(
      otherMovementWarehouseId || warehouseId || warehouses[0]?.id || ""
    );
    setOtherMovementSkuKeyword(skuKeyword);
    setOtherMovementSkuId("");
    setOtherMovementQuantity("");
    setOtherMovementReason("");
    setOtherMovementNotes("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openOtherMovementImport = (kind: OtherMovementKind) => {
    setOtherMovementKind(kind);
    setOtherMovementOpen(false);
    setOtherMovementImportOpen(true);
    setErrorMessage("");
    setSuccessMessage("");
  };

  const submitOtherMovement = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const input = {
        warehouseId: otherMovementWarehouseId,
        skuId: otherMovementSkuId,
        quantity: Number(otherMovementQuantity),
        reason: otherMovementReason,
        notes: otherMovementNotes
      };

      if (otherMovementKind === "inbound") {
        await createOtherInbound(input);
      } else {
        await createOtherOutbound(input);
      }

      setSuccessMessage(
        `${selectedOtherMovementSku?.sku_code ?? "该 SKU"} ${
          otherMovementKind === "inbound" ? "其他入库" : "其他出库"
        }成功。`
      );
      setOtherMovementOpen(false);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const importOtherMovementRows = async (
    rows: OtherInventoryMovementValidationRow[]
  ) => {
    const validRows = rows.flatMap((row) => (row.data ? [row.data] : []));
    const result =
      otherMovementKind === "inbound"
        ? await bulkCreateOtherInbound(validRows)
        : await bulkCreateOtherOutbound(validRows);

    setSuccessMessage(
      `批量${otherMovementKind === "inbound" ? "其他入库" : "其他出库"}完成：成功 ${
        result.successCount
      } 条，失败 ${result.failedCount} 条。`
    );
    await loadPageData();

    return result;
  };

  const openWarehouseSkuAdjustmentForm = () => {
    const warehouse =
      warehouses.find((item) => item.id === newAdjustmentWarehouseId) ??
      warehouses[0] ??
      null;
    const sku = skuOptions.find((item) => item.id === newAdjustmentSkuId) ?? null;

    if (!warehouse || !sku) {
      setErrorMessage("请先选择仓库和 SKU。");
      return;
    }

    const existingItem = inventoryItems.find(
      (item) => item.warehouse_id === warehouse.id && item.sku_id === sku.id
    );

    if (existingItem) {
      openAdjustmentForm(existingItem, {
        adjustmentMode,
        adjustmentReason
      });
      setAdjustmentPickerOpen(false);
      return;
    }

    setSelectedItem({
      id: "",
      warehouse_id: warehouse.id,
      sku_id: sku.sku_type === "material" ? null : sku.id,
      product_sku_id: sku.product_sku_id,
      material_id: sku.material_id,
      item_type: sku.sku_type === "material" ? "material" : "finished_product",
      quantity_on_hand: 0,
      reserved_quantity: 0,
      safety_stock_quantity: 0,
      unit: sku.unit,
      updated_at: new Date().toISOString(),
      warehouse,
      sku: {
        id: sku.id,
        product_id: sku.product_id,
        sku_code: sku.sku_code,
        sku_name: sku.sku_name,
        sku_type: sku.sku_type,
        unit: sku.unit,
        product: sku.product
      },
      product_sku:
        sku.product_sku_id && sku.sku_type !== "material"
          ? {
              id: sku.product_sku_id,
              product_id: sku.product_id,
              sku_code: sku.sku_code,
              sku_name: sku.sku_name,
              sku_type: sku.sku_type,
              unit: sku.unit,
              product: sku.product
            }
          : null,
      material: sku.material
    });
    setAdjustmentMode(adjustmentMode);
    setAdjustmentQuantity("");
    setTargetQuantity("0");
    setAdjustmentReason(adjustmentReason);
    setAdjustmentNotes("");
    setErrorMessage("");
    setSuccessMessage("");
    setAdjustmentPickerOpen(false);
  };

  const closeAdjustmentForm = () => {
    if (submitting) {
      return;
    }

    setSelectedItem(null);
  };

  const submitAdjustment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedItem) {
      setErrorMessage("请选择要调整的库存。");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const result = await adjustInventoryByWarehouseSku({
        warehouseId: selectedItem.warehouse_id,
        skuId: selectedItem.material_id ?? selectedItem.product_sku_id ?? selectedItem.sku_id ?? "",
        adjustmentMode,
        adjustmentQuantity:
          adjustmentMode === "set_to" || !adjustmentQuantity.trim()
            ? undefined
            : Number(adjustmentQuantity),
        targetQuantity:
          adjustmentMode !== "set_to" || !targetQuantity.trim()
            ? undefined
            : Number(targetQuantity),
        reason: adjustmentReason,
        notes: adjustmentNotes
      });

      setSuccessMessage(
        `${
          selectedItem.material?.material_code ??
          selectedItem.product_sku?.sku_code ??
          selectedItem.sku?.sku_code ??
          "该物品"
        } 库存调整成功：${formatQuantity(
          result.beforeQuantity
        )} ${unit} -> ${formatQuantity(result.afterQuantity)} ${unit}。`
      );
      setSelectedItem(null);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const importAdjustmentRows = async (
    rows: InventoryAdjustmentValidationRow[]
  ) => {
    const result = await bulkAdjustInventory(
      rows.flatMap((row) => (row.data ? [row.data] : []))
    );

    setSuccessMessage(
      `批量库存调整完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  return (
    <main className="pageShell">
      <PageHeader
        title="库存收发"
        primaryAction={
          activeTab === "other_in" || activeTab === "other_out" ? (
            <button
              className="primaryButton"
              type="button"
              onClick={() =>
                openOtherMovementForm(
                  activeTab === "other_in" ? "inbound" : "outbound"
                )
              }
              disabled={loading}
            >
              {activeTab === "other_in" ? "新建其他入库" : "新建其他出库"}
            </button>
          ) : activeTab === "adjustment" ? (
            <button
              className="primaryButton"
              type="button"
              onClick={openAdjustmentPicker}
              disabled={loading}
            >
              新建调整单
            </button>
          ) : undefined
        }
        secondaryActions={
          <button type="button" onClick={() => loadPageData()} disabled={loading}>
            {loading ? "正在刷新..." : "刷新"}
          </button>
        }
      />

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
        <div className="tabBar" role="tablist" aria-label="库存收发类型">
          {movementTabs.map((tab) => (
            <button
              className={activeTab === tab.value ? "tabButton active" : "tabButton"}
              key={tab.value}
              type="button"
              onClick={() => setActiveTab(tab.value)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "other_in" || activeTab === "other_out" ? (
          <>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">非采购 / 非生产 / 非备货</p>
                <h3>{activeTab === "other_in" ? "其他入库" : "其他出库"}</h3>
              </div>
              <div className="rowActions">
                <button
                  className="primaryButton"
                  type="button"
                  onClick={() =>
                    openOtherMovementForm(
                      activeTab === "other_in" ? "inbound" : "outbound"
                    )
                  }
                  disabled={loading}
                >
                  {activeTab === "other_in" ? "新建其他入库" : "新建其他出库"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    openOtherMovementImport(
                      activeTab === "other_in" ? "inbound" : "outbound"
                    )
                  }
                  disabled={loading}
                >
                  批量上传
                </button>
              </div>
            </div>

            <div className="detailGrid">
              <div className="detailItem">
                <span>适用场景</span>
                <strong>
                  {activeTab === "other_in"
                    ? "样品入库、退货入库、手工补录、其他原因入库"
                    : "报废出库、领料出库、样品出库、其他原因出库"}
                </strong>
              </div>
              <div className="detailItem">
                <span>必填信息</span>
                <strong>仓库、物料/产品、数量和原因</strong>
              </div>
              <div className="detailItem">
                <span>库存流水</span>
                <strong>
                  {activeTab === "other_in"
                    ? "写入 material_in / product_in"
                    : "写入 material_out / product_out，校验库存不为负"}
                </strong>
              </div>
            </div>
          </>
        ) : null}

        {activeTab === "adjustment" ? (
          <>
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">当前库存</p>
            <h3>库存调整工作台</h3>
          </div>
          <div className="rowActions">
            <button
              className="primaryButton"
              type="button"
              onClick={openAdjustmentPicker}
              disabled={loading}
            >
              新建调整单
            </button>
            <button
              type="button"
              onClick={() => setAdjustmentImportOpen(true)}
              disabled={loading}
            >
              批量上传
            </button>
            <button type="button" onClick={() => loadPageData()} disabled={loading}>
              {loading ? "正在刷新..." : "刷新列表"}
            </button>
          </div>
        </div>

        <form
          className="listToolbar adjustmentToolbar"
          onSubmit={submitFilters}
        >
          <label>
            仓库
            <select
              value={warehouseId}
              onChange={(event) => setWarehouseId(event.target.value)}
              disabled={loading}
            >
              <option value="">全部仓库</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.warehouse_code} / {warehouse.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            SKU 类型
            <select
              value={skuType}
              onChange={(event) =>
                setSkuType(
                  event.target.value as InventoryAdjustmentSkuTypeFilter
                )
              }
              disabled={loading}
            >
              {skuTypeOptions.map((option) => (
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
              disabled={loading}
            />
          </label>

          <div className="rowActions">
            <button type="submit" disabled={loading}>
              {loading ? "查询中..." : "查询"}
            </button>
            <button type="button" onClick={resetFilters} disabled={loading}>
              重置
            </button>
          </div>
        </form>

        <div className="detailGrid">
          <div className="detailItem">
            <span>期初库存</span>
            <strong>建议用“直接修正为指定库存”或批量上传</strong>
          </div>
          <div className="detailItem">
            <span>盘点调整</span>
            <strong>盘点后按真实数量修正，系统自动写调整流水</strong>
          </div>
          <div className="detailItem">
            <span>批量规则</span>
            <strong>上传后先预览校验，通过后才写入数据库</strong>
          </div>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取当前库存，请稍候...</div>
        ) : null}

        {!loading && inventoryItems.length === 0 ? (
          <div className="emptyState">暂无库存数据</div>
        ) : null}

        {!loading && inventoryItems.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable adjustmentInventoryTable">
              <thead>
                <tr>
                  <th>SKU 编码</th>
                  <th>SKU 名称</th>
                  <th>SKU 类型</th>
                  <th>产品名称</th>
                  <th>仓库</th>
                  <th>当前库存数量</th>
                  <th>单位</th>
                  <th>最后更新时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {inventoryItems.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sku?.sku_code ?? "-"}</td>
                    <td>{item.sku?.sku_name ?? "-"}</td>
                    <td>
                      <span
                        className={`tablePill sku-type-${
                          item.sku?.sku_type ?? "unknown"
                        }`}
                      >
                        {getSkuTypeLabel(item.sku?.sku_type)}
                      </span>
                    </td>
                    <td>{item.sku?.product?.name ?? "-"}</td>
                    <td>
                      <strong>{item.warehouse?.name ?? "-"}</strong>
                      <span>{item.warehouse?.warehouse_code ?? "-"}</span>
                    </td>
                    <td className="quantityCell">
                      {formatQuantity(item.quantity_on_hand)}
                    </td>
                    <td>{getUnit(item)}</td>
                    <td>{formatDateTime(item.updated_at)}</td>
                    <td>
                      <div className="rowActions">
                        <button
                          type="button"
                          onClick={() => openAdjustmentForm(item)}
                          disabled={!item.sku || !item.warehouse}
                        >
                          调整库存
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
          </>
        ) : null}

        {activeTab === "records" ? (
          <>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">收发记录</p>
                <h3>库存收发记录</h3>
              </div>
            </div>

            <form
              className="listToolbar adjustmentToolbar"
              onSubmit={submitFilters}
            >
              <label>
                仓库
                <select
                  value={warehouseId}
                  onChange={(event) => setWarehouseId(event.target.value)}
                  disabled={loading}
                >
                  <option value="">全部仓库</option>
                  {warehouses.map((warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.warehouse_code} / {warehouse.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                SKU 类型
                <select
                  value={skuType}
                  onChange={(event) =>
                    setSkuType(
                      event.target.value as InventoryAdjustmentSkuTypeFilter
                    )
                  }
                  disabled={loading}
                >
                  {skuTypeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                搜索
                <input
                  value={skuKeyword}
                  onChange={(event) => setSkuKeyword(event.target.value)}
                  placeholder="流水号 / SKU / 物料 / 产品 / 原因"
                  disabled={loading}
                />
              </label>

              <div className="rowActions">
                <button type="submit" disabled={loading}>
                  {loading ? "查询中..." : "查询"}
                </button>
                <button type="button" onClick={resetFilters} disabled={loading}>
                  重置
                </button>
              </div>
            </form>

            {loading ? (
              <div className="debugNotice">正在读取库存收发记录...</div>
            ) : null}

            {!loading && filteredMovementRecords.length === 0 ? (
              <div className="emptyState">暂无库存收发记录</div>
            ) : null}

            {!loading && filteredMovementRecords.length > 0 ? (
              <div className="tableWrap">
                <table className="dataTable adjustmentTransactionsTable">
                  <thead>
                    <tr>
                      <th>流水号</th>
                      <th>类型</th>
                      <th>物料/产品</th>
                      <th>仓库</th>
                      <th>数量</th>
                      <th>原因</th>
                      <th>备注</th>
                      <th>操作时间</th>
                      <th>操作人</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMovementRecords.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{transaction.transaction_no}</td>
                        <td>
                          <span
                            className={`tablePill movement-type-${transaction.transaction_type}`}
                          >
                            {getTransactionTypeLabel(transaction)}
                          </span>
                        </td>
                        <td>
                          <strong>{getTransactionItemCode(transaction)}</strong>
                          <span>
                            {getTransactionItemName(transaction)} /{" "}
                            {getTransactionItemSubtitle(transaction)}
                          </span>
                        </td>
                        <td>
                          <strong>{transaction.warehouse?.name ?? "-"}</strong>
                          <span>{transaction.warehouse?.warehouse_code ?? "-"}</span>
                        </td>
                        <td className="quantityCell">
                          {formatMovementQuantity(transaction)}
                        </td>
                        <td>
                          {transaction.transaction_type === "adjustment"
                            ? parseAdjustmentReason(transaction.notes)
                            : parseOtherMovementReason(transaction.notes)}
                        </td>
                        <td className="notesCell">
                          {transaction.transaction_type === "adjustment"
                            ? parseAdjustmentRemark(transaction.notes)
                            : parseOtherMovementRemark(transaction.notes)}
                        </td>
                        <td>{formatDateTime(transaction.occurred_at)}</td>
                        <td>{getOperatorLabel(transaction)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </>
        ) : null}
      </section>

      {adjustmentPickerOpen ? (
        <Modal
          open={adjustmentPickerOpen}
          eyebrow="库存调整"
          title="新建库存调整单"
          maxWidth="xl"
          onClose={() => setAdjustmentPickerOpen(false)}
        >
          <div className="detailGrid">
            <div className="detailItem">
              <span>适用场景</span>
              <strong>期初库存、月度盘点、数据修正</strong>
            </div>
            <div className="detailItem">
              <span>推荐方式</span>
              <strong>按盘点后的真实数量直接修正</strong>
            </div>
            <div className="detailItem">
              <span>流水记录</span>
              <strong>提交后自动写入 adjustment 库存流水</strong>
            </div>
          </div>

          <div className="dataForm adjustmentForm">
            <label>
              调整仓库
              <select
                value={newAdjustmentWarehouseId}
                onChange={(event) =>
                  setNewAdjustmentWarehouseId(event.target.value)
                }
                disabled={loading}
              >
                <option value="">请选择仓库</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouse_code} / {warehouse.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              SKU 搜索
              <input
                value={newAdjustmentSkuKeyword}
                onChange={(event) => {
                  setNewAdjustmentSkuKeyword(event.target.value);
                  setNewAdjustmentSkuId("");
                }}
                placeholder="输入 SKU 编码、名称或产品名称"
                disabled={loading}
              />
            </label>

            <label>
              调整 SKU
              <select
                value={newAdjustmentSkuId}
                onChange={(event) => setNewAdjustmentSkuId(event.target.value)}
                disabled={loading}
              >
                <option value="">请选择 SKU</option>
                {filteredSkuOptions.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {sku.sku_code} / {sku.sku_name} /{" "}
                    {sku.product?.name ?? "无所属产品"} / {sku.unit}
                  </option>
                ))}
              </select>
              <span className="fieldHint">
                当前匹配 {filteredSkuOptions.length} 个 SKU，可先输入编码或名称缩小范围。
              </span>
            </label>

            <label>
              调整方式
              <select
                value={adjustmentMode}
                onChange={(event) =>
                  setAdjustmentMode(event.target.value as InventoryAdjustmentMode)
                }
                disabled={loading}
              >
                {adjustmentModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              调整原因
              <select
                value={adjustmentReason}
                onChange={(event) =>
                  setAdjustmentReason(
                    event.target.value as InventoryAdjustmentReason
                  )
                }
                disabled={loading}
              >
                {adjustmentReasonOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="fullField adjustmentPreviewBox">
              <span>批量上传</span>
              <strong>期初库存和盘点结果有很多 SKU 时，建议直接上传 CSV。</strong>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => {
                    setAdjustmentPickerOpen(false);
                    setAdjustmentImportOpen(true);
                  }}
                  disabled={loading}
                >
                  打开批量上传
                </button>
              </div>
            </div>

            <div className="modalFooter fullField">
              <span>没有库存记录时按当前库存 0 处理。</span>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => setAdjustmentPickerOpen(false)}
                >
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="button"
                  onClick={openWarehouseSkuAdjustmentForm}
                  disabled={
                    loading || !newAdjustmentWarehouseId || !newAdjustmentSkuId
                  }
                >
                  下一步填写数量
                </button>
              </div>
            </div>
          </div>
        </Modal>
      ) : null}

      {selectedItem ? (
        <Modal
          open={Boolean(selectedItem)}
          eyebrow="库存调整"
          title={`库存调整单：${selectedItem.sku?.sku_code ?? "未命名 SKU"}`}
          maxWidth="xl"
          onClose={closeAdjustmentForm}
        >
            <div className="detailGrid">
              <div className="detailItem">
                <span>SKU 编码</span>
                <strong>{selectedItem.sku?.sku_code ?? "-"}</strong>
              </div>
              <div className="detailItem">
                <span>SKU 名称</span>
                <strong>{selectedItem.sku?.sku_name ?? "-"}</strong>
              </div>
              <div className="detailItem">
                <span>SKU 类型</span>
                <strong>{getSkuTypeLabel(selectedItem.sku?.sku_type)}</strong>
              </div>
              <div className="detailItem">
                <span>仓库</span>
                <strong>
                  {selectedItem.warehouse?.warehouse_code ?? "-"} /{" "}
                  {selectedItem.warehouse?.name ?? "-"}
                </strong>
              </div>
              <div className="detailItem">
                <span>当前库存数量</span>
                <strong>{formatQuantity(selectedItem.quantity_on_hand)}</strong>
              </div>
              <div className="detailItem">
                <span>单位</span>
                <strong>{unit}</strong>
              </div>
            </div>

            <form className="dataForm adjustmentForm" onSubmit={submitAdjustment}>
              <label>
                调整方式
                <select
                  value={adjustmentMode}
                  onChange={(event) =>
                    setAdjustmentMode(event.target.value as InventoryAdjustmentMode)
                  }
                  disabled={submitting}
                >
                  {adjustmentModeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                调整数量
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={
                    adjustmentMode === "set_to"
                      ? adjustmentPreview
                        ? String(adjustmentPreview.adjustmentQuantity)
                        : ""
                      : adjustmentQuantity
                  }
                  onChange={(event) => setAdjustmentQuantity(event.target.value)}
                  disabled={submitting || adjustmentMode === "set_to"}
                  placeholder={
                    adjustmentMode === "set_to" ? "系统自动计算" : "请输入调整数量"
                  }
                />
              </label>

              <label>
                调整后库存
                <input
                  type="number"
                  min="0"
                  step="0.0001"
                  value={
                    adjustmentMode === "set_to"
                      ? targetQuantity
                      : adjustmentPreview
                        ? String(adjustmentPreview.afterQuantity)
                        : ""
                  }
                  onChange={(event) => setTargetQuantity(event.target.value)}
                  disabled={submitting || adjustmentMode !== "set_to"}
                  placeholder={
                    adjustmentMode === "set_to"
                      ? "请输入调整后的库存"
                      : "系统自动计算"
                  }
                />
              </label>

              <label>
                调整原因
                <select
                  value={adjustmentReason}
                  onChange={(event) =>
                    setAdjustmentReason(
                      event.target.value as InventoryAdjustmentReason
                    )
                  }
                  disabled={submitting}
                >
                  {adjustmentReasonOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="fullField">
                备注
                <textarea
                  value={adjustmentNotes}
                  onChange={(event) => setAdjustmentNotes(event.target.value)}
                  placeholder="填写盘点、报废、样品领用或数据修正的具体说明"
                  disabled={submitting}
                />
              </label>

              <div className="fullField adjustmentPreviewBox">
                <span>调整结果</span>
                <strong>
                  {adjustmentPreview
                    ? `${formatQuantity(currentQuantity)} ${unit} -> ${formatQuantity(
                        adjustmentPreview.afterQuantity
                      )} ${unit}`
                    : "请填写调整数量或调整后库存"}
                </strong>
                {adjustmentPreview ? (
                  <p
                    className={
                      adjustmentPreview.signedDifference < 0
                        ? "dangerText"
                        : "fieldHint"
                    }
                  >
                    差异：{adjustmentPreview.signedDifference > 0 ? "+" : ""}
                    {formatQuantity(adjustmentPreview.signedDifference)} {unit}
                  </p>
                ) : null}
              </div>

              <div className="modalFooter fullField">
                <p className="fieldHint">请确认数量、原因和备注后提交。</p>
                <div className="rowActions">
                  <button
                    type="button"
                    onClick={closeAdjustmentForm}
                    disabled={submitting}
                  >
                    取消
                  </button>
                  <button
                    type="submit"
                    className="primaryButton"
                    disabled={submitting}
                  >
                    {submitting ? "正在提交..." : "提交调整"}
                  </button>
                </div>
              </div>
          </form>
        </Modal>
      ) : null}

      <BulkImportDialog
        open={adjustmentImportOpen}
        title="批量上传库存调整"
        description="适合系统上线期初库存和盘点结果导入。上传后先预览和逐行校验，通过后会一次性批量更新当前库存并写入 adjustment 库存流水。"
        templateFileName="inventory-adjustment-template.csv"
        fields={inventoryAdjustmentImportFields}
        sampleRows={[
          {
            仓库编码: "WH-FIN-001",
            "SKU 编码": "SKU-001",
            调整方式: "直接修正库存",
            调整数量: "",
            调整后库存: "100",
            调整原因: "期初库存",
            备注: "系统上线期初录入"
          },
          {
            仓库编码: "WH-FIN-001",
            "SKU 编码": "SKU-002",
            调整方式: "增加库存",
            调整数量: "5",
            调整后库存: "",
            调整原因: "盘盈",
            备注: "月度盘点"
          }
        ]}
        validateRows={validateInventoryAdjustmentImportRows}
        onImport={importAdjustmentRows}
        onClose={() => setAdjustmentImportOpen(false)}
        renderPreviewSummary={(rows) => {
          const validRows = rows.filter((row) => row.errors.length === 0);
          const setToRows = validRows.filter(
            (row) => row.data?.adjustmentMode === "set_to"
          ).length;
          const increaseRows = validRows.filter(
            (row) => row.data?.adjustmentMode === "increase"
          ).length;
          const decreaseRows = validRows.filter(
            (row) => row.data?.adjustmentMode === "decrease"
          ).length;

          return (
            <div className="debugNotice">
              预览通过 {validRows.length} 行：直接修正 {setToRows} 行，增加库存{" "}
              {increaseRows} 行，减少库存 {decreaseRows} 行。
            </div>
          );
        }}
      />

      {otherMovementOpen ? (
        <Modal
          open={otherMovementOpen}
          eyebrow={otherMovementKind === "inbound" ? "其他入库" : "其他出库"}
          title={
            otherMovementKind === "inbound"
              ? "新建其他入库单"
              : "新建其他出库单"
          }
          maxWidth="xl"
          onClose={() => {
            if (!submitting) {
              setOtherMovementOpen(false);
            }
          }}
        >
          <form className="dataForm inboundForm" onSubmit={submitOtherMovement}>
            <label>
              {otherMovementKind === "inbound" ? "入库仓库" : "出库仓库"}
              <select
                value={otherMovementWarehouseId}
                onChange={(event) => setOtherMovementWarehouseId(event.target.value)}
                disabled={submitting}
                required
              >
                <option value="">请选择仓库</option>
                {warehouses.map((warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouse_code} / {warehouse.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              搜索 SKU
              <input
                value={otherMovementSkuKeyword}
                onChange={(event) => {
                  setOtherMovementSkuKeyword(event.target.value);
                  setOtherMovementSkuId("");
                }}
                placeholder="输入 SKU 编码 / 名称 / 产品名称"
                disabled={submitting}
              />
            </label>

            <label>
              物料 / 产品
              <select
                value={otherMovementSkuId}
                onChange={(event) => setOtherMovementSkuId(event.target.value)}
                disabled={submitting}
                required
              >
                <option value="">请选择物料 / 产品</option>
                {filteredOtherMovementSkuOptions.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {sku.sku_code} / {sku.sku_name} / {getMovementSkuTypeLabel(sku)} /{" "}
                    {sku.unit}
                  </option>
                ))}
              </select>
            </label>

            <label>
              {otherMovementKind === "inbound" ? "入库数量" : "出库数量"}
              <input
                min="0.0001"
                step="0.0001"
                type="number"
                value={otherMovementQuantity}
                onChange={(event) => setOtherMovementQuantity(event.target.value)}
                disabled={submitting}
                required
              />
            </label>

            <label>
              {otherMovementKind === "inbound" ? "入库原因" : "出库原因"}
              <input
                value={otherMovementReason}
                onChange={(event) => setOtherMovementReason(event.target.value)}
                placeholder={
                  otherMovementKind === "inbound"
                    ? "例如样品入库、退货入库、手工补录"
                    : "例如报废出库、领料出库、样品出库"
                }
                disabled={submitting}
                required
              />
            </label>

            <label className="fullField">
              备注
              <textarea
                value={otherMovementNotes}
                onChange={(event) => setOtherMovementNotes(event.target.value)}
                placeholder="可填写来源、用途或盘点说明"
                disabled={submitting}
              />
            </label>

            <div className="fullField adjustmentPreviewBox">
              <span>库存影响</span>
              <strong>
                {otherMovementKind === "inbound"
                  ? "提交后会增加库存，并写入库存流水。"
                  : "提交前会校验可用库存，不能导致库存为负。"}
              </strong>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => openOtherMovementImport(otherMovementKind)}
                  disabled={submitting}
                >
                  打开批量上传
                </button>
              </div>
            </div>

            <div className="modalFooter fullField">
              <span>原因、仓库、物料/产品和数量为必填。</span>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => setOtherMovementOpen(false)}
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={
                    submitting ||
                    !otherMovementWarehouseId ||
                    !otherMovementSkuId ||
                    Number(otherMovementQuantity) <= 0 ||
                    !otherMovementReason.trim()
                  }
                >
                  {submitting
                    ? "正在提交..."
                    : otherMovementKind === "inbound"
                      ? "确认其他入库"
                      : "确认其他出库"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}

      <BulkImportDialog
        open={otherMovementImportOpen}
        title={
          otherMovementKind === "inbound"
            ? "批量导入其他入库"
            : "批量导入其他出库"
        }
        description="上传后先预览和校验，不会直接写入数据库。确认导入后会批量更新库存并写入库存流水。"
        templateFileName={
          otherMovementKind === "inbound"
            ? "other-inbound-template.csv"
            : "other-outbound-template.csv"
        }
        fields={
          otherMovementKind === "inbound"
            ? otherInboundImportFields
            : otherOutboundImportFields
        }
        sampleRows={[
          otherMovementKind === "inbound"
            ? {
                仓库编码: "WH-FIN-001",
                "SKU 编码": "SKU-001",
                入库数量: "100",
                入库原因: "样品入库",
                备注: "手工补录"
              }
            : {
                仓库编码: "WH-FIN-001",
                "SKU 编码": "SKU-001",
                出库数量: "10",
                出库原因: "样品出库",
                备注: "业务样品"
              }
        ]}
        validateRows={
          otherMovementKind === "inbound"
            ? validateOtherInboundImportRows
            : validateOtherOutboundImportRows
        }
        onImport={importOtherMovementRows}
        onClose={() => setOtherMovementImportOpen(false)}
        renderPreviewSummary={(rows) => {
          const validRows = rows.filter((row) => row.errors.length === 0);
          const totalQuantity = validRows.reduce(
            (sum, row) => sum + Number(row.data?.quantity ?? 0),
            0
          );

          return (
            <div className="debugNotice">
              预览通过 {validRows.length} 行，合计
              {otherMovementKind === "inbound" ? "入库" : "出库"}{" "}
              {formatQuantity(totalQuantity)} 件。
            </div>
          );
        }}
      />
    </main>
  );
}
