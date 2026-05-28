"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { DetailDrawer } from "@/components/ui/detail-drawer";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  BoxIcon,
  CartIcon,
  ChevronRightIcon,
  FactoryIcon,
  WarehouseIcon
} from "@/components/ui/icons";
import { useMockRole } from "@/components/auth/mock-role-provider";
import {
  getRoleDashboard,
  type DashboardPipelineItem,
  type DashboardTodoItem,
  type RoleDashboardData
} from "@/lib/api/dashboard";
import { roleLabels } from "@/types/roles";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "读取首页待办失败，请稍后重试。";
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

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  return new Date(value).toLocaleString("zh-CN", {
    hour12: false
  });
}

function getTodayText() {
  return new Date().toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long"
  });
}

function getCardIcon(index: number) {
  const icons = [
    <BoxIcon size={20} key="box" />,
    <FactoryIcon size={20} key="factory" />,
    <CartIcon size={20} key="cart" />,
    <WarehouseIcon size={20} key="warehouse" />
  ];

  return icons[index % icons.length];
}

const todoColumns: DataTableColumn<DashboardTodoItem>[] = [
  {
    key: "no",
    title: "单号",
    render: (item) => <strong>{item.no}</strong>
  },
  {
    key: "brand",
    title: "品牌 / 来源",
    render: (item) => item.brand
  },
  {
    key: "title",
    title: "产品 / SKU",
    render: (item) => item.title
  },
  {
    key: "quantity",
    title: "数量",
    render: (item) =>
      item.quantity === null
        ? "-"
        : `${formatQuantity(item.quantity)} ${item.unit}`
  },
  {
    key: "status",
    title: "状态",
    render: (item) => <StatusBadge status={item.status} label={item.statusLabel} />
  },
  {
    key: "date",
    title: "日期",
    render: (item) => (
      <div>
        <strong>{formatDate(item.dateValue)}</strong>
        <span className="tableSubText">{item.dateLabel}</span>
      </div>
    )
  },
  {
    key: "action",
    title: "操作",
    render: (item) => (
      <Link className="textLink" href={item.href}>
        {item.actionLabel}
      </Link>
    )
  }
];

const recentColumns: DataTableColumn<DashboardTodoItem>[] = [
  {
    key: "no",
    title: "单号",
    render: (item) => (
      <Link className="textLink" href={item.href}>
        {item.no}
      </Link>
    )
  },
  {
    key: "status",
    title: "状态",
    render: (item) => <StatusBadge status={item.status} label={item.statusLabel} />
  },
  {
    key: "date",
    title: "日期",
    render: (item) => formatDate(item.dateValue)
  }
];

export default function DashboardPage() {
  const { user } = useMockRole();
  const [dashboardData, setDashboardData] = useState<RoleDashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [drawerItem, setDrawerItem] = useState<DashboardPipelineItem | null>(null);

  const todayText = useMemo(() => getTodayText(), []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const data = await getRoleDashboard(user.role);
      setDashboardData(data);
    } catch (error) {
      setDashboardData(null);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, [user.role]);

  const workbench = dashboardData?.workbench;
  const activeAlertParts = workbench?.alertSummary.parts.filter((item) => item.count > 0) ?? [];

  return (
    <main className="pageShell modernPageShell">
      <PageHeader
        eyebrow="工作台"
        title={`欢迎回来，${roleLabels[user.role]}`}
        description={`今天是 ${todayText}。这里汇总备货、生产、采购和库存的重点待办。`}
        actions={
          <button className="primaryButton" type="button" onClick={loadDashboard} disabled={loading}>
            {loading ? "刷新中..." : "刷新数据"}
          </button>
        }
      />

      {errorMessage ? (
        <div className="debugError">
          <strong>查询失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {loading ? <div className="debugNotice">正在读取首页数据...</div> : null}

      {!loading && workbench ? (
        <>
          <section className="workbenchKpiGrid" aria-label="首页快照">
            {workbench.kpiCards.map((card, index) => (
              <Link className={`workbenchKpi workbenchKpi-${card.tone}`} href={card.href} key={card.id}>
                <div className="workbenchKpiIcon">{getCardIcon(index)}</div>
                <div className="workbenchKpiBody">
                  <span>{card.title}</span>
                  <strong>
                    {formatQuantity(card.value)}
                    <small>{card.unit}</small>
                  </strong>
                  <p>{card.hint}</p>
                </div>
              </Link>
            ))}
          </section>

          <section className={`blockingBanner ${workbench.alertSummary.total > 0 ? "blockingBannerActive" : ""}`}>
            <div>
              <span>阻断性预警</span>
              <strong>
                {workbench.alertSummary.total > 0
                  ? `存在 ${formatQuantity(workbench.alertSummary.total)} 条阻塞事项，需要优先关注`
                  : "当前没有阻塞事项"}
              </strong>
              <p>
                {activeAlertParts.length > 0
                  ? activeAlertParts.map((item) => `${item.label} ${formatQuantity(item.count)} 条`).join("，")
                  : "库存、交期和采购暂未发现需要优先处理的异常。"}
              </p>
            </div>
            <Link className="primaryButton" href="/inventory/overview">
              立即处理
            </Link>
          </section>

          <section className="workbenchPipelineGrid" aria-label="核心业务管道">
            {workbench.pipelines.map((section) => (
              <section className="pipelineCard" key={section.id}>
                <div className="pipelineCardHeader">
                  <h3>{section.title}</h3>
                </div>
                <div className="pipelineList">
                  {section.items.map((item) => (
                    <button
                      className="pipelineItem"
                      key={item.id}
                      type="button"
                      onClick={() => setDrawerItem(item)}
                    >
                      <span className={`pipelineDot pipelineDot-${item.tone}`} />
                      <span>{item.label}</span>
                      <strong>{formatQuantity(item.count)}</strong>
                      <ChevronRightIcon size={16} />
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </section>

          <section className="recentBusinessGrid" aria-label="最近业务列表">
            {workbench.recentSections.map((section) => (
              <section className="modernCard recentBusinessCard" key={section.id}>
                <div className="modernCardHeader">
                  <h3>{section.title}</h3>
                  <Link className="textLink" href={section.href}>
                    查看全部
                  </Link>
                </div>
                <DataTable
                  columns={recentColumns}
                  rows={section.rows}
                  getRowKey={(item) => item.id}
                  emptyText={`暂无${section.title}`}
                  minWidth={360}
                />
              </section>
            ))}
          </section>

          <DetailDrawer
            open={drawerItem !== null}
            title={drawerItem?.label ?? ""}
            width="lg"
            onClose={() => setDrawerItem(null)}
            footer={
              drawerItem ? (
                <Link className="primaryButton" href={drawerItem.href} onClick={() => setDrawerItem(null)}>
                  查看全部
                </Link>
              ) : null
            }
          >
            {drawerItem ? (
              <DataTable
                columns={todoColumns}
                rows={drawerItem.items}
                getRowKey={(item) => item.id}
                emptyText={drawerItem.emptyText}
                minWidth={760}
              />
            ) : null}
          </DetailDrawer>
        </>
      ) : null}
    </main>
  );
}
