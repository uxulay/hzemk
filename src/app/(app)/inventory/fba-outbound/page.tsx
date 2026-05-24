"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { getBrandOptions, type BrandRow } from "@/lib/api/brands";
import { getBrandCodeName } from "@/lib/brand-utils";
import { getWarehouses, type Warehouse } from "@/lib/api/master-data";
import {
  getFbaOutboundRequests,
  submitFbaOutbound,
  type FbaOutboundRequest
} from "@/lib/api/inventory";

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
  const [requests, setRequests] = useState<FbaOutboundRequest[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [brands, setBrands] = useState<BrandRow[]>([]);
  const [outboundWarehouseId, setOutboundWarehouseId] = useState("");
  const [brandFilter, setBrandFilter] = useState("all");
  const [selectedRequestId, setSelectedRequestId] = useState("");
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

  const loadRequests = async (warehouseId: string) => {
    const requestData = await getFbaOutboundRequests({ warehouseId });
    setRequests(requestData);
    setSelectedRequestId((current) =>
      requestData.some((request) => request.id === current) ? current : ""
    );
  };

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [warehouseData, brandData] = await Promise.all([
        getWarehouses(),
        getBrandOptions()
      ]);
      const defaultWarehouseId =
        outboundWarehouseId || getDefaultWarehouseId(warehouseData);

      setWarehouses(warehouseData);
      setBrands(brandData);
      setOutboundWarehouseId(defaultWarehouseId);
      await loadRequests(defaultWarehouseId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequests([]);
      setWarehouses([]);
      setBrands([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const changeWarehouse = async (warehouseId: string) => {
    try {
      setOutboundWarehouseId(warehouseId);
      setLoading(true);
      setErrorMessage("");
      await loadRequests(warehouseId);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequests([]);
    } finally {
      setLoading(false);
    }
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
      setErrorMessage("请选择 FBA 备货需求。");
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

      setSuccessMessage(`备货单 ${selectedRequest.request_no} FBA 出库成功。`);
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
          <h2>FBA 出库</h2>
          <p>
            成品入库后先留在成品库存，发往 FBA 时再单独扣减库存并生成出库流水。
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
            <p className="eyebrow">待发往 FBA</p>
            <h3>可出库备货需求</h3>
          </div>
          <div className="rowActions">
            <button type="button" onClick={loadPageData} disabled={loading}>
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
                  <th>FBA 备货需求数量</th>
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
      </section>

      {selectedRequest ? (
        <Modal
          open={Boolean(selectedRequest)}
          eyebrow="创建 FBA 出库"
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
                <span>FBA 备货需求</span>
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
                <span>FBA 备货需求数量</span>
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
                  {submitting ? "正在出库..." : "确认 FBA 出库"}
                </button>
              </div>
            </div>
          </form>
        </Modal>
      ) : null}
    </main>
  );
}
