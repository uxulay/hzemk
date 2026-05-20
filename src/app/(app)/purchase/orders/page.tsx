"use client";

import { useEffect, useMemo, useState } from "react";
import { getSuppliers, type Supplier } from "@/lib/api/master-data";
import {
  createPurchaseOrder,
  getPurchaseOrderDetail,
  getPurchaseOrders,
  getShortageMaterialRequirements,
  updatePurchaseOrderStatus,
  type PurchaseOrder,
  type PurchaseOrderStatus,
  type ShortageMaterialRequirement
} from "@/lib/api/purchase";

const purchaseStatusLabels: Record<PurchaseOrderStatus, string> = {
  draft: "草稿",
  ordered: "已下单",
  partially_received: "部分到货",
  received: "已到货",
  cancelled: "已取消"
};

type DraftItem = {
  materialRequirementId: string;
  skuId: string;
  skuCode: string;
  skuName: string;
  productionOrderNo: string;
  orderedQuantity: string;
  shortageQuantity: number;
  unit: string;
  unitPrice: string;
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

function formatMoney(value: number | null | undefined) {
  if (value === null || value === undefined) {
    return "-";
  }

  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2
  });
}

function formatDate(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleDateString("zh-CN");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "-";
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function getDraftItem(requirement: ShortageMaterialRequirement): DraftItem {
  return {
    materialRequirementId: requirement.id,
    skuId: requirement.material_sku_id,
    skuCode: requirement.material_sku?.sku_code ?? "-",
    skuName: requirement.material_sku?.sku_name ?? "-",
    productionOrderNo: requirement.production_order?.production_order_no ?? "-",
    orderedQuantity: String(Number(requirement.shortage_quantity)),
    shortageQuantity: Number(requirement.shortage_quantity),
    unit: requirement.unit,
    unitPrice: ""
  };
}

export default function PurchaseOrdersPage() {
  const [shortages, setShortages] = useState<ShortageMaterialRequirement[]>([]);
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [selectedRequirementIds, setSelectedRequirementIds] = useState<string[]>(
    []
  );
  const [draftItems, setDraftItems] = useState<DraftItem[]>([]);
  const [supplierId, setSupplierId] = useState("");
  const [expectedArrivalDate, setExpectedArrivalDate] = useState("");
  const [notes, setNotes] = useState("");
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [statusUpdatingId, setStatusUpdatingId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const selectedRequirements = useMemo(() => {
    const selectedIds = new Set(selectedRequirementIds);
    return shortages.filter((item) => selectedIds.has(item.id));
  }, [selectedRequirementIds, shortages]);

  const allShortagesSelected =
    shortages.length > 0 && selectedRequirementIds.length === shortages.length;

  const draftTotalAmount = draftItems.reduce((sum, item) => {
    const quantity = Number(item.orderedQuantity) || 0;
    const unitPrice = Number(item.unitPrice) || 0;

    return sum + quantity * unitPrice;
  }, 0);

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [shortageData, orderData, supplierData] = await Promise.all([
        getShortageMaterialRequirements(),
        getPurchaseOrders(),
        getSuppliers()
      ]);

      setShortages(shortageData);
      setPurchaseOrders(orderData);
      setSuppliers(supplierData);
      setSelectedRequirementIds((current) =>
        current.filter((id) => shortageData.some((item) => item.id === id))
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setShortages([]);
      setPurchaseOrders([]);
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const toggleRequirement = (requirementId: string) => {
    setSelectedRequirementIds((current) =>
      current.includes(requirementId)
        ? current.filter((id) => id !== requirementId)
        : [...current, requirementId]
    );
  };

  const toggleAllShortages = () => {
    setSelectedRequirementIds(
      allShortagesSelected ? [] : shortages.map((item) => item.id)
    );
  };

  const openDraftForm = (requirements: ShortageMaterialRequirement[]) => {
    if (requirements.length === 0) {
      setErrorMessage("请先选择要采购的缺料物料。");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setDraftItems(requirements.map(getDraftItem));
    setSupplierId("");
    setExpectedArrivalDate("");
    setNotes("");
  };

  const closeDraftForm = () => {
    if (submitting) {
      return;
    }

    setDraftItems([]);
  };

  const updateDraftItem = (
    materialRequirementId: string,
    field: "orderedQuantity" | "unitPrice",
    value: string
  ) => {
    setDraftItems((current) =>
      current.map((item) =>
        item.materialRequirementId === materialRequirementId
          ? { ...item, [field]: value }
          : item
      )
    );
  };

  const submitPurchaseOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createPurchaseOrder({
        supplierId,
        expectedArrivalDate,
        notes,
        items: draftItems.map((item) => ({
          skuId: item.skuId,
          materialRequirementId: item.materialRequirementId,
          orderedQuantity: Number(item.orderedQuantity),
          unit: item.unit,
          unitPrice: item.unitPrice ? Number(item.unitPrice) : null,
          notes: `来源生产任务：${item.productionOrderNo}`
        }))
      });

      setSuccessMessage(`采购单 ${created.purchase_order_no} 创建成功。`);
      setDraftItems([]);
      setSelectedRequirementIds([]);
      await loadPageData();
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  const viewDetail = async (purchaseOrderId: string) => {
    try {
      setDetailLoading(true);
      setErrorMessage("");
      setDetail(await getPurchaseOrderDetail(purchaseOrderId));
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const updateStatus = async (
    purchaseOrderId: string,
    status: PurchaseOrderStatus
  ) => {
    try {
      setStatusUpdatingId(purchaseOrderId);
      setErrorMessage("");
      setSuccessMessage("");

      await updatePurchaseOrderStatus(purchaseOrderId, status);
      setSuccessMessage(`采购单状态已更新为${purchaseStatusLabels[status]}。`);
      await loadPageData();

      if (detail?.id === purchaseOrderId) {
        setDetail(await getPurchaseOrderDetail(purchaseOrderId));
      }
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setStatusUpdatingId("");
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">采购管理</p>
          <h2>采购单</h2>
          <p>
            采购人员可以从缺料物料生成采购单，采购单明细会记录对应的物料需求，方便后续追踪。
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
            <p className="eyebrow">缺料物料</p>
            <h3>待采购清单</h3>
          </div>
          <div className="rowActions">
            <button
              type="button"
              onClick={() => openDraftForm(selectedRequirements)}
              disabled={loading || selectedRequirements.length === 0}
            >
              生成采购单
            </button>
            <button type="button" onClick={loadPageData} disabled={loading}>
              {loading ? "正在刷新..." : "刷新"}
            </button>
          </div>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取采购数据...</div>
        ) : null}

        {!loading && shortages.length === 0 ? (
          <div className="emptyState">暂无缺料物料</div>
        ) : null}

        {!loading && shortages.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>
                    <input
                      aria-label="选择全部缺料物料"
                      checked={allShortagesSelected}
                      onChange={toggleAllShortages}
                      type="checkbox"
                    />
                  </th>
                  <th>生产任务单号</th>
                  <th>成品 SKU</th>
                  <th>原材料编码</th>
                  <th>原材料名称</th>
                  <th>单位</th>
                  <th>总需求数量</th>
                  <th>当前库存数量</th>
                  <th>缺料数量</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {shortages.map((requirement) => (
                  <tr className="shortageRow" key={requirement.id}>
                    <td>
                      <input
                        aria-label={`选择${requirement.material_sku?.sku_code ?? "缺料物料"}`}
                        checked={selectedRequirementIds.includes(requirement.id)}
                        onChange={() => toggleRequirement(requirement.id)}
                        type="checkbox"
                      />
                    </td>
                    <td>
                      {requirement.production_order?.production_order_no ?? "-"}
                    </td>
                    <td>
                      <strong>
                        {requirement.production_order?.finished_sku?.sku_code ??
                          "-"}
                      </strong>
                      <span>
                        {requirement.production_order?.finished_sku?.sku_name ??
                          "-"}
                      </span>
                    </td>
                    <td>{requirement.material_sku?.sku_code ?? "-"}</td>
                    <td>{requirement.material_sku?.sku_name ?? "-"}</td>
                    <td>{requirement.unit}</td>
                    <td>{formatQuantity(requirement.required_quantity)}</td>
                    <td>{formatQuantity(requirement.available_quantity)}</td>
                    <td>{formatQuantity(requirement.shortage_quantity)}</td>
                    <td>
                      <span className="tablePill material-status-shortage">
                        缺料
                      </span>
                    </td>
                    <td>
                      <div className="rowActions">
                        <button
                          type="button"
                          onClick={() => openDraftForm([requirement])}
                        >
                          加入采购单草稿
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
            <p className="eyebrow">采购单</p>
            <h3>采购单列表</h3>
          </div>
        </div>

        {!loading && purchaseOrders.length === 0 ? (
          <div className="emptyState">暂无采购单</div>
        ) : null}

        {!loading && purchaseOrders.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>采购单号</th>
                  <th>供应商</th>
                  <th>采购负责人</th>
                  <th>状态</th>
                  <th>下单日期</th>
                  <th>预计到货日期</th>
                  <th>总金额</th>
                  <th>备注</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {purchaseOrders.map((order) => {
                  const updating = statusUpdatingId === order.id;

                  return (
                    <tr key={order.id}>
                      <td>{order.purchase_order_no}</td>
                      <td>
                        <strong>{order.supplier?.name ?? "-"}</strong>
                        <span>{order.supplier?.supplier_code ?? "-"}</span>
                      </td>
                      <td>{order.created_by_profile?.full_name ?? "-"}</td>
                      <td>
                        <span className={`tablePill purchase-status-${order.status}`}>
                          {purchaseStatusLabels[order.status] ?? order.status}
                        </span>
                      </td>
                      <td>{formatDate(order.ordered_at)}</td>
                      <td>{formatDate(order.expected_arrival_date)}</td>
                      <td>{formatMoney(order.total_amount)}</td>
                      <td className="notesCell">{order.notes ?? "-"}</td>
                      <td>{formatDateTime(order.created_at)}</td>
                      <td>
                        <div className="rowActions">
                          <button
                            type="button"
                            onClick={() => viewDetail(order.id)}
                            disabled={detailLoading}
                          >
                            查看详情
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(order.id, "ordered")}
                            disabled={
                              updating ||
                              order.status === "ordered" ||
                              order.status === "received" ||
                              order.status === "cancelled"
                            }
                          >
                            标记为已下单
                          </button>
                          <button
                            type="button"
                            onClick={() => updateStatus(order.id, "received")}
                            disabled={
                              updating ||
                              order.status === "received" ||
                              order.status === "cancelled"
                            }
                          >
                            标记为已到货
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

      {detail ? (
        <section className="detailPanel">
          <div className="detailHeader">
            <div>
              <p className="eyebrow">采购单详情</p>
              <h3>{detail.purchase_order_no}</h3>
            </div>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setDetail(null)}
            >
              收起详情
            </button>
          </div>

          <div className="detailGrid">
            <div className="detailItem">
              <span>供应商</span>
              <strong>{detail.supplier?.name ?? "-"}</strong>
            </div>
            <div className="detailItem">
              <span>状态</span>
              <strong>{purchaseStatusLabels[detail.status] ?? detail.status}</strong>
            </div>
            <div className="detailItem">
              <span>总金额</span>
              <strong>{formatMoney(detail.total_amount)}</strong>
            </div>
            <div className="detailItem detailItemWide">
              <span>备注</span>
              <strong>{detail.notes ?? "-"}</strong>
            </div>
          </div>

          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>原材料 SKU</th>
                  <th>原材料名称</th>
                  <th>采购数量</th>
                  <th>已到货数量</th>
                  <th>单位</th>
                  <th>单价</th>
                  <th>小计</th>
                  <th>关联物料需求</th>
                  <th>来源生产任务</th>
                </tr>
              </thead>
              <tbody>
                {detail.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.sku?.sku_code ?? "-"}</td>
                    <td>{item.sku?.sku_name ?? "-"}</td>
                    <td>{formatQuantity(item.ordered_quantity)}</td>
                    <td>{formatQuantity(item.received_quantity)}</td>
                    <td>{item.unit}</td>
                    <td>{formatMoney(item.unit_price)}</td>
                    <td>
                      {formatMoney(
                        Number(item.ordered_quantity) * Number(item.unit_price ?? 0)
                      )}
                    </td>
                    <td>{item.material_requirement_id ?? "-"}</td>
                    <td>
                      {item.material_requirement?.production_order
                        ?.production_order_no ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {draftItems.length > 0 ? (
        <div className="modalBackdrop" role="presentation">
          <form className="modalPanel" onSubmit={submitPurchaseOrder}>
            <div className="detailHeader">
              <div>
                <p className="eyebrow">创建采购单</p>
                <h3>采购单草稿</h3>
              </div>
              <button
                className="secondaryButton"
                type="button"
                onClick={closeDraftForm}
                disabled={submitting}
              >
                关闭
              </button>
            </div>

            <div className="dataForm purchaseForm">
              <label>
                供应商
                <select
                  value={supplierId}
                  onChange={(event) => setSupplierId(event.target.value)}
                  disabled={submitting}
                  required
                >
                  <option value="">请选择供应商</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.supplier_code} / {supplier.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                预计到货日期
                <input
                  type="date"
                  value={expectedArrivalDate}
                  onChange={(event) => setExpectedArrivalDate(event.target.value)}
                  disabled={submitting}
                />
              </label>

              <label className="fullField">
                备注
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  disabled={submitting}
                  placeholder="可填写采购说明"
                />
              </label>
            </div>

            <div className="tableWrap">
              <table className="dataTable">
                <thead>
                  <tr>
                    <th>原材料 SKU</th>
                    <th>原材料名称</th>
                    <th>采购数量</th>
                    <th>单位</th>
                    <th>单价</th>
                    <th>小计</th>
                    <th>关联物料需求</th>
                  </tr>
                </thead>
                <tbody>
                  {draftItems.map((item) => {
                    const subtotal =
                      (Number(item.orderedQuantity) || 0) *
                      (Number(item.unitPrice) || 0);

                    return (
                      <tr key={item.materialRequirementId}>
                        <td>
                          <strong>{item.skuCode}</strong>
                          <span>{item.productionOrderNo}</span>
                        </td>
                        <td>{item.skuName}</td>
                        <td>
                          <input
                            className="tableInput"
                            min="0.0001"
                            step="0.0001"
                            type="number"
                            value={item.orderedQuantity}
                            onChange={(event) =>
                              updateDraftItem(
                                item.materialRequirementId,
                                "orderedQuantity",
                                event.target.value
                              )
                            }
                            disabled={submitting}
                            required
                          />
                          <span>默认缺料 {formatQuantity(item.shortageQuantity)}</span>
                        </td>
                        <td>{item.unit}</td>
                        <td>
                          <input
                            className="tableInput"
                            min="0"
                            step="0.0001"
                            type="number"
                            value={item.unitPrice}
                            onChange={(event) =>
                              updateDraftItem(
                                item.materialRequirementId,
                                "unitPrice",
                                event.target.value
                              )
                            }
                            disabled={submitting}
                            placeholder="可为空"
                          />
                        </td>
                        <td>{formatMoney(subtotal)}</td>
                        <td>{item.materialRequirementId}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="modalFooter">
              <strong>合计：{formatMoney(draftTotalAmount)}</strong>
              <div className="rowActions">
                <button
                  className="secondaryButton"
                  type="button"
                  onClick={closeDraftForm}
                  disabled={submitting}
                >
                  取消
                </button>
                <button
                  className="primaryButton"
                  type="submit"
                  disabled={submitting}
                >
                  {submitting ? "正在创建..." : "提交采购单"}
                </button>
              </div>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
