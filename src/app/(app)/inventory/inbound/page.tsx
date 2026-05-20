"use client";

import { useEffect, useMemo, useState } from "react";
import { getWarehouses, type Warehouse } from "@/lib/api/master-data";
import {
  getReceivableProductionOrders,
  getReceivablePurchaseOrders,
  receiveProductionOrder,
  receivePurchaseOrderItems,
  type ReceivableProductionOrder,
  type ReceivablePurchaseOrder
} from "@/lib/api/inventory";

type InboundTab = "purchase" | "production";

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
  const [selectedPurchaseOrderId, setSelectedPurchaseOrderId] = useState("");
  const [selectedProductionOrderId, setSelectedProductionOrderId] = useState("");
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

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [purchaseData, productionData, warehouseData] = await Promise.all([
        getReceivablePurchaseOrders(),
        getReceivableProductionOrders(),
        getWarehouses()
      ]);

      setPurchaseOrders(purchaseData);
      setProductionOrders(productionData);
      setWarehouses(warehouseData);

      setSelectedPurchaseOrderId((current) =>
        purchaseData.some((order) => order.id === current)
          ? current
          : purchaseData[0]?.id ?? ""
      );
      setSelectedProductionOrderId((current) =>
        productionData.some((order) => order.id === current)
          ? current
          : productionData[0]?.id ?? ""
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
      setWarehouses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
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
          <h2>入库管理</h2>
          <p>
            采购到货先进入原材料库存，生产完成先进入成品库存；发往 FBA 后续单独做出库。
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
        </div>

        {loading ? (
          <div className="debugNotice">正在读取可入库单据...</div>
        ) : null}

        {!loading && activeTab === "purchase" ? (
          <form onSubmit={submitPurchaseInbound}>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">采购到货</p>
                <h3>原材料入库</h3>
              </div>
              <div className="rowActions">
                <button type="button" onClick={loadPageData} disabled={loading}>
                  刷新
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={
                    submitting ||
                    !selectedPurchaseOrder ||
                    !purchaseWarehouseId ||
                    purchaseInboundTotal <= 0
                  }
                >
                  {submitting ? "正在入库..." : "确认采购入库"}
                </button>
              </div>
            </div>

            {purchaseOrders.length === 0 ? (
              <div className="emptyState">暂无可入库采购单</div>
            ) : (
              <>
                <div className="dataForm inboundForm">
                  <label>
                    采购单
                    <select
                      value={selectedPurchaseOrderId}
                      onChange={(event) =>
                        setSelectedPurchaseOrderId(event.target.value)
                      }
                      disabled={submitting}
                    >
                      {purchaseOrders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.purchase_order_no} /{" "}
                          {order.supplier?.name ?? "未填写供应商"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    入库仓库
                    <select
                      value={purchaseWarehouseId}
                      onChange={(event) => setPurchaseWarehouseId(event.target.value)}
                      disabled={submitting}
                      required
                    >
                      <option value="">请选择仓库</option>
                      {(materialWarehouses.length > 0
                        ? materialWarehouses
                        : warehouses
                      ).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.warehouse_code} / {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {selectedPurchaseOrder ? (
                  <>
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
                            <th>原材料 SKU</th>
                            <th>原材料名称</th>
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
                  </>
                ) : null}
              </>
            )}
          </form>
        ) : null}

        {!loading && activeTab === "production" ? (
          <form onSubmit={submitProductionInbound}>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">生产完成</p>
                <h3>成品入库</h3>
              </div>
              <div className="rowActions">
                <button type="button" onClick={loadPageData} disabled={loading}>
                  刷新
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={
                    submitting ||
                    !selectedProductionOrder ||
                    !productionWarehouseId ||
                    Number(productionQuantity) <= 0
                  }
                >
                  {submitting ? "正在入库..." : "确认成品入库"}
                </button>
              </div>
            </div>

            {productionOrders.length === 0 ? (
              <div className="emptyState">暂无可入库生产任务</div>
            ) : (
              <>
                <div className="dataForm inboundForm">
                  <label>
                    生产任务
                    <select
                      value={selectedProductionOrderId}
                      onChange={(event) =>
                        setSelectedProductionOrderId(event.target.value)
                      }
                      disabled={submitting}
                    >
                      {productionOrders.map((order) => (
                        <option key={order.id} value={order.id}>
                          {order.production_order_no} /{" "}
                          {order.sku?.sku_code ?? "未关联 SKU"}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    入库仓库
                    <select
                      value={productionWarehouseId}
                      onChange={(event) =>
                        setProductionWarehouseId(event.target.value)
                      }
                      disabled={submitting}
                      required
                    >
                      <option value="">请选择仓库</option>
                      {(productWarehouses.length > 0
                        ? productWarehouses
                        : warehouses
                      ).map((warehouse) => (
                        <option key={warehouse.id} value={warehouse.id}>
                          {warehouse.warehouse_code} / {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {selectedProductionOrder ? (
                  <>
                    <div className="detailGrid">
                      <div className="detailItem">
                        <span>生产任务单号</span>
                        <strong>{selectedProductionOrder.production_order_no}</strong>
                      </div>
                      <div className="detailItem">
                        <span>成品 SKU</span>
                        <strong>
                          {selectedProductionOrder.sku?.sku_code ?? "-"}
                        </strong>
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
                        <span>关联 FBA 备货需求</span>
                        <strong>
                          {selectedProductionOrder.replenishment_request
                            ?.request_no ?? "-"}
                        </strong>
                      </div>
                      <div className="detailItem">
                        <span>FBA 备货需求数量</span>
                        <strong>{formatQuantity(fbaRequestedQuantity)}</strong>
                      </div>
                      <div className="detailItem">
                        <span>计划生产数量</span>
                        <strong>{formatQuantity(plannedQuantity)}</strong>
                      </div>
                      <div className="detailItem">
                        <span>超量生产数量</span>
                        <strong>{formatQuantity(overProductionQuantity)}</strong>
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
                        <span>生产状态</span>
                        <strong>
                          {productionStatusLabels[selectedProductionOrder.status] ??
                            selectedProductionOrder.status}
                        </strong>
                      </div>
                    </div>

                    {Number(plannedQuantity) > Number(fbaRequestedQuantity) ? (
                      <div className="debugNotice">
                        这张生产任务计划生产 {formatQuantity(plannedQuantity)} 件，
                        FBA 备货需求是 {formatQuantity(fbaRequestedQuantity)} 件，
                        多出部分将进入成品库存，不会自动发往 FBA。
                      </div>
                    ) : null}

                    {Number(productionQuantity) > 0 ? (
                      <div className="debugNotice">
                        本次入库后，预计累计成品入库{" "}
                        {formatQuantity(projectedCompletedQuantity)} 件；其中超过 FBA
                        备货需求的 {formatQuantity(projectedExtraStock)} 件会留在成品库存。
                      </div>
                    ) : null}

                    <div className="dataForm inboundForm">
                      <label>
                        本次成品入库数量
                        <input
                          min="0.0001"
                          step="0.0001"
                          type="number"
                          value={productionQuantity}
                          onChange={(event) =>
                            setProductionQuantity(event.target.value)
                          }
                          disabled={submitting}
                          required
                        />
                      </label>
                    </div>
                  </>
                ) : null}
              </>
            )}
          </form>
        ) : null}
      </section>
    </main>
  );
}
