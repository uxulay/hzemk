import type { UserRole } from "@/types/roles";

export type NavigationItem = {
  label: string;
  href: string;
  roles: UserRole[];
  variant?: "primary";
};

export type NavigationGroup = {
  label: string;
  section?: string;
  href?: string;
  roles?: UserRole[];
  variant?: "primary";
  items: NavigationItem[];
};

const allRoles: UserRole[] = [
  "operations",
  "plant_manager",
  "procurement",
  "warehouse",
  "admin"
];

export const navigationGroups: NavigationGroup[] = [
  {
    label: "工作台",
    section: "核心",
    href: "/dashboard",
    roles: allRoles,
    items: []
  },
  {
    label: "业务",
    section: "业务",
    items: [
      {
        label: "备货需求",
        href: "/replenishment",
        roles: ["operations", "plant_manager", "admin"]
      }
    ]
  },
  {
    label: "生产",
    section: "生产",
    items: [
      {
        label: "厂长排产",
        href: "/production/planning",
        roles: ["plant_manager", "admin"]
      },
      {
        label: "生产任务",
        href: "/production/orders",
        roles: ["plant_manager", "warehouse", "admin"]
      },
      {
        label: "生产入库",
        href: "/inventory/inbound?tab=production",
        roles: ["warehouse", "plant_manager", "admin"]
      }
    ]
  },
  {
    label: "采购",
    section: "采购",
    items: [
      {
        label: "采购单",
        href: "/purchase/orders",
        roles: ["procurement", "admin"]
      },
      {
        label: "采购入库",
        href: "/inventory/inbound?tab=purchase",
        roles: ["warehouse", "procurement", "admin"]
      }
    ]
  },
  {
    label: "仓库",
    section: "仓库",
    items: [
      {
        label: "备货出库",
        href: "/inventory/fba-outbound",
        roles: ["warehouse", "operations", "admin"]
      },
      {
        label: "原材料库存",
        href: "/inventory/materials",
        roles: ["warehouse", "procurement", "plant_manager", "admin"]
      },
      {
        label: "成品库存",
        href: "/inventory/products",
        roles: ["warehouse", "operations", "plant_manager", "admin"]
      },
      {
        label: "库存流水",
        href: "/inventory/transactions",
        roles: ["warehouse", "plant_manager", "procurement", "admin"]
      },
      {
        label: "库存预警",
        href: "/inventory/warnings",
        roles: ["warehouse", "procurement", "operations", "plant_manager", "admin"]
      },
      {
        label: "库存调整",
        href: "/inventory/adjustments",
        roles: ["warehouse", "plant_manager", "procurement", "admin"]
      }
    ]
  },
  {
    label: "基础",
    section: "基础",
    items: [
      { label: "产品管理", href: "/admin/products", roles: ["admin"] },
      { label: "SKU 管理", href: "/admin/skus", roles: ["admin"] },
      {
        label: "BOM 管理",
        href: "/bom",
        roles: ["plant_manager", "procurement", "admin"]
      },
      {
        label: "原材料管理",
        href: "/admin/materials",
        roles: ["admin", "procurement", "warehouse"]
      },
      {
        label: "品牌管理",
        href: "/admin/brands",
        roles: ["admin"]
      },
      {
        label: "供应商管理",
        href: "/admin/suppliers",
        roles: ["admin", "procurement"]
      },
      {
        label: "仓库管理",
        href: "/admin/warehouses",
        roles: ["warehouse", "admin"]
      }
    ]
  },
  {
    label: "系统",
    section: "系统",
    items: [
      { label: "用户管理", href: "/admin/users", roles: ["admin"] },
      { label: "角色权限", href: "/admin/roles", roles: ["admin"] },
      { label: "系统设置", href: "/admin/settings", roles: ["admin"] }
    ]
  }
];

export function getNavigationForRole(role: UserRole): NavigationGroup[] {
  return navigationGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(role))
    }))
    .filter(
      (group) =>
        group.items.length > 0 ||
        Boolean(group.href && group.roles?.includes(role))
    );
}
