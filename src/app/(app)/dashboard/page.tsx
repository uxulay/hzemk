"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  getRoleDashboard,
  type DashboardException,
  type DashboardListSection,
  type DashboardSummaryCard,
  type DashboardTodoItem,
  type RoleDashboardData
} from "@/lib/api/dashboard";
import { useMockRole } from "@/components/auth/mock-role-provider";
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

function getStatusClass(status: string) {
  if (
    status === "planned" ||
    status === "material_pending" ||
    status === "in_progress" ||
    status === "completed" ||
    status === "cancelled"
  ) {
    return `production-status-${status}`;
  }

  if (
    status === "pending" ||
    status === "ready" ||
    status === "enough" ||
    status === "shortage" ||
    status === "purchased" ||
    status === "reserved" ||
    status === "received"
  ) {
    return `material-status-${status}`;
  }

  if (
    status === "ordered" ||
    status === "partially_received" ||
    status === "received"
  ) {
    return `purchase-status-${status}`;
  }

  if (
    status === "material_in" ||
    status === "material_out" ||
    status === "product_in" ||
    status === "product_out" ||
    status === "adjustment"
  ) {
    return `transaction-type-${status}`;
  }

  if (
    status === "out_of_stock" ||
    status === "low_stock" ||
    status === "normal"
  ) {
    return `inventory-status-${status}`;
  }

  return `status-${status}`;
}

function SummaryCard({ card }: { card: DashboardSummaryCard }) {
  return (
    <Link className={`metric todoMetric todoMetric-${card.tone}`} href={card.href}>
      <span>{card.label}</span>
      <strong>{formatQuantity(card.value)}</strong>
      <small>点击处理</small>
    </Link>
  );
}

function TodoTable({ section }: { section: DashboardListSection }) {
  return (
    <section className="listPanel">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">{section.eyebrow}</p>
          <h3>{section.title}</h3>
        </div>
        <Link className="statusPill linkPill" href={section.href}>
          查看全部
        </Link>
      </div>

      {section.items.length === 0 ? (
        <div className="emptyState">{section.emptyText}</div>
      ) : (
        <div className="tableWrap">
          <table className="dataTable dashboardTodoTable">
            <thead>
              <tr>
                <th>单号</th>
                <th>品牌 / 来源</th>
                <th>产品 / SKU</th>
                <th>数量</th>
                <th>状态</th>
                <th>日期</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {section.items.map((item) => (
                <TodoRow item={item} key={item.id} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function TodoRow({ item }: { item: DashboardTodoItem }) {
  return (
    <tr>
      <td>
        <strong>{item.no}</strong>
      </td>
      <td>{item.brand}</td>
      <td>{item.title}</td>
      <td className="quantityCell">
        {item.quantity === null
          ? "-"
          : `${formatQuantity(item.quantity)} ${item.unit}`}
      </td>
      <td>
        <span className={`tablePill ${getStatusClass(item.status)}`}>
          {item.statusLabel}
        </span>
      </td>
      <td>
        <strong>{formatDate(item.dateValue)}</strong>
        <span>{item.dateLabel}</span>
      </td>
      <td>
        <Link className="textLink" href={item.href}>
          {item.actionLabel}
        </Link>
      </td>
    </tr>
  );
}

function ExceptionPanel({
  exceptions
}: {
  exceptions: DashboardException[];
}) {
  const activeExceptions = exceptions.filter((item) => item.count > 0);

  return (
    <section className="listPanel">
      <div className="sectionHeader">
        <div>
          <p className="eyebrow">异常提醒</p>
          <h3>需要优先关注的卡点</h3>
        </div>
        <span className="statusPill">{activeExceptions.length} 类异常</span>
      </div>

      {activeExceptions.length === 0 ? (
        <div className="emptyState">当前没有超期、缺资料或低库存等异常提醒。</div>
      ) : (
        <div className="exceptionGrid">
          {activeExceptions.map((item) => (
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

  return (
    <main className="pageShell">
      <section className="pageHero">
        <div>
          <p className="eyebrow">今日待办中心</p>
          <h2>{roleLabels[user.role]}首页</h2>
          <p>
            今天是 {todayText}。当前使用模拟角色：
            {roleLabels[user.role]}，你有{" "}
            {loading && !dashboardData
              ? "正在读取"
              : formatQuantity(dashboardData?.totalTodoCount ?? 0)}{" "}
            个待处理事项。
          </p>
        </div>
        <div className="rowActions dashboardHeroActions">
          <span className="statusPill">MockRoleProvider</span>
          <button type="button" onClick={loadDashboard} disabled={loading}>
            {loading ? "刷新中..." : "刷新待办"}
          </button>
        </div>
      </section>

      {errorMessage ? (
        <div className="debugError">
          <strong>查询失败</strong>
          <p>{errorMessage}</p>
        </div>
      ) : null}

      {dashboardData ? (
        <>
          <section className="quickLinkBar">
            <span>快捷入口</span>
            <div>
              {dashboardData.quickLinks.map((link) => (
                <Link href={link.href} key={link.href}>
                  {link.label}
                </Link>
              ))}
            </div>
          </section>

          <section className="metricGrid dashboardMetricGrid">
            {dashboardData.summaryCards.map((card) => (
              <SummaryCard card={card} key={card.id} />
            ))}
          </section>
        </>
      ) : null}

      {loading ? (
        <div className="debugNotice">正在读取当前角色的首页待办，请稍候...</div>
      ) : null}

      {!loading && !errorMessage && dashboardData ? (
        <>
          <div className="dashboardListGrid">
            {dashboardData.listSections.slice(0, 4).map((section) => (
              <TodoTable key={section.id} section={section} />
            ))}
          </div>

          {dashboardData.listSections.length > 4 ? (
            <div className="dashboardListGrid">
              {dashboardData.listSections.slice(4).map((section) => (
                <TodoTable key={section.id} section={section} />
              ))}
            </div>
          ) : null}

          <ExceptionPanel exceptions={dashboardData.exceptions} />
        </>
      ) : null}
    </main>
  );
}
