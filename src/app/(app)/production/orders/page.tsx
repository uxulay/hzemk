"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  getProductionOrderDetail,
  getProductionOrderIssueMaterialsPreview,
  getProductionOrders,
  issueMaterialsForProductionOrder,
  type ProductionMaterialIssueStatus,
  type ProductionMaterialStatus,
  type ProductionMaterialStatusFilter,
  type ProductionOrderStatus,
  type ProductionOrderIssueMaterialsPreview,
  type ProductionOrderStatusFilter,
  type ProductionOrderTrackingRow
} from "@/lib/api/production";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

const productionStatusOptions: Array<{
  value: ProductionOrderStatusFilter;
  label: string;
}> = [
  { value: "all", label: "全部生产状态" },
  { value: "planned", label: "已计划" },
  { value: "material_pending", label: "待物料" },
  { value: "in_progress", label: "生产中" },
  { value: "completed", label: "已完成" },
  { value: "cancelled", label: "已取消" }
];

const materialStatusOptions: Array<{
  value: ProductionMaterialStatusFilter;
  label: string;
}> = [
  { value: "all", label: "全部物料状态" },
  { value: "not_generated", label: "未生成物料需求" },
  { value: "shortage", label: "缺料" },
  { value: "purchased", label: "已采购待到货" },
  { value: "received", label: "物料已到货" },
  { value: "issued", label: "已领料" },
  { value: "ready", label: "物料齐套" },
  { value: "pending", label: "待处理" }
];

const productionStatusLabels: Record<ProductionOrderStatus, string> = {
  planned: "已计划",
  material_pending: "待物料",
  in_progress: "生产中",
  completed: "已完成",
  cancelled: "已取消"
};

const materialStatusLabels: Record<ProductionMaterialStatus, string> = {
  not_generated: "未生成物料需求",
  shortage: "缺料",
  purchased: "已采购待到货",
  received: "物料已到货",
  issued: "已领料",
  ready: "物料齐套",
  pending: "待处理"
};

const materialIssueStatusLabels: Record<ProductionMaterialIssueStatus, string> = {
  not_generated: "未生成物料需求",
  issued: "已领料",
  ready: "可领料",
  shortage: "库存不足",
  warehouse_adjust_needed: "单仓不足",
  blocked: "不可领料"
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
  return value || "-";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function getIssueButtonLabel(order: ProductionOrderTrackingRow) {
  if (order.materials_issued) {
    return "已领料";
  }

  if (order.material_issue_status === "not_generated") {
    return "未生成物料需求";
  }

  if (order.material_issue_status === "shortage") {
    return "库存不足";
  }

  if (order.material_issue_status === "warehouse_adjust_needed") {
    return "单仓不足";
  }

  if (order.material_issue_status === "blocked") {
    return "不可领料";
  }

  return "确认领料";
}

function groupProductionItemsByProduct(order: ProductionOrderTrackingRow) {
  const groups = new Map<
    string,
    {
      productName: string;
      productCode: string;
      imageUrl: string | null;
      items: ProductionOrderTrackingRow["items"];
    }
  >();

  for (const item of order.items) {
    const product = item.sku?.product ?? null;
    const key = product?.id ?? item.sku?.product_id ?? "unknown";
    const current = groups.get(key);

    if (current) {
      current.items.push(item);
      continue;
    }

    groups.set(key, {
      productName: product?.name ?? "未关联产品",
      productCode: product?.product_code ?? "-",
      imageUrl: product?.product_image_url ?? null,
      items: [item]
    });
  }

  return [...groups.values()];
}

export default function ProductionOrdersPage() {
  const [orders, setOrders] = useState<ProductionOrderTrackingRow[]>([]);
  const [statusFilter, setStatusFilter] =
    useState<ProductionOrderStatusFilter>("all");
  const [materialStatusFilter, setMaterialStatusFilter] =
    useState<ProductionMaterialStatusFilter>("all");
  const [skuKeyword, setSkuKeyword] = useState("");
  const [selectedDetail, setSelectedDetail] =
    useState<ProductionOrderTrackingRow | null>(null);
  const [issuePreview, setIssuePreview] =
    useState<ProductionOrderIssueMaterialsPreview | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [issuePreviewLoadingId, setIssuePreviewLoadingId] = useState("");
  const [issuingOrderId, setIssuingOrderId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const filteredOrders = useMemo(() => {
    const keyword = skuKeyword.trim().toLowerCase();

    return orders.filter((order) => {
      const matchesStatus =
        statusFilter === "all" || order.status === statusFilter;
      const matchesMaterialStatus =
        materialStatusFilter === "all" ||
        order.material_status === materialStatusFilter;
      const skuText = `${order.sku?.sku_code ?? ""} ${order.sku?.sku_name ?? ""}`
        .trim()
        .toLowerCase();
      const matchesSku = !keyword || skuText.includes(keyword);

      return matchesStatus && matchesMaterialStatus && matchesSku;
    });
  }, [materialStatusFilter, orders, skuKeyword, statusFilter]);

  const paginatedOrders = useMemo(
    () => paginateItems(filteredOrders, page),
    [filteredOrders, page]
  );

  useEffect(() => {
    setPage(1);
  }, [materialStatusFilter, skuKeyword, statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const data = await getProductionOrders();
      setOrders(data);

      if (selectedDetail) {
        const nextDetail = data.find((order) => order.id === selectedDetail.id);
        setSelectedDetail(nextDetail ?? null);
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setOrders([]);
      setSelectedDetail(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const viewDetail = async (productionOrderId: string) => {
    try {
      setDetailLoading(true);
      setErrorMessage("");
      setSelectedDetail(await getProductionOrderDetail(productionOrderId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const openIssuePreview = async (order: ProductionOrderTrackingRow) => {
    try {
      setIssuePreviewLoadingId(order.id);
      setErrorMessage("");
      setSuccessMessage("");

      setIssuePreview(await getProductionOrderIssueMaterialsPreview(order.id));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIssuePreviewLoadingId("");
    }
  };

  const confirmIssueMaterials = async () => {
    if (!issuePreview) {
      return;
    }

    try {
      setIssuingOrderId(issuePreview.production_order_id);
      setErrorMessage("");
      setSuccessMessage("");

      await issueMaterialsForProductionOrder(issuePreview.production_order_id);
      setIssuePreview(null);
      await loadOrders();
      setSuccessMessage("领料成功，生产任务已进入生产中。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setIssuingOrderId("");
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">生产跟踪</p>
          <h2>生产任务列表</h2>
          <p>
            查看所有生产任务的计划数量、实际入库、缺料情况和关联 FBA 备货需求。
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
        <div className="listToolbar productionToolbar">
          <label>
            生产状态
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as ProductionOrderStatusFilter)
              }
              disabled={loading}
            >
              {productionStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            物料状态
            <select
              value={materialStatusFilter}
              onChange={(event) =>
                setMaterialStatusFilter(
                  event.target.value as ProductionMaterialStatusFilter
                )
              }
              disabled={loading}
            >
              {materialStatusOptions.map((option) => (
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
              disabled={loading}
              placeholder="输入 SKU 编码或名称"
            />
          </label>

          <button
            className="secondaryButton"
            type="button"
            onClick={loadOrders}
            disabled={loading}
          >
            {loading ? "正在刷新..." : "刷新列表"}
          </button>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取生产任务...</div>
        ) : null}

        {!loading && filteredOrders.length === 0 ? (
          <div className="emptyState">暂无生产任务</div>
        ) : null}

        {!loading && filteredOrders.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>生产任务单号</th>
                  <th>关联 FBA 备货单号</th>
                  <th>产品数量</th>
                  <th>SKU 数量</th>
                  <th>运营需求数量</th>
                  <th>总计划生产数量</th>
                  <th>超量生产数量</th>
                  <th>已入库数量</th>
                  <th>物料状态</th>
                  <th>领料状态</th>
                  <th>生产状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.production_order_no}</td>
                    <td>{order.replenishment_request?.request_no ?? "-"}</td>
                    <td>{order.product_count}</td>
                    <td>{order.sku_count}</td>
                    <td>{formatQuantity(order.requested_quantity)}</td>
                    <td>{formatQuantity(order.total_planned_quantity)}</td>
                    <td>
                      {formatQuantity(order.overproduction_quantity)}
                      {order.overproduction_quantity > 0 ? (
                        <span>
                          多出 {formatQuantity(order.overproduction_quantity)}{" "}
                          件将进入成品库存
                        </span>
                      ) : null}
                    </td>
                    <td>{formatQuantity(order.inbound_quantity)}</td>
                    <td>
                      <span
                        className={`tablePill material-status-${order.material_status}`}
                      >
                        {materialStatusLabels[order.material_status]}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`tablePill issue-status-${order.material_issue_status}`}
                      >
                        {materialIssueStatusLabels[order.material_issue_status]}
                      </span>
                    </td>
                    <td>
                      <span className={`tablePill production-status-${order.status}`}>
                        {productionStatusLabels[order.status] ?? order.status}
                      </span>
                    </td>
                    <td>
                      <div className="rowActions">
                        <button
                          type="button"
                          onClick={() => viewDetail(order.id)}
                          disabled={detailLoading}
                        >
                          查看详情
                        </button>
                        <Link className="secondaryButton" href="/materials/requirements">
                          查看物料需求
                        </Link>
                        <Link className="secondaryButton" href="/inventory/inbound">
                          去入库
                        </Link>
                        <button
                          type="button"
                          onClick={() => openIssuePreview(order)}
                          disabled={
                            issuePreviewLoadingId === order.id ||
                            !order.material_issue_can_issue
                          }
                        >
                          {issuePreviewLoadingId === order.id
                            ? "检查库存..."
                            : getIssueButtonLabel(order)}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {!loading && filteredOrders.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={filteredOrders.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {selectedDetail ? (
        <Modal
          open={Boolean(selectedDetail)}
          eyebrow="生产任务详情"
          title={selectedDetail.production_order_no}
          maxWidth="xl"
          onClose={() => setSelectedDetail(null)}
        >
          <div className="rowActions">
              <button
                type="button"
                onClick={() => openIssuePreview(selectedDetail)}
                disabled={
                  issuePreviewLoadingId === selectedDetail.id ||
                  !selectedDetail.material_issue_can_issue
                }
              >
                {issuePreviewLoadingId === selectedDetail.id
                  ? "检查库存..."
                  : getIssueButtonLabel(selectedDetail)}
              </button>
          </div>

          <div className="detailGrid">
            <div className="detailItem">
              <span>关联 FBA 备货需求</span>
              <strong>{selectedDetail.replenishment_request?.request_no ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>产品数量</span>
              <strong>{selectedDetail.product_count}</strong>
            </div>
            <div className="detailItem">
              <span>SKU 数量</span>
              <strong>{selectedDetail.sku_count}</strong>
            </div>
            <div className="detailItem">
              <span>FBA 备货需求数量</span>
              <strong>{formatQuantity(selectedDetail.requested_quantity)}</strong>
            </div>
            <div className="detailItem">
              <span>计划生产数量</span>
              <strong>{formatQuantity(selectedDetail.total_planned_quantity)}</strong>
            </div>
            <div className="detailItem">
              <span>已入库数量</span>
              <strong>{formatQuantity(selectedDetail.inbound_quantity)}</strong>
            </div>
            <div className="detailItem">
              <span>待入库数量</span>
              <strong>
                {formatQuantity(selectedDetail.pending_inbound_quantity)}
              </strong>
            </div>
            <div className="detailItem">
              <span>生产负责人</span>
              <strong>{selectedDetail.assigned_profile?.full_name ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>生产状态</span>
              <strong>
                {productionStatusLabels[selectedDetail.status] ??
                  selectedDetail.status}
              </strong>
            </div>
            <div className="detailItem">
              <span>领料状态</span>
              <strong>
                {materialIssueStatusLabels[selectedDetail.material_issue_status]}
              </strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>备注</span>
              <strong>{selectedDetail.notes ?? "-"}</strong>
            </div>
          </div>

          {selectedDetail.overproduction_quantity > 0 ? (
            <div className="debugNotice">
              这张生产任务比 FBA 备货需求多生产{" "}
              {formatQuantity(selectedDetail.overproduction_quantity)}
              件。生产入库后，多出的部分会留在成品库存，不会自动发往 FBA。
            </div>
          ) : null}

          <div className="groupList">
            {groupProductionItemsByProduct(selectedDetail).map((group) => (
              <section className="productGroup" key={group.productCode}>
                <ProductHeader
                  imageUrl={group.imageUrl}
                  name={group.productName}
                  code={group.productCode}
                />
                <div className="tableWrap compactTableWrap">
                  <table className="dataTable compactDataTable">
                    <thead>
                      <tr>
                        <th>SKU</th>
                        <th>运营需求数量</th>
                        <th>计划生产数量</th>
                        <th>已入库数量</th>
                        <th>超量数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td>
                            <strong>{item.sku?.sku_code ?? "-"}</strong>
                            <span>
                              {item.sku?.sku_name ?? "-"} /{" "}
                              {item.sku?.specs ?? "-"}
                            </span>
                          </td>
                          <td>{formatQuantity(item.requested_quantity)}</td>
                          <td>{formatQuantity(item.planned_quantity)}</td>
                          <td>{formatQuantity(item.completed_quantity)}</td>
                          <td>
                            {formatQuantity(
                              Math.max(
                                0,
                                Number(item.planned_quantity) -
                                  Number(item.requested_quantity ?? 0)
                              )
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>

          <div className="contentGrid">
            <section className="panel">
              <h3>物料需求摘要</h3>
              {selectedDetail.material_requirements.length === 0 ? (
                <p>未生成物料需求</p>
              ) : (
                <ul className="debugList">
                  {selectedDetail.material_requirements.map((requirement) => (
                    <li key={requirement.id}>
                      <strong>
                        {requirement.material_sku?.sku_code ?? "-"} /{" "}
                        {requirement.material_sku?.sku_name ?? "-"}
                      </strong>
                      <span>
                        需求 {formatQuantity(requirement.required_quantity)}
                        {requirement.unit}，库存{" "}
                        {formatQuantity(requirement.available_quantity)}
                        {requirement.unit}，缺料{" "}
                        {formatQuantity(requirement.shortage_quantity)}
                        {requirement.unit}，状态 {requirement.status}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h3>入库记录摘要</h3>
              {selectedDetail.inbound_transactions.length === 0 ? (
                <p>暂无成品入库流水</p>
              ) : (
                <ul className="debugList">
                  {selectedDetail.inbound_transactions.map((transaction) => (
                    <li key={transaction.id}>
                      <strong>{transaction.transaction_no}</strong>
                      <span>
                        {formatQuantity(transaction.quantity)}
                        {selectedDetail.sku?.unit ?? "pcs"} /{" "}
                        {transaction.warehouse?.name ?? "-"} /{" "}
                        {formatDateTime(transaction.occurred_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="panel">
              <h3>领料记录摘要</h3>
              {selectedDetail.material_issue_transactions.length === 0 ? (
                <p>暂无原材料领料流水</p>
              ) : (
                <ul className="debugList">
                  {selectedDetail.material_issue_transactions.map((transaction) => (
                    <li key={transaction.id}>
                      <strong>{transaction.transaction_no}</strong>
                      <span>
                        {formatQuantity(transaction.quantity)} /{" "}
                        {transaction.warehouse?.name ?? "-"} /{" "}
                        {formatDateTime(transaction.occurred_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </Modal>
      ) : null}

      {issuePreview ? (
        <div className="modalBackdrop" role="presentation">
          <section
            className="modalPanel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="issue-materials-title"
          >
            <div className="detailHeader">
              <div>
                <p className="eyebrow">确认领料</p>
                <h3 id="issue-materials-title">
                  {issuePreview.production_order_no}
                </h3>
              </div>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setIssuePreview(null)}
                disabled={Boolean(issuingOrderId)}
              >
                关闭
              </button>
            </div>

            <div className="detailGrid">
              <div className="detailItem">
                <span>成品 SKU</span>
                <strong>
                  {issuePreview.sku_code} / {issuePreview.sku_name}
                </strong>
              </div>
              <div className="detailItem">
                <span>计划生产数量</span>
                <strong>{formatQuantity(issuePreview.planned_quantity)}</strong>
              </div>
              <div className="detailItem">
                <span>领料状态</span>
                <strong>
                  {materialIssueStatusLabels[issuePreview.status]}
                </strong>
              </div>
              <div className="detailItem">
                <span>异常材料数</span>
                <strong>{formatQuantity(issuePreview.shortage_count)}</strong>
              </div>
            </div>

            {issuePreview.blocking_reason ? (
              <div className="warningNotice">
                <strong>暂时不能确认领料</strong>
                <p>{issuePreview.blocking_reason}</p>
              </div>
            ) : null}

            {issuePreview.materials.length === 0 ? (
              <div className="emptyState">没有可领料的原材料清单</div>
            ) : (
              <div className="tableWrap">
                <table className="dataTable">
                  <thead>
                    <tr>
                      <th>原材料 SKU 编码</th>
                      <th>原材料名称</th>
                      <th>应领数量</th>
                      <th>当前库存</th>
                      <th>领料后库存</th>
                      <th>扣减仓库</th>
                      <th>状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {issuePreview.materials.map((material) => (
                      <tr
                        key={material.material_requirement_id}
                        className={
                          material.status === "enough" ? undefined : "shortageRow"
                        }
                      >
                        <td>{material.sku_code}</td>
                        <td>{material.sku_name}</td>
                        <td>
                          {formatQuantity(material.required_quantity)}
                          {material.unit}
                        </td>
                        <td>
                          {formatQuantity(material.current_quantity)}
                          {material.unit}
                        </td>
                        <td>
                          {material.after_issue_quantity === null
                            ? "-"
                            : `${formatQuantity(material.after_issue_quantity)}${
                                material.unit
                              }`}
                        </td>
                        <td>
                          {material.selected_warehouse_name
                            ? `${material.selected_warehouse_name} / ${
                                material.selected_warehouse_code ?? "-"
                              }`
                            : "-"}
                        </td>
                        <td>
                          <span
                            className={`tablePill issue-line-status-${material.status}`}
                          >
                            {material.status_label}
                          </span>
                          {material.reason ? (
                            <p className="tableHint">{material.reason}</p>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modalFooter">
              <p>
                系统会按上面的应领数量自动扣库存，不需要厂长手动输入数量。
              </p>
              <div className="rowActions">
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={() => setIssuePreview(null)}
                  disabled={Boolean(issuingOrderId)}
                >
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="button"
                  onClick={confirmIssueMaterials}
                  disabled={
                    Boolean(issuingOrderId) || !issuePreview.can_issue
                  }
                >
                  {issuingOrderId
                    ? "正在确认..."
                    : "确认领料并开始生产"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function ProductHeader({
  imageUrl,
  name,
  code
}: {
  imageUrl: string | null;
  name: string;
  code: string;
}) {
  return (
    <div className="productHeader">
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img className="productThumb" src={imageUrl} alt={name} />
      ) : (
        <div className="productThumb productThumbPlaceholder">图</div>
      )}
      <div>
        <strong>{name}</strong>
        <span>{code}</span>
      </div>
    </div>
  );
}
