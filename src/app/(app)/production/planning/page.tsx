"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { DrawerForm } from "@/components/ui/DrawerForm";
import { EllipsisText } from "@/components/ui/ellipsis-text";
import { InfoCell } from "@/components/ui/info-cell";
import { PageHeader } from "@/components/ui/PageHeader";
import { RowActions } from "@/components/ui/row-actions";
import { SearchFilterBar } from "@/components/ui/SearchFilterBar";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { DownloadIcon, PlusIcon } from "@/components/ui/icons";
import {
  acceptFbaReplenishmentRequest,
  createMergedProductionOrder,
  createProductionOrder,
  getProductionPlanningMaterialPreviews,
  getProductionAssignees,
  getProductionPlanningPage,
  rejectFbaReplenishmentRequest,
  type PlanningFbaReplenishmentRequest,
  type PlanningRequestStatus,
  type ProductionPlanningMaterialPreview,
  type ProductionProfile
} from "@/lib/api/production";
import { getBrandCodeName } from "@/lib/brand-utils";
import { downloadCsvTemplate } from "@/lib/utils/csv";
import { DEFAULT_PAGE_SIZE } from "@/lib/utils/pagination";

type ProductionFormState = {
  plannedStartDate: string;
  plannedEndDate: string;
  assignedTo: string;
  priority: "high" | "medium" | "low";
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

const productionPriorityLabels: Record<ProductionFormState["priority"], string> = {
  high: "高",
  medium: "中",
  low: "低"
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

function estimateCompletionDate(startDate: string, hours: number) {
  if (!startDate || hours <= 0) {
    return "-";
  }

  const date = new Date(`${startDate}T00:00:00`);
  date.setDate(date.getDate() + Math.max(1, Math.ceil(hours / 8)) - 1);

  return date.toISOString().slice(0, 10);
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
    priority: request.priority === "urgent" || request.priority === "high" ? "high" : "medium",
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

function buildInitialMergedProductionForm(
  requests: PlanningFbaReplenishmentRequest[]
): ProductionFormState {
  const targetDates = requests
    .map((request) => request.target_ship_date)
    .filter((date): date is string => Boolean(date))
    .sort();
  const hasHighPriority = requests.some(
    (request) => request.priority === "urgent" || request.priority === "high"
  );

  return {
    plannedStartDate: "",
    plannedEndDate: targetDates[0] ?? "",
    assignedTo: "",
    priority: hasHighPriority ? "high" : "medium",
    notes: "",
    itemQuantities: Object.fromEntries(
      requests.flatMap((request) =>
        request.items.map((item) => [
          item.id,
          String(Number(item.requested_quantity))
        ])
      )
    ),
    itemRemarks: Object.fromEntries(
      requests.flatMap((request) => request.items.map((item) => [item.id, ""]))
    )
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
  const [statusFilter, setStatusFilter] = useState<PlanningRequestStatus | "all">(
    "all"
  );
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [shortageFilter, setShortageFilter] = useState("all");
  const [targetShipDateStart, setTargetShipDateStart] = useState("");
  const [targetShipDateEnd, setTargetShipDateEnd] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [selectedRequest, setSelectedRequest] =
    useState<PlanningFbaReplenishmentRequest | null>(null);
  const [productionFormRequests, setProductionFormRequests] = useState<
    PlanningFbaReplenishmentRequest[]
  >([]);
  const [detailRequest, setDetailRequest] =
    useState<PlanningFbaReplenishmentRequest | null>(null);
  const [form, setForm] = useState<ProductionFormState | null>(null);
  const [materialPreviews, setMaterialPreviews] = useState<
    Record<string, ProductionPlanningMaterialPreview>
  >({});
  const [page, setPage] = useState(1);
  const [totalRequests, setTotalRequests] = useState(0);
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
  useEffect(() => {
    setPage(1);
  }, [
    brandFilter,
    keyword,
    priorityFilter,
    shortageFilter,
    statusFilter,
    targetShipDateStart,
    targetShipDateEnd
  ]);

  const loadPageData = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [requestData, assigneeData] = await Promise.all([
        getProductionPlanningPage({
          page,
          pageSize: DEFAULT_PAGE_SIZE,
          keyword,
          filters: {
            brandId: brandFilter,
            priority: priorityFilter,
            status: statusFilter,
            targetShipDateStart,
            targetShipDateEnd
          }
        }),
        getProductionAssignees()
      ]);
      const previewData = await getProductionPlanningMaterialPreviews(
        requestData.rows
      );

      setRequests(requestData.rows);
      setTotalRequests(requestData.total);
      setAssignees(assigneeData);
      setMaterialPreviews(previewData);
      setSelectedRequestIds((current) =>
        current.filter((id) => requestData.rows.some((request) => request.id === id))
      );
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequests([]);
      setTotalRequests(0);
      setAssignees([]);
      setMaterialPreviews({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadPageData();
    }, 300);

    return () => clearTimeout(timer);
  }, [
    page,
    brandFilter,
    keyword,
    priorityFilter,
    statusFilter,
    targetShipDateStart,
    targetShipDateEnd
  ]);

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
      setProductionFormRequests([]);
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
    setProductionFormRequests([request]);
    setSelectedRequestIds([request.id]);
    setForm(buildInitialProductionForm(request));
    setErrorMessage("");
    setSuccessMessage("");
  };

  const openMergedProductionForm = (
    sourceRequests: PlanningFbaReplenishmentRequest[]
  ) => {
    if (sourceRequests.length === 0) {
      setErrorMessage("请先勾选要排产的备货单。");
      return;
    }

    setSelectedRequest(sourceRequests[0]);
    setProductionFormRequests(sourceRequests);
    setSelectedRequestIds(sourceRequests.map((request) => request.id));
    setForm(buildInitialMergedProductionForm(sourceRequests));
    setErrorMessage("");
    setSuccessMessage("");
  };

  const updateForm = (
    field:
      | "plannedStartDate"
      | "plannedEndDate"
      | "assignedTo"
      | "priority"
      | "notes",
    value: string
  ) => {
    setForm((current) =>
      current
        ? {
            ...current,
            [field]:
              field === "priority"
                ? (value as ProductionFormState["priority"])
                : value
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
    if (productionFormRequests.length === 0 || !form) {
      return "请先选择要排产的备货单。";
    }

    if (!form.plannedStartDate) {
      return "计划开始日期必填。";
    }

    if (!form.assignedTo) {
      return "负责人必填。";
    }

    const allItems = productionFormRequests.flatMap((request) => request.items);

    if (allItems.length === 0) {
      return "所选备货单没有 SKU 明细，不能创建生产任务。";
    }

    const invalidItem = allItems.find(
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

    if (productionFormRequests.length === 0 || !form) {
      return;
    }

    try {
      setSubmittingProduction(true);
      setErrorMessage("");
      setSuccessMessage("");

      const created =
        productionFormRequests.length === 1
          ? await createProductionOrder({
              replenishmentRequestId: productionFormRequests[0].id,
              plannedStartDate: form.plannedStartDate,
              plannedEndDate: form.plannedEndDate,
              assignedTo: form.assignedTo,
              notes: form.notes,
              items: productionFormRequests[0].items.map((item) => ({
                replenishmentRequestItemId: item.id.includes("-legacy-item")
                  ? null
                  : item.id,
                skuId: item.sku_id,
                requestedQuantity: Number(item.requested_quantity),
                plannedQuantity: Number(form.itemQuantities[item.id]),
                remark: form.itemRemarks[item.id] ?? null
              }))
            })
          : await createMergedProductionOrder({
              replenishmentRequestIds: productionFormRequests.map(
                (request) => request.id
              ),
              plannedStartDate: form.plannedStartDate,
              plannedEndDate: form.plannedEndDate,
              assignedTo: form.assignedTo,
              priority: productionPriorityLabels[form.priority],
              notes: form.notes,
              items: productionFormRequests.flatMap((request) =>
                request.items.map((item) => ({
                  replenishmentRequestId: request.id,
                  replenishmentRequestNo: request.request_no,
                  replenishmentRequestItemId: item.id.includes("-legacy-item")
                    ? null
                    : item.id,
                  skuId: item.sku_id,
                  requestedQuantity: Number(item.requested_quantity),
                  plannedQuantity: Number(form.itemQuantities[item.id]),
                  remark: form.itemRemarks[item.id] ?? null
                }))
              )
            });

      setSelectedRequest(null);
      setProductionFormRequests([]);
      setForm(null);
      setSelectedRequestIds([]);
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

  const visibleRequests = useMemo(() => {
    if (shortageFilter === "all") {
      return requests;
    }

    return requests.filter((request) => {
      const preview = materialPreviews[request.id];

      return shortageFilter === "ready"
        ? preview?.status === "ready"
        : preview?.status === "shortage";
    });
  }, [materialPreviews, requests, shortageFilter]);
  const selectedRequests = useMemo(
    () =>
      selectedRequestIds
        .map((id) => requests.find((request) => request.id === id))
        .filter(
          (request): request is PlanningFbaReplenishmentRequest =>
            Boolean(request)
        ),
    [requests, selectedRequestIds]
  );
  const selectedItemRows = useMemo(
    () =>
      selectedRequests.flatMap((request) =>
        request.items.map((item) => ({
          request,
          item
        }))
      ),
    [selectedRequests]
  );
  const selectedSkuCount = useMemo(
    () => new Set(selectedItemRows.map((row) => row.item.sku_id)).size,
    [selectedItemRows]
  );
  const selectedQuantity = useMemo(
    () =>
      selectedRequests.reduce(
        (sum, request) => sum + request.total_requested_quantity,
        0
      ),
    [selectedRequests]
  );
  const selectedPreviewLines = useMemo(
    () =>
      selectedRequests.flatMap(
        (request) => materialPreviews[request.id]?.shortageLines ?? []
      ),
    [materialPreviews, selectedRequests]
  );
  const selectedShortageSkuCount = useMemo(
    () =>
      selectedRequests.reduce(
        (sum, request) =>
          sum + (materialPreviews[request.id]?.shortageSkuCount ?? 0),
        0
      ),
    [materialPreviews, selectedRequests]
  );
  const selectedReadySkuCount = Math.max(0, selectedSkuCount - selectedShortageSkuCount);
  const estimatedHours = selectedQuantity > 0 ? Math.ceil(selectedQuantity / 160) : 0;
  const priorityDistribution = useMemo(
    () => ({
      high: selectedRequests.filter(
        (request) => request.priority === "urgent" || request.priority === "high"
      ).length,
      medium: selectedRequests.filter((request) => request.priority === "normal")
        .length,
      low: selectedRequests.filter((request) => request.priority === "low").length
    }),
    [selectedRequests]
  );
  const allVisibleSelected =
    visibleRequests.length > 0 &&
    visibleRequests.every((request) => selectedRequestIds.includes(request.id));
  const toggleRequestSelection = (requestId: string) => {
    setSelectedRequestIds((current) =>
      current.includes(requestId)
        ? current.filter((id) => id !== requestId)
        : [...current, requestId]
    );
    setErrorMessage("");
  };
  const toggleVisibleSelection = () => {
    setSelectedRequestIds((current) => {
      const visibleIds = visibleRequests.map((request) => request.id);

      if (visibleIds.every((id) => current.includes(id))) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      return [...new Set([...current, ...visibleIds])];
    });
  };
  const resetFilters = () => {
    setKeyword("");
    setStatusFilter("all");
    setPriorityFilter("all");
    setShortageFilter("all");
    setBrandFilter("all");
    setTargetShipDateStart("");
    setTargetShipDateEnd("");
    setPage(1);
  };
  const exportPlanningRows = () => {
    downloadCsvTemplate(
      "production-planning-list.csv",
      [
        { key: "备货单号", label: "备货单号" },
        { key: "SKU数", label: "SKU 数" },
        { key: "总数量", label: "总数量" },
        { key: "交期", label: "交期" },
        { key: "缺料状态", label: "缺料状态" },
        { key: "优先级", label: "优先级" }
      ],
      visibleRequests.map((request) => {
        const preview = materialPreviews[request.id];

        return {
          备货单号: request.request_no,
          SKU数: String(request.sku_count),
          总数量: String(request.total_requested_quantity),
          交期: request.target_ship_date ?? "",
          缺料状态:
            preview?.status === "shortage"
              ? `缺料 ${preview.shortageCount} 项`
              : "齐料",
          优先级: priorityLabels[request.priority] ?? request.priority
        };
      })
    );
  };
  const getRequestSummary = (request: PlanningFbaReplenishmentRequest) => {
    const labels = request.items.slice(0, 2).map((item) => {
      const product = item.product ?? item.sku?.product ?? null;

      return `${product?.name ?? "未关联产品"} / ${item.sku?.sku_code ?? "-"}`;
    });
    const extraCount = Math.max(0, request.items.length - labels.length);

    return {
      main: labels.join("、") || request.sku?.sku_name || "-",
      extra: extraCount > 0 ? `等 ${extraCount} 项` : ""
    };
  };
  const planningColumns: DataTableColumn<PlanningFbaReplenishmentRequest>[] = [
    {
      key: "select",
      title: (
        <input
          aria-label="选择当前页"
          className="tableCheckbox"
          type="checkbox"
          checked={allVisibleSelected}
          onChange={toggleVisibleSelection}
        />
      ),
      width: 44,
      render: (request) => (
        <input
          aria-label={`选择 ${request.request_no}`}
          className="tableCheckbox"
          type="checkbox"
          checked={selectedRequestIds.includes(request.id)}
          onChange={() => toggleRequestSelection(request.id)}
        />
      )
    },
    {
      key: "request_no",
      title: "备货单号",
      width: 142,
      render: (request) => (
        <button
          className="linkButton"
          type="button"
          onClick={() => setDetailRequest(request)}
        >
          {request.request_no}
        </button>
      )
    },
    {
      key: "summary",
      title: "产品/SKU 汇总",
      render: (request) => {
        const summary = getRequestSummary(request);
        const firstItem = request.items[0];
        const product = firstItem?.product ?? firstItem?.sku?.product ?? null;

        return (
          <InfoCell
            imageUrl={product?.product_image_url ?? null}
            imageAlt={product?.name ?? "产品"}
            title={summary.main}
            subtitle={summary.extra || getPlanningRequestBrandSummary(request)}
          />
        );
      }
    },
    {
      key: "quantity",
      title: "总数量",
      width: 92,
      render: (request) => formatQuantity(request.total_requested_quantity)
    },
    {
      key: "due",
      title: "交期",
      width: 86,
      render: (request) => formatDate(request.target_ship_date)
    },
    {
      key: "shortage",
      title: "缺料状态",
      width: 124,
      render: (request) => (
        <ShortageStatus preview={materialPreviews[request.id]} />
      )
    },
    {
      key: "priority",
      title: "建议优先级",
      width: 110,
      render: (request) => (
        <PriorityBadge priority={request.priority} dueDate={request.target_ship_date} />
      )
    },
    {
      key: "actions",
      title: "操作",
      width: 96,
      render: (request) => {
        const isActing = actingRequestId === request.id;

        return (
          <RowActions
            onView={() => setDetailRequest(request)}
            moreActions={[
              {
                label: request.status === "submitted" ? "接单" : "已接单",
                disabled: loading || isActing || request.status !== "submitted",
                onClick: () => handleAccept(request.id)
              },
              {
                label: "拒绝",
                danger: true,
                disabled: loading || isActing,
                onClick: () => handleReject(request.id)
              },
              {
                label: "单独生成",
                disabled: loading || isActing,
                onClick: () => openProductionForm(request)
              }
            ]}
          />
        );
      }
    }
  ];

  return (
    <main className="pageShell">
      <PageHeader
        title="厂长排产"
        secondaryActions={
          <button className="secondaryButton" type="button" onClick={exportPlanningRows}>
            <DownloadIcon size={14} />
            导出
          </button>
        }
        primaryAction={
          <button
            className="primaryButton"
            type="button"
            onClick={() => openMergedProductionForm(selectedRequests)}
            disabled={selectedRequests.length === 0}
          >
            <PlusIcon size={14} />
            合并生成生产任务
          </button>
        }
      />

      {successMessage ? (
        <div className="successNotice">
          <strong>操作成功</strong>
          <p>{successMessage}</p>
        </div>
      ) : null}

      <SearchFilterBar
        searchLabel="搜索"
        searchValue={keyword}
        searchPlaceholder="备货单号 / 产品 / SKU"
        onSearchChange={setKeyword}
        onReset={resetFilters}
        filters={
          <>
            <label>
              状态
              <select
                value={statusFilter}
                onChange={(event) =>
                  setStatusFilter(event.target.value as PlanningRequestStatus | "all")
                }
                disabled={loading}
              >
                <option value="all">全部状态</option>
                <option value="submitted">已提交</option>
                <option value="accepted">已接单</option>
              </select>
            </label>
            <label>
              缺料状态
              <select
                value={shortageFilter}
                onChange={(event) => setShortageFilter(event.target.value)}
                disabled={loading}
              >
                <option value="all">全部</option>
                <option value="ready">齐料</option>
                <option value="shortage">缺料</option>
              </select>
            </label>
            <label>
              优先级
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
                disabled={loading}
              >
                <option value="all">全部优先级</option>
                <option value="urgent">紧急</option>
                <option value="high">高</option>
                <option value="normal">普通</option>
                <option value="low">低</option>
              </select>
            </label>
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
          </>
        }
        dateFilters={
          <>
            <label>
              交期起
              <input
                type="date"
                value={targetShipDateStart}
                onChange={(event) => setTargetShipDateStart(event.target.value)}
                disabled={loading}
              />
            </label>
            <label>
              交期止
              <input
                type="date"
                value={targetShipDateEnd}
                onChange={(event) => setTargetShipDateEnd(event.target.value)}
                disabled={loading}
              />
            </label>
          </>
        }
      />

      {errorMessage ? (
        <div className="debugError">
          <strong>操作失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <div className="planningWorkbenchGrid">
        <section className="listPanel planningPoolPanel">
          <div className="sectionHeader compactSectionHeader">
            <div>
              <h3>待排产池</h3>
            </div>
            <button
              className="secondaryButton"
              type="button"
              onClick={loadPageData}
              disabled={loading || Boolean(actingRequestId)}
            >
              {loading ? "刷新中" : "刷新"}
            </button>
          </div>

          <DataTable
            columns={planningColumns}
            rows={visibleRequests}
            getRowKey={(request) => request.id}
            loading={loading}
            loadingText="正在读取待排产备货需求..."
            emptyText="暂无待排产备货需求"
            minWidth={940}
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={shortageFilter === "all" ? totalRequests : visibleRequests.length}
            onPageChange={setPage}
          />
        </section>

        <aside className="planningSummaryPanel">
          <section className="summaryBlock">
            <h3>排产汇总 / 规则建议</h3>
            <div className="summaryMetricGrid">
              <SummaryMetric label="已选单据数" value={selectedRequests.length} />
              <SummaryMetric label="合计 SKU" value={selectedSkuCount} />
              <SummaryMetric label="合计数量" value={formatQuantity(selectedQuantity)} />
              <SummaryMetric label="预计工时" value={`${estimatedHours} 小时`} />
              <SummaryMetric label="缺料 SKU 数" value={selectedShortageSkuCount} />
              <SummaryMetric label="缺料物料项" value={selectedPreviewLines.length} />
              <SummaryMetric label="齐料 SKU 数" value={selectedReadySkuCount} />
            </div>
          </section>

          <section className="summaryBlock">
            <h4>建议优先级分布</h4>
            <PriorityLine label="高" value={priorityDistribution.high} tone="danger" />
            <PriorityLine label="中" value={priorityDistribution.medium} tone="warning" />
            <PriorityLine label="低" value={priorityDistribution.low} tone="success" />
          </section>

          <section className="summaryBlock">
            <h4>排产规则建议</h4>
            <ul className="ruleList">
              <li>按交期由近到远排序。</li>
              <li>齐料单据优先进入生产。</li>
              <li>相同产品或工艺可合并处理。</li>
            </ul>
          </section>

          <button
            className="primaryButton summaryPrimaryButton"
            type="button"
            onClick={() => openMergedProductionForm(selectedRequests)}
            disabled={selectedRequests.length === 0}
          >
            生成生产任务
          </button>
        </aside>
      </div>

      {productionFormRequests.length > 0 && form ? (
        <DrawerForm
          open={Boolean(productionFormRequests.length > 0 && form)}
          title="合并生成生产任务"
          width="lg"
          onClose={() => {
            if (!submittingProduction) {
              setSelectedRequest(null);
              setProductionFormRequests([]);
              setForm(null);
            }
          }}
          footer={
            <>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => {
                  setSelectedRequest(null);
                  setProductionFormRequests([]);
                  setForm(null);
                }}
                disabled={submittingProduction}
              >
                取消
              </button>
              <button
                className="primaryButton"
                type="submit"
                form="production-create-form"
                disabled={submittingProduction || productionFormRequests.length === 0}
              >
                {submittingProduction ? "正在生成..." : "确认生成"}
              </button>
            </>
          }
        >
          <form
            id="production-create-form"
            className="dataForm productionDrawerForm"
            onSubmit={handleCreateProductionOrder}
          >
            <label>
              计划开始日期 *
              <input
                type="date"
                value={form.plannedStartDate}
                onChange={(event) =>
                  updateForm("plannedStartDate", event.target.value)
                }
                disabled={submittingProduction}
                required
              />
            </label>

            <label>
              负责人 *
              <select
                value={form.assignedTo}
                onChange={(event) => updateForm("assignedTo", event.target.value)}
                disabled={submittingProduction}
                required
              >
                <option value="">请选择负责人</option>
                {activeAssignees.map((assignee) => (
                  <option key={assignee.id} value={assignee.id}>
                    {assignee.full_name} / {assignee.email}
                  </option>
                ))}
              </select>
            </label>

            <label>
              优先级
              <select
                value={form.priority}
                onChange={(event) => updateForm("priority", event.target.value)}
                disabled={submittingProduction}
              >
                <option value="high">高</option>
                <option value="medium">中</option>
                <option value="low">低</option>
              </select>
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

            <label className="fullField">
              备注
              <textarea
                value={form.notes}
                onChange={(event) => updateForm("notes", event.target.value)}
                placeholder="例如：同类产品合并安排，优先处理近交期单据。"
                disabled={submittingProduction}
              />
            </label>

            <div className="fullField drawerSection">
              <div className="drawerSectionHeader">
                <h4>已选单据</h4>
                <span>{productionFormRequests.length} 张</span>
              </div>
              <div className="tableWrap compactTableWrap noHorizontalScroll">
                <table className="dataTable compactDataTable selectedOrdersTable">
                  <thead>
                    <tr>
                      <th>备货单号</th>
                      <th>产品/SKU 汇总</th>
                      <th>数量</th>
                      <th>交期</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productionFormRequests.map((request) => {
                      const summary = getRequestSummary(request);

                      return (
                        <tr key={request.id}>
                          <td>{request.request_no}</td>
                          <td>
                            <EllipsisText>{summary.main}</EllipsisText>
                            {summary.extra ? (
                              <span className="tableSubText">{summary.extra}</span>
                            ) : null}
                          </td>
                          <td>{formatQuantity(request.total_requested_quantity)}</td>
                          <td>{formatDate(request.target_ship_date)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="fullField drawerSection">
              <div className="drawerSectionHeader">
                <h4>合并后预估</h4>
              </div>
              <div className="summaryMetricGrid">
                <SummaryMetric label="合并后 SKU 数" value={selectedSkuCount} />
                <SummaryMetric label="合并后总数量" value={formatQuantity(selectedQuantity)} />
                <SummaryMetric label="预计工时" value={`${estimatedHours} 小时`} />
                <SummaryMetric
                  label="预计完成日期"
                  value={estimateCompletionDate(form.plannedStartDate, estimatedHours)}
                />
              </div>
            </div>
          </form>
        </DrawerForm>
      ) : null}

      {detailRequest ? (
        <DetailDrawer
          open={Boolean(detailRequest)}
          title="备货单详情"
          width="lg"
          onClose={() => setDetailRequest(null)}
          footer={
            <>
              <button
                className="secondaryButton"
                type="button"
                onClick={() => setDetailRequest(null)}
              >
                关闭
              </button>
              <button
                className="primaryButton"
                type="button"
                onClick={() => {
                  openProductionForm(detailRequest);
                  setDetailRequest(null);
                }}
              >
                生成生产任务
              </button>
            </>
          }
        >
          <div className="detailGrid compactDetailGrid">
            <ReadonlyField
              label="平台"
              value={parseNotes(detailRequest.notes).amazonSite}
            />
            <ReadonlyField
              label="目标仓库"
              value={`${detailRequest.target_warehouse?.name ?? "-"} / ${
                detailRequest.fba_warehouse_code ?? "-"
              }`}
            />
            <ReadonlyField label="产品数量" value={String(detailRequest.product_count)} />
            <ReadonlyField label="SKU 数量" value={String(detailRequest.sku_count)} />
            <ReadonlyField
              label="总数量"
              value={formatQuantity(detailRequest.total_requested_quantity)}
            />
            <ReadonlyField
              label="交期"
              value={formatDate(detailRequest.target_ship_date)}
            />
          </div>

          <div className="groupList drawerSection">
            {groupRequestItemsByProduct(detailRequest).map((group) => (
              <section className="productGroup" key={group.productCode}>
                <ProductHeader
                  imageUrl={group.imageUrl}
                  name={group.productName}
                  code={group.productCode}
                  brandLabel={group.brandLabel}
                />
                <div className="tableWrap compactTableWrap noHorizontalScroll">
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
        </DetailDrawer>
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

function SummaryMetric({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="summaryMetric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PriorityLine({
  label,
  value,
  tone
}: {
  label: string;
  value: number;
  tone: "danger" | "warning" | "success";
}) {
  return (
    <div className="priorityLine">
      <span className={`priorityDot priorityDot-${tone}`} />
      <span>{label}</span>
      <div className="priorityLineTrack">
        <span
          className={`priorityLineBar priorityLineBar-${tone}`}
          style={{ width: value > 0 ? "100%" : "0%" }}
        />
      </div>
      <strong>{value}</strong>
    </div>
  );
}

function ShortageStatus({
  preview
}: {
  preview?: ProductionPlanningMaterialPreview;
}) {
  if (!preview) {
    return <StatusBadge status="pending" label="计算中" type="warning" />;
  }

  if (preview.status === "ready") {
    return <StatusBadge status="ready" label="齐料" type="success" />;
  }

  return (
    <div className="hoverPopoverWrap">
      <StatusBadge
        status="shortage"
        label={`缺料 ${preview.shortageCount} 项`}
        type={preview.shortageCount > 2 ? "danger" : "warning"}
      />
      <div className="hoverPopover">
        <strong>缺料明细</strong>
        {preview.shortageLines.slice(0, 3).map((line) => (
          <span key={`${line.material_code}-${line.material_name}`}>
            {line.material_name}：缺 {formatQuantity(line.shortage_quantity)}
            {line.unit}
          </span>
        ))}
        {preview.shortageLines.length > 3 ? (
          <a href="/materials/requirements">查看全部缺料</a>
        ) : null}
      </div>
    </div>
  );
}

function PriorityBadge({
  priority,
  dueDate
}: {
  priority: string;
  dueDate: string | null;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isUrgentByDate = Boolean(dueDate && dueDate <= today);

  if (priority === "urgent" || priority === "high" || isUrgentByDate) {
    return <StatusBadge status="danger" label="高" type="danger" />;
  }

  if (priority === "normal") {
    return <StatusBadge status="warning" label="中" type="warning" />;
  }

  return <StatusBadge status="ready" label="低" type="success" />;
}
