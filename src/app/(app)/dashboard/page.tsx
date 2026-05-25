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

function DashboardChart() {
  return (
    <div className="dashboardChart">
      <svg viewBox="0 0 800 260" preserveAspectRatio="none">
        <path
          d="M0 210 C70 170 90 120 160 145 C225 170 260 72 340 95 C405 115 420 176 500 128 C575 82 610 108 680 62 C730 32 760 58 800 28 L800 260 L0 260 Z"
          fill="rgba(22, 119, 255, 0.15)"
        />
        <path
          d="M0 210 C70 170 90 120 160 145 C225 170 260 72 340 95 C405 115 420 176 500 128 C575 82 610 108 680 62 C730 32 760 58 800 28"
          fill="none"
          stroke="#1677ff"
          strokeWidth="4"
        />
      </svg>
      <div className="dashboardChartLabels">
        <span>05-19</span>
        <span>05-20</span>
        <span>05-21</span>
        <span>05-22</span>
        <span>05-23</span>
        <span>05-24</span>
        <span>05-25</span>
      </div>
    </div>
  );
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
        description={`今天是 ${todayText}。这里汇总 FBA 备货、生产、采购和库存的重点待办。`}
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
        {(dashboardData?.summaryCards ?? []).slice(0, 6).map((card, index) => (
          <Link href={card.href} key={card.id}>
            <StatCard
              title={card.label}
              value={formatQuantity(card.value)}
              change="点击处理"
              tone={getCardTone(card.tone)}
              icon={getCardIcon(index)}
            />
          </Link>
        ))}
      </section>

      {loading ? <div className="debugNotice">正在读取首页数据...</div> : null}

      {!loading && dashboardData ? (
        <>
          <section className="dashboardMainGrid">
            <div className="modernCard">
              <div className="modernCardHeader">
                <div>
                  <p className="eyebrow">业务趋势</p>
                  <h3>最近 7 天备货趋势</h3>
                </div>
                <div className="tabs">
                  <button className="tabButton active" type="button">
                    近7天
                  </button>
                  <button className="tabButton" type="button">
                    近30天
                  </button>
                </div>
              </div>
              <DashboardChart />
            </div>

            {firstTodoSection ? <TodoMiniList section={firstTodoSection} /> : null}
          </section>

          <section className="dashboardSecondaryGrid">
            {dashboardData.listSections.slice(1, 3).map((section) => (
              <TodoMiniList key={section.id} section={section} />
            ))}
            <ExceptionPanel exceptions={dashboardData.exceptions} />
          </section>

          <section className="modernCard">
            <div className="modernCardHeader">
              <div>
                <p className="eyebrow">最新业务单据</p>
                <h3>近期 FBA / 生产 / 采购 / 库存记录</h3>
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
