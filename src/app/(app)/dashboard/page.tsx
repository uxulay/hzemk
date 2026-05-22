"use client";

import { useEffect, useState } from "react";
import {
  getActiveProductionOrders,
  getDashboardStats,
  getLatestReplenishmentRequests,
  getRecentInventoryTransactions,
  getShortageMaterials,
  type ActiveProductionOrder,
  type DashboardStats,
  type LatestReplenishmentRequest,
  type RecentInventoryTransaction,
  type ShortageMaterial
} from "@/lib/api/dashboard";

type DashboardData = {
  stats: DashboardStats;
  latestRequests: LatestReplenishmentRequest[];
  activeProductionOrders: ActiveProductionOrder[];
  shortageMaterials: ShortageMaterial[];
  recentInventoryTransactions: RecentInventoryTransaction[];
};

const fbaStatusLabels: Record<string, string> = {
  draft: "草稿",
  submitted: "待排产",
  accepted: "已接单",
  rejected: "已拒绝",
  in_production: "生产中",
  completed: "已完成",
  shipped: "已发往 FBA"
};

const productionStatusLabels: Record<string, string> = {
  planned: "已计划",
  material_pending: "待物料",
  in_progress: "生产中",
  completed: "已完成",
  cancelled: "已取消"
};

const materialStatusLabels: Record<string, string> = {
  pending: "待处理",
  ready: "库存足够",
  enough: "库存足够",
  shortage: "缺料",
  purchased: "已采购待到货",
  reserved: "已预留",
  received: "已到货"
};

const transactionTypeLabels: Record<string, string> = {
  material_in: "原材料入库",
  material_out: "原材料出库",
  product_in: "成品入库",
  product_out: "成品出库",
  adjustment: "库存调整"
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "读取首页看板失败，请稍后重试。";
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

function formatSignedQuantity(transaction: RecentInventoryTransaction) {
  const quantity = Number(transaction.quantity);

  if (
    transaction.transaction_type === "material_out" ||
    transaction.transaction_type === "product_out"
  ) {
    return `-${formatQuantity(Math.abs(quantity))}`;
  }

  if (
    transaction.transaction_type === "material_in" ||
    transaction.transaction_type === "product_in"
  ) {
    return `+${formatQuantity(Math.abs(quantity))}`;
  }

  return quantity > 0 ? `+${formatQuantity(quantity)}` : formatQuantity(quantity);
}

function getStatusLabel(labels: Record<string, string>, status: string) {
  return labels[status] ?? status;
}

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const [
        stats,
        latestRequests,
        activeProductionOrders,
        shortageMaterials,
        recentInventoryTransactions
      ] = await Promise.all([
        getDashboardStats(),
        getLatestReplenishmentRequests(),
        getActiveProductionOrders(),
        getShortageMaterials(),
        getRecentInventoryTransactions()
      ]);

      setDashboardData({
        stats,
        latestRequests,
        activeProductionOrders,
        shortageMaterials,
        recentInventoryTransactions
      });
    } catch (error) {
      setDashboardData(null);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const statCards = [
    {
      label: "待排产 FBA 备货需求",
      value: dashboardData?.stats.pendingProductionReplenishmentCount
    },
    {
      label: "生产中任务",
      value: dashboardData?.stats.activeProductionOrderCount
    },
    {
      label: "缺料物料",
      value: dashboardData?.stats.shortageMaterialCount
    },
    {
      label: "待采购 / 待到货物料",
      value: dashboardData?.stats.purchasePendingMaterialCount
    },
    {
      label: "待入库采购单",
      value: dashboardData?.stats.pendingInboundPurchaseOrderCount
    },
    {
      label: "有库存成品 SKU",
      value: dashboardData?.stats.finishedGoodStockSkuCount
    },
    {
      label: "原材料低库存",
      value: dashboardData?.stats.lowStockMaterialCount
    }
  ];

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">业务看板</p>
          <h2>后台首页</h2>
          <p>
            汇总 FBA 备货、生产、采购和库存的关键状态，方便管理员、厂长、仓库和采购快速判断当前重点。
          </p>
        </div>
        <div className="rowActions">
          <span className="statusPill">Supabase 数据</span>
          <button type="button" onClick={loadDashboard} disabled={loading}>
            {loading ? "刷新中..." : "刷新看板"}
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="debugError">
          <strong>查询失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      <section className="metricGrid">
        {statCards.map((metric) => (
          <article className="metric" key={metric.label}>
            <span>{metric.label}</span>
            <strong>
              {loading && !dashboardData
                ? "读取中"
                : formatQuantity(metric.value ?? 0)}
            </strong>
          </article>
        ))}
      </section>

      {loading ? (
        <div className="debugNotice">正在读取首页看板数据，请稍候...</div>
      ) : null}

      <section className="listPanel">
        <div className="sectionHeader">
          <div>
            <p className="eyebrow">FBA 备货</p>
            <h3>最新 FBA 备货需求</h3>
          </div>
          <span className="statusPill">最近 5 条</span>
        </div>

        {!loading &&
        !errorMessage &&
        dashboardData?.latestRequests.length === 0 ? (
          <div className="emptyState">暂无 FBA 备货需求</div>
        ) : null}

        {!loading && dashboardData?.latestRequests.length ? (
          <div className="tableWrap">
            <table className="dataTable" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>备货单号</th>
                  <th>SKU</th>
                  <th>备货数量</th>
                  <th>状态</th>
                  <th>创建时间</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.latestRequests.map((request) => (
                  <tr key={request.id}>
                    <td>{request.request_no}</td>
                    <td>
                      <strong>{request.sku?.sku_code ?? "-"}</strong>
                      <span>{request.sku?.sku_name ?? "-"}</span>
                    </td>
                    <td>{formatQuantity(request.requested_quantity)}</td>
                    <td>
                      <span className={`tablePill status-${request.status}`}>
                        {getStatusLabel(fbaStatusLabels, request.status)}
                      </span>
                    </td>
                    <td>{formatDateTime(request.created_at)}</td>
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
            <p className="eyebrow">生产跟踪</p>
            <h3>进行中的生产任务</h3>
          </div>
          <span className="statusPill">最近 5 条</span>
        </div>

        {!loading &&
        !errorMessage &&
        dashboardData?.activeProductionOrders.length === 0 ? (
          <div className="emptyState">暂无进行中的生产任务</div>
        ) : null}

        {!loading && dashboardData?.activeProductionOrders.length ? (
          <div className="tableWrap">
            <table className="dataTable" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>生产任务单号</th>
                  <th>SKU</th>
                  <th>计划生产数量</th>
                  <th>状态</th>
                  <th>预计完成日期</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.activeProductionOrders.map((order) => (
                  <tr key={order.id}>
                    <td>{order.production_order_no}</td>
                    <td>
                      <strong>{order.sku?.sku_code ?? "-"}</strong>
                      <span>{order.sku?.sku_name ?? "-"}</span>
                    </td>
                    <td>{formatQuantity(order.planned_quantity)}</td>
                    <td>
                      <span
                        className={`tablePill production-status-${order.status}`}
                      >
                        {getStatusLabel(productionStatusLabels, order.status)}
                      </span>
                    </td>
                    <td>{formatDate(order.planned_end_date)}</td>
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
            <p className="eyebrow">物料需求</p>
            <h3>缺料提醒</h3>
          </div>
          <span className="statusPill">最近 5 条</span>
        </div>

        {!loading &&
        !errorMessage &&
        dashboardData?.shortageMaterials.length === 0 ? (
          <div className="emptyState">暂无缺料提醒</div>
        ) : null}

        {!loading && dashboardData?.shortageMaterials.length ? (
          <div className="tableWrap">
            <table className="dataTable" style={{ minWidth: 760 }}>
              <thead>
                <tr>
                  <th>生产任务单号</th>
                  <th>原材料 SKU</th>
                  <th>缺料数量</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.shortageMaterials.map((material) => (
                  <tr className="shortageRow" key={material.id}>
                    <td>
                      {material.production_order?.production_order_no ?? "-"}
                    </td>
                    <td>
                      <strong>{material.material_sku?.sku_code ?? "-"}</strong>
                      <span>{material.material_sku?.sku_name ?? "-"}</span>
                    </td>
                    <td>{formatQuantity(material.shortage_quantity)}</td>
                    <td>
                      <span
                        className={`tablePill material-status-${material.status}`}
                      >
                        {getStatusLabel(materialStatusLabels, material.status)}
                      </span>
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
            <p className="eyebrow">库存追踪</p>
            <h3>最近库存流水</h3>
          </div>
          <span className="statusPill">最近 8 条</span>
        </div>

        {!loading &&
        !errorMessage &&
        dashboardData?.recentInventoryTransactions.length === 0 ? (
          <div className="emptyState">暂无库存流水</div>
        ) : null}

        {!loading && dashboardData?.recentInventoryTransactions.length ? (
          <div className="tableWrap">
            <table className="dataTable" style={{ minWidth: 920 }}>
              <thead>
                <tr>
                  <th>流水类型</th>
                  <th>SKU</th>
                  <th>仓库</th>
                  <th>数量</th>
                  <th>操作时间</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.recentInventoryTransactions.map((transaction) => (
                  <tr key={transaction.id}>
                    <td>
                      <span
                        className={`tablePill transaction-type-${transaction.transaction_type}`}
                      >
                        {getStatusLabel(
                          transactionTypeLabels,
                          transaction.transaction_type
                        )}
                      </span>
                    </td>
                    <td>
                      <strong>{transaction.sku?.sku_code ?? "-"}</strong>
                      <span>{transaction.sku?.sku_name ?? "-"}</span>
                    </td>
                    <td>
                      <strong>{transaction.warehouse?.name ?? "-"}</strong>
                      <span>{transaction.warehouse?.warehouse_code ?? "-"}</span>
                    </td>
                    <td className="quantityCell">
                      {formatSignedQuantity(transaction)}
                    </td>
                    <td>{formatDateTime(transaction.occurred_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </main>
  );
}
