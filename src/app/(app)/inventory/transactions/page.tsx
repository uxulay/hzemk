"use client";

import { useEffect, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { getBrandOptions, type BrandRow } from "@/lib/api/brands";
import { getBrandCodeName } from "@/lib/brand-utils";
import {
  getInventoryTransactionsPage,
  getWarehousesForFilter,
  type InventoryTransactionFilters,
  type InventoryTransactionRelatedOrderType,
  type InventoryTransactionRow,
  type InventoryTransactionSummary,
  type InventoryTransactionType,
  type InventoryTransactionTypeFilter,
  type InventoryTransactionWarehouse
} from "@/lib/api/inventory";
import { DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

const transactionTypeOptions: Array<{
  value: InventoryTransactionTypeFilter;
  label: string;
}> = [
  { value: "all", label: "全部流水类型" },
  { value: "material_in", label: "辅料入库" },
  { value: "material_out", label: "辅料出库" },
  { value: "product_in", label: "成品入库" },
  { value: "product_out", label: "成品出库" },
  { value: "adjustment", label: "库存调整" }
];

const transactionTypeLabels: Record<InventoryTransactionType, string> = {
  material_in: "辅料入库",
  material_out: "辅料出库",
  product_in: "成品入库",
  product_out: "成品出库",
  adjustment: "库存调整"
};

const skuTypeLabels: Record<string, string> = {
  material: "辅料",
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
  fba_replenishment_request: "备货单"
};

const emptySummary: InventoryTransactionSummary = {
  material_in: 0,
  material_out: 0,
  product_in: 0,
  product_out: 0,
  adjustment: 0
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

  if (transaction.transaction_type === "adjustment") {
    const match = transaction.notes?.match(/调整差异：\s*([+-]?\d+(?:\.\d+)?)/);
    const signedQuantity = match?.[1] ? Number(match[1]) : quantity;

    if (signedQuantity > 0) {
      return `+${formatQuantity(signedQuantity)}`;
    }

    if (signedQuantity < 0) {
      return `-${formatQuantity(Math.abs(signedQuantity))}`;
    }

    return formatQuantity(signedQuantity);
  }

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

function getRelatedOrderLabel(transaction: InventoryTransactionRow) {
  const typeLabel = getRelatedOrderTypeLabel(transaction.related_order_type);
  const orderNo = transaction.related_order_no ?? "-";

  if (typeLabel === "-" && orderNo === "-") {
    return "-";
  }

  return `${typeLabel} / ${orderNo}`;
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

function getTransactionUnit(transaction: InventoryTransactionRow) {
  return (
    transaction.material?.unit ??
    transaction.product_sku?.unit ??
    transaction.sku?.unit ??
    ""
  );
}

function isEndDateBeforeStartDate(startDate: string, endDate: string) {
  return Boolean(startDate && endDate && endDate < startDate);
}

function getSignedQuantityClass(transaction: InventoryTransactionRow) {
  if (
    transaction.transaction_type === "material_out" ||
    transaction.transaction_type === "product_out"
  ) {
    return "quantityNegative";
  }

  if (transaction.transaction_type === "adjustment") {
    return "quantityAdjust";
  }

  return "quantityPositive";
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

export default function InventoryTransactionsPage() {
  const [transactions, setTransactions] = useState<InventoryTransactionRow[]>([]);
  const [warehouses, setWarehouses] = useState<InventoryTransactionWarehouse[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [transactionType, setTransactionType] =
    useState<InventoryTransactionTypeFilter>("all");
  const [warehouseId, setWarehouseId] = useState("");
  const [brandId, setBrandId] = useState("all");
  const [skuKeyword, setSkuKeyword] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTransaction, setSelectedTransaction] =
    useState<InventoryTransactionRow | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] =
    useState<InventoryTransactionSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadTransactions = async (
    filters: InventoryTransactionFilters = {
      transactionType,
      warehouseId,
      brandId,
      skuKeyword,
      startDate,
      endDate
    },
    targetPage = 1
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

      const [transactionPage, warehouseData, brandData] = await Promise.all([
        getInventoryTransactionsPage({
          page: targetPage,
          pageSize: DEFAULT_PAGE_SIZE,
          filters
        }),
        getWarehousesForFilter(),
        getBrandOptions()
      ]);

      setTransactions(transactionPage.rows);
      setTotal(transactionPage.total);
      setSummary(transactionPage.summary);
      setPage(transactionPage.page);
      setWarehouses(warehouseData);
      setBrands(brandData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setTransactions([]);
      setTotal(0);
      setSummary(emptySummary);
      setBrands([]);
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
      brandId: "all",
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

    loadTransactions(initialFilters, 1);
  }, []);

  const submitFilters = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    loadTransactions(undefined, 1);
  };

  const resetFilters = () => {
    const nextFilters: InventoryTransactionFilters = {
      transactionType: "all",
      warehouseId: "",
      brandId: "all",
      skuKeyword: "",
      startDate: "",
      endDate: ""
    };

    setTransactionType("all");
    setWarehouseId("");
    setBrandId("all");
    setSkuKeyword("");
    setStartDate("");
    setEndDate("");
    loadTransactions(nextFilters, 1);
  };

  const exportTransactions = () => {
    const headers = [
      "流水编号",
      "类型",
      "物料/产品",
      "数量变化",
      "仓库",
      "关联单据",
      "操作时间",
      "操作人"
    ];
    const rows = transactions.map((transaction) => [
      transaction.transaction_no,
      transactionTypeLabels[transaction.transaction_type],
      `${getTransactionItemCode(transaction)} / ${getTransactionItemName(transaction)}`,
      formatSignedQuantity(transaction),
      transaction.warehouse?.name ?? "",
      getRelatedOrderLabel(transaction),
      formatDateTime(transaction.occurred_at),
      transaction.operator?.full_name ?? ""
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
    link.download = `库存流水_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const transactionColumns: DataTableColumn<InventoryTransactionRow>[] = [
    {
      key: "transaction_no",
      title: "流水编号",
      width: 150,
      render: (transaction) => transaction.transaction_no
    },
    {
      key: "type",
      title: "类型",
      width: 110,
      render: (transaction) => (
        <StatusBadge
          status={transaction.transaction_type}
          label={transactionTypeLabels[transaction.transaction_type]}
        />
      )
    },
    {
      key: "item",
      title: "物料/产品信息",
      width: 250,
      render: (transaction) => (
        <InfoCell
          title={getTransactionItemName(transaction)}
          subtitle={`${getTransactionItemCode(transaction)} / ${
            transaction.material?.specs ??
            transaction.product_sku?.product?.name ??
            transaction.sku?.product?.name ??
            "-"
          }`}
        />
      )
    },
    {
      key: "quantity",
      title: "数量变化",
      width: 110,
      align: "right",
      render: (transaction) => (
        <span className={getSignedQuantityClass(transaction)}>
          {formatSignedQuantity(transaction)}
        </span>
      )
    },
    {
      key: "warehouse",
      title: "仓库",
      width: 160,
      render: (transaction) => (
        <InfoCell
          title={transaction.warehouse?.name ?? "-"}
          subtitle={transaction.warehouse?.warehouse_code ?? "-"}
        />
      )
    },
    {
      key: "related",
      title: "关联单据",
      width: 170,
      render: (transaction) => (
        <button
          className="linkButton"
          type="button"
          onClick={() => setSelectedTransaction(transaction)}
        >
          {getRelatedOrderLabel(transaction)}
        </button>
      )
    },
    {
      key: "time",
      title: "操作时间",
      width: 150,
      render: (transaction) => formatDateTime(transaction.occurred_at)
    },
    {
      key: "operator",
      title: "操作人",
      width: 110,
      render: (transaction) => transaction.operator?.full_name ?? "-"
    }
  ];

  return (
    <main className="pageShell">
      <PageHeader
        title="库存流水"
        secondaryActions={
          <button
            type="button"
            onClick={exportTransactions}
            disabled={loading || transactions.length === 0}
          >
            导出
          </button>
        }
      />

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

        <form onSubmit={submitFilters}>
          <SearchFilterBar
            searchLabel="搜索"
            searchValue={skuKeyword}
            searchPlaceholder="流水号 / 物料 / 产品 / 关联单据"
            onSearchChange={setSkuKeyword}
            onReset={resetFilters}
            filters={
              <>
                <label>
                  类型
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
              </>
            }
            dateFilters={
              <>
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
              </>
            }
            rightActions={
              <>
                <button type="submit" disabled={loading}>
                  {loading ? "查询中..." : "查询"}
                </button>
                <button
                  type="button"
                  onClick={() => loadTransactions(undefined, page)}
                  disabled={loading}
                >
                  {loading ? "刷新中..." : "刷新"}
                </button>
              </>
            }
          />
        </form>

        <DataTable
          columns={transactionColumns}
          rows={transactions}
          getRowKey={(transaction) => transaction.id}
          loading={loading}
          loadingText="正在读取库存流水，请稍候..."
          emptyText="暂无库存流水"
          minWidth={1080}
          page={page}
          pageSize={DEFAULT_PAGE_SIZE}
          total={total}
          onPageChange={(nextPage) =>
            loadTransactions(
              {
                transactionType,
                warehouseId,
                brandId,
                skuKeyword,
                startDate,
                endDate
              },
              nextPage
            )
          }
        />
      </section>

      {selectedTransaction ? (
        <DetailDrawer
          open={Boolean(selectedTransaction)}
          title={selectedTransaction.transaction_no}
          width="lg"
          onClose={() => setSelectedTransaction(null)}
          footer={
            <button type="button" onClick={() => setSelectedTransaction(null)}>
              关闭
            </button>
          }
        >
          <div className="detailGrid">
            <div className="detailItem">
              <span>流水单号</span>
              <strong>{selectedTransaction.transaction_no}</strong>
            </div>
            <div className="detailItem">
              <span>流水类型</span>
              <strong>
                {transactionTypeLabels[selectedTransaction.transaction_type]}
              </strong>
            </div>
            <div className="detailItem">
              <span>物品</span>
              <strong>
                {getTransactionItemCode(selectedTransaction)} /{" "}
                {getTransactionItemName(selectedTransaction)}
              </strong>
            </div>
            <div className="detailItem">
              <span>{selectedTransaction.material ? "规格" : "产品名称"}</span>
              <strong>
                {selectedTransaction.material?.specs ??
                  selectedTransaction.product_sku?.product?.name ??
                  selectedTransaction.sku?.product?.name ??
                  "-"}
              </strong>
            </div>
            <div className="detailItem">
              <span>物品类型</span>
              <strong>
                {selectedTransaction.material
                  ? "辅料"
                  : getSkuTypeLabel(
                      selectedTransaction.product_sku?.sku_type ??
                        selectedTransaction.sku?.sku_type
                    )}
              </strong>
            </div>
            <div className="detailItem">
              <span>品牌</span>
              <strong>
                {selectedTransaction.material
                  ? "-"
                  : getBrandCodeName(
                      selectedTransaction.product_sku?.product?.brand ??
                        selectedTransaction.sku?.product?.brand
                    )}
              </strong>
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
                {getTransactionUnit(selectedTransaction)
                  ? ` ${getTransactionUnit(selectedTransaction)}`
                  : ""}
              </strong>
            </div>
            <div className="detailItem">
              <span>单位</span>
              <strong>{getTransactionUnit(selectedTransaction) || "-"}</strong>
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
        </DetailDrawer>
      ) : null}
    </main>
  );
}
