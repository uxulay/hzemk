"use client";

import { useEffect, useMemo, useState } from "react";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Modal } from "@/components/Modal";
import {
  adjustInventoryByWarehouseSku,
  bulkAdjustInventory,
  getInventoryForAdjustment,
  getRecentAdjustmentTransactions,
  getSkuOptionsForInventory,
  getWarehousesForFilter,
  inventoryAdjustmentImportFields,
  validateInventoryAdjustmentImportRows,
  type InventorySkuOption,
  type InventoryAdjustmentMode,
  type InventoryAdjustmentReason,
  type InventoryAdjustmentValidationRow,
  type InventoryAdjustmentRow,
  type InventoryAdjustmentSkuTypeFilter,
  type InventoryTransactionRow,
  type InventoryTransactionWarehouse
} from "@/lib/api/inventory";

const skuTypeOptions: Array<{
  value: InventoryAdjustmentSkuTypeFilter;
  label: string;
}> = [
  { value: "all", label: "全部 SKU 类型" },
  { value: "material", label: "原材料" },
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
  material: "原材料",
  finished_good: "成品",
  finished_product: "成品"
};

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

function getOperatorLabel(transaction: InventoryTransactionRow) {
  return (
    transaction.operator?.full_name ||
    transaction.operator?.email ||
    transaction.operator_id ||
    "-"
  );
}

export default function InventoryAdjustmentsPage() {
  const [inventoryItems, setInventoryItems] = useState<InventoryAdjustmentRow[]>(
    []
  );
  const [recentAdjustments, setRecentAdjustments] = useState<
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

      const [inventoryData, warehouseData, adjustmentData, skuData] =
        await Promise.all([
        getInventoryForAdjustment(filters),
        getWarehousesForFilter(),
        getRecentAdjustmentTransactions(),
        getSkuOptionsForInventory()
      ]);

      setInventoryItems(inventoryData);
      setWarehouses(warehouseData);
      setRecentAdjustments(adjustmentData);
      setSkuOptions(skuData.filter((sku) => sku.status === "active"));
      setNewAdjustmentWarehouseId((current) => current || warehouseData[0]?.id || "");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setInventoryItems([]);
      setRecentAdjustments([]);
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
      sku_id: sku.id,
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
      }
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
        skuId: selectedItem.sku_id,
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
        `${selectedItem.sku?.sku_code ?? "该 SKU"} 库存调整成功：${formatQuantity(
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

    await loadPageData();
    setSuccessMessage(
      `批量库存调整完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">仓库管理</p>
          <h2>库存调整</h2>
          <p>
            主要用于系统上线期初库存录入，以及后续盘点时把账面库存修正到真实数量。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
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
      </section>

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">最近流水</p>
            <h3>最近库存调整记录</h3>
          </div>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取最近库存调整记录...</div>
        ) : null}

        {!loading && recentAdjustments.length === 0 ? (
          <div className="emptyState">暂无库存调整流水</div>
        ) : null}

        {!loading && recentAdjustments.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable adjustmentTransactionsTable">
              <thead>
                <tr>
                  <th>操作时间</th>
                  <th>SKU 编码</th>
                  <th>SKU 名称</th>
                  <th>仓库</th>
                  <th>调整数量</th>
                  <th>调整原因</th>
                  <th>备注</th>
                  <th>操作人</th>
                </tr>
              </thead>
              <tbody>
                {recentAdjustments.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{formatDateTime(transaction.occurred_at)}</td>
                    <td>{transaction.sku?.sku_code ?? "-"}</td>
                    <td>{transaction.sku?.sku_name ?? "-"}</td>
                    <td>
                      <strong>{transaction.warehouse?.name ?? "-"}</strong>
                      <span>{transaction.warehouse?.warehouse_code ?? "-"}</span>
                    </td>
                    <td className="quantityCell">
                      {formatAdjustmentQuantity(transaction)}
                    </td>
                    <td>{parseAdjustmentReason(transaction.notes)}</td>
                    <td className="notesCell">
                      {parseAdjustmentRemark(transaction.notes)}
                    </td>
                    <td>{getOperatorLabel(transaction)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
        description="适合系统上线期初库存和盘点结果导入。上传后先预览和逐行校验，通过后才会更新当前库存并写入 adjustment 库存流水。"
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
    </main>
  );
}
