"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowActions } from "@/components/ui/row-actions";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { searchWarehouseOptions, type WarehouseRow as Warehouse } from "@/lib/api/warehouses";
import {
  getInventoryTransactions,
  getReceivableProductionOrders,
  getReceivablePurchaseOrders,
  receiveProductionOrder,
  receivePurchaseOrderItems,
  type InventoryTransactionRow,
  type ReceivableProductionOrder,
  type ReceivablePurchaseOrder
} from "@/lib/api/inventory";

type InboundTab = "purchase" | "production";
type InboundWorkTab = "pending" | "records";

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
  const [workTab, setWorkTab] = useState<InboundWorkTab>("pending");
  const [purchaseOrders, setPurchaseOrders] = useState<ReceivablePurchaseOrder[]>(
    []
  );
  const [productionOrders, setProductionOrders] = useState<
    ReceivableProductionOrder[]
  >([]);
  const [purchaseInboundRecords, setPurchaseInboundRecords] = useState<
    InventoryTransactionRow[]
  >([]);
  const [productionInboundRecords, setProductionInboundRecords] = useState<
    InventoryTransactionRow[]
  >([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [selectedProductionOrderId, setSelectedProductionOrderId] = useState("");
  const [inboundKeyword, setInboundKeyword] = useState("");
  const [inboundStatus, setInboundStatus] = useState("all");
  const [inboundWarehouseFilter, setInboundWarehouseFilter] = useState("");
  const [inboundDate, setInboundDate] = useState("");
  const [purchaseWarehouseId, setPurchaseWarehouseId] = useState("");
  const [productionWarehouseId, setProductionWarehouseId] = useState("");
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
      const matchesDate =
        !inboundDate ||
        order.received_at?.slice(0, 10) === inboundDate ||
        order.expected_arrival_date === inboundDate;

      return matchesKeyword && matchesStatus && matchesDate && remainingTotal > 0;
    });
  }, [
    inboundDate,
    inboundKeyword,
    inboundStatus,
    purchaseOrders
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
      const matchesDate =
        !inboundDate ||
        order.planned_start_date === inboundDate ||
        order.planned_end_date === inboundDate;

      return matchesKeyword && matchesStatus && matchesDate && pendingQuantity > 0;
    });
  }, [
    inboundDate,
    inboundKeyword,
    inboundStatus,
    productionOrders
  ]);

  const filteredPurchaseInboundRecords = useMemo(() => {
    const keyword = inboundKeyword.trim().toLowerCase();

    return purchaseInboundRecords.filter((transaction) => {
      const matchesKeyword =
        !keyword ||
        [
          transaction.transaction_no,
          transaction.purchase_order?.purchase_order_no ?? "",
          transaction.material?.material_code ?? transaction.sku?.sku_code ?? "",
          transaction.material?.material_name ?? transaction.sku?.sku_name ?? ""
        ]
          .join(" / ")
          .toLowerCase()
          .includes(keyword);
      const matchesWarehouse =
        !inboundWarehouseFilter ||
        transaction.warehouse_id === inboundWarehouseFilter;
      const matchesDate =
        !inboundDate || transaction.occurred_at.slice(0, 10) === inboundDate;

      return matchesKeyword && matchesWarehouse && matchesDate;
    });
  }, [
    inboundDate,
    inboundKeyword,
    inboundWarehouseFilter,
    purchaseInboundRecords
  ]);

  const filteredProductionInboundRecords = useMemo(() => {
    const keyword = inboundKeyword.trim().toLowerCase();

    return productionInboundRecords.filter((transaction) => {
      const matchesKeyword =
        !keyword ||
        [
          transaction.transaction_no,
          transaction.production_order?.production_order_no ?? "",
          transaction.product_sku?.sku_code ?? transaction.sku?.sku_code ?? "",
          transaction.product_sku?.sku_name ?? transaction.sku?.sku_name ?? "",
          transaction.product_sku?.product?.name ??
            transaction.sku?.product?.name ??
            ""
        ]
          .join(" / ")
          .toLowerCase()
          .includes(keyword);
      const matchesWarehouse =
        !inboundWarehouseFilter ||
        transaction.warehouse_id === inboundWarehouseFilter;
      const matchesDate =
        !inboundDate || transaction.occurred_at.slice(0, 10) === inboundDate;

      return matchesKeyword && matchesWarehouse && matchesDate;
    });
  }, [
    inboundDate,
    inboundKeyword,
    inboundWarehouseFilter,
    productionInboundRecords
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

      const [
        purchaseData,
        productionData,
        purchaseRecordData,
        productionRecordData,
        warehouseData
      ] =
        await Promise.all([
          getReceivablePurchaseOrders(),
          getReceivableProductionOrders(),
          getInventoryTransactions({ transactionType: "material_in" }),
          getInventoryTransactions({ transactionType: "product_in" }),
          searchWarehouseOptions("", 20)
        ]);

      setPurchaseOrders(purchaseData);
      setProductionOrders(productionData);
      setPurchaseInboundRecords(
        purchaseRecordData.filter((transaction) => Boolean(transaction.purchase_order_id))
      );
      setProductionInboundRecords(
        productionRecordData.filter((transaction) => Boolean(transaction.production_order_id))
      );
      setWarehouses(warehouseData);

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
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setPurchaseOrders([]);
      setProductionOrders([]);
      setPurchaseInboundRecords([]);
      setProductionInboundRecords([]);
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const initialTab = params.get("tab");
    const initialWarehouseId = params.get("warehouseId") ?? "";
    const initialSkuKeyword = params.get("skuKeyword") ?? "";

    if (initialTab === "production") {
      setActiveTab("production");
    } else if (initialTab === "purchase") {
      setActiveTab("purchase");
    } else if (initialTab === "other") {
      setActiveTab("purchase");
    }

    setInboundWarehouseFilter(initialWarehouseId);
    setInboundKeyword(initialSkuKeyword);

    loadPageData(initialWarehouseId);
  }, []);

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

  const resetInboundFilters = () => {
    setInboundKeyword("");
    setInboundStatus("all");
    setInboundWarehouseFilter("");
    setInboundDate("");
  };

  const exportInboundRows = () => {
    const rows =
      activeTab === "purchase"
        ? workTab === "pending"
          ? filteredPurchaseOrders.map((order) => [
              order.purchase_order_no,
              order.supplier?.name ?? "",
              order.items.length,
              order.items.reduce((sum, item) => sum + Number(item.ordered_quantity), 0),
              order.items.reduce((sum, item) => sum + Number(item.received_quantity), 0),
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
          : filteredPurchaseInboundRecords.map((transaction) => [
              transaction.transaction_no,
              transaction.purchase_order?.purchase_order_no ?? "-",
              transaction.material?.material_name ??
                transaction.sku?.sku_name ??
                "-",
              transaction.quantity,
              transaction.warehouse?.name ?? "-",
              formatDate(transaction.occurred_at),
              transaction.operator?.full_name ?? "-"
            ])
        : workTab === "pending"
          ? filteredProductionOrders.map((order) => [
              order.production_order_no,
              order.sku?.sku_code ?? "",
              order.sku?.product?.name ?? order.sku?.sku_name ?? "",
              order.planned_quantity,
              order.completed_quantity,
              Math.max(
                0,
                Number(order.planned_quantity) - Number(order.completed_quantity)
              ),
              productionStatusLabels[order.status] ?? order.status
            ])
          : filteredProductionInboundRecords.map((transaction) => [
              transaction.transaction_no,
              transaction.production_order?.production_order_no ?? "-",
              transaction.product_sku?.sku_code ?? transaction.sku?.sku_code ?? "-",
              transaction.product_sku?.product?.name ??
                transaction.sku?.product?.name ??
                transaction.product_sku?.sku_name ??
                transaction.sku?.sku_name ??
                "-",
              transaction.quantity,
              transaction.warehouse?.name ?? "-",
              formatDate(transaction.occurred_at),
              transaction.operator?.full_name ?? "-"
            ]);
    const headers =
      activeTab === "purchase"
        ? workTab === "pending"
          ? [
              "采购单号",
              "供应商",
              "物料数量",
              "采购数量",
              "已入库数量",
              "待入库数量",
              "采购状态",
              "交期"
            ]
          : [
              "入库流水号",
              "关联采购单",
              "物料信息",
              "入库数量",
              "入库仓库",
              "入库时间",
              "操作人"
            ]
        : workTab === "pending"
          ? [
              "生产任务单号",
              "成品 SKU",
              "产品名称",
              "计划生产数量",
              "已入库数量",
              "待入库数量",
              "生产状态"
            ]
          : [
              "入库流水号",
              "关联生产任务",
              "成品 SKU",
              "产品名称",
              "入库数量",
              "入库仓库",
              "入库时间",
              "操作人"
            ];
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
      key: "purchase_order_no",
      title: "采购单号",
      width: 145,
      mobilePriority: "title",
      render: (order) => order.purchase_order_no
    },
    {
      key: "supplier",
      title: "供应商",
      width: 150,
      render: (order) => (
        <InfoCell
          title={order.supplier?.name ?? "-"}
          subtitle={order.supplier?.supplier_code ?? "-"}
        />
      )
    },
    {
      key: "material_count",
      title: "物料数量",
      width: 90,
      align: "right",
      render: (order) => formatQuantity(order.items.length)
    },
    {
      key: "ordered_quantity",
      title: "采购数量",
      width: 100,
      align: "right",
      render: (order) =>
        formatQuantity(
          order.items.reduce((sum, item) => sum + Number(item.ordered_quantity), 0)
        )
    },
    {
      key: "received_quantity",
      title: "已入库数量",
      width: 105,
      align: "right",
      render: (order) =>
        formatQuantity(
          order.items.reduce((sum, item) => sum + Number(item.received_quantity), 0)
        )
    },
    {
      key: "pending_quantity",
      title: "待入库数量",
      width: 105,
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
      key: "arrival_date",
      title: "交期 / 到货日期",
      width: 120,
      render: (order) => formatDate(order.received_at ?? order.expected_arrival_date)
    },
    {
      key: "status",
      title: "采购状态",
      width: 100,
      align: "center",
      mobilePriority: "status",
      render: (order) => (
        <StatusBadge status={order.status} label={purchaseStatusLabels[order.status]} />
      )
    },
    {
      key: "actions",
      title: "操作",
      width: 110,
      mobilePriority: "action",
      render: (order) => {
        const pendingQuantity = order.items.reduce(
          (sum, item) =>
            sum +
            getRemainingPurchaseQuantity(
              item.ordered_quantity,
              item.received_quantity
            ),
          0
        );

        return pendingQuantity > 0 ? (
          <RowActions viewLabel="办理入库" onView={() => openPurchaseInbound(order)} />
        ) : (
          <button type="button" disabled>
            已完成
          </button>
        );
      }
    }
  ];

  const productionInboundColumns: DataTableColumn<ReceivableProductionOrder>[] = [
    {
      key: "production_order_no",
      title: "生产任务单号",
      width: 150,
      mobilePriority: "title",
      render: (order) => order.production_order_no
    },
    {
      key: "sku",
      title: "成品 SKU",
      width: 150,
      render: (order) => (
        <InfoCell
          title={order.sku?.sku_code ?? "-"}
          subtitle={order.sku?.sku_name ?? "-"}
        />
      )
    },
    {
      key: "product",
      title: "产品名称",
      width: 160,
      ellipsis: true,
      render: (order) => order.sku?.product?.name ?? "-"
    },
    {
      key: "planned_quantity",
      title: "计划生产数量",
      width: 105,
      align: "right",
      render: (order) => formatQuantity(order.planned_quantity)
    },
    {
      key: "completed_quantity",
      title: "已入库数量",
      width: 105,
      align: "right",
      render: (order) => formatQuantity(order.completed_quantity)
    },
    {
      key: "pending_quantity",
      title: "待入库数量",
      width: 105,
      align: "right",
      render: (order) =>
        formatQuantity(
          Math.max(
            0,
            Number(order.planned_quantity) - Number(order.completed_quantity)
          )
        )
    },
    {
      key: "status",
      title: "生产状态",
      width: 100,
      align: "center",
      mobilePriority: "status",
      render: (order) => (
        <StatusBadge
          status={order.status}
          label={productionStatusLabels[order.status] ?? order.status}
        />
      )
    },
    {
      key: "actions",
      title: "操作",
      width: 110,
      mobilePriority: "action",
      render: (order) => {
        const pendingQuantity = Math.max(
          0,
          Number(order.planned_quantity) - Number(order.completed_quantity)
        );

        return pendingQuantity > 0 ? (
          <RowActions viewLabel="办理入库" onView={() => openProductionInbound(order)} />
        ) : (
          <button type="button" disabled>
            已完成
          </button>
        );
      }
    }
  ];

  const purchaseInboundRecordColumns: DataTableColumn<InventoryTransactionRow>[] = [
    {
      key: "transaction_no",
      title: "入库流水号",
      width: 145,
      mobilePriority: "title",
      render: (transaction) => transaction.transaction_no
    },
    {
      key: "purchase_order",
      title: "关联采购单",
      width: 135,
      render: (transaction) => transaction.purchase_order?.purchase_order_no ?? "-"
    },
    {
      key: "supplier",
      title: "供应商",
      width: 120,
      render: () => "-"
    },
    {
      key: "material",
      title: "物料信息",
      width: 180,
      render: (transaction) => (
        <InfoCell
          title={transaction.material?.material_name ?? transaction.sku?.sku_name ?? "-"}
          subtitle={
            transaction.material?.material_code ?? transaction.sku?.sku_code ?? "-"
          }
        />
      )
    },
    {
      key: "quantity",
      title: "入库数量",
      width: 95,
      align: "right",
      render: (transaction) => formatQuantity(transaction.quantity)
    },
    {
      key: "warehouse",
      title: "入库仓库",
      width: 135,
      render: (transaction) => (
        <InfoCell
          title={transaction.warehouse?.name ?? "-"}
          subtitle={transaction.warehouse?.warehouse_code ?? "-"}
        />
      )
    },
    {
      key: "time",
      title: "入库时间",
      width: 140,
      render: (transaction) => formatDate(transaction.occurred_at)
    },
    {
      key: "operator",
      title: "操作人",
      width: 100,
      render: (transaction) => transaction.operator?.full_name ?? "-"
    },
    {
      key: "actions",
      title: "操作",
      width: 90,
      mobilePriority: "action",
      render: () => "-"
    }
  ];

  const productionInboundRecordColumns: DataTableColumn<InventoryTransactionRow>[] = [
    {
      key: "transaction_no",
      title: "入库流水号",
      width: 145,
      mobilePriority: "title",
      render: (transaction) => transaction.transaction_no
    },
    {
      key: "production_order",
      title: "关联生产任务",
      width: 145,
      render: (transaction) =>
        transaction.production_order?.production_order_no ?? "-"
    },
    {
      key: "sku",
      title: "成品 SKU",
      width: 140,
      render: (transaction) =>
        transaction.product_sku?.sku_code ?? transaction.sku?.sku_code ?? "-"
    },
    {
      key: "product",
      title: "产品名称",
      width: 160,
      ellipsis: true,
      render: (transaction) =>
        transaction.product_sku?.product?.name ??
        transaction.sku?.product?.name ??
        transaction.product_sku?.sku_name ??
        transaction.sku?.sku_name ??
        "-"
    },
    {
      key: "quantity",
      title: "入库数量",
      width: 95,
      align: "right",
      render: (transaction) => formatQuantity(transaction.quantity)
    },
    {
      key: "warehouse",
      title: "入库仓库",
      width: 135,
      render: (transaction) => (
        <InfoCell
          title={transaction.warehouse?.name ?? "-"}
          subtitle={transaction.warehouse?.warehouse_code ?? "-"}
        />
      )
    },
    {
      key: "time",
      title: "入库时间",
      width: 140,
      render: (transaction) => formatDate(transaction.occurred_at)
    },
    {
      key: "operator",
      title: "操作人",
      width: 100,
      render: (transaction) => transaction.operator?.full_name ?? "-"
    },
    {
      key: "actions",
      title: "操作",
      width: 90,
      mobilePriority: "action",
      render: () => "-"
    }
  ];

  return (
    <main className="pageShell">
      <PageHeader
        title={activeTab === "purchase" ? "采购入库" : "生产入库"}
        secondaryActions={
          <button
            type="button"
            onClick={exportInboundRows}
            disabled={
              loading ||
              (activeTab === "purchase"
                ? workTab === "pending"
                  ? filteredPurchaseOrders.length === 0
                  : filteredPurchaseInboundRecords.length === 0
                : workTab === "pending"
                  ? filteredProductionOrders.length === 0
                  : filteredProductionInboundRecords.length === 0)
            }
          >
            导出
          </button>
        }
        primaryAction={
          <button
            className="primaryButton"
            type="button"
            onClick={() => loadPageData()}
            disabled={submitting}
          >
            刷新
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
        <div className="tabBar" role="tablist" aria-label="入库页面">
          <button
            className={workTab === "pending" ? "tabButton active" : "tabButton"}
            type="button"
            onClick={() => setWorkTab("pending")}
          >
            {activeTab === "purchase" ? "待入库采购单" : "待入库任务"}
          </button>
          <button
            className={workTab === "records" ? "tabButton active" : "tabButton"}
            type="button"
            onClick={() => setWorkTab("records")}
          >
            入库记录
          </button>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取可入库单据...</div>
        ) : null}

        <SearchFilterBar
          searchLabel="搜索"
          searchValue={inboundKeyword}
          searchPlaceholder={
            activeTab === "purchase"
              ? "采购单号 / 供应商 / 物料"
              : "生产任务单号 / 成品 SKU / 产品"
          }
          onSearchChange={setInboundKeyword}
          onReset={resetInboundFilters}
          filters={
            <>
              {workTab === "pending" ? (
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
                        <option value="material_pending">待物料</option>
                        <option value="in_progress">生产中</option>
                        <option value="completed">已完成</option>
                      </>
                    )}
                  </select>
                </label>
              ) : null}
              {workTab === "records" ? (
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
              ) : null}
            </>
          }
          dateFilters={
            <label>
              {workTab === "pending"
                ? activeTab === "purchase"
                  ? "交期 / 到货日期"
                  : "计划日期"
                : "入库日期"}
              <input
                type="date"
                value={inboundDate}
                onChange={(event) => setInboundDate(event.target.value)}
                disabled={loading}
              />
            </label>
          }
        />

        {!loading && activeTab === "purchase" && workTab === "pending" ? (
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
              minWidth={1040}
            />
          </>
        ) : null}

        {!loading && activeTab === "purchase" && workTab === "records" ? (
          <>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">采购入库</p>
                <h3>入库记录</h3>
              </div>
              <div className="rowActions">
                <button type="button" onClick={() => loadPageData()} disabled={loading}>
                  刷新
                </button>
              </div>
            </div>

            <DataTable
              columns={purchaseInboundRecordColumns}
              rows={filteredPurchaseInboundRecords}
              getRowKey={(transaction) => transaction.id}
              emptyText="暂无采购入库记录"
              minWidth={1100}
            />
          </>
        ) : null}

        {!loading && activeTab === "production" && workTab === "pending" ? (
          <>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">生产完成</p>
                <h3>待入库任务</h3>
              </div>
              <div className="rowActions">
                <button type="button" onClick={() => loadPageData()} disabled={loading}>
                  刷新
                </button>
              </div>
            </div>

            <DataTable
              columns={productionInboundColumns}
              rows={filteredProductionOrders}
              getRowKey={(order) => order.id}
              emptyText="暂无可入库生产任务"
              minWidth={1020}
            />
          </>
        ) : null}

        {!loading && activeTab === "production" && workTab === "records" ? (
          <>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">生产入库</p>
                <h3>入库记录</h3>
              </div>
              <div className="rowActions">
                <button type="button" onClick={() => loadPageData()} disabled={loading}>
                  刷新
                </button>
              </div>
            </div>

            <DataTable
              columns={productionInboundRecordColumns}
              rows={filteredProductionInboundRecords}
              getRowKey={(transaction) => transaction.id}
              emptyText="暂无生产入库记录"
              minWidth={1040}
            />
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

    </main>
  );
}
