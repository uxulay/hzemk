"use client";

import { useEffect, useMemo, useState } from "react";
import { BulkImportDialog } from "@/components/BulkImportDialog";
import { Modal } from "@/components/Modal";
import { getBrandOptions, type BrandRow } from "@/lib/api/brands";
import { getBrandCodeName } from "@/lib/brand-utils";
import { searchWarehouseOptions, type WarehouseRow as Warehouse } from "@/lib/api/warehouses";
import {
  bulkCreateOtherOutbound,
  createOtherOutbound,
  getFbaOutboundRequests,
  getInventoryForAdjustment,
  getInventoryTransactions,
  getSkuOptionsForInventory,
  otherOutboundImportFields,
  submitFbaOutbound,
  validateOtherOutboundImportRows,
  type FbaOutboundRequest,
  type InventoryAdjustmentRow,
  type InventorySkuOption,
  type InventoryTransactionRow,
  type OtherInventoryMovementValidationRow
} from "@/lib/api/inventory";

type OutboundTab = "fba" | "other";

const requestStatusLabels: Record<string, string> = {
  accepted: "已接单",
  in_production: "生产中",
  completed: "已完成",
  shipped: "已发往 FBA"
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

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function parseAmazonSite(notes: string | null | undefined) {
  if (!notes) {
    return "-";
  }

  const match = notes.match(/亚马逊站点：(.+)/);

  return match?.[1]?.split("\n")[0]?.trim() || "-";
}

function getDefaultWarehouseId(warehouses: Warehouse[]) {
  return (
    warehouses.find((warehouse) => warehouse.warehouse_type === "finished_product")
      ?.id ??
    warehouses[0]?.id ??
    ""
  );
}

export default function FbaOutboundPage() {
  const [activeTab, setActiveTab] = useState<OutboundTab>("fba");
  const [requests, setRequests] = useState<FbaOutboundRequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [skuOptions, setSkuOptions] = useState<InventorySkuOption[]>([]);
  const [otherInventoryItems, setOtherInventoryItems] = useState<
    InventoryAdjustmentRow[]
  >([]);
  const [recentOtherOutbound, setRecentOtherOutbound] = useState<
    InventoryTransactionRow[]
  >([]);
  const [outboundWarehouseId, setOutboundWarehouseId] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [otherOutboundOpen, setOtherOutboundOpen] = useState(false);
  const [otherImportOpen, setOtherImportOpen] = useState(false);
  const [otherWarehouseId, setOtherWarehouseId] = useState("");
  const [otherSkuId, setOtherSkuId] = useState("");
  const [otherSkuKeyword, setOtherSkuKeyword] = useState("");
  const [otherQuantity, setOtherQuantity] = useState("");
  const [otherReason, setOtherReason] = useState("");
  const [otherNotes, setOtherNotes] = useState("");
  const [outboundQuantity, setOutboundQuantity] = useState("");
  const [logisticsNotes, setLogisticsNotes] = useState("");
  const [operationNotes, setOperationNotes] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const finishedWarehouses = useMemo(
    () =>
      warehouses.filter(
        (warehouse) =>
          warehouse.status === "active" &&
          warehouse.warehouse_type === "finished_product"
      ),
    [warehouses]
  );

  const selectedRequest = useMemo(
    () => requests.find((request) => request.id === selectedRequestId) ?? null,
    [requests, selectedRequestId]
  );
  const filteredRequests = useMemo(() => {
    if (brandFilter === "all") {
      return requests;
    }

    return requests.filter((request) => {
      const brandId = request.sku?.product?.brand?.id ?? null;

      return brandFilter === "none" ? !brandId : brandId === brandFilter;
    });
  }, [brandFilter, requests]);

  const selectedWarehouse =
    warehouses.find((warehouse) => warehouse.id === outboundWarehouseId) ?? null;
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
  const selectedOtherInventory = useMemo(
    () =>
      otherInventoryItems.find(
        (item) => item.warehouse_id === otherWarehouseId && item.sku_id === otherSkuId
      ) ?? null,
    [otherInventoryItems, otherSkuId, otherWarehouseId]
  );
  const selectedOtherAvailableQuantity = selectedOtherInventory
    ? Math.max(
        0,
        Number(selectedOtherInventory.quantity_on_hand) -
          Number(selectedOtherInventory.reserved_quantity)
      )
    : 0;

  const loadRequests = async (warehouseId: string) => {
    const requestData = await getFbaOutboundRequests({ warehouseId });
    setRequests(requestData);
    setSelectedRequestId((current) =>
      requestData.some((request) => request.id === current) ? current : ""
    );
  };

  const loadOtherOutboundData = async (warehouseId: string) => {
    const [inventoryData, materialOutData, productOutData] = await Promise.all([
      getInventoryForAdjustment({ warehouseId }),
      getInventoryTransactions({ transactionType: "material_out", warehouseId }),
      getInventoryTransactions({ transactionType: "product_out", warehouseId })
    ]);

    setOtherInventoryItems(inventoryData);
    setRecentOtherOutbound(
      [...materialOutData, ...productOutData]
        .filter((transaction) => transaction.notes?.includes("其他出库"))
        .sort(
          (a, b) =>
            new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime()
        )
        .slice(0, 20)
    );
  };

  const loadPageData = async (preferredWarehouseId = "") => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [warehouseData, brandData, skuData] = await Promise.all([
        searchWarehouseOptions("", 20),
        getBrandOptions(),
        getSkuOptionsForInventory()
      ]);
      const defaultWarehouseId =
        preferredWarehouseId || outboundWarehouseId || getDefaultWarehouseId(warehouseData);

      setWarehouses(warehouseData);
      setBrands(brandData);
      setSkuOptions(skuData.filter((sku) => sku.status === "active"));
      setOutboundWarehouseId(defaultWarehouseId);
      setOtherWarehouseId((current) => current || defaultWarehouseId);
      await loadRequests(defaultWarehouseId);
      await loadOtherOutboundData(defaultWarehouseId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequests([]);
      setWarehouses([]);
      setBrands([]);
      setSkuOptions([]);
      setOtherInventoryItems([]);
      setRecentOtherOutbound([]);
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
      setOtherOutboundOpen(true);
    }

    if (initialWarehouseId) {
      setOutboundWarehouseId(initialWarehouseId);
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

  const changeWarehouse = async (warehouseId: string) => {
    try {
      setOutboundWarehouseId(warehouseId);
      setOtherWarehouseId(warehouseId);
      setLoading(true);
      setErrorMessage("");
      await loadRequests(warehouseId);
      await loadOtherOutboundData(warehouseId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const openOtherOutbound = () => {
    setActiveTab("other");
    setOtherOutboundOpen(true);
    setOtherWarehouseId(
      otherWarehouseId || outboundWarehouseId || getDefaultWarehouseId(warehouses)
    );
    setOtherSkuId("");
    setOtherSkuKeyword("");
    setOtherQuantity("");
    setOtherReason("");
    setOtherNotes("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openOtherOutboundImport = () => {
    setActiveTab("other");
    setOtherOutboundOpen(false);
    setOtherImportOpen(true);
  };

  const submitOtherOutbound = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      await createOtherOutbound({
        warehouseId: otherWarehouseId,
        skuId: otherSkuId,
        quantity: Number(otherQuantity),
        reason: otherReason,
        notes: otherNotes
      });

      setSuccessMessage(
        `${selectedOtherSku?.sku_code ?? "该 SKU"} 其他出库成功，库存已扣减。`
      );
      setOtherOutboundOpen(false);
      await loadOtherOutboundData(otherWarehouseId);
      await loadRequests(outboundWarehouseId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const importOtherOutboundRows = async (
    rows: OtherInventoryMovementValidationRow[]
  ) => {
    const result = await bulkCreateOtherOutbound(
      rows.flatMap((row) => (row.data ? [row.data] : []))
    );

    setSuccessMessage(
      `批量其他出库完成：成功 ${result.successCount} 条，失败 ${result.failedCount} 条。`
    );

    return result;
  };

  const openOutboundForm = (request: FbaOutboundRequest) => {
    setSelectedRequestId(request.id);
    setOutboundQuantity(
      String(
        Math.min(
          Number(request.pending_outbound_quantity),
          Number(request.current_inventory_quantity)
        )
      )
    );
    setLogisticsNotes("");
    setOperationNotes("");
    setErrorMessage("");
    setSuccessMessage("");
  };

  const submitOutbound = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedRequest) {
      setErrorMessage("请选择备货需求。");
      return;
    }

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      await submitFbaOutbound({
        replenishmentRequestId: selectedRequest.id,
        warehouseId: outboundWarehouseId,
        outboundQuantity: Number(outboundQuantity),
        logisticsNotes,
        operationNotes
      });

      setSuccessMessage(`备货单 ${selectedRequest.request_no} 出库成功。`);
      setSelectedRequestId("");
      setOutboundQuantity("");
      setLogisticsNotes("");
      setOperationNotes("");
      await loadRequests(outboundWarehouseId);
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
          <h2>出库管理</h2>
          <p>
            备货出库继续关联备货单；其他出库用于样品、损耗、退供应商和借出等非平台场景。
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
        <div className="tabBar" role="tablist" aria-label="出库类型">
          <button
            className={activeTab === "fba" ? "tabButton active" : "tabButton"}
            type="button"
            onClick={() => setActiveTab("fba")}
          >
            备货出库
          </button>
          <button
            className={activeTab === "other" ? "tabButton active" : "tabButton"}
            type="button"
            onClick={openOtherOutbound}
          >
            其他出库
          </button>
        </div>

        {activeTab === "fba" ? (
          <>
            <div className="sectionHeader">
          <div>
            <p className="eyebrow">待出库</p>
            <h3>可出库备货需求</h3>
          </div>
          <div className="rowActions">
            <button type="button" onClick={() => loadPageData()} disabled={loading}>
              {loading ? "正在刷新..." : "刷新"}
            </button>
          </div>
        </div>

        <div className="dataForm inboundForm">
          <label>
            出库仓库
            <select
              value={outboundWarehouseId}
              onChange={(event) => changeWarehouse(event.target.value)}
              disabled={loading || submitting}
            >
              <option value="">请选择仓库</option>
              {(finishedWarehouses.length > 0 ? finishedWarehouses : warehouses).map(
                (warehouse) => (
                  <option key={warehouse.id} value={warehouse.id}>
                    {warehouse.warehouse_code} / {warehouse.name}
                  </option>
                )
              )}
            </select>
          </label>

          <label>
            品牌
            <select
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              disabled={loading || submitting}
            >
              <option value="all">全部品牌</option>
              <option value="none">无品牌</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {getBrandCodeName(brand)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取可出库 FBA 需求...</div>
        ) : null}

        {!loading && filteredRequests.length === 0 ? (
          <div className="emptyState">暂无可出库 FBA 需求</div>
        ) : null}

        {!loading && filteredRequests.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>备货单号</th>
                  <th>产品名称</th>
                  <th>品牌</th>
                  <th>SKU 编码</th>
                  <th>SKU 名称</th>
                  <th>亚马逊站点</th>
                  <th>目标 FBA 仓库</th>
                  <th>备货需求数量</th>
                  <th>当前成品库存</th>
                  <th>已出库数量</th>
                  <th>待出库数量</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => {
                  const isShortage =
                    Number(request.current_inventory_quantity) <
                    Number(request.pending_outbound_quantity);

                  return (
                    <tr className={isShortage ? "shortageRow" : undefined} key={request.id}>
                      <td>{request.request_no}</td>
                      <td>{request.sku?.product?.name ?? "-"}</td>
                      <td>{getBrandCodeName(request.sku?.product?.brand)}</td>
                      <td>
                        <strong>{request.sku?.sku_code ?? "-"}</strong>
                        <span>{request.sku?.amazon_sku ?? "-"}</span>
                      </td>
                      <td>{request.sku?.sku_name ?? "-"}</td>
                      <td>{parseAmazonSite(request.notes)}</td>
                      <td>
                        <strong>{request.fba_warehouse_code ?? "-"}</strong>
                        <span>{request.target_warehouse?.name ?? "-"}</span>
                      </td>
                      <td>{formatQuantity(request.requested_quantity)}</td>
                      <td>{formatQuantity(request.current_inventory_quantity)}</td>
                      <td>{formatQuantity(request.outbound_quantity)}</td>
                      <td>{formatQuantity(request.pending_outbound_quantity)}</td>
                      <td>
                        <span className={`tablePill status-${request.status}`}>
                          {requestStatusLabels[request.status] ?? request.status}
                        </span>
                        {isShortage ? (
                          <span className="dangerText">库存不足</span>
                        ) : null}
                      </td>
                      <td>
                        <div className="rowActions">
                          <button
                            type="button"
                            onClick={() => openOutboundForm(request)}
                            disabled={submitting || !outboundWarehouseId}
                          >
                            发往 FBA
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
          </>
        ) : null}

        {activeTab === "other" ? (
          <>
            <div className="sectionHeader">
              <div>
                <p className="eyebrow">其他出库</p>
                <h3>其他出库单</h3>
              </div>
              <div className="rowActions">
                <button
                  className="primaryButton"
                  type="button"
                  onClick={openOtherOutbound}
                  disabled={submitting}
                >
                  新建其他出库单
                </button>
                <button
                  type="button"
                  onClick={openOtherOutboundImport}
                  disabled={submitting}
                >
                  批量上传
                </button>
                <button
                  type="button"
                  onClick={() => loadOtherOutboundData(otherWarehouseId || outboundWarehouseId)}
                  disabled={loading}
                >
                  刷新
                </button>
              </div>
            </div>

            <div className="dataForm inboundForm">
              <label>
                查看仓库
                <select
                  value={otherWarehouseId}
                  onChange={(event) => {
                    setOtherWarehouseId(event.target.value);
                    loadOtherOutboundData(event.target.value);
                  }}
                  disabled={loading || submitting}
                >
                  <option value="">全部仓库</option>
                  {(activeWarehouses.length > 0 ? activeWarehouses : warehouses).map(
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
                <span>适用场景</span>
                <strong>样品、损耗、退供应商、借出</strong>
              </div>
              <div className="detailItem">
                <span>库存规则</span>
                <strong>出库前校验可用库存，不能扣成负数</strong>
              </div>
              <div className="detailItem">
                <span>库存流水</span>
                <strong>自动写入 material_out / product_out</strong>
              </div>
            </div>

            {otherInventoryItems.length === 0 ? (
              <div className="emptyState">当前仓库暂无可出库库存</div>
            ) : (
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>SKU 编码</th>
                      <th>SKU 名称</th>
                      <th>仓库</th>
                      <th>当前库存</th>
                      <th>已占用</th>
                      <th>可用库存</th>
                      <th>单位</th>
                    </tr>
                  </thead>
                  <tbody>
                    {otherInventoryItems.map((item) => {
                      const availableQuantity = Math.max(
                        0,
                        Number(item.quantity_on_hand) -
                          Number(item.reserved_quantity)
                      );

                      return (
                        <tr key={item.id}>
                          <td>{item.sku?.sku_code ?? "-"}</td>
                          <td>{item.sku?.sku_name ?? "-"}</td>
                          <td>
                            <strong>{item.warehouse?.name ?? "-"}</strong>
                            <span>{item.warehouse?.warehouse_code ?? "-"}</span>
                          </td>
                          <td>{formatQuantity(item.quantity_on_hand)}</td>
                          <td>{formatQuantity(item.reserved_quantity)}</td>
                          <td>{formatQuantity(availableQuantity)}</td>
                          <td>{item.sku?.unit ?? item.unit}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="sectionHeader">
              <div>
                <p className="eyebrow">最近流水</p>
                <h3>最近其他出库记录</h3>
              </div>
            </div>

            {recentOtherOutbound.length === 0 ? (
              <div className="emptyState">暂无其他出库流水</div>
            ) : (
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>类型</th>
                      <th>SKU</th>
                      <th>仓库</th>
                      <th>数量</th>
                      <th>备注</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOtherOutbound.map((transaction) => (
                      <tr key={transaction.id}>
                        <td>{formatDate(transaction.occurred_at)}</td>
                        <td>{transaction.transaction_type}</td>
                        <td>{transaction.sku?.sku_code ?? "-"}</td>
                        <td>{transaction.warehouse?.name ?? "-"}</td>
                        <td>{formatQuantity(transaction.quantity)}</td>
                        <td className="notesCell">{transaction.notes ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : null}
      </section>

      {selectedRequest ? (
        <Modal
          open={Boolean(selectedRequest)}
          eyebrow="创建备货出库"
          title={selectedRequest.request_no}
          maxWidth="xl"
          onClose={() => {
            if (!submitting) {
              setSelectedRequestId("");
            }
          }}
        >
          <form onSubmit={submitOutbound}>
            <div className="detailGrid">
              <div className="detailItem">
                <span>备货需求</span>
                <strong>{selectedRequest.request_no}</strong>
              </div>
              <div className="detailItem">
                <span>成品 SKU</span>
                <strong>{selectedRequest.sku?.sku_code ?? "-"}</strong>
              </div>
              <div className="detailItem">
                <span>品牌</span>
                <strong>{getBrandCodeName(selectedRequest.sku?.product?.brand)}</strong>
              </div>
              <div className="detailItem">
                <span>出库仓库</span>
                <strong>
                  {selectedWarehouse
                    ? `${selectedWarehouse.warehouse_code} / ${selectedWarehouse.name}`
                    : "-"}
                </strong>
              </div>
              <div className="detailItem">
                <span>目标 FBA 仓库</span>
                <strong>{selectedRequest.fba_warehouse_code ?? "-"}</strong>
              </div>
              <div className="detailItem">
                <span>备货需求数量</span>
                <strong>{formatQuantity(selectedRequest.requested_quantity)}</strong>
              </div>
              <div className="detailItem">
                <span>当前成品库存</span>
                <strong>
                  {formatQuantity(selectedRequest.current_inventory_quantity)}
                </strong>
              </div>
              <div className="detailItem">
                <span>已出库数量</span>
                <strong>{formatQuantity(selectedRequest.outbound_quantity)}</strong>
              </div>
              <div className="detailItem">
                <span>待出库数量</span>
                <strong>
                  {formatQuantity(selectedRequest.pending_outbound_quantity)}
                </strong>
              </div>
            </div>

            {Number(selectedRequest.current_inventory_quantity) <
            Number(selectedRequest.pending_outbound_quantity) ? (
              <div className="debugError">
                当前成品库存不足，只能按现有库存出库，第一版不允许超出库存或超发。
              </div>
            ) : null}

            <div className="dataForm inboundForm">
              <label>
                本次出库数量
                <input
                  disabled={submitting}
                  max={Math.min(
                    Number(selectedRequest.current_inventory_quantity),
                    Number(selectedRequest.pending_outbound_quantity)
                  )}
                  min="0.0001"
                  required
                  step="0.0001"
                  type="number"
                  value={outboundQuantity}
                  onChange={(event) => setOutboundQuantity(event.target.value)}
                />
              </label>

              <label>
                物流/运输备注
                <textarea
                  disabled={submitting}
                  value={logisticsNotes}
                  onChange={(event) => setLogisticsNotes(event.target.value)}
                  placeholder="例如承运商、运单号、箱数"
                />
              </label>

              <label className="fullField">
                操作备注
                <textarea
                  disabled={submitting}
                  value={operationNotes}
                  onChange={(event) => setOperationNotes(event.target.value)}
                  placeholder="可填写仓库操作说明"
                />
              </label>
            </div>

            <div className="modalFooter">
              <span>请确认出库数量、目标仓和物流备注。</span>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => setSelectedRequestId("")}
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={
                    submitting ||
                    Number(outboundQuantity) <= 0 ||
                    Number(outboundQuantity) >
                      Number(selectedRequest.current_inventory_quantity) ||
                    Number(outboundQuantity) >
                      Number(selectedRequest.pending_outbound_quantity)
                  }
                >
                  {submitting ? "正在出库..." : "确认出库"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}

      {otherOutboundOpen ? (
        <Modal
          open={otherOutboundOpen}
          eyebrow="其他出库"
          title="新建其他出库单"
          maxWidth="xl"
          onClose={() => {
            if (!submitting) {
              setOtherOutboundOpen(false);
            }
          }}
        >
          <form className="dataForm inboundForm" onSubmit={submitOtherOutbound}>
            <label>
              出库仓库
              <select
                value={otherWarehouseId}
                onChange={(event) => {
                  setOtherWarehouseId(event.target.value);
                  loadOtherOutboundData(event.target.value);
                }}
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
              出库数量
              <input
                min="0.0001"
                max={selectedOtherAvailableQuantity || undefined}
                step="0.0001"
                type="number"
                value={otherQuantity}
                onChange={(event) => setOtherQuantity(event.target.value)}
                disabled={submitting}
                required
              />
            </label>

            <label>
              出库原因
              <input
                value={otherReason}
                onChange={(event) => setOtherReason(event.target.value)}
                placeholder="例如样品出库、损耗出库、退货给供应商"
                disabled={submitting}
                required
              />
            </label>

            <label className="fullField">
              备注
              <textarea
                value={otherNotes}
                onChange={(event) => setOtherNotes(event.target.value)}
                placeholder="可填写领用人、退货原因或业务说明"
                disabled={submitting}
              />
            </label>

            <div className="fullField adjustmentPreviewBox">
              <span>批量上传</span>
              <strong>适合样品、损耗、退供应商、借出等多 SKU 出库</strong>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={openOtherOutboundImport}
                  disabled={submitting}
                >
                  打开批量上传
                </button>
              </div>
            </div>

            <div className="fullField adjustmentPreviewBox">
              <span>可用库存</span>
              <strong>
                {formatQuantity(selectedOtherAvailableQuantity)}{" "}
                {selectedOtherSku?.unit ?? ""}
              </strong>
              {!selectedOtherInventory && otherWarehouseId && otherSkuId ? (
                <p className="dangerText">当前仓库没有该 SKU 库存记录，不能出库。</p>
              ) : null}
            </div>

            <div className="modalFooter fullField">
              <span>提交后会扣减库存，并写入库存流水。</span>
              <div className="rowActions">
                <button
                  type="button"
                  onClick={() => setOtherOutboundOpen(false)}
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
                    Number(otherQuantity) > selectedOtherAvailableQuantity ||
                    !otherReason.trim()
                  }
                >
                  {submitting ? "正在出库..." : "确认其他出库"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}

      <BulkImportDialog
        open={otherImportOpen}
        title="批量导入其他出库"
        description="上传后先预览和校验库存是否足够。确认导入后会一次性批量扣减库存并写入库存流水。"
        templateFileName="other-outbound-template.csv"
        fields={otherOutboundImportFields}
        sampleRows={[
          {
            仓库编码: "WH-FIN-001",
            "SKU 编码": "SKU-001",
            出库数量: "10",
            出库原因: "样品出库",
            备注: "业务样品"
          }
        ]}
        validateRows={validateOtherOutboundImportRows}
        onImport={importOtherOutboundRows}
        onClose={() => setOtherImportOpen(false)}
        renderPreviewSummary={(rows) => {
          const validRows = rows.filter((row) => row.errors.length === 0);
          const totalQuantity = validRows.reduce(
            (sum, row) => sum + Number(row.data?.quantity ?? 0),
            0
          );

          return (
            <div className="debugNotice">
              预览通过 {validRows.length} 行，合计出库{" "}
              {formatQuantity(totalQuantity)} 件。
            </div>
          );
        }}
      />
    </main>
  );
}
