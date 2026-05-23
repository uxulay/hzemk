"use client";

import { useEffect, useMemo, useState } from "react";
import {
  adjustInventoryItem,
  getInventoryForAdjustment,
  getRecentAdjustmentTransactions,
  getWarehousesForFilter,
  type InventoryAdjustmentMode,
  type InventoryAdjustmentReason,
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
  const [warehouseId, setWarehouseId] = useState("");
  const [skuKeyword, setSkuKeyword] = useState("");
  const [skuType, setSkuType] =
    useState<InventoryAdjustmentSkuTypeFilter>("all");
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

      const [inventoryData, warehouseData, adjustmentData] = await Promise.all([
        getInventoryForAdjustment(filters),
        getWarehousesForFilter(),
        getRecentAdjustmentTransactions()
      ]);

      setInventoryItems(inventoryData);
      setWarehouses(warehouseData);
      setRecentAdjustments(adjustmentData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setInventoryItems([]);
      setRecentAdjustments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

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

  const openAdjustmentForm = (item: InventoryAdjustmentRow) => {
    setSelectedItem(item);
    setAdjustmentMode("increase");
    setAdjustmentQuantity("");
    setTargetQuantity(String(item.quantity_on_hand));
    setAdjustmentReason("stocktake_gain");
    setAdjustmentNotes("");
    setErrorMessage("");
    setSuccessMessage("");
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

      const result = await adjustInventoryItem({
        inventoryItemId: selectedItem.id,
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

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">仓库管理</p>
          <h2>库存调整</h2>
          <p>
            处理盘点差异、破损报废、录入错误修正和样品领用等非正常库存变动。
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
            <h3>选择要调整的 SKU</h3>
          </div>
          <div className="rowActions">
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

      {selectedItem ? (
        <div className="modalBackdrop">
          <div className="modalPanel">
            <div className="detailHeader">
              <div>
                <p className="eyebrow">库存调整</p>
                <h3>{selectedItem.sku?.sku_code ?? "未命名 SKU"}</h3>
              </div>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={closeAdjustmentForm}
                  disabled={submitting}
                >
                  关闭
                </button>
              </div>
            </div>

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
          </div>
        </div>
      ) : null}
    </main>
  );
}
