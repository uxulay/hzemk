"use client";

import { useEffect, useMemo, useState } from "react";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Modal } from "@/components/Modal";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowActions } from "@/components/ui/row-actions";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { searchWarehouseOptions, type WarehouseRow as Warehouse } from "@/lib/api/warehouses";
import {
  bulkCreateOtherInbound,
  createOtherInbound,
  getReceivableProductionOrders,
  getReceivablePurchaseOrders,
  getSkuOptionsForInventory,
  otherInboundImportFields,
  receiveProductionOrder,
  receivePurchaseOrderItems,
  validateOtherInboundImportRows,
  type InventorySkuOption,
  type OtherInventoryMovementValidationRow,
  type ReceivableProductionOrder,
  type ReceivablePurchaseOrder
} from "@/lib/api/inventory";

type InboundTab = "purchase" | "production" | "other";

const productionStatusLabels: Record<string, string> = {
  planned: "已计划",
  material_pending: "待物料",
  in_progress: "生产中",
  completed: "已完成",
  cancelled: "已取消"
};

const purchaseStatusLabels: Record<string, string> = {
  ordered: "已下单",
  partially_received: "部分到货",
  received: "已到货"
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

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

function escapeCsvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");

  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, "\"\"")}"`;
  }

  return text;
}

function getRemainingPurchaseQuantity(
  orderedQuantity: number,
  receivedQuantity: number
) {
  return Math.max(0, Number(orderedQuantity) - Number(receivedQuantity));
}

function getDefaultWarehouseId(warehouses: Warehouse[], warehouseType: string) {
  return (
    warehouses.find((warehouse) => warehouse.warehouse_type === warehouseType)
      ?.id ??
    warehouses[0]?.id ??
    ""
  );
}

export default function InventoryInboundPage() {
  const [activeTab, setActiveTab] = useState<InboundTab>("purchase");
  const [purchaseOrders, setPurchaseOrders] = useState<ReceivablePurchaseOrder[]>(
    []
  );
  const [productionOrders, setProductionOrders] = useState<
    ReceivableProductionOrder[]
  >([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [skuOptions, setSkuOptions] = useState<InventorySkuOption[]>([]);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [selectedProductionOrderId, setSelectedProductionOrderId] = useState("");
  const [inboundKeyword, setInboundKeyword] = useState("");
  const [inboundStatus, setInboundStatus] = useState("all");
  const [inboundWarehouseFilter, setInboundWarehouseFilter] = useState("");
  const [inboundDate, setInboundDate] = useState("");
  const [purchaseWarehouseId, setPurchaseWarehouseId] = useState("");
  const [productionWarehouseId, setProductionWarehouseId] = useState("");
  const [otherInboundOpen, setOtherInboundOpen] = useState(false);
  const [otherImportOpen, setOtherImportOpen] = useState(false);
  const [otherWarehouseId, setOtherWarehouseId] = useState("");
  const [otherSkuId, setOtherSkuId] = useState("");
  const [otherSkuKeyword, setOtherSkuKeyword] = useState("");
  const [otherQuantity, setOtherQuantity] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [otherNotes, setOtherNotes] = useState("");
  const [purchaseQuantities, setPurchaseQuantities] = useState<
    Record<string, string>
  >({});
  const [productionQuantity, setProductionQuantity] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedPurchaseOrder = useMemo(
    () =>
      purchaseOrders.find((order) => order.id === selectedPurchaseOrderId) ??
      null,
    [purchaseOrders, selectedPurchaseOrderId]
  );

  const selectedProductionOrder = useMemo(
    () =>
      productionOrders.find((order) => order.id === selectedProductionOrderId) ??
      null,
    [productionOrders, selectedProductionOrderId]
  );

  const materialWarehouses = useMemo(
    () =>
      warehouses.filter(
        (warehouse) =>
          warehouse.status === "active" && warehouse.warehouse_type === "material"
      ),
    [warehouses]
  );

  const productWarehouses = useMemo(
    () =>
      warehouses.filter(
        (warehouse) =>
          warehouse.status === "active" &&
          warehouse.warehouse_type === "finished_product"
      ),
    [warehouses]
  );

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.status === "active"),
    [warehouses]
  );

  const filteredSkuOptions = useMemo(() => {
    const keyword = otherSkuKeyword.trim().toLowerCase();

    if (!keyword) {
      return skuOptions;
    }

    return skuOptions.filter((sku) =>
      [sku.sku_code, sku.sku_name, sku.product?.name]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword))
    );
  }, [otherSkuKeyword, skuOptions]);

  const selectedOtherSku = useMemo(
    () => skuOptions.find((sku) => sku.id === otherSkuId) ?? null,
    [otherSkuId, skuOptions]
  );

  const filteredPurchaseOrders = useMemo(() => {
    const keyword = inboundKeyword.trim().toLowerCase();

    return purchaseOrders.filter((order) => {
      const remainingTotal = order.items.reduce(
        (sum, item) =>
          sum +
          getRemainingPurchaseQuantity(
            item.ordered_quantity,
            item.received_quantity
          ),
        0
      );
      const matchesKeyword =
        !keyword ||
        [
          order.purchase_order_no,
          order.supplier?.name ?? "",
          order.supplier?.supplier_code ?? ""
        ]
          .join(" / ")
          .toLowerCase()
          .includes(keyword);
      const matchesStatus = inboundStatus === "all" || order.status === inboundStatus;
      const matchesWarehouse =
        !inboundWarehouseFilter || purchaseWarehouseId === inboundWarehouseFilter;
      const matchesDate =
        !inboundDate ||
        order.received_at?.slice(0, 10) === inboundDate ||
        order.expected_arrival_date === inboundDate;

      return matchesKeyword && matchesStatus && matchesWarehouse && matchesDate && remainingTotal > 0;
    });
  }, [
    inboundDate,
    inboundKeyword,
    inboundStatus,
    inboundWarehouseFilter,
    purchaseOrders,
    purchaseWarehouseId
  ]);

  const filteredProductionOrders = useMemo(() => {
    const keyword = inboundKeyword.trim().toLowerCase();

    return productionOrders.filter((order) => {
      const pendingQuantity = Math.max(
        0,
        Number(order.planned_quantity) - Number(order.completed_quantity)
      );
      const matchesKeyword =
        !keyword ||
        [
          order.production_order_no,
          order.sku?.sku_code ?? "",
          order.sku?.sku_name ?? "",
          order.sku?.product?.name ?? ""
        ]
          .join(" / ")
          .toLowerCase()
          .includes(keyword);
      const matchesStatus = inboundStatus === "all" || order.status === inboundStatus;
      const matchesWarehouse =
        !inboundWarehouseFilter || productionWarehouseId === inboundWarehouseFilter;
      const matchesDate =
        !inboundDate ||
        order.planned_start_date === inboundDate ||
        order.planned_end_date === inboundDate;

      return matchesKeyword && matchesStatus && matchesWarehouse && matchesDate && pendingQuantity > 0;
    });
  }, [
    inboundDate,
    inboundKeyword,
    inboundStatus,
    inboundWarehouseFilter,
    productionOrders,
    productionWarehouseId
  ]);

  const purchaseInboundTotal = Object.values(purchaseQuantities).reduce(
    (sum, value) => sum + (Number(value) || 0),
    0
  );

  const fbaRequestedQuantity =
    selectedProductionOrder?.replenishment_request?.requested_quantity ?? 0;
  const plannedQuantity = selectedProductionOrder?.planned_quantity ?? 0;
  const completedQuantity = selectedProductionOrder?.completed_quantity ?? 0;
  const overProductionQuantity = Math.max(
    0,
    Number(plannedQuantity) - Number(fbaRequestedQuantity)
  );
  const pendingProductionQuantity = Math.max(
    0,
    Number(plannedQuantity) - Number(completedQuantity)
  );
  const projectedCompletedQuantity =
    Number(completedQuantity) + (Number(productionQuantity) || 0);
  const projectedExtraStock = Math.max(
    0,
    projectedCompletedQuantity - Number(fbaRequestedQuantity)
  );

  const loadPageData = async (preferredOtherWarehouseId = "") => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [purchaseData, productionData, warehouseData, skuData] =
        await Promise.all([
        getReceivablePurchaseOrders(),
        getReceivableProductionOrders(),
        searchWarehouseOptions("", 20),
        getSkuOptionsForInventory()
      ]);

      setPurchaseOrders(purchaseData);
      setProductionOrders(productionData);
      setWarehouses(warehouseData);
      setSkuOptions(skuData.filter((sku) => sku.status === "active"));

      setSelectedPurchaseOrderId((current) =>
        purchaseData.some((order) => order.id === current)
          ? current
          : ""
      );
      setSelectedProductionOrderId((current) =>
        productionData.some((order) => order.id === current)
          ? current
          : ""
      );
      setPurchaseWarehouseId((current) =>
        current || getDefaultWarehouseId(warehouseData, "material")
      );
      setProductionWarehouseId((current) =>
        current || getDefaultWarehouseId(warehouseData, "finished_product")
      );
      setOtherWarehouseId((current) =>
        current ||
        preferredOtherWarehouseId ||
        getDefaultWarehouseId(warehouseData, "finished_product")
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setPurchaseOrders([]);
      setProductionOrders([]);
      setWarehouses([]);
      setSkuOptions([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab");
    const initialWarehouseId = params.get("warehouseId") ?? "";
    const initialSkuKeyword = params.get("skuKeyword") ?? "";

    if (initialTab === "other") {
      setActiveTab("other");
      setOtherInboundOpen(true);
    } else if (initialTab === "production") {
      setActiveTab("production");
    } else if (initialTab === "purchase") {
      setActiveTab("purchase");
    }

    if (initialWarehouseId) {
      setOtherWarehouseId(initialWarehouseId);
    }

    if (initialSkuKeyword) {
      setOtherSkuKeyword(initialSkuKeyword);
    }

    loadPageData(initialWarehouseId);
  }, []);

  useEffect(() => {
    const keyword = otherSkuKeyword.trim().toLowerCase();

    if (!keyword || otherSkuId) {
      return;
    }

    const matchedSku = filteredSkuOptions.find(
      (sku) =>
        sku.sku_code.toLowerCase() === keyword ||
        sku.sku_name.toLowerCase() === keyword
    ) ?? filteredSkuOptions[0];

    if (matchedSku) {
      setOtherSkuId(matchedSku.id);
    }
  }, [filteredSkuOptions, otherSkuId, otherSkuKeyword]);

  useEffect(() => {
    const timeoutId = window.setTimeout(async () => {
      try {
        const skuData = await getSkuOptionsForInventory(otherSkuKeyword, 20);
        setSkuOptions(skuData.filter((sku) => sku.status === "active"));
      } catch (error) {
        setErrorMessage(getErrorMessage(error));
      }
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [otherSkuKeyword]);

  useEffect(() => {
    if (!selectedPurchaseOrder) {
      setPurchaseQuantities({});
      return;
    }

    const nextQuantities: Record<string, string> = {};

    for (const item of selectedPurchaseOrder.items) {
      const remaining = getRemainingPurchaseQuantity(
        item.ordered_quantity,
        item.received_quantity
      );

      nextQuantities[item.id] = remaining > 0 ? String(remaining) : "";
    }

    setPurchaseQuantities(nextQuantities);
  }, [selectedPurchaseOrder]);

  useEffect(() => {
    if (!selectedProductionOrder) {
      setProductionQuantity("");
      return;
    }

    setProductionQuantity(
      pendingProductionQuantity > 0 ? String(pendingProductionQuantity) : ""
    );
  }, [selectedProductionOrder, pendingProductionQuantity]);

  const submitPurchaseInbound = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedPurchaseOrder) {
      setErrorMessage("请选择采购单。");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      await receivePurchaseOrderItems({
        purchaseOrderId: selectedPurchaseOrder.id,
        warehouseId: purchaseWarehouseId,
        items: selectedPurchaseOrder.items.map((item) => ({
          purchaseOrderItemId: item.id,
          receiveQuantity: Number(purchaseQuantities[item.id] || 0)
        }))
      });

      setSuccessMessage(`采购单 ${selectedPurchaseOrder.purchase_order_no} 入库成功。`);
      setSelectedPurchaseOrderId("");
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const submitProductionInbound = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedProductionOrder) {
      setErrorMessage("请选择生产任务。");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      await receiveProductionOrder({
        productionOrderId: selectedProductionOrder.id,
        warehouseId: productionWarehouseId,
        receiveQuantity: Number(productionQuantity)
      });

      setSuccessMessage(
        `生产任务 ${selectedProductionOrder.production_order_no} 成品入库成功。`
      );
      setSelectedProductionOrderId("");
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const openPurchaseInbound = (order: ReceivablePurchaseOrder) => {
    setActiveTab("purchase");
    setSelectedPurchaseOrderId(order.id);
    setPurchaseWarehouseId(
      purchaseWarehouseId || getDefaultWarehouseId(warehouses, "material")
    );
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openProductionInbound = (order: ReceivableProductionOrder) => {
    setActiveTab("production");
    setSelectedProductionOrderId(order.id);
    setProductionWarehouseId(
      productionWarehouseId ||
        getDefaultWarehouseId(warehouses, "finished_product")
    );
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openOtherInbound = () => {
    setActiveTab("other");
    setOtherInboundOpen(true);
    setOtherWarehouseId(
      otherWarehouseId || getDefaultWarehouseId(warehouses, "finished_product")
    );
    setOtherSkuId("");
    setOtherSkuKeyword("");
    setOtherQuantity("");
    setOtherReason("");
    setOtherNotes("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openOtherInboundImport = () => {
    setActiveTab("other");
    setOtherInboundOpen(false);
    setOtherImportOpen(true);
  };

  const submitOtherInbound = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      await createOtherInbound({
        warehouseId: otherWarehouseId,
        skuId: otherSkuId,
        quantity: Number(otherQuantity),
        reason: otherReason,
        notes: otherNotes
      });

      setSuccessMessage(
        `${selectedOtherSku?.sku_code ?? "该 SKU"} 其他入库成功，库存已增加。`
      );
      setOtherInboundOpen(false);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const importOtherInboundRows = async (
    rows: OtherInventoryMovementValidationRow[]
  ) => {
    const result = await bulkCreateOtherInbound(
      rows.flatMap((row) => (row.data ? [row.data] : []))
    );

    setSuccessMessage(
      `批量其他入库完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  const resetInboundFilters = () => {
    setInboundKeyword("");
    setInboundStatus("all");
    setInboundWarehouseFilter("");
    setInboundDate("");
  };

  const exportInboundRows = () => {
    const rows =
      activeTab === "purchase"
        ? filteredPurchaseOrders.map((order) => [
            `IN-${order.purchase_order_no.replace(/^PUR-?/, "")}`,
            order.purchase_order_no,
            order.supplier?.name ?? "",
            order.items.reduce(
              (sum, item) =>
                sum +
                getRemainingPurchaseQuantity(
                  item.ordered_quantity,
                  item.received_quantity
                ),
              0
            ),
            purchaseStatusLabels[order.status] ?? order.status,
            formatDate(order.expected_arrival_date)
          ])
        : filteredProductionOrders.map((order) => [
            `IN-${order.production_order_no.replace(/^PROD-?/, "")}`,
            order.production_order_no,
            order.sku?.sku_code ?? "",
            Math.max(0, Number(order.planned_quantity) - Number(order.completed_quantity)),
            productionStatusLabels[order.status] ?? order.status,
            formatDate(order.planned_end_date)
          ]);
    const headers =
      activeTab === "purchase"
        ? ["入库单号", "采购单号", "供应商", "待入库数量", "状态", "交期"]
        : ["入库单号", "生产任务", "成品 SKU", "待入库数量", "状态", "计划完成"];
    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsvCell).join(","))
      .join("\n");
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8"
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `入库列表_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const purchaseInboundColumns: DataTableColumn<ReceivablePurchaseOrder>[] = [
    {
      key: "no",
      title: "入库单号",
      width: 150,
      render: (order) => `IN-${order.purchase_order_no.replace(/^PUR-?/, "")}`
    },
    {
      key: "purchase",
      title: "关联采购单",
      width: 160,
      render: (order) => order.purchase_order_no
    },
    {
      key: "supplier",
      title: "供应商",
      width: 180,
      render: (order) => (
        <InfoCell
          title={order.supplier?.name ?? "-"}
          subtitle={order.supplier?.supplier_code ?? "-"}
        />
      )
    },
    {
      key: "quantity",
      title: "入库数量",
      width: 120,
      align: "right",
      render: (order) =>
        formatQuantity(
          order.items.reduce(
            (sum, item) =>
              sum +
              getRemainingPurchaseQuantity(
                item.ordered_quantity,
                item.received_quantity
              ),
            0
          )
        )
    },
    {
      key: "warehouse",
      title: "入库仓库",
      width: 160,
      render: () =>
        materialWarehouses.find((warehouse) => warehouse.id === purchaseWarehouseId)
          ?.name ?? "待选择"
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
      key: "time",
      title: "入库时间",
      width: 120,
      render: (order) => formatDate(order.received_at ?? order.expected_arrival_date)
    },
    {
      key: "actions",
      title: "操作",
      width: 120,
      render: (order) => (
        <RowActions
          viewLabel="办理"
          onView={() => openPurchaseInbound(order)}
        />
      )
    }
  ];

  return (
    <main className="pageShell">
      <PageHeader
        title={activeTab === "purchase" ? "采购入库" : activeTab === "production" ? "生产入库" : "入库管理"}
        secondaryActions={
          <button type="button" onClick={exportInboundRows} disabled={loading}>
            导出
          </button>
        }
        primaryAction={
          <button
            className="primaryButton"
            type="button"
            onClick={activeTab === "other" ? openOtherInbound : () => loadPageData()}
            disabled={submitting}
          >
            新增入库
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
        <div className="tabBar" role="tablist" aria-label="入库类型">
          <button
            className={activeTab === "purchase" ? "tabButton active" : "tabButton"}
            type="button"
            onClick={() => setActiveTab("purchase")}
          >
            采购入库
          </button>
          <button
            className={
              activeTab === "production" ? "tabButton active" : "tabButton"
            }
            type="button"
            onClick={() => setActiveTab("production")}
          >
            生产入库
          </button>
          <button
            className={activeTab === "other" ? "tabButton active" : "tabButton"}
            type="button"
            onClick={openOtherInbound}
          >
            其他入库
          </button>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取可入库单据...</div>
        ) : null}

        <SearchFilterBar
          searchLabel="搜索"
          searchValue={inboundKeyword}
          searchPlaceholder="入库单号 / 采购单号 / 供应商"
          onSearchChange={setInboundKeyword}
          onReset={resetInboundFilters}
          filters={
            <>
              <label>
                状态
                <select
                  value={inboundStatus}
                  onChange={(event) => setInboundStatus(event.target.value)}
                  disabled={loading}
                >
                  <option value="all">全部状态</option>
                  {activeTab === "purchase" ? (
                    <>
                      <option value="ordered">已下单</option>
                      <option value="partially_received">部分到货</option>
                      <option value="received">已到货</option>
                    </>
                  ) : (
                    <>
                      <option value="planned">已计划</option>
                      <option value="in_progress">生产中</option>
                      <option value="completed">已完成</option>
                    </>
                  )}
                </select>
              </label>
              <label>
                仓库
                <select
                  value={inboundWarehouseFilter}
                  onChange={(event) => setInboundWarehouseFilter(event.target.value)}
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
            <label>
              入库日期
              <input
                type="date"
                value={inboundDate}
                onChange={(event) => setInboundDate(event.target.value)}
                disabled={loading}
              />
            </label>
          }
        />

        {!loading && activeTab === "purchase" ? (
          <>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">采购到货</p>
                <h3>待入库采购单</h3>
              </div>
              <div className="rowActions">
                <button type="button" onClick={() => loadPageData()} disabled={loading}>
                  刷新
                </button>
              </div>
            </div>

            <DataTable
              columns={purchaseInboundColumns}
              rows={filteredPurchaseOrders}
              getRowKey={(order) => order.id}
              emptyText="暂无可入库采购单"
              minWidth={980}
            />
          </>
        ) : null}

        {!loading && activeTab === "production" ? (
          <>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">生产完成</p>
                <h3>待入库生产任务</h3>
              </div>
              <div className="rowActions">
                <button type="button" onClick={() => loadPageData()} disabled={loading}>
                  刷新
                </button>
              </div>
            </div>

            {productionOrders.length === 0 ? (
              <div className="emptyState">暂无可入库生产任务</div>
            ) : (
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>生产任务单号</th>
                      <th>成品 SKU</th>
                      <th>产品名称</th>
                      <th>生产状态</th>
                      <th>计划生产数量</th>
                      <th>已入库数量</th>
                      <th>待入库数量</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionOrders.map((order) => {
                      const pendingQuantity = Math.max(
                        0,
                        Number(order.planned_quantity) -
                          Number(order.completed_quantity)
                      );

                      return (
                        <tr key={order.id}>
                          <td>{order.production_order_no}</td>
                          <td>
                            <strong>{order.sku?.sku_code ?? "-"}</strong>
                            <span>{order.sku?.sku_name ?? "-"}</span>
                          </td>
                          <td>{order.sku?.product?.name ?? "-"}</td>
                          <td>
                            <span className={`tablePill production-status-${order.status}`}>
                              {productionStatusLabels[order.status] ?? order.status}
                            </span>
                          </td>
                          <td>{formatQuantity(order.planned_quantity)}</td>
                          <td>{formatQuantity(order.completed_quantity)}</td>
                          <td>{formatQuantity(pendingQuantity)}</td>
                          <td>
                            <div className="rowActions">
                              <button
                                type="button"
                                onClick={() => openProductionInbound(order)}
                                disabled={submitting || pendingQuantity <= 0}
                              >
                                办理入库
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}

        {!loading && activeTab === "other" ? (
          <>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">非采购 / 非生产</p>
                <h3>其他入库单</h3>
              </div>
              <div className="rowActions">
                <button
                  className="primaryButton"
                  type="button"
                  onClick={openOtherInbound}
                  disabled={submitting}
                >
                  新建其他入库单
                </button>
                <button
                  type="button"
                  onClick={openOtherInboundImport}
                  disabled={submitting}
                >
                  批量上传
                </button>
                <button type="button" onClick={() => loadPageData()} disabled={loading}>
                  刷新
                </button>
              </div>
            </div>

            <div className="detailGrid">
              <div className="detailItem">
                <span>适用场景</span>
                <strong>初始库存、盘点补录、退货入库</strong>
              </div>
              <div className="detailItem">
                <span>支持 SKU</span>
                <strong>成品 SKU 和辅料 SKU</strong>
              </div>
              <div className="detailItem">
                <span>库存流水</span>
                <strong>自动写入 material_in / product_in</strong>
              </div>
            </div>
          </>
        ) : null}
      </section>

      {selectedPurchaseOrder ? (
        <Modal
          open={Boolean(selectedPurchaseOrder)}
          eyebrow="采购入库"
          title={selectedPurchaseOrder.purchase_order_no}
          maxWidth="xl"
          onClose={() => {
            if (!submitting) {
              setSelectedPurchaseOrderId("");
            }
          }}
        >
          <form onSubmit={submitPurchaseInbound}>
            <div className="dataForm inboundForm">
              <label>
                入库仓库
                <select
                  value={purchaseWarehouseId}
                  onChange={(event) => setPurchaseWarehouseId(event.target.value)}
                  disabled={submitting}
                  required
                >
                  <option value="">请选择仓库</option>
                  {(materialWarehouses.length > 0 ? materialWarehouses : warehouses).map(
                    (warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.warehouse_code} / {warehouse.name}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <div className="detailGrid">
              <div className="detailItem">
                <span>采购单状态</span>
                <strong>
                  {purchaseStatusLabels[selectedPurchaseOrder.status] ??
                    selectedPurchaseOrder.status}
                </strong>
              </div>
              <div className="detailItem">
                <span>供应商</span>
                <strong>{selectedPurchaseOrder.supplier?.name ?? "-"}</strong>
              </div>
              <div className="detailItem">
                <span>预计到货日期</span>
                <strong>
                  {formatDate(selectedPurchaseOrder.expected_arrival_date)}
                </strong>
              </div>
            </div>

            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>辅料编码</th>
                    <th>辅料名称</th>
                    <th>采购数量</th>
                    <th>已入库数量</th>
                    <th>待入库数量</th>
                    <th>本次入库数量</th>
                    <th>单位</th>
                    <th>关联物料需求</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchaseOrder.items.map((item) => {
                    const remaining = getRemainingPurchaseQuantity(
                      item.ordered_quantity,
                      item.received_quantity
                    );

                    return (
                      <tr key={item.id}>
                        <td>{item.sku?.sku_code ?? "-"}</td>
                        <td>{item.sku?.sku_name ?? "-"}</td>
                        <td>{formatQuantity(item.ordered_quantity)}</td>
                        <td>{formatQuantity(item.received_quantity)}</td>
                        <td>{formatQuantity(remaining)}</td>
                        <td>
                          <input
                            className="tableInput"
                            disabled={submitting || remaining <= 0}
                            max={remaining}
                            min="0"
                            step="0.0001"
                            type="number"
                            value={purchaseQuantities[item.id] ?? ""}
                            onChange={(event) =>
                              setPurchaseQuantities((current) => ({
                                ...current,
                                [item.id]: event.target.value
                              }))
                            }
                          />
                        </td>
                        <td>{item.unit}</td>
                        <td>{item.material_requirement_id ?? "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modalFooter">
              <span>本次合计入库：{formatQuantity(purchaseInboundTotal)}</span>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => setSelectedPurchaseOrderId("")}
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={
                    submitting ||
                    !purchaseWarehouseId ||
                    purchaseInboundTotal <= 0
                  }
                >
                  {submitting ? "正在入库..." : "确认采购入库"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}

      {selectedProductionOrder ? (
        <Modal
          open={Boolean(selectedProductionOrder)}
          eyebrow="生产入库"
          title={selectedProductionOrder.production_order_no}
          maxWidth="xl"
          onClose={() => {
            if (!submitting) {
              setSelectedProductionOrderId("");
            }
          }}
        >
          <form onSubmit={submitProductionInbound}>
            <div className="dataForm inboundForm">
              <label>
                入库仓库
                <select
                  value={productionWarehouseId}
                  onChange={(event) => setProductionWarehouseId(event.target.value)}
                  disabled={submitting}
                  required
                >
                  <option value="">请选择仓库</option>
                  {(productWarehouses.length > 0 ? productWarehouses : warehouses).map(
                    (warehouse) => (
                      <option key={warehouse.id} value={warehouse.id}>
                        {warehouse.warehouse_code} / {warehouse.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                本次成品入库数量
                <input
                  min="0.0001"
                  step="0.0001"
                  type="number"
                  value={productionQuantity}
                  onChange={(event) => setProductionQuantity(event.target.value)}
                  disabled={submitting}
                  required
                />
              </label>
            </div>

            <div className="detailGrid">
              <div className="detailItem">
                <span>成品 SKU</span>
                <strong>{selectedProductionOrder.sku?.sku_code ?? "-"}</strong>
              </div>
              <div className="detailItem">
                <span>产品名称</span>
                <strong>
                  {selectedProductionOrder.sku?.product?.name ??
                    selectedProductionOrder.sku?.sku_name ??
                    "-"}
                </strong>
              </div>
              <div className="detailItem">
                <span>关联备货需求</span>
                <strong>
                  {selectedProductionOrder.replenishment_request?.request_no ?? "-"}
                </strong>
              </div>
              <div className="detailItem">
                <span>备货需求数量</span>
                <strong>{formatQuantity(fbaRequestedQuantity)}</strong>
              </div>
              <div className="detailItem">
                <span>计划生产数量</span>
                <strong>{formatQuantity(plannedQuantity)}</strong>
              </div>
              <div className="detailItem">
                <span>已入库数量</span>
                <strong>{formatQuantity(completedQuantity)}</strong>
              </div>
              <div className="detailItem">
                <span>待入库数量</span>
                <strong>{formatQuantity(pendingProductionQuantity)}</strong>
              </div>
              <div className="detailItem">
                <span>超量生产数量</span>
                <strong>{formatQuantity(overProductionQuantity)}</strong>
              </div>
              <div className="detailItem">
                <span>生产状态</span>
                <strong>
                  {productionStatusLabels[selectedProductionOrder.status] ??
                    selectedProductionOrder.status}
                </strong>
              </div>
            </div>

            {Number(productionQuantity) > 0 ? (
              <div className="debugNotice">
                本次入库后，预计累计成品入库{" "}
                {formatQuantity(projectedCompletedQuantity)} 件；其中超过 FBA
                备货需求的 {formatQuantity(projectedExtraStock)} 件会留在成品库存。
              </div>
            ) : null}

            <div className="modalFooter">
              <span>请确认成品数量和入库仓库。</span>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => setSelectedProductionOrderId("")}
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={
                    submitting ||
                    !productionWarehouseId ||
                    Number(productionQuantity) <= 0
                  }
                >
                  {submitting ? "正在入库..." : "确认成品入库"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}

      {otherInboundOpen ? (
        <Modal
          open={otherInboundOpen}
          eyebrow="其他入库"
          title="新建其他入库单"
          maxWidth="xl"
          onClose={() => {
            if (!submitting) {
              setOtherInboundOpen(false);
            }
          }}
        >
          <form className="dataForm inboundForm" onSubmit={submitOtherInbound}>
            <label>
              入库仓库
              <select
                value={otherWarehouseId}
                onChange={(event) => setOtherWarehouseId(event.target.value)}
                disabled={submitting}
                required
              >
                <option value="">请选择仓库</option>
                {(activeWarehouses.length > 0 ? activeWarehouses : warehouses).map(
                  (warehouse) => (
                    <option key={warehouse.id} value={warehouse.id}>
                      {warehouse.warehouse_code} / {warehouse.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label>
              搜索 SKU
              <input
                value={otherSkuKeyword}
                onChange={(event) => {
                  setOtherSkuKeyword(event.target.value);
                  setOtherSkuId("");
                }}
                placeholder="输入 SKU 编码 / SKU 名称"
                disabled={submitting}
              />
            </label>

            <label>
              SKU
              <select
                value={otherSkuId}
                onChange={(event) => setOtherSkuId(event.target.value)}
                disabled={submitting}
                required
              >
                <option value="">请选择 SKU</option>
                {filteredSkuOptions.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {sku.sku_code} / {sku.sku_name} / {sku.unit}
                  </option>
                ))}
              </select>
            </label>

            <label>
              入库数量
              <input
                min="0.0001"
                step="0.0001"
                type="number"
                value={otherQuantity}
                onChange={(event) => setOtherQuantity(event.target.value)}
                disabled={submitting}
                required
              />
            </label>

            <label>
              入库原因
              <input
                value={otherReason}
                onChange={(event) => setOtherReason(event.target.value)}
                placeholder="例如初始库存导入、盘点补录、退货入库"
                disabled={submitting}
                required
              />
            </label>

            <label className="fullField">
              备注
              <textarea
                value={otherNotes}
                onChange={(event) => setOtherNotes(event.target.value)}
                placeholder="可填写来源说明或盘点说明"
                disabled={submitting}
              />
            </label>

            <div className="fullField adjustmentPreviewBox">
              <span>批量上传</span>
              <strong>适合期初库存、盘点补录、退货入库等多 SKU 场景</strong>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={openOtherInboundImport}
                  disabled={submitting}
                >
                  打开批量上传
                </button>
              </div>
            </div>

            <div className="modalFooter fullField">
              <span>提交后会增加库存，并写入库存流水。</span>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => setOtherInboundOpen(false)}
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={
                    submitting ||
                    !otherWarehouseId ||
                    !otherSkuId ||
                    Number(otherQuantity) <= 0 ||
                    !otherReason.trim()
                  }
                >
                  {submitting ? "正在入库..." : "确认其他入库"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}

      <BulkImportDialog
        open={otherImportOpen}
        title="批量导入初始库存 / 其他入库"
        description="上传后先预览和校验，不会直接写入数据库。确认导入后会一次性批量增加库存并写入库存流水。"
        templateFileName="other-inbound-template.csv"
        fields={otherInboundImportFields}
        sampleRows={[
          {
            仓库编码: "WH-FIN-001",
            "SKU 编码": "SKU-001",
            入库数量: "100",
            入库原因: "初始库存导入",
            备注: "期初盘点录入"
          }
        ]}
        validateRows={validateOtherInboundImportRows}
        onImport={importOtherInboundRows}
        onClose={() => setOtherImportOpen(false)}
        renderPreviewSummary={(rows) => {
          const validRows = rows.filter((row) => row.errors.length === 0);
          const totalQuantity = validRows.reduce(
            (sum, row) => sum + Number(row.data?.quantity ?? 0),
            0
          );

          return (
            <div className="debugNotice">
              预览通过 {validRows.length} 行，合计入库{" "}
              {formatQuantity(totalQuantity)} 件。
            </div>
          );
        }}
      />
    </main>
  );
}
