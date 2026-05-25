"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { DataTable, type DataTableColumn } from "@/components/ui/DataTable";
import { PageHeader } from "@/components/ui/PageHeader";
import { StatCard } from "@/components/ui/StatCard";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  BoxIcon,
  CartIcon,
  FactoryIcon,
  WarehouseIcon
} from "@/components/ui/icons";
import { useMockRole } from "@/components/auth/mock-role-provider";
import {
  getRoleDashboard,
  type DashboardException,
  type DashboardListSection,
  type DashboardSummaryCard,
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

function getCardTone(
  tone: DashboardSummaryCard["tone"]
): "blue" | "green" | "orange" | "red" | "purple" | "cyan" {
  if (tone === "success") {
    return "green";
  }
  if (tone === "warning") {
    return "orange";
  }
  if (tone === "danger") {
    return "red";
  }
  if (tone === "info") {
    return "blue";
  }

  return "purple";
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

function TodoMiniList({ section }: { section: DashboardListSection }) {
  return (
    <section className="modernCard">
      <div className="modernCardHeader">
        <div>
          <p className="eyebrow">{section.eyebrow}</p>
          <h3>{section.title}</h3>
        </div>
        <Link className="textLink" href={section.href}>
          查看全部
        </Link>
      </div>

      {section.items.length === 0 ? (
        <div className="emptyState">{section.emptyText}</div>
      ) : (
        <div className="todoList">
          {section.items.slice(0, 4).map((item) => (
            <Link className="todoItem" href={item.href} key={item.id}>
              <div className="todoItemIcon">
                <BoxIcon size={18} />
              </div>
              <div>
                <strong>{item.no}</strong>
                <span>{item.title}</span>
              </div>
              <StatusBadge status={item.status} label={item.statusLabel} />
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

function ExceptionPanel({ exceptions }: { exceptions: DashboardException[] }) {
  const activeExceptions = exceptions.filter((item) => item.count > 0);

  return (
    <section className="modernCard">
      <div className="modernCardHeader">
        <div>
          <p className="eyebrow">库存和异常</p>
          <h3>需要优先关注的卡点</h3>
        </div>
        <StatusBadge status={activeExceptions.length > 0 ? "shortage" : "normal"} label={`${activeExceptions.length} 类异常`} />
      </div>

      {activeExceptions.length === 0 ? (
        <div className="emptyState">当前没有超期、缺资料或低库存等异常提醒。</div>
      ) : (
        <div className="exceptionGrid modernExceptionGrid">
          {activeExceptions.slice(0, 6).map((item) => (
            <Link
              className={`exceptionCard exceptionCard-${item.tone}`}
              href={item.href}
              key={item.id}
            >
              <span>{item.label}</span>
              <strong>{formatQuantity(item.count)}</strong>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
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

const compactCardTitles = ["待排产", "生产中", "待采购", "待入库", "待出库", "库存预警"];
const compactCardSubtitles = ["备货单", "生产任务", "物料", "入库单", "出库单", "预警"];

function getCompactCard(
  card: DashboardSummaryCard,
  index: number
): DashboardSummaryCard & { shortTitle: string; shortDescription: string } {
  const id = card.id.toLowerCase();
  let title = compactCardTitles[index] ?? card.label;
  let description = compactCardSubtitles[index] ?? "待处理";

  if (id.includes("planning") || id.includes("submitted")) {
    title = "待排产";
    description = "备货单";
  } else if (id.includes("production") || id.includes("producing")) {
    title = "生产中";
    description = "生产任务";
  } else if (id.includes("shortage") || id.includes("supplier")) {
    title = "待采购";
    description = "物料";
  } else if (id.includes("inbound") || id.includes("ordered") || id.includes("purchase")) {
    title = "待入库";
    description = "入库单";
  } else if (id.includes("outbound")) {
    title = "待出库";
    description = "出库单";
  } else if (id.includes("stock") || id.includes("bom") || id.includes("overdue")) {
    title = "库存预警";
    description = "预警";
  }

  return {
    ...card,
    shortTitle: title,
    shortDescription: description
  };
}

export default function DashboardPage() {
  const { user } = useMockRole();
  const [dashboardData, setDashboardData] = useState<RoleDashboardData | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

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

  const firstTodoSection = dashboardData?.listSections[0] ?? null;
  const latestRows = dashboardData?.listSections.flatMap((section) =>
    section.items.slice(0, 3)
  ) ?? [];

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

      <section className="modernStatGrid">
        {(dashboardData?.summaryCards ?? []).slice(0, 6).map((card, index) => {
          const compactCard = getCompactCard(card, index);

          return (
          <Link href={card.href} key={card.id}>
            <StatCard
              title={compactCard.shortTitle}
              value={formatQuantity(card.value)}
              change={compactCard.shortDescription}
              tone={getCardTone(card.tone)}
              icon={getCardIcon(index)}
            />
          </Link>
        );
        })}
      </section>

      {loading ? <div className="debugNotice">正在读取首页数据...</div> : null}

      {!loading && dashboardData ? (
        <>
          <section className="dashboardWorkbenchGrid">
            {firstTodoSection ? <TodoMiniList section={firstTodoSection} /> : null}
            <ExceptionPanel exceptions={dashboardData.exceptions} />
          </section>

          <section className="dashboardSecondaryGrid">
            {dashboardData.listSections.slice(1, 4).map((section) => (
              <TodoMiniList key={section.id} section={section} />
            ))}
          </section>

          <section className="modernCard">
            <div className="modernCardHeader">
              <div>
                <p className="eyebrow">最新业务单据</p>
                <h3>近期备货 / 生产 / 采购 / 库存记录</h3>
              </div>
              <span className="statusPill">{latestRows.length} 条</span>
            </div>
            <DataTable
              columns={todoColumns}
              rows={latestRows}
              getRowKey={(item) => item.id}
              emptyText="暂无近期业务记录"
              minWidth={980}
            />
          </section>
        </>
      ) : null}
    </main>
  );
}
