"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
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

type ProductionFormState = {
  plannedQuantity: string;
  plannedStartDate: string;
  plannedEndDate: string;
  assignedTo: string;
  notes: string;
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
    plannedQuantity: String(Number(request.requested_quantity)),
    plannedStartDate: "",
    plannedEndDate: request.target_ship_date ?? "",
    assignedTo: "",
    notes: ""
  };
}

export default function ProductionPlanningPage() {
  const [requests, setRequests] = useState<PlanningFbaReplenishmentRequest[]>(
    []
  );
  const [assignees, setAssignees] = useState<ProductionProfile[]>([]);
  const [selectedRequest, setSelectedRequest] =
    useState<PlanningFbaReplenishmentRequest | null>(null);
  const [form, setForm] = useState<ProductionFormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actingRequestId, setActingRequestId] = useState("");
  const [submittingProduction, setSubmittingProduction] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const activeAssignees = useMemo(
    () => assignees.filter((assignee) => assignee.status === "active"),
    [assignees]
  );

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

  const updateForm = (field: keyof ProductionFormState, value: string) => {
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

  const validateForm = () => {
    if (!selectedRequest || !form) {
      return "请先选择一个 FBA 备货需求。";
    }

    if (!selectedRequest.sku_id) {
      return "当前备货需求缺少 SKU，不能创建生产任务。";
    }

    const quantity = Number(form.plannedQuantity);
    if (!Number.isFinite(quantity) || quantity <= 0) {
      return "计划生产数量必须大于 0。";
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
        skuId: selectedRequest.sku_id,
        plannedQuantity: Number(form.plannedQuantity),
        plannedStartDate: form.plannedStartDate,
        plannedEndDate: form.plannedEndDate,
        assignedTo: form.assignedTo,
        notes: form.notes
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

        {errorMessage ? (
          <div className="debugError">
            <strong>操作失败</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {!loading && !errorMessage && requests.length === 0 ? (
          <div className="emptyState">暂无待排产 FBA 备货需求</div>
        ) : null}

        {!loading && requests.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>备货单号</th>
                  <th>产品名称</th>
                  <th>SKU 编码</th>
                  <th>SKU 名称</th>
                  <th>亚马逊站点</th>
                  <th>目标 FBA 仓库</th>
                  <th>备货数量</th>
                  <th>期望完成日期</th>
                  <th>优先级</th>
                  <th>状态</th>
                  <th>备注</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => {
                  const notes = parseNotes(request.notes);
                  const isActing = actingRequestId === request.id;

                  return (
                    <tr key={request.id}>
                      <td>{request.request_no}</td>
                      <td>{request.sku?.product?.name ?? "-"}</td>
                      <td>{request.sku?.sku_code ?? "-"}</td>
                      <td>{request.sku?.sku_name ?? "-"}</td>
                      <td>{notes.amazonSite}</td>
                      <td>
                        <strong>{request.target_warehouse?.name ?? "-"}</strong>
                        <span>{request.fba_warehouse_code ?? "-"}</span>
                      </td>
                      <td>{formatQuantity(request.requested_quantity)}</td>
                      <td>{formatDate(request.target_ship_date)}</td>
                      <td>{priorityLabels[request.priority] ?? request.priority}</td>
                      <td>
                        <span className={`tablePill status-${request.status}`}>
                          {statusLabels[request.status] ?? request.status}
                        </span>
                      </td>
                      <td className="notesCell">{notes.displayNotes}</td>
                      <td>{formatDateTime(request.created_at)}</td>
                      <td>
                        <div className="rowActions">
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
      </section>

      {selectedRequest && form ? (
        <section className="formPanel">
          <div className="sectionHeader">
            <div>
              <p className="eyebrow">生产任务</p>
              <h3>创建生产任务</h3>
            </div>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => {
                setSelectedRequest(null);
                setForm(null);
              }}
              disabled={submittingProduction}
            >
              关闭
            </button>
          </div>

          <form className="dataForm" onSubmit={handleCreateProductionOrder}>
            <ReadonlyField
              label="关联的 FBA 备货需求"
              value={selectedRequest.request_no}
            />
            <ReadonlyField
              label="产品"
              value={selectedRequest.sku?.product?.name ?? "-"}
            />
            <ReadonlyField
              label="SKU"
              value={`${selectedRequest.sku?.sku_code ?? "-"} / ${
                selectedRequest.sku?.sku_name ?? "-"
              }`}
            />

            <label>
              计划生产数量
              <input
                min="1"
                step="1"
                type="number"
                value={form.plannedQuantity}
                onChange={(event) =>
                  updateForm("plannedQuantity", event.target.value)
                }
                disabled={submittingProduction}
              />
            </label>

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
        </section>
      ) : null}
    </main>
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
