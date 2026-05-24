import type { UserRole } from "@/types/roles";

export type NavigationItem = {
  label: string;
  href: string;
  roles: UserRole[];
  variant?: "primary";
};

export type NavigationGroup = {
  label: string;
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
    label: "首页",
    href: "/dashboard",
    roles: allRoles,
    items: []
  },
  {
    label: "FBA 备货需求",
    href: "/replenishment",
    roles: ["operations", "plant_manager", "admin"],
    variant: "primary",
    items: []
  },
  {
    label: "生产管理",
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
        label: "BOM 管理",
        href: "/bom",
        roles: ["plant_manager", "procurement", "admin"]
      },
      {
        label: "物料需求",
        href: "/materials/requirements",
        roles: ["plant_manager", "procurement", "warehouse", "admin"]
      }
    ]
  },
  {
    label: "采购管理",
    items: [
      {
        label: "采购单",
        href: "/purchase/orders",
        roles: ["procurement", "admin"]
      },
      {
        label: "供应商管理",
        href: "/admin/suppliers",
        roles: ["admin"]
      }
    ]
  },
  {
    label: "仓库库存",
    items: [
      {
        label: "入库管理",
        href: "/inventory/inbound",
        roles: ["warehouse", "procurement", "plant_manager", "admin"]
      },
      {
        label: "FBA 出库",
        href: "/inventory/fba-outbound",
        roles: ["warehouse", "operations", "admin"]
      },
      {
        label: "原材料库存",
        href: "/inventory/materials",
        roles: ["warehouse", "procurement", "admin"]
      },
      {
        label: "成品库存",
        href: "/inventory/products",
        roles: ["warehouse", "operations", "admin"]
      },
      {
        label: "库存流水",
        href: "/inventory/transactions",
        roles: ["warehouse", "plant_manager", "procurement", "admin"]
      },
      {
        label: "库存调整",
        href: "/inventory/adjustments",
        roles: ["warehouse", "plant_manager", "procurement", "admin"]
      }
    ]
  },
  {
    label: "基础资料",
    items: [
      { label: "产品管理", href: "/admin/products", roles: ["admin"] },
      { label: "SKU 管理", href: "/admin/skus", roles: ["admin"] },
      {
        label: "仓库管理",
        href: "/admin/warehouses",
        roles: ["warehouse", "admin"]
      }
    ]
  },
  {
    label: "系统管理",
    items: [
      { label: "用户管理", href: "/admin/users", roles: ["admin"] }
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
