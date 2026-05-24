"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  getInventoryTransactions,
  getWarehousesForFilter,
  type InventoryTransactionFilters,
  type InventoryTransactionRelatedOrderType,
  type InventoryTransactionRow,
  type InventoryTransactionType,
  type InventoryTransactionTypeFilter,
  type InventoryTransactionWarehouse
} from "@/lib/api/inventory";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

const transactionTypeOptions: Array<{
  value: InventoryTransactionTypeFilter;
  label: string;
}> = [
  { value: "all", label: "全部流水类型" },
  { value: "material_in", label: "原材料入库" },
  { value: "material_out", label: "原材料出库" },
  { value: "product_in", label: "成品入库" },
  { value: "product_out", label: "成品出库" },
  { value: "adjustment", label: "库存调整" }
];

const transactionTypeLabels: Record<InventoryTransactionType, string> = {
  material_in: "原材料入库",
  material_out: "原材料出库",
  product_in: "成品入库",
  product_out: "成品出库",
  adjustment: "库存调整"
};

const skuTypeLabels: Record<string, string> = {
  material: "原材料",
  semi_finished: "半成品",
  finished_product: "成品",
  finished_good: "成品"
};

const relatedOrderTypeLabels: Record<
  InventoryTransactionRelatedOrderType,
  string
> = {
  purchase_order: "采购单",
  production_order: "生产任务",
  fba_replenishment_request: "FBA 备货单"
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "读取库存流水失败，请稍后重试。";
}

function formatQuantity(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function formatSignedQuantity(transaction: InventoryTransactionRow) {
  const quantity = Number(transaction.quantity);

  if (
    transaction.transaction_type === "material_out" ||
    transaction.transaction_type === "product_out"
  ) {
    return `-${formatQuantity(Math.abs(quantity))}`;
  }

  if (
    transaction.transaction_type === "material_in" ||
    transaction.transaction_type === "product_in"
  ) {
    return `+${formatQuantity(Math.abs(quantity))}`;
  }

  return quantity > 0 ? `+${formatQuantity(quantity)}` : formatQuantity(quantity);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function getRelatedOrderTypeLabel(
  relatedOrderType: InventoryTransactionRelatedOrderType | null
) {
  if (!relatedOrderType) {
    return "-";
  }

  return relatedOrderTypeLabels[relatedOrderType];
}

function getSkuTypeLabel(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return skuTypeLabels[value] ?? value;
}

function isEndDateBeforeStartDate(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && endDate < startDate);
}

export default function InventoryTransactionsPage() {
  const [transactions, setTransactions] = useState<InventoryTransactionRow[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryTransactionWarehouse[]>([]);
  const [transactionType, setTransactionType] =
    useState<InventoryTransactionTypeFilter>("all");
  const [warehouseId, setWarehouseId] = useState("");
  const [skuKeyword, setSkuKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTransaction, setSelectedTransaction] =
    useState<InventoryTransactionRow | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const summary = useMemo(() => {
    const counts: Record<InventoryTransactionType, number> = {
      material_in: 0,
      material_out: 0,
      product_in: 0,
      product_out: 0,
      adjustment: 0
    };

    for (const transaction of transactions) {
      counts[transaction.transaction_type] += 1;
    }

    return counts;
  }, [transactions]);

  const paginatedTransactions = useMemo(
    () => paginateItems(transactions, page),
    [page, transactions]
  );

  const loadTransactions = async (
    filters: InventoryTransactionFilters = {
      transactionType,
      warehouseId,
      skuKeyword,
      startDate,
      endDate
    }
  ) => {
    if (
      isEndDateBeforeStartDate(filters.startDate ?? "", filters.endDate ?? "")
    ) {
      setErrorMessage("结束日期不能早于开始日期。");
      setTransactions([]);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");
      setPage(1);

      const [transactionData, warehouseData] = await Promise.all([
        getInventoryTransactions(filters),
        getWarehousesForFilter()
      ]);

      setTransactions(transactionData);
      setWarehouses(warehouseData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialSkuKeyword = params.get("skuKeyword") ?? "";
    const initialWarehouseId = params.get("warehouseId") ?? "";
    const initialFilters: InventoryTransactionFilters = {
      transactionType: "all",
      warehouseId: initialWarehouseId,
      skuKeyword: initialSkuKeyword,
      startDate: "",
      endDate: ""
    };

    if (initialWarehouseId) {
      setWarehouseId(initialWarehouseId);
    }

    if (initialSkuKeyword) {
      setSkuKeyword(initialSkuKeyword);
    }

    loadTransactions(initialFilters);
  }, []);

  const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadTransactions();
  };

  const resetFilters = () => {
    const nextFilters: InventoryTransactionFilters = {
      transactionType: "all",
      warehouseId: "",
      skuKeyword: "",
      startDate: "",
      endDate: ""
    };

    setTransactionType("all");
    setWarehouseId("");
    setSkuKeyword("");
    setStartDate("");
    setEndDate("");
    loadTransactions(nextFilters);
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">仓库管理</p>
          <h2>库存流水</h2>
          <p>
            查看每一笔库存变化，后续如果库存数量对不上，可以从这里追溯来源单据和操作时间。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      {errorMessage ? (
        <div className="debugError">
          <strong>读取失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <section className="transactionSummaryGrid">
        {transactionTypeOptions
          .filter((option) => option.value !== "all")
          .map((option) => (
            <div className="metric" key={option.value}>
              <span>{option.label}笔数</span>
              <strong>{summary[option.value as InventoryTransactionType]}</strong>
            </div>
          ))}
      </section>

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">库存流水</p>
            <h3>流水列表</h3>
          </div>
        </div>

        <form className="listToolbar transactionsToolbar" onSubmit={submitFilters}>
          <label>
            流水类型
            <select
              value={transactionType}
              onChange={(event) =>
                setTransactionType(
                  event.target.value as InventoryTransactionTypeFilter
                )
              }
              disabled={loading}
            >
              {transactionTypeOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

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
            SKU 搜索
            <input
              value={skuKeyword}
              onChange={(event) => setSkuKeyword(event.target.value)}
              placeholder="输入 SKU 编码或名称"
              disabled={loading}
            />
          </label>

          <label>
            开始日期
            <input
              type="date"
              value={startDate}
              onChange={(event) => setStartDate(event.target.value)}
              disabled={loading}
            />
          </label>

          <label>
            结束日期
            <input
              type="date"
              value={endDate}
              onChange={(event) => setEndDate(event.target.value)}
              disabled={loading}
            />
          </label>

          <div className="rowActions">
            <button type="submit" disabled={loading}>
              {loading ? "查询中..." : "查询"}
            </button>
            <button
              type="button"
              onClick={() => loadTransactions()}
              disabled={loading}
            >
              {loading ? "刷新中..." : "刷新"}
            </button>
            <button type="button" onClick={resetFilters} disabled={loading}>
              重置
            </button>
          </div>
        </form>

        {loading ? (
          <div className="debugNotice">正在读取库存流水，请稍候...</div>
        ) : null}

        {!loading && transactions.length === 0 ? (
          <div className="emptyState">暂无库存流水</div>
        ) : null}

        {!loading && transactions.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable transactionTable">
              <thead>
                <tr>
                  <th>流水单号</th>
                  <th>流水类型</th>
                  <th>SKU 编码</th>
                  <th>SKU 名称</th>
                  <th>SKU 类型</th>
                  <th>产品名称</th>
                  <th>仓库</th>
                  <th>数量</th>
                  <th>单位</th>
                  <th>关联单据类型</th>
                  <th>关联单据号</th>
                  <th>操作人</th>
                  <th>操作时间</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>{transaction.transaction_no}</td>
                    <td>
                      <span
                        className={`tablePill transaction-type-${transaction.transaction_type}`}
                      >
                        {transactionTypeLabels[transaction.transaction_type]}
                      </span>
                    </td>
                    <td>{transaction.sku?.sku_code ?? "-"}</td>
                    <td>{transaction.sku?.sku_name ?? "-"}</td>
                    <td>{getSkuTypeLabel(transaction.sku?.sku_type)}</td>
                    <td>{transaction.sku?.product?.name ?? "-"}</td>
                    <td>
                      <strong>{transaction.warehouse?.name ?? "-"}</strong>
                      <span>{transaction.warehouse?.warehouse_code ?? "-"}</span>
                    </td>
                    <td className="quantityCell">
                      {formatSignedQuantity(transaction)}
                    </td>
                    <td>{transaction.sku?.unit ?? "-"}</td>
                    <td>
                      {getRelatedOrderTypeLabel(transaction.related_order_type)}
                    </td>
                    <td>{transaction.related_order_no ?? "-"}</td>
                    <td>
                      <strong>{transaction.operator?.full_name ?? "-"}</strong>
                      {transaction.operator?.email ? (
                        <span>{transaction.operator.email}</span>
                      ) : null}
                    </td>
                    <td>{formatDateTime(transaction.occurred_at)}</td>
                    <td className="notesCell">{transaction.notes ?? "-"}</td>
                    <td>
                      <button
                        className="secondaryButton"
                        type="button"
                        onClick={() => setSelectedTransaction(transaction)}
                      >
                        查看详情
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && transactions.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={transactions.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {selectedTransaction ? (
        <Modal
          open={Boolean(selectedTransaction)}
          eyebrow="库存流水详情"
          title={selectedTransaction.transaction_no}
          onClose={() => setSelectedTransaction(null)}
        >
          <div className="detailGrid">
            <div className="detailItem">
              <span>流水类型</span>
              <strong>
                {transactionTypeLabels[selectedTransaction.transaction_type]}
              </strong>
            </div>
            <div className="detailItem">
              <span>SKU</span>
              <strong>
                {selectedTransaction.sku?.sku_code ?? "-"} /{" "}
                {selectedTransaction.sku?.sku_name ?? "-"}
              </strong>
            </div>
            <div className="detailItem">
              <span>SKU 类型</span>
              <strong>{getSkuTypeLabel(selectedTransaction.sku?.sku_type)}</strong>
            </div>
            <div className="detailItem">
              <span>仓库</span>
              <strong>
                {selectedTransaction.warehouse?.name ?? "-"} /{" "}
                {selectedTransaction.warehouse?.warehouse_code ?? "-"}
              </strong>
            </div>
            <div className="detailItem">
              <span>数量</span>
              <strong>
                {formatSignedQuantity(selectedTransaction)}
                {selectedTransaction.sku?.unit
                  ? ` ${selectedTransaction.sku.unit}`
                  : ""}
              </strong>
            </div>
            <div className="detailItem">
              <span>关联单据</span>
              <strong>
                {getRelatedOrderTypeLabel(selectedTransaction.related_order_type)}
                {" / "}
                {selectedTransaction.related_order_no ?? "-"}
              </strong>
            </div>
            <div className="detailItem">
              <span>操作人</span>
              <strong>
                {selectedTransaction.operator?.full_name ?? "-"}
                {selectedTransaction.operator?.email
                  ? ` / ${selectedTransaction.operator.email}`
                  : ""}
              </strong>
            </div>
            <div className="detailItem">
              <span>操作时间</span>
              <strong>{formatDateTime(selectedTransaction.occurred_at)}</strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>备注</span>
              <strong>{selectedTransaction.notes ?? "-"}</strong>
            </div>
          </div>
        </Modal>
      ) : null}
    </main>
  );
}
