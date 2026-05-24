"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  acceptFbaReplenishmentRequest,
  createProductionOrder,
  getProductionAssignees,
  getProductionPlanningRequests,
  rejectFbaReplenishmentRequest,
  type PlanningFbaReplenishmentRequest,
  type PlanningRequestStatus,
  type ProductionProfile
} from "@/lib/api/production";
import { getBrandCodeName } from "@/lib/brand-utils";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

type ProductionFormState = {
  plannedStartDate: string;
  plannedEndDate: string;
  assignedTo: string;
  notes: string;
  itemQuantities: Record<string, string>;
  itemRemarks: Record<string, string>;
};

const statusLabels: Record<PlanningRequestStatus, string> = {
  submitted: "已提交",
  accepted: "已接单",
  rejected: "已拒绝",
  in_production: "生产中"
};

const priorityLabels: Record<string, string> = {
  low: "低",
  normal: "普通",
  high: "高",
  urgent: "紧急"
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "操作失败，请稍后重试。";
}

function formatDate(value: string | null) {
  return value || "-";
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("zh-CN", { hour12: false });
}

function formatQuantity(value: number) {
  return Number(value).toLocaleString("zh-CN", {
    maximumFractionDigits: 4
  });
}

function parseNotes(notes: string | null) {
  if (!notes?.trim()) {
    return {
      amazonSite: "-",
      displayNotes: "-"
    };
  }

  const lines = notes
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const noteLines: string[] = [];
  let amazonSite = "-";

  for (const line of lines) {
    const siteMatch = line.match(/^亚马逊站点[:：]\s*(.+)$/);
    const noteMatch = line.match(/^备注[:：]\s*(.*)$/);

    if (siteMatch) {
      amazonSite = siteMatch[1];
      continue;
    }

    if (noteMatch) {
      if (noteMatch[1]) {
        noteLines.push(noteMatch[1]);
      }
      continue;
    }

    noteLines.push(line);
  }

  return {
    amazonSite,
    displayNotes: noteLines.join("\n") || "-"
  };
}

function buildInitialProductionForm(
  request: PlanningFbaReplenishmentRequest
): ProductionFormState {
  return {
    plannedStartDate: "",
    plannedEndDate: request.target_ship_date ?? "",
    assignedTo: "",
    notes: "",
    itemQuantities: Object.fromEntries(
      request.items.map((item) => [
        item.id,
        String(Number(item.requested_quantity))
      ])
    ),
    itemRemarks: Object.fromEntries(request.items.map((item) => [item.id, ""]))
  };
}

function isPositiveIntegerText(value: string) {
  return /^[1-9]\d*$/.test(value.trim());
}

function groupRequestItemsByProduct(request: PlanningFbaReplenishmentRequest) {
  const groups = new Map<
    string,
    {
      productName: string;
      productCode: string;
      brandLabel: string;
      brandId: string | null;
      imageUrl: string | null;
      items: PlanningFbaReplenishmentRequest["items"];
    }
  >();

  for (const item of request.items) {
    const product = item.product ?? item.sku?.product ?? null;
    const key = product?.id ?? item.product_id ?? "unknown";
    const current = groups.get(key);

    if (current) {
      current.items.push(item);
      continue;
    }

    groups.set(key, {
      productName: product?.name ?? "未关联产品",
      productCode: product?.product_code ?? "-",
      brandLabel: getBrandCodeName(product?.brand),
      brandId: product?.brand?.id ?? null,
      imageUrl: product?.product_image_url ?? null,
      items: [item]
    });
  }

  return [...groups.values()];
}

function getPlanningRequestBrandSummary(request: PlanningFbaReplenishmentRequest) {
  const brandLabels = new Set(
    request.items
      .map((item) => item.product ?? item.sku?.product ?? null)
      .map((product) => getBrandCodeName(product?.brand))
  );
  const labels = [...brandLabels];

  if (labels.length === 0) {
    return "无品牌";
  }

  if (labels.length <= 2) {
    return labels.join("、");
  }

  return `${labels[0]} 等 ${labels.length} 个品牌`;
}

export default function ProductionPlanningPage() {
  const [requests, setRequests] = useState<PlanningFbaReplenishmentRequest[]>(
    []
  );
  const [assignees, setAssignees] = useState<ProductionProfile[]>([]);
  const [brandFilter, setBrandFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] =
    useState<PlanningFbaReplenishmentRequest | null>(null);
  const [detailRequest, setDetailRequest] =
    useState<PlanningFbaReplenishmentRequest | null>(null);
  const [form, setForm] = useState<ProductionFormState | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actingRequestId, setActingRequestId] = useState("");
  const [submittingProduction, setSubmittingProduction] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const activeAssignees = useMemo(
    () => assignees.filter((assignee) => assignee.status === "active"),
    [assignees]
  );
  const brandOptions = useMemo(() => {
    const brandById = new Map<
      string,
      NonNullable<
        NonNullable<PlanningFbaReplenishmentRequest["items"][number]["product"]>["brand"]
      >
    >();

    requests.forEach((request) => {
      request.items.forEach((item) => {
        const product = item.product ?? item.sku?.product ?? null;

        if (product?.brand) {
          brandById.set(product.brand.id, product.brand);
        }
      });
    });

    return [...brandById.values()].sort((first, second) =>
      first.brand_code.localeCompare(second.brand_code, "zh-CN")
    );
  }, [requests]);
  const filteredRequests = useMemo(() => {
    if (brandFilter === "all") {
      return requests;
    }

    return requests.filter((request) =>
      request.items.some((item) => {
        const product = item.product ?? item.sku?.product ?? null;

        return brandFilter === "none"
          ? !product?.brand?.id
          : product?.brand?.id === brandFilter;
      })
    );
  }, [brandFilter, requests]);
  const paginatedRequests = useMemo(
    () => paginateItems(filteredRequests, page),
    [filteredRequests, page]
  );

  useEffect(() => {
    setPage(1);
  }, [brandFilter, requests.length]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [requestData, assigneeData] = await Promise.all([
        getProductionPlanningRequests(),
        getProductionAssignees()
      ]);

      setRequests(requestData);
      setAssignees(assigneeData);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequests([]);
      setAssignees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPageData();
  }, []);

  const handleAccept = async (requestId: string) => {
    try {
      setActingRequestId(requestId);
      setErrorMessage("");
      setSuccessMessage("");

      await acceptFbaReplenishmentRequest(requestId);
      await loadPageData();
      setSuccessMessage("接单成功，状态已更新为已接单。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActingRequestId("");
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      setActingRequestId(requestId);
      setErrorMessage("");
      setSuccessMessage("");
      setSelectedRequest(null);
      setForm(null);

      await rejectFbaReplenishmentRequest(requestId);
      await loadPageData();
      setSuccessMessage("拒绝成功，当前需求已从待排产列表移出。");
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setActingRequestId("");
    }
  };

  const openProductionForm = (request: PlanningFbaReplenishmentRequest) => {
    setSelectedRequest(request);
    setForm(buildInitialProductionForm(request));
    setErrorMessage("");
    setSuccessMessage("");
  };

  const updateForm = (
    field: "plannedStartDate" | "plannedEndDate" | "assignedTo" | "notes",
    value: string
  ) => {
    setForm((current) =>
      current
        ? {
            ...current,
            [field]: value
          }
        : current
    );
    setErrorMessage("");
    setSuccessMessage("");
  };

  const updateItemForm = (
    itemId: string,
    field: "itemQuantities" | "itemRemarks",
    value: string
  ) => {
    setForm((current) =>
      current
        ? {
            ...current,
            [field]: {
              ...current[field],
              [itemId]: value
            }
          }
        : current
    );
    setErrorMessage("");
    setSuccessMessage("");
  };

  const validateForm = () => {
    if (!selectedRequest || !form) {
      return "请先选择一个 FBA 备货需求。";
    }

    if (selectedRequest.items.length === 0) {
      return "当前备货单没有 SKU 明细，不能创建生产任务。";
    }

    const invalidItem = selectedRequest.items.find(
      (item) => !isPositiveIntegerText(form.itemQuantities[item.id] ?? "")
    );

    if (invalidItem) {
      return "每个 SKU 的计划生产数量都必须是正整数。";
    }

    if (
      form.plannedStartDate &&
      form.plannedEndDate &&
      form.plannedStartDate > form.plannedEndDate
    ) {
      return "预计完成日期不能早于计划开始日期。";
    }

    return "";
  };

  const handleCreateProductionOrder = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const validationMessage = validateForm();
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    if (!selectedRequest || !form) {
      return;
    }

    try {
      setSubmittingProduction(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created = await createProductionOrder({
        replenishmentRequestId: selectedRequest.id,
        plannedStartDate: form.plannedStartDate,
        plannedEndDate: form.plannedEndDate,
        assignedTo: form.assignedTo,
        notes: form.notes,
        items: selectedRequest.items.map((item) => ({
          replenishmentRequestItemId: item.id.includes("-legacy-item")
            ? null
            : item.id,
          skuId: item.sku_id,
          requestedQuantity: Number(item.requested_quantity),
          plannedQuantity: Number(form.itemQuantities[item.id]),
          remark: form.itemRemarks[item.id] ?? null
        }))
      });

      setSelectedRequest(null);
      setForm(null);
      await loadPageData();
      setSuccessMessage(
        `生产任务已创建，物料需求已生成：${created.production_order_no}（${created.material_requirement_count} 条）`
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
    } finally {
      setSubmittingProduction(false);
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">厂长排产</p>
          <h2>厂长排产页面</h2>
          <p>
            查看运营提交的 FBA 备货需求，完成接单、拒绝，或创建生产任务。
            当前阶段先显示所有已提交和已接单的需求。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">待排产</p>
            <h3>FBA 备货需求列表</h3>
          </div>
          <button
            className="secondaryButton"
            type="button"
            onClick={loadPageData}
            disabled={loading || Boolean(actingRequestId)}
          >
            {loading ? "正在刷新..." : "刷新列表"}
          </button>
        </div>

        {successMessage ? (
          <div className="successNotice">
            <strong>操作成功</strong>
            <p>{successMessage}</p>
          </div>
        ) : null}

        {loading ? (
          <div className="debugNotice">正在读取待排产 FBA 备货需求...</div>
        ) : null}

        <div className="listToolbar">
          <label>
            品牌
            <select
              value={brandFilter}
              onChange={(event) => setBrandFilter(event.target.value)}
              disabled={loading}
            >
              <option value="all">全部品牌</option>
              <option value="none">无品牌</option>
              {brandOptions.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {getBrandCodeName(brand)}
                </option>
              ))}
            </select>
          </label>
        </div>

        {errorMessage ? (
          <div className="debugError">
            <strong>操作失败</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {!loading && !errorMessage && filteredRequests.length === 0 ? (
          <div className="emptyState">暂无待排产 FBA 备货需求</div>
        ) : null}

        {!loading && filteredRequests.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>备货单号</th>
                  <th>亚马逊站点</th>
                  <th>目标 FBA 仓库</th>
                  <th>产品数量</th>
                  <th>品牌</th>
                  <th>SKU 数量</th>
                  <th>总数量</th>
                  <th>期望完成日期</th>
                  <th>优先级</th>
                  <th>状态</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((request) => {
                  const notes = parseNotes(request.notes);
                  const isActing = actingRequestId === request.id;

                  return (
                    <tr key={request.id}>
                      <td>{request.request_no}</td>
                      <td>{notes.amazonSite}</td>
                      <td>
                        <strong>{request.target_warehouse?.name ?? "-"}</strong>
                        <span>{request.fba_warehouse_code ?? "-"}</span>
                      </td>
                      <td>{request.product_count}</td>
                      <td>{getPlanningRequestBrandSummary(request)}</td>
                      <td>{request.sku_count}</td>
                      <td>{formatQuantity(request.total_requested_quantity)}</td>
                      <td>{formatDate(request.target_ship_date)}</td>
                      <td>{priorityLabels[request.priority] ?? request.priority}</td>
                      <td>
                        <span className={`tablePill status-${request.status}`}>
                          {statusLabels[request.status] ?? request.status}
                        </span>
                      </td>
                      <td>{formatDateTime(request.created_at)}</td>
                      <td>
                        <div className="rowActions">
                          <button
                            type="button"
                            onClick={() => setDetailRequest(request)}
                            disabled={loading || isActing}
                          >
                            查看明细
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAccept(request.id)}
                            disabled={
                              loading ||
                              isActing ||
                              request.status !== "submitted"
                            }
                          >
                            {isActing ? "处理中..." : "接单"}
                          </button>
                          <button
                            className="dangerButton"
                            type="button"
                            onClick={() => handleReject(request.id)}
                            disabled={loading || isActing}
                          >
                            拒绝
                          </button>
                          <button
                            type="button"
                            onClick={() => openProductionForm(request)}
                            disabled={loading || isActing}
                          >
                            创建生产任务
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

        {!loading && filteredRequests.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={filteredRequests.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {selectedRequest && form ? (
        <Modal
          open={Boolean(selectedRequest && form)}
          eyebrow="生产任务"
          title="创建生产任务"
          maxWidth="xl"
          onClose={() => {
            if (!submittingProduction) {
              setSelectedRequest(null);
              setForm(null);
            }
          }}
        >

          <form className="dataForm" onSubmit={handleCreateProductionOrder}>
            <ReadonlyField
              label="关联的 FBA 备货需求"
              value={selectedRequest.request_no}
            />
            <ReadonlyField
              label="总运营需求"
              value={formatQuantity(selectedRequest.total_requested_quantity)}
            />

            <label>
              计划开始日期
              <input
                type="date"
                value={form.plannedStartDate}
                onChange={(event) =>
                  updateForm("plannedStartDate", event.target.value)
                }
                disabled={submittingProduction}
              />
            </label>

            <label>
              预计完成日期
              <input
                type="date"
                value={form.plannedEndDate}
                onChange={(event) =>
                  updateForm("plannedEndDate", event.target.value)
                }
                disabled={submittingProduction}
              />
            </label>

            <label>
              生产负责人
              <select
                value={form.assignedTo}
                onChange={(event) => updateForm("assignedTo", event.target.value)}
                disabled={submittingProduction}
              >
                <option value="">暂不指定负责人</option>
                {activeAssignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.full_name} / {assignee.email}
                  </option>
                ))}
              </select>
            </label>

            <label className="fullField">
              备注
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="例如：优先安排本周生产，完成后转入 FBA 发货暂存仓。"
                disabled={submittingProduction}
              />
            </label>

            <div className="fullField groupList">
              {groupRequestItemsByProduct(selectedRequest).map((group) => (
                <section className="productGroup" key={group.productCode}>
                  <ProductHeader
                    imageUrl={group.imageUrl}
                    name={group.productName}
                    code={group.productCode}
                    brandLabel={group.brandLabel}
                  />
                  <div className="tableWrap compactTableWrap">
                    <table className="dataTable compactDataTable">
                      <thead>
                        <tr>
                          <th>SKU 编码</th>
                          <th>SKU 名称 / 米数</th>
                          <th>运营需求数量</th>
                          <th>计划生产数量</th>
                          <th>备注</th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.sku?.sku_code ?? "-"}</td>
                            <td>
                              <strong>{item.sku?.sku_name ?? "-"}</strong>
                              <span>{item.sku?.specs ?? "-"}</span>
                            </td>
                            <td>{formatQuantity(item.requested_quantity)}</td>
                            <td>
                              <input
                                min="1"
                                step="1"
                                type="number"
                                value={form.itemQuantities[item.id] ?? ""}
                                onChange={(event) =>
                                  updateItemForm(
                                    item.id,
                                    "itemQuantities",
                                    event.target.value
                                  )
                                }
                                disabled={submittingProduction}
                              />
                            </td>
                            <td>
                              <input
                                value={form.itemRemarks[item.id] ?? ""}
                                onChange={(event) =>
                                  updateItemForm(
                                    item.id,
                                    "itemRemarks",
                                    event.target.value
                                  )
                                }
                                disabled={submittingProduction}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>

            <div className="formActions">
              <button
                className="primaryButton"
                type="submit"
                disabled={submittingProduction}
              >
                {submittingProduction ? "正在创建..." : "提交生产任务"}
              </button>
            </div>
          </form>
        </Modal>
      ) : null}

      {detailRequest ? (
        <Modal
          open={Boolean(detailRequest)}
          eyebrow="备货单明细"
          title={detailRequest.request_no}
          maxWidth="xl"
          onClose={() => setDetailRequest(null)}
        >
          <div className="detailGrid">
            <ReadonlyField
              label="亚马逊站点"
              value={parseNotes(detailRequest.notes).amazonSite}
            />
            <ReadonlyField
              label="目标仓库"
              value={`${detailRequest.target_warehouse?.name ?? "-"} / ${
                detailRequest.fba_warehouse_code ?? "-"
              }`}
            />
            <ReadonlyField
              label="产品数量"
              value={String(detailRequest.product_count)}
            />
            <ReadonlyField
              label="SKU 数量"
              value={String(detailRequest.sku_count)}
            />
            <ReadonlyField
              label="总数量"
              value={formatQuantity(detailRequest.total_requested_quantity)}
            />
            <ReadonlyField
              label="期望完成日期"
              value={formatDate(detailRequest.target_ship_date)}
            />
          </div>

          <div className="groupList">
            {groupRequestItemsByProduct(detailRequest).map((group) => (
              <section className="productGroup" key={group.productCode}>
                <ProductHeader
                  imageUrl={group.imageUrl}
                  name={group.productName}
                  code={group.productCode}
                  brandLabel={group.brandLabel}
                />
                <div className="tableWrap compactTableWrap">
                  <table className="dataTable compactDataTable">
                    <thead>
                      <tr>
                        <th>SKU 编码</th>
                        <th>SKU 名称 / 米数</th>
                        <th>备货数量</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item) => (
                        <tr key={item.id}>
                          <td>{item.sku?.sku_code ?? "-"}</td>
                          <td>
                            <strong>{item.sku?.sku_name ?? "-"}</strong>
                            <span>{item.sku?.specs ?? "-"}</span>
                          </td>
                          <td>{formatQuantity(item.requested_quantity)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        </Modal>
      ) : null}
    </main>
  );
}

function ProductHeader({
  imageUrl,
  name,
  code,
  brandLabel
}: {
  imageUrl: string | null;
  name: string;
  code: string;
  brandLabel?: string;
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
        {brandLabel ? <span>{brandLabel}</span> : null}
      </div>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="readonlyField">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
