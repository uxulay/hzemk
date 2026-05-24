"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/Modal";
import { Pagination } from "@/components/Pagination";
import {
  getProducts,
  getSkus,
  getWarehouses,
  type Product,
  type Sku,
  type Warehouse
} from "@/lib/api/master-data";
import {
  createFbaReplenishmentDocument,
  getFbaReplenishmentRequests,
  type CreateFbaReplenishmentDocumentInput,
  type FbaReplenishmentRequest,
  type FbaReplenishmentRequestItem,
  type FbaRequestStatus
} from "@/lib/api/replenishment";
import { DEFAULT_PAGE_SIZE, paginateItems } from "@/lib/utils/pagination";

type StatusFilter = FbaRequestStatus | "all";

type CreateRequestFormState = {
  amazonSite: string;
  targetWarehouseId: string;
  fbaWarehouseCode: string;
  targetShipDate: string;
  priority: string;
  notes: string;
};

type ProductSkuGroup = {
  product: Product;
  skuRows: Array<{
    sku: Sku;
    quantity: string;
    remark: string;
  }>;
};

const initialCreateForm: CreateRequestFormState = {
  amazonSite: "US",
  targetWarehouseId: "",
  fbaWarehouseCode: "",
  targetShipDate: "",
  priority: "normal",
  notes: ""
};

const amazonSites = [
  { value: "US", label: "美国站 US" },
  { value: "CA", label: "加拿大站 CA" },
  { value: "MX", label: "墨西哥站 MX" },
  { value: "UK", label: "英国站 UK" },
  { value: "DE", label: "德国站 DE" },
  { value: "FR", label: "法国站 FR" },
  { value: "IT", label: "意大利站 IT" },
  { value: "ES", label: "西班牙站 ES" },
  { value: "JP", label: "日本站 JP" }
];

const priorityOptions = [
  { value: "low", label: "低" },
  { value: "normal", label: "普通" },
  { value: "high", label: "高" },
  { value: "urgent", label: "紧急" }
];

const statusOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "全部状态" },
  { value: "draft", label: "草稿" },
  { value: "submitted", label: "已提交" },
  { value: "accepted", label: "已接单" },
  { value: "rejected", label: "已拒绝" },
  { value: "in_production", label: "生产中" },
  { value: "completed", label: "已完成" },
  { value: "shipped", label: "已发往 FBA" }
];

const statusLabels: Record<FbaRequestStatus, string> = {
  draft: "草稿",
  submitted: "已提交",
  accepted: "已接单",
  rejected: "已拒绝",
  in_production: "生产中",
  completed: "已完成",
  shipped: "已发往 FBA"
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

  return "读取失败，请稍后重试。";
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

function getSkuSearchText(request: FbaReplenishmentRequest) {
  return [
    request.request_no,
    request.sku?.sku_code,
    request.sku?.sku_name,
    request.sku?.amazon_sku,
    request.sku?.fnsku,
    ...request.items.flatMap((item) => [
      item.product?.name,
      item.sku?.sku_code,
      item.sku?.sku_name,
      item.sku?.specs
    ])
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function isPositiveIntegerText(value: string) {
  return /^[1-9]\d*$/.test(value.trim());
}

function sortWarehouses(warehouses: Warehouse[]) {
  const priority: Record<string, number> = {
    fba: 1,
    finished_product: 2,
    finished_good: 2,
    internal: 3,
    semi_finished: 4,
    material: 5
  };

  return [...warehouses].sort((first, second) => {
    const firstPriority = priority[first.warehouse_type] ?? 99;
    const secondPriority = priority[second.warehouse_type] ?? 99;

    if (firstPriority !== secondPriority) {
      return firstPriority - secondPriority;
    }

    return first.warehouse_code.localeCompare(second.warehouse_code);
  });
}

function groupRequestItemsByProduct(items: FbaReplenishmentRequestItem[]) {
  const groups = new Map<
    string,
    {
      productName: string;
      productCode: string;
      imageUrl: string | null;
      items: FbaReplenishmentRequestItem[];
    }
  >();

  for (const item of items) {
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
      imageUrl: product?.product_image_url ?? null,
      items: [item]
    });
  }

  return [...groups.values()];
}

export default function ReplenishmentPage() {
  const [requests, setRequests] = useState<FbaReplenishmentRequest[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [skuKeyword, setSkuKeyword] = useState("");
  const [selectedRequest, setSelectedRequest] =
    useState<FbaReplenishmentRequest | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] =
    useState<CreateRequestFormState>(initialCreateForm);
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productGroups, setProductGroups] = useState<ProductSkuGroup[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [createErrorMessage, setCreateErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

    async function loadOptions() {
      try {
        setLoadingOptions(true);
        const [productData, skuData, warehouseData] = await Promise.all([
          getProducts(),
          getSkus(),
          getWarehouses()
        ]);

        if (isMounted) {
          setProducts(productData);
          setSkus(skuData);
          setWarehouses(sortWarehouses(warehouseData));
        }
      } catch (error) {
        if (isMounted) {
          setCreateErrorMessage(getErrorMessage(error));
        }
      } finally {
        if (isMounted) {
          setLoadingOptions(false);
        }
      }
    }

    async function loadRequests() {
      try {
        setLoading(true);
        setErrorMessage("");
        setSelectedRequest(null);

        const data = await getFbaReplenishmentRequests({
          status: statusFilter
        });

        if (isMounted) {
          setRequests(data);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(getErrorMessage(error));
          setRequests([]);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadOptions();
    loadRequests();

    return () => {
      isMounted = false;
    };
  }, [statusFilter]);

  const filteredRequests = useMemo(() => {
    const keyword = skuKeyword.trim().toLowerCase();

    if (!keyword) {
      return requests;
    }

    return requests.filter((request) =>
      getSkuSearchText(request).includes(keyword)
    );
  }, [requests, skuKeyword]);

  const paginatedRequests = useMemo(
    () => paginateItems(filteredRequests, page),
    [filteredRequests, page]
  );

  useEffect(() => {
    setPage(1);
  }, [skuKeyword, statusFilter]);

  const refreshRequests = async () => {
    try {
      setLoading(true);
      setErrorMessage("");
      setSelectedRequest(null);

      const data = await getFbaReplenishmentRequests({
        status: statusFilter
      });
      setRequests(data);
    } catch (error) {
      setErrorMessage(getErrorMessage(error));
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  const openCreateModal = () => {
    setCreateOpen(true);
    setCreateErrorMessage("");
    setSuccessMessage("");
  };

  const updateCreateForm = (field: keyof CreateRequestFormState, value: string) => {
    setCreateForm((current) => ({
      ...current,
      [field]: value
    }));
    setCreateErrorMessage("");
    setSuccessMessage("");
  };

  const addSelectedProduct = () => {
    const product = products.find((item) => item.id === selectedProductId);

    if (!product) {
      setCreateErrorMessage("请先选择一个产品。");
      return;
    }

    if (productGroups.some((group) => group.product.id === product.id)) {
      setCreateErrorMessage("这个产品已经添加过了，同一张单里不要重复添加。");
      return;
    }

    const productSkus = skus.filter(
      (sku) => sku.product_id === product.id && sku.sku_type === "finished_good"
    );

    if (productSkus.length === 0) {
      setCreateErrorMessage("这个产品下面没有成品 SKU，不能添加原材料 SKU。");
      return;
    }

    setProductGroups((current) => [
      ...current,
      {
        product,
        skuRows: productSkus.map((sku) => ({
          sku,
          quantity: "",
          remark: ""
        }))
      }
    ]);
    setSelectedProductId("");
    setCreateErrorMessage("");
  };

  const removeProductGroup = (productId: string) => {
    setProductGroups((current) =>
      current.filter((group) => group.product.id !== productId)
    );
  };

  const updateSkuRow = (
    productId: string,
    skuId: string,
    field: "quantity" | "remark",
    value: string
  ) => {
    setProductGroups((current) =>
      current.map((group) =>
        group.product.id === productId
          ? {
              ...group,
              skuRows: group.skuRows.map((row) =>
                row.sku.id === skuId
                  ? {
                      ...row,
                      [field]: value
                    }
                  : row
              )
            }
          : group
      )
    );
    setCreateErrorMessage("");
    setSuccessMessage("");
  };

  const buildCreateInput = (): CreateFbaReplenishmentDocumentInput | string => {
    if (!createForm.amazonSite) {
      return "请选择亚马逊站点。";
    }

    if (!createForm.targetWarehouseId) {
      return "请选择目标 FBA 仓库。";
    }

    if (productGroups.length === 0) {
      return "请至少添加一个产品。";
    }

    const items = productGroups.flatMap((group) =>
      group.skuRows
        .filter((row) => row.quantity.trim() !== "" && row.quantity.trim() !== "0")
        .map((row) => ({
          productId: group.product.id,
          skuId: row.sku.id,
          requestedQuantity: Number(row.quantity),
          remark: row.remark
        }))
    );

    if (items.length === 0) {
      return "请至少给一个 SKU 填写备货数量。";
    }

    const invalidRow = productGroups
      .flatMap((group) => group.skuRows)
      .find(
        (row) =>
          row.quantity.trim() !== "" &&
          row.quantity.trim() !== "0" &&
          !isPositiveIntegerText(row.quantity)
      );

    if (invalidRow) {
      return "SKU 数量必须是正整数，不能是负数或小数。";
    }

    return {
      amazonSite: createForm.amazonSite,
      targetWarehouseId: createForm.targetWarehouseId,
      fbaWarehouseCode: createForm.fbaWarehouseCode,
      targetShipDate: createForm.targetShipDate || null,
      priority: createForm.priority,
      notes: createForm.notes,
      items
    };
  };

  const handleCreateRequest = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const input = buildCreateInput();

    if (typeof input === "string") {
      setCreateErrorMessage(input);
      return;
    }

    try {
      setSubmitting(true);
      setCreateErrorMessage("");
      setSuccessMessage("");

      const created = await createFbaReplenishmentDocument(input);
      setCreateOpen(false);
      setCreateForm(initialCreateForm);
      setProductGroups([]);
      setSelectedProductId("");
      await refreshRequests();
      setSuccessMessage(`创建成功：${created.request_no}`);
    } catch (error) {
      setCreateErrorMessage(getErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">FBA 备货</p>
          <h2>FBA 备货需求</h2>
          <p>
            按整张备货单查看运营需求。一张单可以包含多个产品和多个 SKU 明细。
          </p>
        </div>
        <div className="pageHeroActions">
          <span className="statusPill">Supabase 数据</span>
          <button
            className="primaryButton successButton"
            type="button"
            onClick={openCreateModal}
          >
            + 创建备货单
          </button>
        </div>
      </section>

      {successMessage ? (
        <div className="successNotice">
          <strong>操作成功</strong>
          <p>{successMessage}</p>
        </div>
      ) : null}

      <section className="listPanel">
        <div className="listToolbar">
          <label>
            状态
            <select
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as StatusFilter)
              }
              disabled={loading}
            >
              {statusOptions.map((option) => (
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
              placeholder="输入 SKU 编码或名称"
            />
          </label>

          <button
            className="secondaryButton"
            type="button"
            onClick={refreshRequests}
            disabled={loading}
          >
            {loading ? "正在刷新..." : "刷新列表"}
          </button>
        </div>

        {loading ? (
          <div className="debugNotice">正在读取 FBA 备货需求列表...</div>
        ) : null}

        {errorMessage ? (
          <div className="debugError">
            <strong>查询失败</strong>
            <p>{errorMessage}</p>
          </div>
        ) : null}

        {!loading && !errorMessage && filteredRequests.length === 0 ? (
          <div className="emptyState">暂无 FBA 备货需求</div>
        ) : null}

        {!loading && !errorMessage && filteredRequests.length > 0 ? (
          <div className="tableWrap">
            <table className="dataTable">
              <thead>
                <tr>
                  <th>备货单号</th>
                  <th>亚马逊站点</th>
                  <th>目标 FBA 仓库</th>
                  <th>产品数量</th>
                  <th>SKU 数量</th>
                  <th>总备货数量</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>创建人</th>
                  <th>创建时间</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRequests.map((request) => {
                  const notes = parseNotes(request.notes);

                  return (
                    <tr key={request.id}>
                      <td>{request.request_no}</td>
                      <td>{notes.amazonSite}</td>
                      <td>
                        <strong>{request.target_warehouse?.name ?? "-"}</strong>
                        <span>{request.fba_warehouse_code ?? "-"}</span>
                      </td>
                      <td>{request.product_count}</td>
                      <td>{request.sku_count}</td>
                      <td>{formatQuantity(request.total_requested_quantity)}</td>
                      <td>
                        <span className={`tablePill status-${request.status}`}>
                          {statusLabels[request.status] ?? request.status}
                        </span>
                      </td>
                      <td>{priorityLabels[request.priority] ?? request.priority}</td>
                      <td>{request.requested_by_profile?.full_name ?? "-"}</td>
                      <td>{formatDateTime(request.created_at)}</td>
                      <td>
                        <div className="rowActions">
                          <button
                            type="button"
                            onClick={() => setSelectedRequest(request)}
                          >
                            查看
                          </button>
                          <button type="button" disabled>
                            编辑
                          </button>
                          <button type="button" disabled>
                            删除
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

        {!loading && !errorMessage && filteredRequests.length > 0 ? (
          <Pagination
            page={page}
            pageSize={DEFAULT_PAGE_SIZE}
            total={filteredRequests.length}
            onPageChange={setPage}
          />
        ) : null}
      </section>

      {selectedRequest ? (
        <Modal
          open={Boolean(selectedRequest)}
          eyebrow="备货需求详情"
          title={selectedRequest.request_no}
          onClose={() => setSelectedRequest(null)}
        >
          <div className="detailGrid">
            <DetailItem
              label="亚马逊站点"
              value={parseNotes(selectedRequest.notes).amazonSite}
            />
            <DetailItem
              label="目标仓库"
              value={`${selectedRequest.target_warehouse?.name ?? "-"} / ${
                selectedRequest.target_warehouse?.warehouse_code ?? "-"
              }`}
            />
            <DetailItem
              label="FBA 仓库代码"
              value={selectedRequest.fba_warehouse_code ?? "-"}
            />
            <DetailItem
              label="备货数量"
              value={formatQuantity(selectedRequest.total_requested_quantity)}
            />
            <DetailItem
              label="产品数量"
              value={String(selectedRequest.product_count)}
            />
            <DetailItem label="SKU 数量" value={String(selectedRequest.sku_count)} />
            <DetailItem
              label="期望完成日期"
              value={formatDate(selectedRequest.target_ship_date)}
            />
            <DetailItem
              label="状态"
              value={statusLabels[selectedRequest.status] ?? selectedRequest.status}
            />
            <DetailItem
              label="优先级"
              value={
                priorityLabels[selectedRequest.priority] ??
                selectedRequest.priority
              }
            />
            <DetailItem
              label="创建人"
              value={
                selectedRequest.requested_by_profile
                  ? `${selectedRequest.requested_by_profile.full_name} / ${selectedRequest.requested_by_profile.email}`
                  : "-"
              }
            />
            <DetailItem
              label="创建时间"
              value={formatDateTime(selectedRequest.created_at)}
            />
            <DetailItem
              label="更新时间"
              value={formatDateTime(selectedRequest.updated_at)}
            />
            <DetailItem
              label="拒绝原因"
              value={selectedRequest.rejected_reason ?? "-"}
            />
            <DetailItem
              label="备注"
              value={parseNotes(selectedRequest.notes).displayNotes}
              wide
            />
          </div>

          <div className="groupList">
            {groupRequestItemsByProduct(selectedRequest.items).map((group) => (
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
                        <th>SKU 编码</th>
                        <th>SKU 名称 / 规格</th>
                        <th>备货数量</th>
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
                          <td className="notesCell">{item.remark ?? "-"}</td>
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

      <Modal
        open={createOpen}
        eyebrow="运营创建"
        title="创建 FBA 备货单"
        maxWidth="xl"
        onClose={() => {
          if (!submitting) {
            setCreateOpen(false);
          }
        }}
      >
        {createErrorMessage ? (
          <div className="debugError">
            <strong>操作失败</strong>
            <p>{createErrorMessage}</p>
          </div>
        ) : null}

        {loadingOptions ? (
          <div className="debugNotice">正在读取产品、SKU 和仓库数据...</div>
        ) : null}

        <form className="dataForm" onSubmit={handleCreateRequest}>
          <label>
            亚马逊站点
            <select
              value={createForm.amazonSite}
              onChange={(event) =>
                updateCreateForm("amazonSite", event.target.value)
              }
              disabled={submitting}
            >
              {amazonSites.map((site) => (
                <option key={site.value} value={site.value}>
                  {site.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            目标 FBA 仓库
            <select
              value={createForm.targetWarehouseId}
              onChange={(event) =>
                updateCreateForm("targetWarehouseId", event.target.value)
              }
              disabled={loadingOptions || submitting}
            >
              <option value="">请选择目标仓库</option>
              {warehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.name} / {warehouse.warehouse_code}
                </option>
              ))}
            </select>
          </label>

          <label>
            FBA 仓库代码
            <input
              value={createForm.fbaWarehouseCode}
              onChange={(event) =>
                updateCreateForm("fbaWarehouseCode", event.target.value)
              }
              placeholder="例如 ONT8、LAX9"
              disabled={submitting}
            />
          </label>

          <label>
            期望完成日期
            <input
              type="date"
              value={createForm.targetShipDate}
              onChange={(event) =>
                updateCreateForm("targetShipDate", event.target.value)
              }
              disabled={submitting}
            />
          </label>

          <label>
            优先级
            <select
              value={createForm.priority}
              onChange={(event) =>
                updateCreateForm("priority", event.target.value)
              }
              disabled={submitting}
            >
              {priorityOptions.map((priority) => (
                <option key={priority.value} value={priority.value}>
                  {priority.label}
                </option>
              ))}
            </select>
          </label>

          <label className="fullField">
            备注
            <textarea
              value={createForm.notes}
              onChange={(event) => updateCreateForm("notes", event.target.value)}
              placeholder="例如：按近期销量安排补货。"
              disabled={submitting}
            />
          </label>

          <div className="fullField addProductRow">
            <label>
              添加产品
              <select
                value={selectedProductId}
                onChange={(event) => setSelectedProductId(event.target.value)}
                disabled={loadingOptions || submitting}
              >
                <option value="">请选择产品</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} / {product.product_code}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="secondaryButton"
              type="button"
              onClick={addSelectedProduct}
              disabled={loadingOptions || submitting}
            >
              添加产品
            </button>
          </div>

          <div className="fullField groupList">
            {productGroups.length === 0 ? (
              <div className="emptyState">请先添加产品，然后填写需要备货的 SKU 数量。</div>
            ) : null}

            {productGroups.map((group) => (
              <section className="productGroup" key={group.product.id}>
                <div className="productGroupTop">
                  <ProductHeader
                    imageUrl={group.product.product_image_url ?? null}
                    name={group.product.name}
                    code={group.product.product_code}
                  />
                  <button
                    className="secondaryButton"
                    type="button"
                    onClick={() => removeProductGroup(group.product.id)}
                    disabled={submitting}
                  >
                    移除产品
                  </button>
                </div>
                <div className="tableWrap compactTableWrap">
                  <table className="dataTable compactDataTable">
                    <thead>
                      <tr>
                        <th>SKU 编码</th>
                        <th>SKU 名称 / 规格</th>
                        <th>备货数量</th>
                        <th>备注</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.skuRows.map((row) => (
                        <tr key={row.sku.id}>
                          <td>{row.sku.sku_code}</td>
                          <td>
                            <strong>{row.sku.sku_name}</strong>
                            <span>{row.sku.specs ?? "-"}</span>
                          </td>
                          <td>
                            <input
                              min="1"
                              step="1"
                              type="number"
                              value={row.quantity}
                              onChange={(event) =>
                                updateSkuRow(
                                  group.product.id,
                                  row.sku.id,
                                  "quantity",
                                  event.target.value
                                )
                              }
                              disabled={submitting}
                            />
                          </td>
                          <td>
                            <input
                              value={row.remark}
                              onChange={(event) =>
                                updateSkuRow(
                                  group.product.id,
                                  row.sku.id,
                                  "remark",
                                  event.target.value
                                )
                              }
                              disabled={submitting}
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

          <div className="formActions fullField">
            <button
              className="primaryButton successButton"
              type="submit"
              disabled={loadingOptions || submitting}
            >
              {submitting ? "正在创建..." : "提交备货单"}
            </button>
          </div>
        </form>
      </Modal>
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

function DetailItem({
  label,
  value,
  wide = false
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "detailItem detailItemWide" : "detailItem"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
