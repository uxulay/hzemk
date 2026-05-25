import {
  getRoleDashboard,
  type DashboardException,
  type DashboardListSection,
  type DashboardTodoItem
} from "@/lib/api/dashboard";
import type { UserRole } from "@/types/roles";

export type AppNotificationTone = "blue" | "green" | "orange" | "red" | "gray";

export type AppNotification = {
  id: string;
  title: string;
  description: string;
  timeLabel: string;
  href: string;
  tone: AppNotificationTone;
};

function formatTime(value: string | null) {
  if (!value) {
    return "刚刚";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  });
}

function getTone(status: string): AppNotificationTone {
  if (["shortage", "rejected", "cancelled", "out_of_stock"].includes(status)) {
    return "red";
  }

  if (["pending", "draft", "material_pending", "low_stock"].includes(status)) {
    return "orange";
  }

  if (["completed", "received", "shipped", "normal"].includes(status)) {
    return "green";
  }

  return "blue";
}

function sectionToNotifications(section: DashboardListSection) {
  return section.items.slice(0, 3).map((item: DashboardTodoItem) => ({
    id: `todo-${section.id}-${item.id}`,
    title: section.title,
    description: `${item.no} · ${item.title} · ${item.statusLabel}`,
    timeLabel: formatTime(item.dateValue),
    href: item.href,
    tone: getTone(item.status)
  }));
}

function exceptionToNotification(item: DashboardException): AppNotification | null {
  if (item.count <= 0) {
    return null;
  }

  return {
    id: `exception-${item.id}`,
    title: item.label,
    description: `当前有 ${item.count} 条需要处理`,
    timeLabel: "实时",
    href: item.href,
    tone: item.tone === "danger" ? "red" : item.tone === "warning" ? "orange" : "blue"
  };
}

export async function getAppNotifications(role: UserRole): Promise<AppNotification[]> {
  const dashboard = await getRoleDashboard(role);
  const todoNotifications = dashboard.listSections.flatMap(sectionToNotifications);
  const exceptionNotifications = dashboard.exceptions
    .map(exceptionToNotification)
    .filter((item): item is AppNotification => Boolean(item));

  return [...exceptionNotifications, ...todoNotifications].slice(0, 12);
}
