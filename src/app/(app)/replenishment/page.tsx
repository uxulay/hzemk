"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getFbaReplenishmentRequests,
  type FbaReplenishmentRequest,
  type FbaRequestStatus
} from "@/lib/api/replenishment";

type StatusFilter = FbaRequestStatus | "all";

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
    request.sku?.sku_code,
    request.sku?.sku_name,
    request.sku?.amazon_sku,
    request.sku?.fnsku
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

export default function ReplenishmentPage() {
  const [requests, setRequests] = useState<FbaReplenishmentRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [skuKeyword, setSkuKeyword] = useState("");
  const [selectedRequest, setSelectedRequest] =
    useState<FbaReplenishmentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let isMounted = true;

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

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">FBA 备货</p>
          <h2>FBA 备货需求列表</h2>
          <p>
            查看运营提交的备货需求。当前阶段先显示全部数据，后续再接真实登录角色筛选。
          </p>
        </div>
        <span className="statusPill">Supabase 数据</span>
      </section>

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
                  <th>产品名称</th>
                  <th>SKU</th>
                  <th>亚马逊站点</th>
                  <th>目标 FBA 仓库</th>
                  <th>备货数量</th>
                  <th>期望完成日期</th>
                  <th>状态</th>
                  <th>优先级</th>
                  <th>创建时间</th>
                  <th>备注</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRequests.map((request) => {
                  const notes = parseNotes(request.notes);

                  return (
                    <tr key={request.id}>
                      <td>{request.request_no}</td>
                      <td>
                        {request.sku?.product?.name ?? "-"}
                      </td>
                      <td>
                        <strong>{request.sku?.sku_code ?? "-"}</strong>
                        <span>{request.sku?.sku_name ?? "-"}</span>
                      </td>
                      <td>{notes.amazonSite}</td>
                      <td>
                        <strong>{request.target_warehouse?.name ?? "-"}</strong>
                        <span>{request.fba_warehouse_code ?? "-"}</span>
                      </td>
                      <td>{formatQuantity(request.requested_quantity)}</td>
                      <td>{formatDate(request.target_ship_date)}</td>
                      <td>
                        <span className={`tablePill status-${request.status}`}>
                          {statusLabels[request.status] ?? request.status}
                        </span>
                      </td>
                      <td>{priorityLabels[request.priority] ?? request.priority}</td>
                      <td>{formatDateTime(request.created_at)}</td>
                      <td className="notesCell">{notes.displayNotes}</td>
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
      </section>

      {selectedRequest ? (
        <section className="detailPanel">
          <div className="detailHeader">
            <div>
              <p className="eyebrow">备货需求详情</p>
              <h3>{selectedRequest.request_no}</h3>
            </div>
            <button
              className="secondaryButton"
              type="button"
              onClick={() => setSelectedRequest(null)}
            >
              关闭
            </button>
          </div>
          <div className="detailGrid">
            <DetailItem
              label="产品名称"
              value={selectedRequest.sku?.product?.name ?? "-"}
            />
            <DetailItem
              label="SKU"
              value={`${selectedRequest.sku?.sku_code ?? "-"} / ${
                selectedRequest.sku?.sku_name ?? "-"
              }`}
            />
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
              value={formatQuantity(selectedRequest.requested_quantity)}
            />
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
        </section>
      ) : null}
    </main>
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
